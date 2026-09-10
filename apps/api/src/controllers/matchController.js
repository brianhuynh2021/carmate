import { getTrips, getTripById, getTripsForUser } from '../db/sqliteStore.js';
import { sanitizeTripForPublic } from './tripController.js';
import { ROUTE_BENCHMARKS, cleanPhoneNumber } from '@carmate/shared';

export function calculateFuelSavings(routeCategory, seats = 1) {
  const benchmark = ROUTE_BENCHMARKS[routeCategory];
  const rate = (benchmark && benchmark.suggestedRate) ? benchmark.suggestedRate : 150000;
  const savingsVnd = Math.round(rate * (seats || 1) * 0.6);
  return {
    savingsVnd,
    savingsVndFormatted: `Tiết kiệm ~${(savingsVnd / 1000).toLocaleString('vi-VN')}k xăng`,
    estimatedRateVnd: rate
  };
}

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

/**
 * GET /api/matches/social-suggestions
 * Gợi ý bạn đồng hành thông minh cho feed mạng xã hội (Kiểu TikTok / Facebook Reels)
 * Tự động tìm kiếm bạn đồng hành đối ứng phù hợp nhất cho chuyến của người dùng.
 */
export function getSocialSuggestions(req, res) {
  try {
    const { tripId, routeCategory, excludeIds = '', limit = 10 } = req.query;
    const excludedSet = new Set(
      excludeIds
        ? excludeIds
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : []
    );

    let anchorTrip = null;
    if (tripId) {
      anchorTrip = getTripById(tripId);
    }

    // Nếu không có tripId cụ thể nhưng có user đăng nhập, lấy chuyến mới nhất của user làm mỏ neo
    if (!anchorTrip && req.user) {
      const userTrips = getTripsForUser(req.user);
      if (userTrips && userTrips.length > 0) {
        anchorTrip = userTrips.find((t) => !t.status || (t.status !== 'cancelled' && t.status !== 'completed')) || userTrips[0];
      }
    }

    let targetRole = 'all';
    let targetRoute = routeCategory;
    let targetDirection = undefined;

    if (anchorTrip) {
      targetRole = anchorTrip.type === 'driver_offer' ? 'passengers' : 'drivers';
      targetRoute = anchorTrip.routeCategory || targetRoute;
      targetDirection = anchorTrip.direction;
    }

    // Lấy danh sách ứng viên đối ứng
    const candidateType = targetRole === 'passengers' ? 'passengers' : (targetRole === 'drivers' ? 'drivers' : undefined);
    const candidates = getTrips({
      type: candidateType,
      routeCategory: targetRoute && targetRoute !== 'all' ? targetRoute : undefined,
      direction: targetDirection && targetDirection !== 'all' ? targetDirection : undefined,
      includeHidden: false
    })
      .filter((c) => !c.status || (c.status !== 'cancelled' && c.status !== 'completed'))
      .filter((c) => !excludedSet.has(c.id))
      .filter((c) => {
        // Loại trừ chính mình
        if (anchorTrip && c.id === anchorTrip.id) return false;
        if (req.user) {
          const userPhone = cleanPhoneNumber(req.user.phone || '');
          const cPhone = cleanPhoneNumber(c.phoneReal || c.phone || '');
          if (userPhone && cPhone && userPhone === cPhone) return false;
          if (req.user.id && c.userId && req.user.id === c.userId) return false;
        }
        return true;
      });

    // Tính điểm tương đồng & Gắn thẻ Social
    const suggestions = candidates.map((item) => {
      let score = 75; // Cùng tuyến đường
      const socialTags = [];

      if (anchorTrip) {
        if (anchorTrip.direction && item.direction && anchorTrip.direction === item.direction) {
          score += 10;
        }
        if (anchorTrip.timeSlot && item.timeSlot && anchorTrip.timeSlot === item.timeSlot) {
          score += 10;
          socialTags.push('Cùng khung giờ');
        }
        if (anchorTrip.hometown && item.hometown && anchorTrip.hometown.trim().toLowerCase() === item.hometown.trim().toLowerCase()) {
          score += 5;
          socialTags.push(`Đồng hương ${anchorTrip.hometown}`);
        }
      } else {
        if (item.timeSlot) socialTags.push('Giờ tiện lợi');
      }

      if (item.trustScore && item.trustScore >= 95) {
        socialTags.push('Tín nhiệm cao');
      }

      const seats = item.type === 'driver_offer' ? (item.availableSeats || 3) : (item.seatsNeeded || 1);
      const fuelSavings = calculateFuelSavings(item.routeCategory || targetRoute || 'Tuyến QL13', seats);

      return {
        id: item.id,
        score: Math.min(99, score),
        trip: sanitizeTripForPublic(item, req.user),
        anchorTripId: anchorTrip?.id || null,
        fuelSavings,
        socialTags
      };
    });

    // Sắp xếp điểm cao nhất
    suggestions.sort((a, b) => b.score - a.score);
    const limitedSuggestions = suggestions.slice(0, Number(limit) || 10);

    return res.status(200).json({
      success: true,
      count: limitedSuggestions.length,
      anchorTrip: anchorTrip ? sanitizeTripForPublic(anchorTrip, req.user) : null,
      data: limitedSuggestions
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
