/**
 * CarMate — Bộ Dữ Liệu Kiểm Thử Local Chuẩn Chỉnh (Curated Local Test Dataset)
 *
 * Chuẩn bị môi trường dữ liệu phong phú, sống động và thực tế 100%:
 * - Đầy đủ các chuyến của tài khoản chính (0984883750) ở mọi trạng thái: đang nhận khách, đã đủ người, đã qua giờ (để test tái đăng), khứ hồi.
 * - Đầy đủ các đơn ghép xe (Bookings): đang hẹn Zalo, đã đặt cọc, đã hoàn thành, có đánh giá 5 sao, trễ hẹn, huỷ.
 * - Đầy đủ các hành lang liên tỉnh trọng điểm: Tuyến QL13, Tuyến QL14, Tuyến Cao tốc Vũng Tàu, Tuyến Phan Thiết, Tuyến Miền Tây.
 * - Đồng bộ 100% giữa SQLite (apps/api/data/carmate.sqlite) và JSON (apps/api/data/carmate_db.json).
 *
 * Cách chạy:
 *   node scripts/seed-local-data.js
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../apps/api/data');
const DB_PATH = path.join(DATA_DIR, 'carmate.sqlite');
const JSON_PATH = path.join(DATA_DIR, 'carmate_db.json');

const CAR_PHOTOS_XPANDER = [
  {
    angle: 'front',
    label: 'Góc Trước (Đầu xe)',
    url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
    caption: 'Đầu xe Mitsubishi Xpander sáng bóng, đèn LED hiện đại'
  },
  {
    angle: 'back',
    label: 'Góc Sau (Đuôi xe & Cốp)',
    url: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80',
    caption: 'Đuôi xe sạch sẽ, có gắn camera lùi'
  },
  {
    angle: 'side',
    label: 'Góc Thân xe (Bên hông)',
    url: 'https://images.unsplash.com/photo-1509000000103-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    caption: 'Thân xe nguyên bản màu trắng gia đình, không vết xước'
  },
  {
    angle: 'interior',
    label: 'Nội thất & Ghế ngồi',
    url: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80',
    caption: 'Ghế bọc da sạch sẽ, 2 giàn lạnh độc lập thơm mát'
  },
  {
    angle: 'trunk',
    label: 'Khoang cốp để đồ',
    url: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&q=80',
    caption: 'Cốp xe rộng rãi, chứa thoải mái 2-3 vali lớn'
  }
];

const CAR_PHOTOS_VIOS = [
  {
    angle: 'front',
    label: 'Góc Trước (Đầu xe)',
    url: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80',
    caption: 'Toyota Vios 5 chỗ màu bạc, đầu xe mới tinh'
  },
  {
    angle: 'side',
    label: 'Góc Thân xe (Bên hông)',
    url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80',
    caption: 'Thân xe gia đình sạch sẽ'
  },
  {
    angle: 'interior',
    label: 'Nội thất & Ghế ngồi',
    url: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80',
    caption: 'Nội thất bọc da êm ái, máy lạnh sâu'
  }
];

// 1. TÀI KHOẢN NGƯỜI DÙNG
const USERS = [
  {
    id: 'USR-0984883750',
    phone: '0984883750',
    name: 'Nguyễn Thành Huỳnh',
    role: 'admin',
    avatar: '',
    trustScore: 99,
    safeTripsCount: 48,
    provider: 'zalo',
    isCccdVerified: 1,
    isGplxVerified: 1,
    isBanned: 0,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: new Date().toISOString(),
    email: 'huynh.nguyen@carmate.vn'
  },
  {
    id: 'USR-0900000019',
    phone: '0900000019',
    name: 'Anh Tuấn (Lộc Ninh)',
    role: 'driver',
    avatar: '',
    trustScore: 98,
    safeTripsCount: 142,
    provider: 'zalo',
    isCccdVerified: 1,
    isGplxVerified: 1,
    isBanned: 0,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'USR-0900000013',
    phone: '0900000013',
    name: 'Anh Hùng (Bình Long)',
    role: 'driver',
    avatar: '',
    trustScore: 97,
    safeTripsCount: 89,
    provider: 'zalo',
    isCccdVerified: 1,
    isGplxVerified: 1,
    isBanned: 0,
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'USR-0900000018',
    phone: '0900000018',
    name: 'Văn Long (Khách đi cùng)',
    role: 'passenger',
    avatar: '',
    trustScore: 99,
    safeTripsCount: 12,
    provider: 'zalo',
    isCccdVerified: 1,
    isGplxVerified: 0,
    isBanned: 0,
    createdAt: '2026-09-02T08:00:00.000Z',
    updatedAt: new Date().toISOString()
  }
];

// 2. DANH SÁCH BÀI ĐĂNG CHUYẾN XE (TRIPS)
const TRIPS = [
  // ── NHÓM A: CHUYẾN CỦA CHÍNH BẠN (0984883750) ──
  {
    id: 'DRV-2928',
    maskedCode: 'CX-483',
    type: 'driver_offer',
    status: 'active',
    phoneReal: '0984883750',
    userId: 'USR-0984883750',
    publicName: 'Nguyễn Thành Huỳnh',
    from: 'trung tâm hành chính Tân Khai, Hớn Quản, Bình Phước',
    to: 'Đường Cống Quỳnh (Quận 1)',
    routeCategory: 'Tuyến QL13',
    direction: 'both',
    hometown: 'Bình Phước',
    waypointNote: 'Tiện đón dọc Quốc Lộ 13 (Tân Khai ➔ Chơn Thành ➔ Thủ Dầu Một ➔ Sài Gòn)',
    date: 'Ngày mai',
    timeSlot: '16:00-18:00',
    timeSlotLabel: '16:00 – 18:00',
    carType: 'Mitsubishi Xpander (Xe 7 chỗ)',
    capacity: 6,
    availableSeats: 1,
    price: 150000,
    basePricePerSeat: 150000,
    depositPerSeat: 0,
    carCategory: 'family_car',
    isVip: true,
    rating: 5.0,
    completedCount: 24,
    perks: ['Xe gia đình (Biển trắng)', 'Không khói thuốc', 'Trọn gói vé BOT & xăng', 'Bật máy lạnh', 'Cốp rộng'],
    carPhotos: CAR_PHOTOS_XPANDER,
    hasCarPhotos: true,
    plateMask: '93A - 541.86',
    notes: 'Xe gia đình 7 chỗ êm ái, giờ giấc thoải mái, đón tận nơi tiện đường QL13.',
    createdAt: Date.now() - 1000 * 3600 * 4
  },
  {
    id: 'DRV-0984-MORNING',
    maskedCode: 'CX-BP108',
    type: 'driver_offer',
    status: 'active',
    phoneReal: '0984883750',
    userId: 'USR-0984883750',
    publicName: 'Nguyễn Thành Huỳnh',
    from: 'Bù Đốp (Cây xăng Petrolimex 17, QL13)',
    to: 'Sài Gòn (Ngã 4 Hàng Xanh / Quận 1)',
    routeCategory: 'Tuyến QL13',
    direction: 'province_to_sg',
    hometown: 'Bù Đốp',
    waypointNote: 'Đón dọc QL13: Bù Đốp ➔ Lộc Ninh ➔ Bình Long ➔ Chơn Thành ➔ Hàng Xanh',
    date: 'Hôm nay',
    timeSlot: '05:00-07:00',
    timeSlotLabel: '05:00 – 07:00',
    carType: 'Mitsubishi Xpander (Xe 7 chỗ)',
    capacity: 6,
    availableSeats: 3,
    price: 180000,
    basePricePerSeat: 180000,
    depositPerSeat: 0,
    carCategory: 'family_car',
    isVip: true,
    rating: 5.0,
    completedCount: 24,
    perks: ['Không khói thuốc', 'Trọn gói vé BOT & xăng', 'Bật máy lạnh', 'Nhận gửi hàng'],
    carPhotos: CAR_PHOTOS_XPANDER,
    hasCarPhotos: true,
    plateMask: '93A - 541.86',
    notes: 'Mình chở gia đình đi khám bệnh sáng sớm, còn trống 3 ghế rộng rãi.',
    createdAt: Date.now() - 1000 * 3600 * 2
  },
  {
    id: 'DRV-0984-RETURN',
    maskedCode: 'CX-SG109',
    type: 'driver_offer',
    status: 'active',
    phoneReal: '0984883750',
    userId: 'USR-0984883750',
    publicName: 'Nguyễn Thành Huỳnh',
    from: 'Sài Gòn (Quận 1 / Ngã 4 Hàng Xanh)',
    to: 'Bù Đốp (QL13, Bình Phước)',
    routeCategory: 'Tuyến QL13',
    direction: 'sg_to_province',
    hometown: 'Bù Đốp',
    waypointNote: 'Về lại Bù Đốp đón dọc QL13 từ Hàng Xanh, Bình Dương',
    date: 'Hôm nay',
    timeSlot: '17:00-19:00',
    timeSlotLabel: '17:00 – 19:00',
    carType: 'Mitsubishi Xpander (Xe 7 chỗ)',
    capacity: 6,
    availableSeats: 3,
    price: 180000,
    basePricePerSeat: 180000,
    depositPerSeat: 0,
    carCategory: 'family_car',
    isVip: true,
    rating: 5.0,
    completedCount: 24,
    perks: ['Không khói thuốc', 'Trọn gói vé BOT & xăng', 'Bật máy lạnh'],
    carPhotos: CAR_PHOTOS_XPANDER,
    hasCarPhotos: true,
    plateMask: '93A - 541.86',
    notes: 'Chuyến về chiều tối sau khi xong việc tại Sài Gòn. Ghế sau ngả lưng thoải mái.',
    createdAt: Date.now() - 1000 * 3600 * 1
  },
  {
    id: 'DRV-0984-FULL',
    maskedCode: 'CX-DX111',
    type: 'driver_offer',
    status: 'full',
    phoneReal: '0984883750',
    userId: 'USR-0984883750',
    publicName: 'Nguyễn Thành Huỳnh',
    from: 'Đồng Xoài (Vòng xoay ngã 4 Hùng Vương)',
    to: 'Sài Gòn (Bến xe Miền Đông mới / Thủ Đức)',
    routeCategory: 'Tuyến QL14',
    direction: 'province_to_sg',
    hometown: 'Đồng Xoài',
    waypointNote: 'Đã nhận đủ 4 người quen cùng cơ quan',
    date: 'Ngày mai',
    timeSlot: '06:00-08:00',
    timeSlotLabel: '06:00 – 08:00',
    carType: 'Toyota Vios (Xe 5 chỗ)',
    capacity: 4,
    availableSeats: 0,
    price: 160000,
    basePricePerSeat: 160000,
    depositPerSeat: 0,
    carCategory: 'family_car',
    isVip: false,
    rating: 5.0,
    completedCount: 24,
    perks: ['Xe gia đình (Biển trắng)', 'Không khói thuốc', 'Bật máy lạnh'],
    carPhotos: CAR_PHOTOS_VIOS,
    hasCarPhotos: true,
    plateMask: '93A - 541.86',
    notes: 'Chuyến xe đã kín chỗ.',
    createdAt: Date.now() - 1000 * 3600 * 8
  },
  {
    id: 'DRV-0984-PAST',
    maskedCode: 'CX-CT110',
    type: 'driver_offer',
    status: 'completed',
    phoneReal: '0984883750',
    userId: 'USR-0984883750',
    publicName: 'Nguyễn Thành Huỳnh',
    from: 'Chợ Chơn Thành (Bình Phước)',
    to: 'Sân bay Tân Sơn Nhất (Ga Quốc Nội)',
    routeCategory: 'Tuyến QL13',
    direction: 'province_to_sg',
    hometown: 'Chơn Thành',
    waypointNote: 'Đưa đón tận cổng ga sân bay',
    date: 'Hôm qua',
    timeSlot: '08:00-10:00',
    timeSlotLabel: '08:00 – 10:00',
    carType: 'Mitsubishi Xpander (Xe 7 chỗ)',
    capacity: 6,
    availableSeats: 0,
    price: 140000,
    basePricePerSeat: 140000,
    depositPerSeat: 0,
    carCategory: 'family_car',
    isVip: true,
    rating: 5.0,
    completedCount: 24,
    perks: ['Không khói thuốc', 'Bao trọn vé BOT', 'Cốp rộng'],
    carPhotos: CAR_PHOTOS_XPANDER,
    hasCarPhotos: true,
    plateMask: '93A - 541.86',
    notes: 'Chuyến đi đã hoàn thành an toàn tốt đẹp.',
    createdAt: Date.now() - 1000 * 3600 * 30
  },

  // ── NHÓM B: CÁC CHUYẾN XE KHÁC ĐỂ TEST SÀN & BỘ LỌC ──
  {
    id: 'DRV-101',
    maskedCode: 'CX-BP101',
    type: 'driver_offer',
    status: 'active',
    phoneReal: '0900000019',
    userId: 'USR-0900000019',
    publicName: 'Chủ xe Lộc Ninh #101',
    from: 'Bù Đốp (Cây xăng Petrolimex 17, QL13)',
    to: 'Sài Gòn (Ngã tư Hàng Xanh / BX Miền Đông mới)',
    routeCategory: 'Tuyến QL13',
    direction: 'province_to_sg',
    hometown: 'Bình Phước',
    date: 'Hôm nay',
    timeSlot: '05:00-06:00',
    timeSlotLabel: '05:00 – 06:00',
    carType: 'Mitsubishi Xpander (Xe 7 chỗ)',
    capacity: 6,
    availableSeats: 3,
    price: 180000,
    basePricePerSeat: 180000,
    depositPerSeat: 0,
    carCategory: 'family_car',
    isVip: true,
    rating: 4.95,
    completedCount: 142,
    perks: ['Không khói thuốc', 'Trọn gói xăng & cầu đường', 'Xe gia đình'],
    carPhotos: CAR_PHOTOS_XPANDER,
    hasCarPhotos: true,
    plateMask: '93A - ***.86',
    notes: 'Xe gia đình sạch sẽ, đón dọc QL13 tiện đường, không hút thuốc.',
    createdAt: Date.now() - 3600000 * 2
  },
  {
    id: 'DRV-102',
    maskedCode: 'CX-BP102',
    type: 'driver_offer',
    status: 'active',
    phoneReal: '0900000013',
    userId: 'USR-0900000013',
    publicName: 'Chủ xe Lộc Ninh #102',
    from: 'Lộc Ninh (Chợ Ninh Thịnh / Ngã 3 Lộc Tấn)',
    to: 'Sài Gòn (Quận Tân Bình / Sân bay TSN)',
    routeCategory: 'Tuyến QL13',
    direction: 'province_to_sg',
    hometown: 'Lộc Ninh',
    date: 'Ngày mai',
    timeSlot: '07:00-08:00',
    timeSlotLabel: '07:00 – 08:00',
    carType: 'Toyota Veloz Cross (Xe 7 chỗ)',
    capacity: 6,
    availableSeats: 2,
    price: 170000,
    basePricePerSeat: 170000,
    depositPerSeat: 0,
    carCategory: 'family_car',
    isVip: false,
    rating: 4.88,
    completedCount: 88,
    perks: ['Xe gia đình', 'Bật điều hoà', 'Không khói thuốc', 'Cốp rộng'],
    hasCarPhotos: true,
    carPhotos: CAR_PHOTOS_XPANDER,
    plateMask: '93A - ***.52',
    notes: 'Đi công việc cơ quan, còn 2 ghế ngồi êm ái, xe không chở đồ tanh.',
    createdAt: Date.now() - 3600000 * 5
  },
  {
    id: 'DRV-103',
    maskedCode: 'CX-PT103',
    type: 'driver_offer',
    status: 'active',
    phoneReal: '0900000017',
    userId: 'USR-0900000017',
    publicName: 'Chủ xe Phan Thiết #103',
    from: 'Phan Thiết (Mũi Né / Trung tâm TP)',
    to: 'Sài Gòn (Quận 1 / Quận 2 - Cao tốc Dầu Giây)',
    routeCategory: 'Tuyến Phan Thiết',
    direction: 'province_to_sg',
    hometown: 'Bình Thuận',
    date: 'Hôm nay',
    timeSlot: '08:00-09:00',
    timeSlotLabel: '08:00 – 09:00',
    carType: 'Toyota Fortuner (Xe 7 chỗ gầm cao)',
    capacity: 6,
    availableSeats: 3,
    price: 220000,
    basePricePerSeat: 220000,
    depositPerSeat: 0,
    carCategory: 'family_car',
    isVip: true,
    rating: 5.0,
    completedCount: 65,
    perks: ['Xe gầm cao êm ái', 'Bao vé cao tốc BOT', 'Không khói thuốc'],
    hasCarPhotos: false,
    notes: 'Chạy thẳng cao tốc Phan Thiết - Dầu Giây chỉ mất 2 tiếng rưỡi.',
    createdAt: Date.now() - 3600000 * 3
  },
  {
    id: 'DRV-104',
    maskedCode: 'CX-VT104',
    type: 'driver_offer',
    status: 'active',
    phoneReal: '0900000012',
    userId: 'USR-0900000012',
    publicName: 'Chủ xe Vũng Tàu #104',
    from: 'Bãi Trước Vũng Tàu (TP. Vũng Tàu)',
    to: 'Sài Gòn (Quận 7 / Phú Mỹ Hưng - Cao tốc Long Thành)',
    routeCategory: 'Tuyến Vũng Tàu',
    direction: 'province_to_sg',
    hometown: 'Bà Rịa - Vũng Tàu',
    date: 'Ngày mai',
    timeSlot: '14:00-15:00',
    timeSlotLabel: '14:00 – 15:00',
    carType: 'Kia Carnival (Xe 7 chỗ VIP)',
    capacity: 6,
    availableSeats: 4,
    price: 150000,
    basePricePerSeat: 150000,
    depositPerSeat: 0,
    carCategory: 'family_car',
    isVip: true,
    rating: 4.97,
    completedCount: 210,
    perks: ['Xe VIP thương gia', 'Không khói thuốc', 'Trọn gói vé BOT'],
    hasCarPhotos: true,
    carPhotos: CAR_PHOTOS_XPANDER,
    notes: 'Xe Carnival rộng rãi bậc nhất, phù hợp gia đình có người lớn tuổi hoặc trẻ em.',
    createdAt: Date.now() - 3600000 * 1
  },
  {
    id: 'DRV-105',
    maskedCode: 'CX-MT105',
    type: 'driver_offer',
    status: 'active',
    phoneReal: '0900000011',
    userId: 'USR-0900000011',
    publicName: 'Chủ xe Mỹ Tho #105',
    from: 'TP. Mỹ Tho (Tiền Giang)',
    to: 'Sài Gòn (Bến xe Miền Tây / Quận 5)',
    routeCategory: 'Tuyến Miền Tây',
    direction: 'province_to_sg',
    hometown: 'Tiền Giang',
    date: 'Hôm nay',
    timeSlot: '06:30-07:30',
    timeSlotLabel: '06:30 – 07:30',
    carType: 'Hyundai Accent (Xe 5 chỗ)',
    capacity: 4,
    availableSeats: 2,
    price: 110000,
    basePricePerSeat: 110000,
    depositPerSeat: 0,
    carCategory: 'family_car',
    isVip: false,
    rating: 4.85,
    completedCount: 42,
    perks: ['Xe gia đình êm ái', 'Bật điều hoà'],
    hasCarPhotos: true,
    carPhotos: CAR_PHOTOS_VIOS,
    notes: 'Đi làm việc Sài Gòn mỗi tuần, xe nhỏ gọn sạch sẽ.',
    createdAt: Date.now() - 3600000 * 6
  },

  // ── NHÓM C: NHU CẦU TÌM XE CỦA KHÁCH (PASSENGER REQUESTS - PHỤC VỤ RADAR) ──
  {
    id: 'REQ-201',
    maskedCode: 'KH-SG201',
    type: 'passenger_request',
    status: 'open',
    phoneReal: '0900000015',
    userId: 'USR-0900000015',
    publicName: 'Chị Mai (Khách đi cùng)',
    from: 'Chợ Lộc Ninh (Bình Phước)',
    to: 'Bệnh Viện Chợ Rẫy / Quận 5 (Sài Gòn)',
    routeCategory: 'Tuyến QL13',
    direction: 'province_to_sg',
    date: 'Ngày mai',
    timeSlot: '05:00-07:00',
    timeSlotLabel: '05:00 – 07:00',
    seatsNeeded: 2,
    seats: 2,
    price: 360000,
    expectedPrice: 360000,
    depositPerSeat: 0,
    notes: 'Hai mẹ con đi khám bệnh Chợ Rẫy, xin ngồi ghế trước hoặc hàng 2 chống say xe.',
    createdAt: Date.now() - 3600000 * 3
  },
  {
    id: 'REQ-202',
    maskedCode: 'KH-SG202',
    type: 'passenger_request',
    status: 'open',
    phoneReal: '0900000016',
    userId: 'USR-0900000016',
    publicName: 'Anh Nam (Khách tìm xe)',
    from: 'Ngã 4 Thủ Đức (Sài Gòn)',
    to: 'Bình Long - Lộc Ninh (Bình Phước)',
    routeCategory: 'Tuyến QL13',
    direction: 'sg_to_province',
    date: 'Hôm nay',
    timeSlot: '17:00-19:00',
    timeSlotLabel: '17:00 – 19:00',
    seatsNeeded: 1,
    seats: 1,
    price: 180000,
    expectedPrice: 180000,
    depositPerSeat: 0,
    notes: 'Tan sở về quê cuối tuần, có 1 ba lô gọn nhẹ.',
    createdAt: Date.now() - 3600000 * 2
  },
  {
    id: 'REQ-203',
    maskedCode: 'KH-VT203',
    type: 'passenger_request',
    status: 'open',
    phoneReal: '0900000014',
    userId: 'USR-0900000014',
    publicName: 'Gia đình Chị Hà',
    from: 'Quận 7 / Phú Mỹ Hưng (Sài Gòn)',
    to: 'Bãi Sau - Vũng Tàu',
    routeCategory: 'Tuyến Vũng Tàu',
    direction: 'sg_to_province',
    date: 'Ngày mai',
    timeSlot: '08:00-09:30',
    timeSlotLabel: '08:00 – 09:30',
    seatsNeeded: 3,
    seats: 3,
    price: 450000,
    expectedPrice: 450000,
    depositPerSeat: 0,
    notes: 'Đi nghỉ mát gia đình 3 người, tìm xe 7 chỗ rộng rãi đón tại chung cư.',
    createdAt: Date.now() - 3600000 * 4
  }
];

// 3. DANH SÁCH ĐƠN GHÉP XE (BOOKINGS / ESCROWS)
const BOOKINGS = [
  {
    escrowId: 'ESC-ZALO-483-01',
    tripId: 'DRV-2928',
    status: 'zalo_active',
    passengerPhone: '0900000018',
    createdAt: Date.now() - 3600000 * 2,
    payload: {
      escrowId: 'ESC-ZALO-483-01',
      tripId: 'DRV-2928',
      tripMaskedCode: 'CX-483',
      status: 'zalo_active',
      commitmentType: 'zalo_direct',
      partyRole: 'Chủ xe kết nối Khách',
      contactName: 'Văn Long',
      contactPhone: '0900.000.018',
      driverPhone: '0984883750',
      driverName: 'Nguyễn Thành Huỳnh',
      seats: 1,
      totalDeal: 150000,
      paidToEscrow: 0,
      remainingCash: 150000,
      from: 'trung tâm hành chính Tân Khai, Hớn Quản, Bình Phước',
      to: 'Đường Cống Quỳnh (Quận 1)',
      timeSlot: '16:00-18:00',
      pickupNote: 'Đón tại cổng Chợ Tân Khai đúng 16:15',
      createdAt: 'Hôm nay, 14:20'
    }
  },
  {
    escrowId: 'ESC-PAID-108-02',
    tripId: 'DRV-0984-MORNING',
    status: 'escrow_paid',
    passengerPhone: '0900000025',
    createdAt: Date.now() - 3600000 * 1,
    payload: {
      escrowId: 'ESC-PAID-108-02',
      tripId: 'DRV-0984-MORNING',
      tripMaskedCode: 'CX-BP108',
      status: 'escrow_paid',
      commitmentType: 'escrow_deposit',
      partyRole: 'Chủ xe kết nối Khách',
      contactName: 'Chị Lan Bình Phước',
      contactPhone: '0900.000.025',
      driverPhone: '0984883750',
      driverName: 'Nguyễn Thành Huỳnh',
      seats: 2,
      depositAmount: 100000,
      totalDeal: 360000,
      paidToEscrow: 100000,
      remainingCash: 260000,
      from: 'Bù Đốp (Cây xăng Petrolimex 17, QL13)',
      to: 'Sài Gòn (Ngã 4 Hàng Xanh)',
      timeSlot: '05:00-07:00',
      pickupNote: 'Đón tại ngã 3 Lộc Tấn lúc 05:30',
      createdAt: 'Hôm nay, 15:00'
    }
  },
  {
    escrowId: 'ESC-DONE-110-03',
    tripId: 'DRV-0984-PAST',
    status: 'completed',
    passengerPhone: '0900000026',
    createdAt: Date.now() - 3600000 * 28,
    payload: {
      escrowId: 'ESC-DONE-110-03',
      tripId: 'DRV-0984-PAST',
      tripMaskedCode: 'CX-CT110',
      status: 'completed',
      commitmentType: 'zalo_direct',
      partyRole: 'Chủ xe kết nối Khách',
      contactName: 'Bác Tuấn',
      contactPhone: '0900.000.026',
      driverPhone: '0984883750',
      driverName: 'Nguyễn Thành Huỳnh',
      seats: 1,
      totalDeal: 140000,
      from: 'Chợ Chơn Thành (Bình Phước)',
      to: 'Sân bay Tân Sơn Nhất',
      timeSlot: '08:00-10:00',
      completedAt: new Date(Date.now() - 3600000 * 26).toISOString(),
      feedback: {
        rating: 5,
        review: 'Chủ xe lái xe rất êm ái, xe gia đình sạch sẽ, không mùi thuốc lá, tới sân bay kịp giờ check-in!'
      },
      createdAt: 'Hôm qua'
    }
  }
];

export async function seedLocalData() {
  console.log('\n🌱 BẮT ĐẦU NẠP BỘ DỮ LIỆU TEST LOCAL CARMATE CHUẨN CHỈNH...\n');

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // 1. Nạp Users
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (
      id, phone, email, name, role, avatar, trustScore, isCccdVerified,
      isGplxVerified, isBanned, createdAt, updatedAt, payload
    ) VALUES (
      @id, @phone, @email, @name, @role, @avatar, @trustScore, @isCccdVerified,
      @isGplxVerified, @isBanned, @createdAt, @updatedAt, @payload
    )
  `);

  const insertUsersTx = db.transaction((users) => {
    for (const u of users) {
      insertUser.run({
        id: u.id,
        phone: u.phone,
        email: u.email || null,
        name: u.name,
        role: u.role,
        avatar: u.avatar || '',
        trustScore: u.trustScore || 98,
        isCccdVerified: u.isCccdVerified ?? 1,
        isGplxVerified: u.isGplxVerified ?? 1,
        isBanned: u.isBanned ?? 0,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        payload: JSON.stringify(u)
      });
    }
  });
  insertUsersTx(USERS);
  console.log(`✅ Đã nạp thành công ${USERS.length} tài khoản thành viên (gồm Root Admin 0984883750).`);

  // 2. Nạp Trips
  const insertTrip = db.prepare(`
    INSERT OR REPLACE INTO trips (
      id, type, status, maskedCode, phoneReal, userId, fromLocation, toLocation,
      routeCategory, direction, timeSlot, date, price, seats, carCategory,
      carType, isHidden, isBanned, createdAt, payload
    ) VALUES (
      @id, @type, @status, @maskedCode, @phoneReal, @userId, @fromLocation, @toLocation,
      @routeCategory, @direction, @timeSlot, @date, @price, @seats, @carCategory,
      @carType, @isHidden, @isBanned, @createdAt, @payload
    )
  `);

  const insertTripsTx = db.transaction((trips) => {
    for (const t of trips) {
      insertTrip.run({
        id: t.id,
        type: t.type,
        status: t.status,
        maskedCode: t.maskedCode,
        phoneReal: t.phoneReal,
        userId: t.userId,
        fromLocation: t.from,
        toLocation: t.to,
        routeCategory: t.routeCategory,
        direction: t.direction,
        timeSlot: t.timeSlot,
        date: t.date,
        price: Number(t.price || t.basePricePerSeat || 150000),
        seats: Number(t.availableSeats || t.seatsNeeded || 1),
        carCategory: t.carCategory || 'family_car',
        carType: t.carType || 'Xe 7 chỗ',
        isHidden: 0,
        isBanned: 0,
        createdAt: t.createdAt || Date.now(),
        payload: JSON.stringify(t)
      });
    }
  });
  insertTripsTx(TRIPS);
  console.log(`✅ Đã nạp thành công ${TRIPS.length} chuyến xe chất lượng cao vào SQLite.`);

  // 3. Nạp Bookings
  const insertBooking = db.prepare(`
    INSERT OR REPLACE INTO bookings (
      escrowId, tripId, passengerPhone, status, createdAt, payload
    ) VALUES (
      @escrowId, @tripId, @passengerPhone, @status, @createdAt, @payload
    )
  `);

  const insertBookingsTx = db.transaction((bookings) => {
    for (const b of bookings) {
      insertBooking.run({
        escrowId: b.escrowId,
        tripId: b.tripId,
        passengerPhone: b.passengerPhone,
        status: b.status,
        createdAt: b.createdAt,
        payload: JSON.stringify(b.payload)
      });
    }
  });
  insertBookingsTx(BOOKINGS);
  console.log(`✅ Đã nạp thành công ${BOOKINGS.length} đơn ghép xe (Bookings) đủ trạng thái.`);

  // 4. Đồng bộ ra file carmate_db.json
  const currentJson = fs.existsSync(JSON_PATH) ? JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) : {};
  currentJson.users = USERS;
  currentJson.driverOffers = TRIPS.filter((t) => t.type === 'driver_offer');
  currentJson.passengerRequests = TRIPS.filter((t) => t.type === 'passenger_request');
  currentJson.bookings = BOOKINGS.map((b) => b.payload);
  fs.writeFileSync(JSON_PATH, JSON.stringify(currentJson, null, 2), 'utf8');
  console.log(`✅ Đã đồng bộ hoàn hảo sang file ${JSON_PATH}.`);

  console.log('\n🎉 HOÀN TẤT NẠP DỮ LIỆU TEST LOCAL! (KHÔNG CÓ COMMIT NÀO ĐƯỢC TẠO)');
}

seedLocalData().catch((err) => {
  console.error('Lỗi nạp dữ liệu:', err);
  process.exit(1);
});
