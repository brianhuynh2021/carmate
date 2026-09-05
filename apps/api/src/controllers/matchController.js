import { getDB } from '../db/sqliteStore.js';

/**
 * GET /api/matches - Thuật toán Radar so khớp 2 chiều tự động
 */
export function getMatches(req, res) {
  try {
    const { route, direction, role = 'all' } = req.query;
    const db = getDB();

    let drivers = db.driverOffers.filter((d) => d.status !== 'cancelled' && d.status !== 'completed');
    let passengers = db.passengerRequests.filter((p) => p.status !== 'cancelled' && p.status !== 'completed');

    if (route && route !== 'all') {
      drivers = drivers.filter((d) => d.routeCategory === route);
      passengers = passengers.filter((p) => p.routeCategory === route);
    }

    if (direction && direction !== 'all') {
      drivers = drivers.filter((d) => d.direction === direction);
      passengers = passengers.filter((p) => p.direction === direction);
    }

    const matchedPairs = [];

    drivers.forEach((driver) => {
      passengers.forEach((pass) => {
        if (driver.routeCategory === pass.routeCategory && driver.direction === pass.direction) {
          let score = 70; // Cùng tuyến đường chính
          const reasons = ['Cùng tuyến quốc lộ'];

          if (driver.timeSlot === pass.timeSlot) {
            score += 25;
            reasons.push('Khớp hoàn hảo khung giờ xuất phát');
          }

          if ((driver.availableSeats || 3) >= (pass.seatsNeeded || 1)) {
            score += 5;
            reasons.push('Đủ ghế trống đáp ứng yêu cầu');
          }

          if (driver.hometown && pass.hometown && driver.hometown.toLowerCase() === pass.hometown.toLowerCase()) {
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
      });
    });

    // Sắp xếp điểm tương thích cao nhất lên đầu
    matchedPairs.sort((a, b) => b.score - a.score);

    return res.status(200).json({
      success: true,
      count: matchedPairs.length,
      data: {
        matches: matchedPairs,
        totalDriversAvailable: drivers.length,
        totalPassengersWaiting: passengers.length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
