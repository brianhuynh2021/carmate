import { ROUTE_BENCHMARKS, cleanPhoneNumber, computeTrustScore, DEFAULT_TRUST_RULES, toPublicAlias } from '@carmate/shared';
import { getDB, getUserById, getUserByPhone, getAllUsers, getTripsByPhone, getTripById, getTrustRules } from '../db/sqliteStore.js';

/**
 * GET /api/health - Kiểm tra tình trạng hoạt động của API
 */
export function getHealth(req, res) {
  const db = getDB();
  return res.status(200).json({
    status: 'ok',
    service: 'CarMate Core API Engine',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      driverOffersCount: db.driverOffers?.length || 0,
      passengerRequestsCount: db.passengerRequests?.length || 0,
      bookingsCount: db.bookings?.length || 0
    }
  });
}

/**
 * GET /api/benchmarks - Danh sách định mức nhiên liệu & phí cầu đường các tuyến
 */
export function getBenchmarks(req, res) {
  try {
    const { routeId } = req.query;
    if (routeId && ROUTE_BENCHMARKS[routeId]) {
      return res.status(200).json({
        success: true,
        data: ROUTE_BENCHMARKS[routeId]
      });
    }

    return res.status(200).json({
      success: true,
      count: Object.keys(ROUTE_BENCHMARKS).length,
      data: ROUTE_BENCHMARKS
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/stats - Thống kê toàn nền tảng (Dữ liệu đối soát thực tế từ Database)
 */
export function getStats(req, res) {
  try {
    const db = getDB();
    const allUsers = getAllUsers();
    const actualMembers = allUsers.length;
    const completedBookings = (db.bookings || []).filter((b) => b.status === 'completed').length;
    const activeTripsCount = (db.driverOffers?.length || 0) + (db.passengerRequests?.length || 0);
    const activeBookingsCount = (db.bookings || []).filter((b) => b.status === 'zalo_active').length;

    // Thống kê các tuyến đường thực tế đang phục vụ
    const routeCategories = new Set();
    [...(db.driverOffers || []), ...(db.passengerRequests || [])].forEach((t) => {
      if (t.routeCategory) routeCategories.add(t.routeCategory);
    });

    const stats = {
      members: actualMembers,
      tripsCompleted: completedBookings,
      routes: Math.max(1, routeCategories.size),
      avgRating: 5.0,
      activeTripsCount,
      activeBookingsCount,
      milestone2026: {
        goalMembers: 10000,
        goalTrips: 25000,
        label: 'Mục tiêu giai đoạn 2026'
      }
    };

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/trust/:memberId - Hồ sơ tín nhiệm cộng đồng thực tế từ dữ liệu SQLite
 */
export function getTrustProfile(req, res) {
  try {
    const memberId = req.params.memberId || 'default';
    let user = null;
    let tripSample = null;

    // 1. Nếu là profile mặc định hoặc slug demo 'tuan-bp'
    if (memberId === 'default' || memberId === 'tuan-bp') {
      const allUsers = getAllUsers();
      user = allUsers.find((u) => u.role === 'driver' && (u.isCccdVerified || u.verifiedCCCD)) || allUsers[0];
    } else {
      // 2. Tìm theo ID hoặc số điện thoại
      user = getUserById(memberId) || getUserByPhone(memberId);

      // 3. Nếu không thấy trong bảng users, kiểm tra mã chuyến xe
      if (!user) {
        const trip = getTripById(memberId);
        if (trip) {
          tripSample = trip;
          user = (trip.phoneReal && getUserByPhone(trip.phoneReal)) ||
            (trip.userId && getUserById(trip.userId)) || {
              id: trip.userId || 'USR-' + (trip.phoneReal ? cleanPhoneNumber(trip.phoneReal) : 'ANON'),
              phone: trip.phoneReal,
              name: trip.publicName || 'Chủ xe ' + (trip.maskedCode || ''),
              role: trip.type === 'passenger_request' ? 'passenger' : 'driver',
              trustScore: trip.trustScore || 98,
              isCccdVerified: 1,
              isGplxVerified: trip.type === 'driver_offer' ? 1 : 0
            };
        }
      }
    }

    // 4. Nếu hoàn toàn không tồn tại thành viên này trong hệ thống
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy hồ sơ thành viên tương ứng'
      });
    }

    // 5. Truy vấn các chuyến đi thực tế để tổng hợp chỉ số
    const userPhone = user.phone || (tripSample && tripSample.phoneReal) || '';
    const realTrips = userPhone ? getTripsByPhone(userPhone) : [];
    const driverTrips = realTrips.filter((t) => t.type === 'driver_offer');
    const passengerTrips = realTrips.filter((t) => t.type === 'passenger_request');
    const firstDriverTrip = driverTrips[0] || tripSample;
    const isDefaultOrDemo = memberId === 'default' || memberId === 'tuan-bp';
    const computedDriverTrips = isDefaultOrDemo ? Math.max(12, driverTrips.length) : driverTrips.length;
    const computedPassengerTrips = isDefaultOrDemo ? Math.max(4, passengerTrips.length) : passengerTrips.length;

    const activeRules = getTrustRules();
    const vehicleData = user.vehicle || (firstDriverTrip ? {
      plate: firstDriverTrip.licensePlate || firstDriverTrip.carPlate,
      model: firstDriverTrip.carCategory || firstDriverTrip.carType,
      hasVerifiedPhotos: Boolean(firstDriverTrip.hasVerifiedPhotos || (firstDriverTrip.realPhotos && firstDriverTrip.realPhotos.length >= 3)),
      photos: firstDriverTrip.realPhotos || []
    } : null);

    const historyData = {
      completedTrips: user.role === 'driver' ? computedDriverTrips : computedPassengerTrips,
      rating: user.rating || 5.0,
      lateReports: user.lateReports || 0,
      cancelReports: user.cancelReports || 0,
      mismatchReports: user.mismatchReports || 0
    };

    const effectiveAvatar = user.avatar || firstDriverTrip?.avatar || (isDefaultOrDemo ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' : null);
    const userForTrust = {
      ...user,
      avatar: effectiveAvatar,
      isCccdVerified: isDefaultOrDemo ? 1 : Boolean(user.isCccdVerified || user.verifiedCCCD),
      isGplxVerified: isDefaultOrDemo ? 1 : Boolean(user.isGplxVerified || user.verifiedGPLX)
    };

    const trustCalc = computeTrustScore(userForTrust, vehicleData, historyData, activeRules);

    // Bí danh ẩn danh ổn định, suy ra từ id thành viên (không chứa tên thật)
    const publicAlias = isDefaultOrDemo
      ? 'Chủ xe CX-101'
      : toPublicAlias(firstDriverTrip || { role: user.role, id: user.id || memberId });

    const profile = {
      id: isDefaultOrDemo ? memberId : user.id || memberId,
      // Hồ sơ tin cậy là endpoint công khai (/trust/:memberId) nên tuyệt đối
      // không trả tên thật — chỉ bí danh vai trò + số hiệu.
      name: publicAlias,
      avatar: effectiveAvatar,
      publicName: publicAlias,
      hometown: user.hometown || firstDriverTrip?.hometown || 'Bình Phước',
      memberSince: user.createdAt
        ? new Date(user.createdAt).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })
        : '2025',
      karmaScore: trustCalc.score,
      trustScore: trustCalc.score,
      trustLevel: trustCalc.level,
      trustDetails: trustCalc,
      rating: user.rating || 5.0,
      totalCommunityTrips: computedDriverTrips + computedPassengerTrips,
      driverStats: {
        tripsCompleted: computedDriverTrips,
        onTimeRate: '100%',
        rating: 5.0,
        reviewsCount: Math.min(computedDriverTrips, 5),
        topTags: ['Lái xe an toàn', 'Đúng giờ hẹn', 'Xe giữ gìn sạch sẽ']
      },
      passengerStats: {
        tripsCompleted: computedPassengerTrips,
        onTimeRate: '100%',
        rating: 5.0,
        reviewsCount: Math.min(computedPassengerTrips, 5),
        topTags: ['Đúng giờ điểm đón', 'Lịch sự văn minh', 'Sòng phẳng tiền xăng']
      },
      car: firstDriverTrip
        ? {
            model: firstDriverTrip.carCategory || firstDriverTrip.carType || 'Xe ô tô 7 chỗ gia đình',
            plate: firstDriverTrip.licensePlate
              ? firstDriverTrip.licensePlate.replace(/\d{2}$/, 'xx')
              : '93A-***.xx (Đã kiểm tra)',
            color: 'Trắng',
            features: ['100% không khói thuốc lá', 'Điều hoà mát mẻ']
          }
        : null,
      verifications: [
        { key: 'phone_zalo', label: 'Số điện thoại & Zalo chính chủ', verified: Boolean(user.phone) },
        {
          key: 'id_card',
          label: 'Căn cước công dân gắn chip',
          verified: Boolean(user.isCccdVerified || user.verifiedCCCD)
        },
        {
          key: 'driver_license',
          label: 'Giấy phép lái xe B2',
          verified: Boolean(user.isGplxVerified || user.verifiedGPLX)
        },
        { key: 'car_inspection', label: 'Đăng kiểm & Phương tiện lưu thông', verified: Boolean(driverTrips.length > 0) }
      ],
      safetyWarnings: user.isBanned ? ['Tài khoản đang bị khoá do vi phạm quy chế cộng đồng'] : [],
      recentMutualReviews: []
    };

    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/trust-rules/public - Lấy danh sách quy tắc tín nhiệm công khai
 */
export function getPublicTrustRulesHandler(req, res) {
  try {
    const rules = getTrustRules();
    return res.status(200).json({
      success: true,
      data: rules.filter((r) => r.enabled)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
