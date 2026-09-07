import { getTrips } from '../db/sqliteStore.js';
import { sanitizeTripForPublic } from './tripController.js';

// Cache kết quả tìm kiếm so khớp trong 5 giây để giảm tải truy vấn đồng thời
const matchCache = new Map();
const MATCH_CACHE_TTL_MS = 5000;

/**
 * GET /api/matches - Thuật toán Radar so khớp 2 chiều tối ưu O(N+M)
 * Sử dụng Route-Direction Hash Bucket Lookup thay vì lặp lồng O(N*M)
 */
export function getMatches(req, res) {
  try {
    const { route, direction, role = 'all' } = req.query;
    const cacheKey = `${route || 'all'}_${direction || 'all'}_${role}`;
    const now = Date.now();

    const cached = matchCache.get(cacheKey);
    if (cached && now - cached.timestamp < MATCH_CACHE_TTL_MS) {
      // Bảo đảm sanitize PII theo người dùng hiện tại
      const sanitizedMatches = cached.data.matches.map((m) => ({
        ...m,
        driver: sanitizeTripForPublic(m.driver, req.user),
        passenger: sanitizeTripForPublic(m.passenger, req.user)
      }));
      return res.status(200).json({
        success: true,
        count: sanitizedMatches.length,
        cached: true,
        data: {
          ...cached.data,
          matches: sanitizedMatches
        }
      });
    }

    // 1. Lọc từ SQL với giới hạn tải (Tối đa 150 bài đăng gần nhất mỗi vai trò)
    const rawDrivers = getTrips({
      type: 'drivers',
      routeCategory: route && route !== 'all' ? route : undefined,
      direction: direction && direction !== 'all' ? direction : undefined,
      includeHidden: false
    }).slice(0, 150);

    const rawPassengers = getTrips({
      type: 'passengers',
      routeCategory: route && route !== 'all' ? route : undefined,
      direction: direction && direction !== 'all' ? direction : undefined,
      includeHidden: false
    }).slice(0, 150);

    const drivers = rawDrivers.filter((d) => !d.status || (d.status !== 'cancelled' && d.status !== 'completed'));
    const passengers = rawPassengers.filter((p) => !p.status || (p.status !== 'cancelled' && p.status !== 'completed'));

    // 2. Gom nhóm hành khách vào Hash Map theo [routeCategory#direction] -> O(M)
    const passengerBucketMap = new Map();
    for (const pass of passengers) {
      const bucketKey = `${pass.routeCategory || ''}#${pass.direction || ''}`;
      if (!passengerBucketMap.has(bucketKey)) {
        passengerBucketMap.set(bucketKey, []);
      }
      passengerBucketMap.get(bucketKey).push(pass);
    }

    // 3. Quét qua Chủ xe và tra cứu O(1) vào bucket tương ứng -> O(N)
    const matchedPairs = [];

    for (const driver of drivers) {
      const bucketKey = `${driver.routeCategory || ''}#${driver.direction || ''}`;
      const candidates = passengerBucketMap.get(bucketKey);
      if (!candidates || candidates.length === 0) continue;

      for (const pass of candidates) {
        let score = 70; // Tuyến đường và chiều di chuyển khớp nhau
        const reasons = ['Cùng tuyến quốc lộ'];

        if (driver.timeSlot && pass.timeSlot && driver.timeSlot === pass.timeSlot) {
          score += 25;
          reasons.push('Khớp hoàn hảo khung giờ xuất phát');
        }

        if ((driver.availableSeats || 3) >= (pass.seatsNeeded || 1)) {
          score += 5;
          reasons.push('Đủ ghế trống đáp ứng yêu cầu');
        }

        if (
          driver.hometown &&
          pass.hometown &&
          driver.hometown.trim().toLowerCase() === pass.hometown.trim().toLowerCase()
        ) {
          score = Math.min(100, score + 5);
          reasons.push(`Đồng hương ${driver.hometown}`);
        }

        matchedPairs.push({
          pairId: `MATCH-${driver.id}-${pass.id}`,
          score,
          reasons,
          routeCategory: driver.routeCategory,
          direction: driver.direction,
          driver,
          passenger: pass,
          createdAt: Math.max(driver.createdAt || 0, pass.createdAt || 0)
        });
      }
    }

    // 4. Sắp xếp điểm tương thích cao nhất và giới hạn tối đa 50 cặp tốt nhất
    matchedPairs.sort((a, b) => b.score - a.score);
    const topMatches = matchedPairs.slice(0, 50);

    const responsePayload = {
      matches: topMatches,
      totalDriversAvailable: drivers.length,
      totalPassengersWaiting: passengers.length
    };

    // Lưu cache ngắn hạn
    matchCache.set(cacheKey, {
      timestamp: now,
      data: responsePayload
    });

    // Dọn dẹp cache nếu vượt quá 100 queries
    if (matchCache.size > 100) {
      const oldestKey = matchCache.keys().next().value;
      matchCache.delete(oldestKey);
    }

    // 5. Sanitize PII trước khi trả về client
    const sanitizedMatches = topMatches.map((m) => ({
      ...m,
      driver: sanitizeTripForPublic(m.driver, req.user),
      passenger: sanitizeTripForPublic(m.passenger, req.user)
    }));

    return res.status(200).json({
      success: true,
      count: sanitizedMatches.length,
      data: {
        matches: sanitizedMatches,
        totalDriversAvailable: drivers.length,
        totalPassengersWaiting: passengers.length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
