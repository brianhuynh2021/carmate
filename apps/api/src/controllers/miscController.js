import { ROUTE_BENCHMARKS, SITE_INFO } from '@carmate/shared';
import { getDB } from '../db/sqliteStore.js';

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
 * GET /api/stats - Thống kê toàn nền tảng
 */
export function getStats(req, res) {
  try {
    const db = getDB();
    const stats = {
      members: db.stats?.members || SITE_INFO.stats.members,
      tripsCompleted: (db.stats?.tripsCompleted || SITE_INFO.stats.tripsCompleted) + (db.bookings?.filter(b => b.status === 'completed').length || 0),
      routes: db.stats?.routes || SITE_INFO.stats.routes,
      avgRating: db.stats?.avgRating || SITE_INFO.stats.avgRating,
      activeTripsCount: (db.driverOffers?.length || 0) + (db.passengerRequests?.length || 0),
      activeBookingsCount: db.bookings?.filter(b => b.status === 'zalo_active').length || 0
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
 * GET /api/trust/:memberId - Hồ sơ tín nhiệm cộng đồng bình đẳng (Cầm lái & Đi cùng)
 */
export function getTrustProfile(req, res) {
  try {
    const { memberId = 'tuan-bp' } = req.params;

    const profile = {
      id: memberId,
      name: 'Nguyễn Anh Tuấn',
      publicName: 'Chủ xe Lộc Ninh #101',
      hometown: 'Bình Phước',
      memberSince: '10/2024',
      karmaScore: 98,
      trustScore: 98,
      rating: 4.95,
      totalCommunityTrips: 62,
      driverStats: {
        tripsCompleted: 48,
        onTimeRate: '99%',
        rating: 4.95,
        reviewsCount: 38,
        topTags: ['Lái xe an toàn', 'Xe sạch êm', 'Đúng giờ', 'Không khói thuốc']
      },
      passengerStats: {
        tripsCompleted: 14,
        onTimeRate: '100%',
        rating: 5.0,
        reviewsCount: 12,
        topTags: ['Đúng giờ điểm đón', 'Lịch sự văn minh', 'Gửi tiền xăng sòng phẳng']
      },
      car: {
        model: 'Mitsubishi Xpander (7 chỗ)',
        plate: '93A-289.xx (Đã đối soát)',
        color: 'Trắng Ngọc Trai',
        features: ['100% không khói thuốc', 'Ghế da êm ái', 'Điều hoà 2 dàn lạnh', 'Cốp rộng để đồ']
      },
      verifications: [
        { key: 'phone_zalo', label: 'Số điện thoại & Zalo chính chủ', verified: true },
        { key: 'id_card', label: 'Căn cước công dân gắn chip', verified: true },
        { key: 'driver_license', label: 'Giấy phép lái xe B2', verified: true },
        { key: 'car_inspection', label: 'Đăng kiểm & Bảo hiểm TNDS', verified: true }
      ],
      safetyWarnings: [],
      recentMutualReviews: [
        {
          id: 'REV-1',
          author: 'Chị Mai (Hành khách cùng đường)',
          reviewerRole: 'passenger',
          rating: 5,
          tags: ['Lái xe cẩn thận', 'Đúng giờ', 'Xe thơm mát'],
          comment: 'Bác Tuấn lái rất êm, đón đúng giờ tại Bù Đốp, xe gia đình sạch sẽ không mùi thuốc lá.',
          date: 'Hôm qua'
        },
        {
          id: 'REV-2',
          author: 'Anh Hùng (Chủ xe Đồng Phú)',
          reviewerRole: 'driver',
          rating: 5,
          tags: ['Đúng giờ điểm hẹn', 'Giao tiếp lịch sự', 'Gửi tiền xăng sòng phẳng'],
          comment: 'Hôm trước anh Tuấn đi nhờ xe tôi về Sài Gòn, rất đúng giờ và văn minh, nói chuyện vui vẻ.',
          date: '3 ngày trước'
        }
      ]
    };

    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
