import React, { useState, useMemo } from 'react';
import {
  Car,
  Users,
  ShieldCheck,
  Lock,
  Unlock,
  Phone,
  MessageSquare,
  Crown,
  Sparkles,
  Search,
  Filter,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  QrCode,
  ArrowRight,
  ArrowLeftRight,
  Clock,
  Star,
  Zap,
  DollarSign,
  Calendar,
  Share2,
  Copy,
  Info,
  BadgePercent,
  Check,
  Fuel,
  ThumbsUp,
  X,
  Compass,
  Navigation,
  Layers,
  UserCheck,
  Radio,
  Send,
  SlidersHorizontal,
  Flame,
  ArrowUpRight,
  Sun,
  Moon,
  Tag,
  Gift,
  Scale,
  BadgeCheck,
  Bus,
  Sliders,
  AlertTriangle,
  ShieldAlert,
  UserX,
  Ban,
  EyeOff,
  HeartHandshake,
  Plane,
  FileText,
  Timer
} from 'lucide-react';

// CHI PHÍ CHIA SẺ HỢP LÝ CHO TỪNG TUYẾN (Xăng + Cầu đường + Hao mòn chia đều)
const ROUTE_BENCHMARKS = {
  'Tuyến QL13': {
    name: 'Bình Phước (Bù Đốp/Lộc Ninh) ⇄ Sài Gòn (~140km)',
    traditionalBusPrice: 220000,
    minSafePrice: 100000,
    maxSafePrice: 400000,
    suggestedRate: 180000
  },
  'Tuyến QL51': {
    name: 'Vũng Tàu ⇄ Sài Gòn (Cao Tốc ~100km)',
    traditionalBusPrice: 200000,
    minSafePrice: 90000,
    maxSafePrice: 350000,
    suggestedRate: 160000
  },
  'Tuyến QL20': {
    name: 'Bảo Lộc / Đà Lạt ⇄ Sài Gòn (~180-300km)',
    traditionalBusPrice: 250000,
    minSafePrice: 120000,
    maxSafePrice: 500000,
    suggestedRate: 200000
  },
  'Tuyến QL1A': {
    name: 'Phan Thiết / Bình Thuận ⇄ Sài Gòn (~200km)',
    traditionalBusPrice: 230000,
    minSafePrice: 110000,
    maxSafePrice: 450000,
    suggestedRate: 190000
  },
  'Tuyến QL22': {
    name: 'Tây Ninh ⇄ Sài Gòn (~100km)',
    traditionalBusPrice: 150000,
    minSafePrice: 70000,
    maxSafePrice: 300000,
    suggestedRate: 120000
  },
  'Tuyến CT Long Thành': {
    name: 'Long Thành / Đồng Nai ⇄ Sài Gòn (Cao Tốc ~60km)',
    traditionalBusPrice: 100000,
    minSafePrice: 50000,
    maxSafePrice: 200000,
    suggestedRate: 80000
  },
  'Tuyến QL1K': {
    name: 'Biên Hòa / Đồng Nai ⇄ Sài Gòn (~30km)',
    traditionalBusPrice: 80000,
    minSafePrice: 35000,
    maxSafePrice: 150000,
    suggestedRate: 60000
  },
  'Tuyến QL50': {
    name: 'Gò Công / Tiền Giang ⇄ Sài Gòn (~80km)',
    traditionalBusPrice: 140000,
    minSafePrice: 65000,
    maxSafePrice: 280000,
    suggestedRate: 110000
  },
  'Tuyến QL60': {
    name: 'Bến Tre ⇄ Sài Gòn (~90km)',
    traditionalBusPrice: 160000,
    minSafePrice: 75000,
    maxSafePrice: 300000,
    suggestedRate: 130000
  },
  'Tuyến CT Trung Lương': {
    name: 'Mỹ Tho / Tiền Giang ⇄ Sài Gòn (Cao Tốc ~70km)',
    traditionalBusPrice: 120000,
    minSafePrice: 55000,
    maxSafePrice: 250000,
    suggestedRate: 100000
  }
};

const TIME_SLOTS = [
  { id: 'all', label: 'Tất cả giờ' },
  { id: '05:00-06:00', label: '05:00 - 06:00 (Sáng sớm)' },
  { id: '07:00-08:00', label: '07:00 - 08:00 (Cao điểm sáng)' },
  { id: '09:00-10:00', label: '09:00 - 10:00 (Sáng)' },
  { id: '13:00-14:00', label: '13:00 - 14:00 (Đầu giờ chiều)' },
  { id: '15:00-16:00', label: '15:00 - 16:00 (Chiều)' },
  { id: '17:00-18:00', label: '17:00 - 18:00 (Tan tầm)' },
  { id: '19:00-20:00', label: '19:00 - 20:00 (Tối)' },
  { id: '21:00-22:00', label: '21:00 - 22:00 (Chuyến đêm)' }
];

// DỮ LIỆU PROFILE MÃ HÓA BẢO MẬT
const INITIAL_DRIVER_OFFERS = [
  {
    id: 'DRV-101',
    type: 'driver_offer',
    maskedCode: 'CX-BP101',
    publicName: 'Chủ xe Lộc Ninh #101',
    phoneReal: '0988.234.567',
    direction: 'province_to_sg',
    from: 'Bù Đốp / Lộc Ninh (Bình Phước)',
    to: 'Sài Gòn (Bến xe Miền Đông Mới - Q9)',
    routeCategory: 'Tuyến QL13',
    date: 'Hôm nay',
    timeSlot: '05:00-06:00',
    timeSlotLabel: '05:00 - 06:00 Sáng',
    carType: 'Mitsubishi Xpander (Xe 7 chỗ)',
    capacity: 4,
    availableSeats: 3,
    basePricePerSeat: 180000,
    customDiscountPercent: 10,
    depositPerSeat: 50000,
    isVip: true,
    rating: 4.95,
    completedCount: 142,
    notes: 'Xe gia đình sạch sẽ, đón dọc QL13, đi từ 2 ghế giảm 10%.',
    createdAt: Date.now() - 3600000 * 2
  },
  {
    id: 'DRV-102',
    type: 'driver_offer',
    maskedCode: 'CX-BP102',
    publicName: 'Chủ xe Lộc Ninh #102',
    phoneReal: '0913.889.922',
    direction: 'province_to_sg',
    from: 'Chợ Lộc Ninh (Bình Phước)',
    to: 'Sân Bay Tân Sơn Nhất (Ga T1/T2)',
    routeCategory: 'Tuyến QL13',
    date: 'Hôm nay',
    timeSlot: '07:00-08:00',
    timeSlotLabel: '07:00 - 08:00 Sáng',
    carType: 'Toyota Veloz Cross (Xe 7 chỗ)',
    capacity: 5,
    availableSeats: 4,
    basePricePerSeat: 200000,
    customDiscountPercent: 15,
    depositPerSeat: 50000,
    isVip: true,
    rating: 4.9,
    completedCount: 98,
    notes: 'Ưu tiên bà con đi khám bệnh Chợ Rẫy hoặc ra sân bay sớm.',
    createdAt: Date.now() - 3600000 * 4
  },
  {
    id: 'DRV-103',
    type: 'driver_offer',
    maskedCode: 'CX-PT103',
    publicName: 'Chủ xe Phan Thiết #103',
    phoneReal: '0977.556.334',
    direction: 'province_to_sg',
    from: 'Phan Thiết (Bình Thuận)',
    to: 'Sài Gòn (Quận 1 / Bình Thạnh)',
    routeCategory: 'Tuyến QL1A',
    date: 'Hôm nay',
    timeSlot: '05:00-06:00',
    timeSlotLabel: '05:00 - 06:00 Sáng',
    carType: 'Toyota Innova (Xe 7 chỗ)',
    capacity: 5,
    availableSeats: 4,
    basePricePerSeat: 190000,
    customDiscountPercent: 10,
    depositPerSeat: 50000,
    isVip: true,
    rating: 4.85,
    completedCount: 67,
    notes: 'Đi công tác SG hàng tuần, xe sạch máy lạnh, đón dọc QL1A.',
    createdAt: Date.now() - 3600000 * 1
  },
  {
    id: 'DRV-104',
    type: 'driver_offer',
    maskedCode: 'CX-TN104',
    publicName: 'Chủ xe Tây Ninh #104',
    phoneReal: '0909.112.445',
    direction: 'province_to_sg',
    from: 'Trảng Bàng / Tây Ninh',
    to: 'Sài Gòn (Củ Chi - Hóc Môn - Q12)',
    routeCategory: 'Tuyến QL22',
    date: 'Hôm nay',
    timeSlot: '07:00-08:00',
    timeSlotLabel: '07:00 - 08:00 Sáng',
    carType: 'Kia Carnival (Xe 7 chỗ)',
    capacity: 6,
    availableSeats: 5,
    basePricePerSeat: 120000,
    customDiscountPercent: 15,
    depositPerSeat: 50000,
    isVip: false,
    rating: 4.7,
    completedCount: 34,
    notes: 'Đi làm KCN Củ Chi, ghép dọc QL22 tiện đường.',
    createdAt: Date.now() - 3600000 * 3
  },
  {
    id: 'DRV-105',
    type: 'driver_offer',
    maskedCode: 'CX-MT105',
    publicName: 'Chủ xe Mỹ Tho #105',
    phoneReal: '0365.778.991',
    direction: 'province_to_sg',
    from: 'Mỹ Tho (Tiền Giang)',
    to: 'Sài Gòn (Bến xe Miền Tây / Q8)',
    routeCategory: 'Tuyến CT Trung Lương',
    date: 'Hôm nay',
    timeSlot: '09:00-10:00',
    timeSlotLabel: '09:00 - 10:00 Sáng',
    carType: 'Honda CR-V (Xe 5 chỗ)',
    capacity: 3,
    availableSeats: 2,
    basePricePerSeat: 100000,
    customDiscountPercent: 0,
    depositPerSeat: 50000,
    isVip: true,
    rating: 4.92,
    completedCount: 89,
    notes: 'Chạy cao tốc Trung Lương, nhanh 1 tiếng. Đón tại BX Mỹ Tho.',
    createdAt: Date.now() - 3600000 * 5
  },
  {
    id: 'DRV-106',
    type: 'driver_offer',
    maskedCode: 'CX-BH106',
    publicName: 'Chủ xe Biên Hòa #106',
    phoneReal: '0812.334.667',
    direction: 'province_to_sg',
    from: 'Biên Hòa (Đồng Nai)',
    to: 'Sân Bay Tân Sơn Nhất (Ga T1/T2)',
    routeCategory: 'Tuyến QL1K',
    date: 'Hôm nay',
    timeSlot: '05:00-06:00',
    timeSlotLabel: '05:00 - 06:00 Sáng',
    carType: 'VinFast VF8 (Xe 5 chỗ điện)',
    capacity: 3,
    availableSeats: 2,
    basePricePerSeat: 80000,
    customDiscountPercent: 0,
    depositPerSeat: 50000,
    isVip: false,
    rating: 4.8,
    completedCount: 23,
    notes: 'Xe điện VinFast, êm mát. Đi sân bay sáng sớm.',
    createdAt: Date.now() - 3600000 * 2
  }
];

const INITIAL_PASSENGER_REQUESTS = [
  {
    id: 'REQ-201',
    type: 'passenger_request',
    maskedCode: 'KH-SG201',
    publicName: 'Khách đi khám Chợ Rẫy #201',
    phoneReal: '0945.123.889',
    direction: 'province_to_sg',
    from: 'Chợ Lộc Ninh (Bình Phước)',
    to: 'Bệnh Viện Chợ Rẫy / Quận 5 (Sài Gòn)',
    routeCategory: 'Tuyến QL13',
    date: 'Hôm nay',
    timeSlot: '07:00-08:00',
    timeSlotLabel: '07:00 - 08:00 Sáng',
    seatsNeeded: 2,
    expectedPrice: 180000,
    depositPerSeat: 50000,
    notes: 'Cần ghép 2 ghế đi tái khám, sẵn sàng cọc 100k cho 2 người.',
    status: 'open',
    createdAt: Date.now() - 3600000 * 1
  },
  {
    id: 'REQ-202',
    type: 'passenger_request',
    maskedCode: 'KH-SG202',
    publicName: 'Khách về quê #202',
    phoneReal: '0968.445.112',
    direction: 'sg_to_province',
    from: 'Ngã 4 Thủ Đức (Sài Gòn)',
    to: 'Bình Long - Lộc Ninh (Bình Phước)',
    routeCategory: 'Tuyến QL13',
    date: 'Hôm nay',
    timeSlot: '17:00-18:00',
    timeSlotLabel: '17:00 - 18:00 Chiều',
    seatsNeeded: 1,
    expectedPrice: 170000,
    depositPerSeat: 50000,
    notes: 'Cuối tuần về quê, ghép xe dọc QL13 có 1 balo nhỏ.',
    status: 'open',
    createdAt: Date.now() - 3600000 * 2
  },
  {
    id: 'REQ-203',
    type: 'passenger_request',
    maskedCode: 'KH-VT203',
    publicName: 'Khách đi Vũng Tàu #203',
    phoneReal: '0933.221.887',
    direction: 'sg_to_province',
    from: 'Quận 7 / Phú Mỹ Hưng (Sài Gòn)',
    to: 'Bãi Sau - Vũng Tàu',
    routeCategory: 'Tuyến QL51',
    date: 'Hôm nay',
    timeSlot: '07:00-08:00',
    timeSlotLabel: '07:00 - 08:00 Sáng',
    seatsNeeded: 3,
    expectedPrice: 160000,
    depositPerSeat: 50000,
    notes: 'Gia đình 3 người đi biển cuối tuần, có 2 balo + 1 túi nhỏ.',
    status: 'open',
    createdAt: Date.now() - 3600000 * 1
  },
  {
    id: 'REQ-204',
    type: 'passenger_request',
    maskedCode: 'KH-PT204',
    publicName: 'Khách về Phan Thiết #204',
    phoneReal: '0899.443.556',
    direction: 'sg_to_province',
    from: 'Bến xe Miền Đông Mới (Q9)',
    to: 'Phan Thiết (Bình Thuận)',
    routeCategory: 'Tuyến QL1A',
    date: 'Hôm nay',
    timeSlot: '15:00-16:00',
    timeSlotLabel: '15:00 - 16:00 Chiều',
    seatsNeeded: 1,
    expectedPrice: 180000,
    depositPerSeat: 50000,
    notes: 'Sinh viên về quê, hành lý gọn.',
    status: 'open',
    createdAt: Date.now() - 3600000 * 3
  },
  {
    id: 'REQ-205',
    type: 'passenger_request',
    maskedCode: 'KH-BT205',
    publicName: 'Khách về Bến Tre #205',
    phoneReal: '0708.991.223',
    direction: 'sg_to_province',
    from: 'Bến xe Miền Tây (Q. Bình Tân)',
    to: 'TP Bến Tre',
    routeCategory: 'Tuyến QL60',
    date: 'Hôm nay',
    timeSlot: '13:00-14:00',
    timeSlotLabel: '13:00 - 14:00 Chiều',
    seatsNeeded: 2,
    expectedPrice: 120000,
    depositPerSeat: 50000,
    notes: 'Hai chị em về thăm ngoại, cần xe sạch sẽ.',
    status: 'open',
    createdAt: Date.now() - 3600000 * 4
  }
];

// DỮ LIỆU ĐƠN CỌC MẪU (CHUYẾN ĐI SÂN BAY ĐÃ CỌC ĐỂ KIỂM THỬ QUY CHẾ HUỶ / PHẠT)
const INITIAL_BOOKED_ESCROWS = [
  {
    escrowId: 'CX-7821',
    targetItem: {
      id: 'DRV-102',
      type: 'driver_offer',
      publicName: 'Chủ xe Lộc Ninh #102',
      phoneReal: '0913.889.922',
      from: 'Chợ Lộc Ninh (Bình Phước)',
      to: 'Sân Bay Tân Sơn Nhất (Ga T1/T2)',
      timeSlotLabel: '07:00 - 08:00 Sáng',
      carType: 'Toyota Veloz Cross (Xe 7 chỗ)'
    },
    commitmentType: 'full_deal', // 🔒 ĐÃ CHỐT KÈO 100% — KHÔNG THỂ HỦY
    partyRole: 'Khách chốt ghế Chủ Xe',
    contactName: 'Chủ xe Lộc Ninh #102',
    contactPhone: '0913.889.922',
    seats: 2,
    depositAmount: 400000,
    fullTripAmount: 400000, // Chốt kèo thanh toán 100% toàn bộ chuyến đi cho CarMate giữ
    paidToEscrow: 400000,
    remainingCash: 0, // 0đ trên xe, sàn giữ trung gian trọn gói
    isAirportTrip: true,
    totalDeal: 400000,
    timeSlot: '07:00 - 08:00 Sáng',
    from: 'Chợ Lộc Ninh (Bình Phước)',
    to: 'Sân Bay Tân Sơn Nhất (Ga T1/T2)',
    status: 'escrow_locked',
    bothConfirmed: true,
    createdAt: 'Hôm nay, 06:20'
  },
  {
    escrowId: 'CX-5120',
    targetItem: {
      id: 'DRV-101',
      type: 'driver_offer',
      publicName: 'Chủ xe Chơn Thành #101',
      phoneReal: '0908.123.456',
      from: 'Bến Xe Miền Đông Cũ',
      to: 'Chợ Chơn Thành (Bình Phước)',
      timeSlotLabel: '14:00 - 15:00 Chiều',
      carType: 'Mitsubishi Xpander'
    },
    commitmentType: 'deposit_50k', // 🎫 CỌC GIỮ CHỖ 50K — ĐƯỢC HỦY TRƯỚC 8 TIẾNG
    partyRole: 'Khách cọc giữ chỗ Chủ Xe',
    contactName: 'Chủ xe Chơn Thành #101',
    contactPhone: '0908.123.456',
    seats: 1,
    depositAmount: 50000,
    fullTripAmount: 180000,
    paidToEscrow: 50000,
    remainingCash: 130000, // Thanh toán thêm khi lên xe
    isAirportTrip: false,
    totalDeal: 180000,
    timeSlot: '14:00 - 15:00 Chiều',
    from: 'Bến Xe Miền Đông Cũ',
    to: 'Chợ Chơn Thành (Bình Phước)',
    status: 'escrow_locked',
    bothConfirmed: false,
    createdAt: 'Hôm nay, 08:15'
  }
];

export default function App() {
  const [themeMode, setThemeMode] = useState('light');
  const [activeTab, setActiveTab] = useState('market'); // 'market' | 'post' | 'booked' | 'vip' | 'match'
  const [marketViewMode, setMarketViewMode] = useState('all');

  const [driverOffers, setDriverOffers] = useState(INITIAL_DRIVER_OFFERS);
  const [passengerRequests, setPassengerRequests] = useState(INITIAL_PASSENGER_REQUESTS);
  const [bookedEscrows, setBookedEscrows] = useState(INITIAL_BOOKED_ESCROWS);
  const [blacklistedPhones, setBlacklistedPhones] = useState([]);

  // Bộ lọc
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('all');
  const [selectedDirection, setSelectedDirection] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Form Đăng tin
  const [postRole, setPostRole] = useState('driver');
  const [postDirection, setPostDirection] = useState('province_to_sg');
  const [postRouteCategory, setPostRouteCategory] = useState('Tuyến QL13');
  const [inputPrice, setInputPrice] = useState(180000);
  const [customDiscount, setCustomDiscount] = useState(10);

  // State phụ
  const [isDriverVip, setIsDriverVip] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // Escrow Modal
  const [selectedItemForEscrow, setSelectedItemForEscrow] = useState(null);
  const [depositStep, setDepositStep] = useState('review');
  const [bookingSeatsCount, setBookingSeatsCount] = useState(1);
  const [bookingCommitmentType, setBookingCommitmentType] = useState('full_deal'); // 'full_deal' (Chốt kèo 100% - Không thể hủy) | 'deposit_50k' (Cọc giữ chỗ 50k - Hủy trước 8h)
  const [callingData, setCallingData] = useState(null);

  // QUY CHẾ CHỐT KÈO 100%, HUỶ TRƯỚC 8H (TỐI ĐA 3 LẦN/THÁNG) & XÁC MINH 5 NGÀY
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [cancelModalRecord, setCancelModalRecord] = useState(null);
  const [isCancelWithin8Hours, setIsCancelWithin8Hours] = useState(false);
  const [cancelReasonText, setCancelReasonText] = useState('Thay đổi lịch trình đột xuất');
  const [cancelCountThisMonth, setCancelCountThisMonth] = useState(1); // Demo: đã dùng 1/3 lần hủy tháng này
  const [delayModalRecord, setDelayModalRecord] = useState(null);
  const [delayMinutes, setDelayMinutes] = useState(15);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // CƠ CHẾ CẢNH BÁO SỚM CHO CHUYẾN SÂN BAY (KHÁCH CHỦ ĐỘNG TRỪ HAO GIỜ, CẦN GẤP ĐI XE RIÊNG)
  const AIRPORT_KEYWORDS = ['sân bay', 'san bay', 'tsn', 'tân sơn nhất', 'tan son nhat', 'nội bài', 'noi bai', 'đà nẵng airport', 'cam ranh', 'phú quốc', 'ga t1', 'ga t2', 'ga quốc tế', 'ga quốc nội'];
  
  const isAirportRoute = (item) => {
    if (!item) return false;
    const searchText = `${item.from || ''} ${item.to || ''}`.toLowerCase();
    return AIRPORT_KEYWORDS.some(kw => searchText.includes(kw));
  };

  // Cấu hình cọc chuẩn của Chợ (không đền 3-4 lần phức tạp)
  const getDepositConfig = (item, seatsCount) => {
    const isAirport = isAirportRoute(item);
    const depositPerSeat = 50000;
    const depositAmount = depositPerSeat * seatsCount;

    return {
      isAirport,
      depositPerSeat,
      depositAmount,
      depositLabel: '50k'
    };
  };

  const formatVND = (num) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Tính giá chiết khấu
  const calculatePricing = (item, seats) => {
    if (!item) return { unitPrice: 0, total: 0, hasDiscount: false, savedAmount: 0, discountPercent: 0 };
    const basePrice = item.basePricePerSeat || item.expectedPrice || 180000;
    const discountPercent = item.customDiscountPercent !== undefined ? item.customDiscountPercent : 0;
    
    if (seats >= 2 && discountPercent > 0 && item.type === 'driver_offer') {
      const discountedUnit = Math.round(basePrice * (1 - discountPercent / 100));
      const total = discountedUnit * seats;
      const originalTotal = basePrice * seats;
      return {
        unitPrice: discountedUnit,
        total: total,
        hasDiscount: true,
        savedAmount: originalTotal - total,
        discountPercent: discountPercent
      };
    }

    return {
      unitPrice: basePrice,
      total: basePrice * seats,
      hasDiscount: false,
      savedAmount: 0,
      discountPercent: 0
    };
  };

  // Lọc danh sách
  const combinedMarketItems = useMemo(() => {
    let items = [];
    if (marketViewMode === 'all' || marketViewMode === 'driver_offers') {
      items = items.concat(driverOffers);
    }
    if (marketViewMode === 'all' || marketViewMode === 'passenger_requests') {
      items = items.concat(passengerRequests);
    }

    return items
      .filter((item) => !blacklistedPhones.includes(item.phoneReal))
      .filter((item) => {
        const matchTime = selectedTimeSlot === 'all' || item.timeSlot === selectedTimeSlot;
        const matchDir = selectedDirection === 'all' || item.direction === selectedDirection;
        const matchKw =
          searchKeyword.trim() === '' ||
          item.from.toLowerCase().includes(searchKeyword.toLowerCase()) ||
          item.to.toLowerCase().includes(searchKeyword.toLowerCase()) ||
          item.publicName.toLowerCase().includes(searchKeyword.toLowerCase());
        return matchTime && matchDir && matchKw;
      })
      .sort((a, b) => {
        if (a.isVip && !b.isVip) return -1;
        if (!a.isVip && b.isVip) return 1;
        return b.createdAt - a.createdAt;
      });
  }, [driverOffers, passengerRequests, marketViewMode, selectedTimeSlot, selectedDirection, searchKeyword, blacklistedPhones]);

  // Radar Match
  const autoMatchPairs = useMemo(() => {
    const pairs = [];
    driverOffers.forEach((driver) => {
      passengerRequests.forEach((req) => {
        if (
          !blacklistedPhones.includes(driver.phoneReal) &&
          !blacklistedPhones.includes(req.phoneReal) &&
          driver.direction === req.direction &&
          driver.timeSlot === req.timeSlot &&
          driver.availableSeats >= req.seatsNeeded
        ) {
          pairs.push({
            id: `MATCH-${driver.id}-${req.id}`,
            driver,
            request: req,
            timeSlotLabel: driver.timeSlotLabel,
            route: `${driver.from} ➔ ${driver.to}`,
            matchScore: 98
          });
        }
      });
    });
    return pairs;
  }, [driverOffers, passengerRequests, blacklistedPhones]);

  // ĐẶT CHUYẾN: CHỐT KÈO 100% HOẶC CỌC GIỮ CHỖ 50K
  const handleConfirmEscrow = () => {
    if (!selectedItemForEscrow) return;

    const isDriverOffer = selectedItemForEscrow.type === 'driver_offer';
    const config = getDepositConfig(selectedItemForEscrow, bookingSeatsCount);
    const { total } = calculatePricing(selectedItemForEscrow, bookingSeatsCount);
    const insuranceFee = hasInsuranceAddon ? config.insuranceFee : 0;
    const fullTripAmount = total + insuranceFee;

    const isFullDeal = bookingCommitmentType === 'full_deal';
    const depositAmount = isFullDeal ? fullTripAmount : (50000 * bookingSeatsCount);
    const paidToEscrow = isFullDeal ? fullTripAmount : depositAmount;
    const remainingCash = isFullDeal ? 0 : Math.max(0, total - depositAmount);

    const newEscrowRecord = {
      escrowId: `CX-${Math.floor(1000 + Math.random() * 9000)}`,
      targetItem: { ...selectedItemForEscrow },
      commitmentType: isFullDeal ? 'full_deal' : 'deposit_50k',
      partyRole: isDriverOffer ? (isFullDeal ? 'Khách chốt 100% Chủ Xe' : 'Khách cọc 50k Chủ Xe') : (isFullDeal ? 'Chủ xe chốt đón Khách' : 'Chủ xe nhận chuyến Khách'),
      contactName: selectedItemForEscrow.publicName,
      contactPhone: selectedItemForEscrow.phoneReal,
      seats: bookingSeatsCount,
      depositAmount: depositAmount,
      fullTripAmount: fullTripAmount,
      paidToEscrow: paidToEscrow,
      remainingCash: remainingCash,
      isAirportTrip: config.isAirport,
      totalDeal: fullTripAmount,
      timeSlot: selectedItemForEscrow.timeSlotLabel,
      from: selectedItemForEscrow.from,
      to: selectedItemForEscrow.to,
      status: 'escrow_locked',
      bothConfirmed: isFullDeal,
      createdAt: 'Vừa xong'
    };

    if (isDriverOffer) {
      setDriverOffers((prev) =>
        prev.map((d) =>
          d.id === selectedItemForEscrow.id
            ? { ...d, availableSeats: Math.max(0, d.availableSeats - bookingSeatsCount) }
            : d
        )
      );
    } else {
      setPassengerRequests((prev) => prev.filter((r) => r.id !== selectedItemForEscrow.id));
    }

    setBookedEscrows((prev) => [newEscrowRecord, ...prev]);
    setDepositStep('success');

    setTimeout(() => {
      setSelectedItemForEscrow(null);
      setDepositStep('review');
      setActiveTab('booked');
      showToast(
        isFullDeal
          ? '🎉 Chốt kèo 100% thành công! Đã chốt là đi — Không hủy chuyến. SĐT thật đối tác đã mở.'
          : '🎉 Cọc 50k giữ chỗ thành công! Áp dụng quy tắc hủy trước 8h (max 3 lần/tháng). SĐT đối tác đã mở.'
      );
    }, 1500);
  };

  // CƠ CHẾ BÁO CÁO — XÁC MINH TRONG VÒNG 5 NGÀY LÀM VIỆC TRƯỚC KHI CHUYỂN TIỀN
  const handleReportBung = (record) => {
    // Bước 1: Chuyển trạng thái sang "Đang Xác Minh" — Hẹn trong vòng 5 ngày làm việc
    setBookedEscrows((prev) =>
      prev.map((b) =>
        b.escrowId === record.escrowId
          ? { ...b, status: 'pending_review', reportedAt: Date.now() }
          : b
      )
    );
    showToast('📋 Báo cáo đã gửi! Sàn đối soát GPS, cuộc gọi, tin nhắn và chuyển tiền bồi thường cho bạn trong vòng 5 ngày làm việc.');
  };

  // Bước 2: Sàn xác minh xong (trong vòng 5 ngày làm việc) → chuyển tiền bồi thường & block
  const handleApproveCompensation = (record) => {
    const phoneToBlock = record.contactPhone;
    setBlacklistedPhones((prev) => [...prev, phoneToBlock]);
    setBookedEscrows((prev) =>
      prev.map((b) =>
        b.escrowId === record.escrowId
          ? { ...b, status: 'compensated' }
          : b
      )
    );

    const payoutAmount = record.commitmentType === 'full_deal' 
      ? (record.fullTripAmount || record.totalDeal)
      : record.depositAmount;

    showToast(`✅ XÁC MINH XONG (5 NGÀY)! Sàn chuyển toàn bộ ${formatVND(payoutAmount)} bồi thường cho bạn vì đối tác bùng/ngủ quên. ĐÃ BLOCK ${phoneToBlock} vĩnh viễn!`);
  };

  // Bước 2b: Sàn từ chối — báo cáo không đủ bằng chứng
  const handleRejectReport = (record) => {
    setBookedEscrows((prev) =>
      prev.map((b) =>
        b.escrowId === record.escrowId
          ? { ...b, status: 'escrow_locked' }
          : b
      )
    );
    showToast('❌ Báo cáo không đủ bằng chứng. Giao dịch giữ nguyên. Nếu cố tình báo cáo ảo nhiều lần sẽ bị khóa tài khoản.');
  };

  // XÁC NHẬN HOÀN THÀNH CHUYẾN ĐI (2 BÊN XÁC NHẬN ➔ SÀN GIẢI NGÂN CHO CHỦ XE)
  const handleCompleteTrip = (record) => {
    setBookedEscrows((prev) =>
      prev.map((b) =>
        b.escrowId === record.escrowId
          ? { ...b, status: 'completed', completedAt: Date.now() }
          : b
      )
    );
    const payoutAmount = record.commitmentType === 'full_deal'
      ? (record.fullTripAmount || record.totalDeal)
      : record.depositAmount;
    showToast(`🎉 XÁC NHẬN HOÀN THÀNH CHUYẾN ĐI! Sàn đã giải ngân ${formatVND(payoutAmount)} cho chủ xe. Cảm ơn hai bạn đã đồng hành văn minh!`);
  };

  // CƠ CHẾ HUỶ CHUYẾN: CHỈ DÀNH CHO CỌC 50K (HỦY TRƯỚC 8H HOÀN CỌC MAX 3 LẦN/THÁNG)
  // CÒN ĐÃ CHỐT KÈO 100%: TUYỆT ĐỐI KHÔNG HỦY (ĐÃ CHỐT LÀ ĐI)
  const handleConfirmCancelTrip = () => {
    if (!cancelModalRecord) return;
    const record = cancelModalRecord;

    if (record.commitmentType === 'full_deal') {
      showToast('🚫 Chuyến đi này thuộc diện CHỐT KÈO 100% (cam kết chắc chắn đi đường xa), TUYỆT ĐỐI KHÔNG HỦY! Ráng chịu vì hai bên đã lên kế hoạch công việc.');
      setCancelModalRecord(null);
      return;
    }

    const depositAmount = record.depositAmount || 50000;

    if (isCancelWithin8Hours) {
      // Huỷ sát giờ (< 8 tiếng) hoặc ngủ quên: KHÔNG HOÀN TIỀN CỌC 50K
      setBookedEscrows((prev) =>
        prev.map((b) =>
          b.escrowId === record.escrowId
            ? {
                ...b,
                status: 'cancelled_penalty',
                cancelReason: cancelReasonText,
                cancelledAt: Date.now()
              }
            : b
        )
      );
      showToast(`⚠️ Huỷ sát giờ (< 8h) hoặc ngủ quên: Mất 100% tiền cọc (${formatVND(depositAmount)})! Toàn bộ cọc được chuyển bồi thường cho đối tác trong 5 ngày làm việc.`);
    } else {
      // Huỷ sớm trước > 8 tiếng (tối đa 3 lần/tháng)
      if (cancelCountThisMonth >= 3) {
        showToast('⚠️ Bạn đã dùng hết 3 lượt huỷ miễn phí trong tháng này. Để tránh làm lỡ kế hoạch của người khác, bạn không thể hủy thêm!');
        return;
      }

      setCancelCountThisMonth((prev) => prev + 1);
      setBookedEscrows((prev) =>
        prev.map((b) =>
          b.escrowId === record.escrowId
            ? {
                ...b,
                status: 'cancelled_free',
                cancelReason: cancelReasonText,
                cancelledAt: Date.now()
              }
            : b
        )
      );
      showToast(`✅ Huỷ sớm thành công (> 8 tiếng) [Lần ${cancelCountThisMonth + 1}/3 tháng này]! Sàn đã hoàn trả 100% tiền cọc (${formatVND(depositAmount)}) về ví của bạn.`);
    }

    setCancelModalRecord(null);
  };

  // CƠ CHẾ BÁO TRỄ HẸN (> 15 PHÚT) — TRÁNH ĐẾN TRỄ / TRỄ CHUYẾN BAY
  const handleConfirmReportDelay = () => {
    if (!delayModalRecord) return;
    const record = delayModalRecord;

    setBookedEscrows((prev) =>
      prev.map((b) =>
        b.escrowId === record.escrowId
          ? {
              ...b,
              status: 'delay_reported',
              delayReportedAt: Date.now(),
              delayMinutes: delayMinutes
            }
          : b
      )
    );

    showToast(`⏱️ ĐÃ BÁO TRỄ HẸN (${delayMinutes} PHÚT)! Sàn đã kích hoạt cảnh báo khẩn tới đối tác. Nếu quá 15 phút không liên lạc được, bạn có quyền báo huỷ bùng để nhận bồi thường.`);
    setDelayModalRecord(null);
  };

  const currentBenchmark = ROUTE_BENCHMARKS[postRouteCategory] || ROUTE_BENCHMARKS['Tuyến QL13'];
  const isTooLow = inputPrice < currentBenchmark.minSafePrice;
  const isTooHigh = inputPrice > currentBenchmark.maxSafePrice;
  const isPriceValid = !isTooLow && !isTooHigh;

  const isLight = themeMode === 'light';

  return (
    <div className={`min-h-screen flex justify-center items-start sm:py-6 sm:px-4 font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-300 ${
      isLight ? 'bg-slate-200/80 text-slate-900' : 'bg-slate-950 text-slate-100'
    }`}>
      {/* Mobile App Viewport */}
      <div className={`w-full max-w-md min-h-screen sm:min-h-[880px] sm:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden transition-colors duration-300 ${
        isLight
          ? 'bg-slate-50 border border-slate-300/80 shadow-slate-400/20'
          : 'bg-slate-900 border border-slate-800'
      }`}>
        
        {/* TOP STATUS BAR */}
        <div className={`px-4 py-2 flex items-center justify-between text-xs border-b transition-colors duration-300 ${
          isLight ? 'bg-white/90 border-slate-200 text-slate-600' : 'bg-slate-950/90 border-slate-800/80 text-slate-400'
        }`}>
          <div className="flex items-center gap-1.5 font-bold text-emerald-700">
            <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
            <span>Đi Chung Văn Minh • Đôi Bên Cùng Có Lợi</span>
          </div>

          <button
            onClick={() => {
              const next = isLight ? 'dark' : 'light';
              setThemeMode(next);
              showToast(next === 'light' ? '☀️ Chế độ Sáng' : '🌙 Chế độ Tối');
            }}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 font-semibold transition-all ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300'
            }`}
          >
            {isLight ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-amber-300" />}
            <span className="text-[10px]">{isLight ? 'Sáng' : 'Tối'}</span>
          </button>
        </div>

        {/* HEADER */}
        <header className={`px-4 pt-3 pb-3 border-b transition-colors duration-300 ${
          isLight
            ? 'bg-gradient-to-b from-white via-white to-slate-100 border-slate-200'
            : 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-slate-800/90'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-600/20 text-white font-black">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className={`text-xl font-extrabold tracking-tight flex items-center gap-1 ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    CarMate
                  </h1>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md border border-emerald-300">
                    BẠN ĐỒNG HÀNH
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Cộng đồng đi chung xe ô tô • Tiện nghi & Văn minh
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('match')}
              className="relative px-3 py-1.5 bg-amber-500 text-slate-950 hover:bg-amber-400 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              <span>Khớp ({autoMatchPairs.length})</span>
            </button>
          </div>

          {/* 4 TAB NGƯỜI DÙNG */}
          <div className={`grid grid-cols-4 gap-1 p-1 rounded-2xl border mt-3 shadow-inner transition-colors duration-300 ${
            isLight ? 'bg-slate-200/90 border-slate-300' : 'bg-slate-950 border-slate-800'
          }`}>
            <button
              onClick={() => setActiveTab('market')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'market'
                  ? 'bg-emerald-600 text-white shadow-md font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Search className="w-4 h-4 mb-0.5" />
              <span>Tìm Chuyến</span>
            </button>

            <button
              onClick={() => setActiveTab('post')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'post'
                  ? 'bg-emerald-600 text-white shadow-md font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <PlusCircle className="w-4 h-4 mb-0.5" />
              <span>Đăng Tin</span>
            </button>

            <button
              onClick={() => setActiveTab('booked')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'booked'
                  ? 'bg-emerald-600 text-white shadow-md font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <CheckCircle2 className="w-4 h-4 mb-0.5" />
                {bookedEscrows.length > 0 && (
                  <span className="absolute -top-1 -right-2 bg-amber-500 text-slate-950 text-[9px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {bookedEscrows.length}
                  </span>
                )}
              </div>
              <span>Đã Cọc ({bookedEscrows.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('vip')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'vip'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black shadow-md'
                  : 'text-amber-600 hover:text-amber-700 font-bold'
              }`}
            >
              <Crown className="w-4 h-4 mb-0.5" />
              <span>Gói VIP</span>
            </button>
          </div>
        </header>

        {/* TOAST ALERT */}
        {toastMessage && (
          <div className="absolute top-28 left-4 right-4 z-50 bg-emerald-600 text-white text-xs font-bold px-3.5 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-2 border border-emerald-400 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-yellow-300" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* MAIN BODY */}
        <main className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 pb-20">
          
          {/* ========================================================
              TAB 1: SÀN CHỢ
              ======================================================== */}
          {activeTab === 'market' && (
            <div className="space-y-3">
              
              <div className={`grid grid-cols-3 gap-1 p-1 rounded-2xl border text-xs font-bold shadow-inner ${
                isLight ? 'bg-slate-200/90 border-slate-300' : 'bg-slate-950 border-slate-800'
              }`}>
                <button
                  onClick={() => setMarketViewMode('all')}
                  className={`py-2 rounded-xl text-center transition-all ${
                    marketViewMode === 'all'
                      ? isLight ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-800 text-slate-100 shadow'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tất Cả ({driverOffers.length + passengerRequests.length})
                </button>

                <button
                  onClick={() => setMarketViewMode('driver_offers')}
                  className={`py-2 rounded-xl text-center flex items-center justify-center gap-1 transition-all ${
                    marketViewMode === 'driver_offers'
                      ? 'bg-emerald-600 text-white shadow-md font-black'
                      : 'text-emerald-700 hover:text-emerald-800'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Xe Có Ghế ({driverOffers.length})</span>
                </button>

                <button
                  onClick={() => setMarketViewMode('passenger_requests')}
                  className={`py-2 rounded-xl text-center flex items-center justify-center gap-1 transition-all ${
                    marketViewMode === 'passenger_requests'
                      ? 'bg-blue-600 text-white shadow-md font-black'
                      : 'text-blue-700 hover:text-blue-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Khách Cần Đi ({passengerRequests.length})</span>
                </button>
              </div>

              {/* LỌC KHUNG GIỜ */}
              <div className={`p-3 rounded-2xl border shadow-sm space-y-2.5 ${
                isLight ? 'bg-white border-slate-200/80' : 'bg-slate-800/90 border-slate-700/80'
              }`}>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Khung Giờ Khởi Hành (1 Tiếng)</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {combinedMarketItems.length} tin đăng
                  </span>
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedTimeSlot(slot.id)}
                      className={`px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                        selectedTimeSlot === slot.id
                          ? 'bg-emerald-600 text-white shadow-md'
                          : isLight
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-700/70'
                      }`}
                    >
                      <span>{slot.label}</span>
                    </button>
                  ))}
                </div>

                <div className={`grid grid-cols-3 gap-2 pt-1 border-t text-xs ${
                  isLight ? 'border-slate-100' : 'border-slate-700/60'
                }`}>
                  <div className="col-span-2 relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm Bù Đốp, Lộc Ninh, Vũng Tàu, TSN..."
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      className={`w-full rounded-xl pl-8 pr-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 border ${
                        isLight
                          ? 'bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400'
                          : 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
                      }`}
                    />
                  </div>

                  <select
                    value={selectedDirection}
                    onChange={(e) => setSelectedDirection(e.target.value)}
                    className={`rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-bold border ${
                      isLight
                        ? 'bg-slate-100 border-slate-200 text-slate-700'
                        : 'bg-slate-900 border-slate-700 text-slate-200'
                    }`}
                  >
                    <option value="all">2 Chiều</option>
                    <option value="province_to_sg">Tỉnh ➔ SG</option>
                    <option value="sg_to_province">SG ➔ Tỉnh</option>
                  </select>
                </div>
              </div>

              {/* FEED */}
              <div className="space-y-3">
                {combinedMarketItems.map((item) => {
                  const isDriver = item.type === 'driver_offer';
                  const basePrice = item.basePricePerSeat || item.expectedPrice || 180000;
                  const discountPercent = item.customDiscountPercent || 0;
                  const groupPrice = Math.round(basePrice * (1 - discountPercent / 100));

                  return (
                    <div
                      key={item.id}
                      className={`relative rounded-2xl border transition-all p-3.5 shadow-sm hover:shadow-md ${
                        item.isVip
                          ? isLight
                            ? 'border-amber-400 bg-gradient-to-b from-amber-50/80 to-white shadow-amber-200/50'
                            : 'border-amber-500/60 bg-gradient-to-b from-amber-950/20 via-slate-800 to-slate-800/95'
                          : isLight
                          ? isDriver
                            ? 'border-emerald-200 bg-white hover:border-emerald-300'
                            : 'border-blue-200 bg-white hover:border-blue-300'
                          : isDriver
                          ? 'border-emerald-700/40 bg-slate-800/95'
                          : 'border-blue-700/40 bg-slate-800/95'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                            isDriver
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}>
                            {isDriver ? <Car className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                            <span>{isDriver ? 'CHỦ XE CHIA SẺ GHẾ' : 'KHÁCH CẦN GHÉP XE'}</span>
                          </span>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                            isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-900 text-slate-300 border-slate-700'
                          }`}>
                            <Clock className="w-2.5 h-2.5 text-emerald-600" />
                            <span>{item.timeSlotLabel}</span>
                          </span>
                        </div>

                        {item.isVip && (
                          <div className="flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                            <Crown className="w-2.5 h-2.5 text-amber-600" /> VIP PRO
                          </div>
                        )}
                        {isAirportRoute(item) && (
                          <div className="flex items-center gap-1 bg-rose-100 text-rose-900 border border-rose-400 text-[9px] font-black px-1.5 py-0.5 rounded-md animate-pulse">
                            <Plane className="w-2.5 h-2.5 text-rose-600" /> SÂN BAY 6X
                          </div>
                        )}
                      </div>

                      {/* PROFILE MÃ HÓA */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center ${
                            isDriver ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <span className={`text-xs font-extrabold flex items-center gap-1 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                              <span>{item.publicName}</span>
                              <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              SĐT: 09••.•••.••• (Được bảo vệ)
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px]">
                          {isDriver ? (
                            <span className="text-amber-600 font-bold flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {item.rating} ({item.completedCount} chuyến)
                            </span>
                          ) : (
                            <span className="text-blue-700 font-bold">Cần {item.seatsNeeded} ghế</span>
                          )}
                        </div>
                      </div>

                      <div className={`space-y-1 rounded-xl p-2.5 text-xs border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
                      }`}>
                        <div className="flex items-start gap-2">
                          <div className="flex flex-col items-center mt-0.5">
                            <div className={`w-2 h-2 rounded-full ${isDriver ? 'bg-emerald-600' : 'bg-blue-600'}`} />
                            <div className="w-0.5 h-5 bg-slate-300 my-0.5" />
                            <div className="w-2 h-2 rounded-full bg-teal-500" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className={`font-bold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                              <span className="text-slate-400 font-normal">Đón:</span> {item.from}
                            </p>
                            <p className={`font-bold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                              <span className="text-slate-400 font-normal">Đến:</span> {item.to}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* CHIẾT KHẤU RIÊNG */}
                      {isDriver && discountPercent > 0 && (
                        <div className="mt-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-emerald-900 text-[11px] font-bold">
                            <Gift className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Ưu đãi ghép từ 2 ghế:</span>
                          </div>
                          <span className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-xs">
                            {formatVND(groupPrice)}/người (-{discountPercent}%)
                          </span>
                        </div>
                      )}

                      {/* FOOTER */}
                      <div className={`mt-3 pt-2.5 border-t flex items-center justify-between gap-2 ${
                        isLight ? 'border-slate-100' : 'border-slate-700/60'
                      }`}>
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-black text-emerald-600">
                              {formatVND(basePrice)}
                            </span>
                            <span className="text-[10px] text-slate-400">/người</span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            {isAirportRoute(item) ? (
                              <span className="flex items-center gap-1 text-rose-600 font-bold">
                                <Plane className="w-2.5 h-2.5" /> Cọc SÂN BAY: 100k / ghế • Đền 6X
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" /> Cọc: 50k / ghế
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedItemForEscrow(item);
                            setDepositStep('review');
                            setBookingSeatsCount(isDriver ? 1 : item.seatsNeeded);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer ${
                            isDriver
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                          }`}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>{isDriver 
                            ? `Khách Ghép Chuyến (Cọc ${isAirportRoute(item) ? '100k' : '50k'})` 
                            : `Chủ Xe Nhận Đón (Cọc ${isAirportRoute(item) ? '100k' : '50k'})`}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 2: RADAR TỰ ĐỘNG KHỚP LỆNH
              ======================================================== */}
          {activeTab === 'match' && (
            <div className="space-y-3.5">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-3.5 text-slate-900">
                <div className="flex items-center gap-2 text-amber-800 font-black text-sm">
                  <Zap className="w-5 h-5 text-amber-600 fill-amber-600" />
                  <span>Radar Khớp Lệnh 2 Chiều Tự Động</span>
                </div>
                <p className="text-xs text-slate-700 mt-1">
                  Tự động tìm kiếm và ghép nối các chuyến đi trùng tuyến & khung giờ để tối ưu chi phí.
                </p>
              </div>

              {autoMatchPairs.map((pair) => (
                <div
                  key={pair.id}
                  className={`border-2 border-amber-400 rounded-2xl p-3.5 shadow-md space-y-3 ${
                    isLight ? 'bg-white' : 'bg-slate-800'
                  }`}
                >
                  <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-100' : 'border-slate-700'}`}>
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-600" /> Khớp {pair.matchScore}% Trùng Khung Giờ
                    </span>
                    <span className="text-xs font-black text-emerald-600">{pair.timeSlotLabel}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-200 space-y-1">
                      <span className="text-[10px] text-emerald-800 font-extrabold uppercase block">🚗 Chủ Xe:</span>
                      <p className="font-bold text-slate-900">{pair.driver.publicName}</p>
                      <p className="text-[11px] text-slate-600">{pair.driver.carType}</p>
                      <p className="text-[11px] text-emerald-700 font-black">{formatVND(pair.driver.basePricePerSeat)}/người</p>
                    </div>

                    <div className="bg-blue-50 rounded-xl p-2.5 border border-blue-200 space-y-1">
                      <span className="text-[10px] text-blue-800 font-extrabold uppercase block">🙋 Khách Cần Xe:</span>
                      <p className="font-bold text-slate-900">{pair.request.publicName}</p>
                      <p className="text-[11px] text-slate-600">Cần {pair.request.seatsNeeded} ghế</p>
                      <p className="text-[11px] text-blue-700 font-black">Bù {formatVND(pair.request.expectedPrice)}/ghế</p>
                    </div>
                  </div>

                  <p className={`text-[11px] p-2 rounded-lg border ${
                    isLight ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-slate-900 text-slate-300 border-slate-800'
                  }`}>
                    📍 <strong>Lộ trình khớp:</strong> {pair.route}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setSelectedItemForEscrow(pair.driver);
                        setDepositStep('review');
                        setBookingSeatsCount(pair.request.seatsNeeded);
                      }}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] rounded-xl shadow-md flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Khách Chốt Xe Này</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedItemForEscrow(pair.request);
                        setDepositStep('review');
                        setBookingSeatsCount(pair.request.seatsNeeded);
                      }}
                      className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] rounded-xl shadow-md flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Chủ Xe Nhận Khách Này</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ========================================================
              TAB 3: ĐĂNG TIN
              ======================================================== */}
          {activeTab === 'post' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!isPriceValid) {
                  showToast(isTooLow 
                    ? '🛡️ Giá quá thấp có thể khiến khách nghi ngờ lừa đảo. Vui lòng điều chỉnh trong khung thị trường nhé!'
                    : '🛡️ Giá vượt quá mức hợp lý. Vui lòng điều chỉnh để khách dễ tiếp cận hơn nhé!');
                  return;
                }

                const formData = new FormData(e.currentTarget);
                const isDriver = postRole === 'driver';
                const fromLoc = formData.get('fromLocation') || (postDirection === 'province_to_sg' ? 'Lộc Ninh (Bình Phước)' : 'Sân Bay Tân Sơn Nhất');
                const toLoc = formData.get('toLocation') || (postDirection === 'province_to_sg' ? 'Sài Gòn (BX Miền Đông)' : 'Lộc Ninh - Bình Phước');
                const timeSlotId = formData.get('timeSlot') || '07:00-08:00';
                const timeSlotObj = TIME_SLOTS.find((s) => s.id === timeSlotId) || TIME_SLOTS[2];
                const basePrice = inputPrice;
                const seats = parseInt(formData.get('seats') || '3', 10);
                const phone = formData.get('phone') || '0988.777.666';
                const randomId = Math.floor(100 + Math.random() * 900);

                if (isDriver) {
                  const newDriverPost = {
                    id: `DRV-${Date.now().toString().slice(-4)}`,
                    type: 'driver_offer',
                    maskedCode: `CX-BP${randomId}`,
                    publicName: `Chủ xe #${randomId}`,
                    phoneReal: phone,
                    direction: postDirection,
                    from: fromLoc,
                    to: toLoc,
                    routeCategory: postRouteCategory,
                    date: 'Hôm nay',
                    timeSlot: timeSlotId,
                    timeSlotLabel: timeSlotObj.label,
                    carType: formData.get('car') || 'Xe 7 chỗ',
                    capacity: seats,
                    availableSeats: seats,
                    basePricePerSeat: basePrice,
                    customDiscountPercent: customDiscount,
                    depositPerSeat: 50000,
                    isVip: isDriverVip,
                    rating: 5.0,
                    completedCount: 1,
                    notes: formData.get('notes') || 'Xe gia đình sạch sẽ, đi đúng giờ.',
                    createdAt: Date.now()
                  };
                  setDriverOffers((prev) => [newDriverPost, ...prev]);
                  showToast('🚗 Đã đăng chuyến (Profile đã được mã hóa bảo mật)!');
                } else {
                  const newPassengerReq = {
                    id: `REQ-${Date.now().toString().slice(-4)}`,
                    type: 'passenger_request',
                    maskedCode: `KH-SG${randomId}`,
                    publicName: `Khách ghép #${randomId}`,
                    phoneReal: phone,
                    direction: postDirection,
                    from: fromLoc,
                    to: toLoc,
                    routeCategory: postRouteCategory,
                    date: 'Hôm nay',
                    timeSlot: timeSlotId,
                    timeSlotLabel: timeSlotObj.label,
                    seatsNeeded: seats,
                    expectedPrice: basePrice,
                    depositPerSeat: 50000,
                    notes: formData.get('notes') || 'Cần tìm xe ghép đi cùng giờ này.',
                    status: 'open',
                    createdAt: Date.now()
                  };
                  setPassengerRequests((prev) => [newPassengerReq, ...prev]);
                  showToast('🙋 Đã đăng nhu cầu tìm xe (Profile đã được bảo vệ)!');
                }

                setActiveTab('market');
              }}
              className={`border rounded-3xl p-4 shadow-sm space-y-3.5 ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-800/90 border-slate-700/80'
              }`}
            >
              <div className={`border-b pb-2.5 ${isLight ? 'border-slate-100' : 'border-slate-700'}`}>
                <h2 className={`text-sm font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <Send className="w-4 h-4 text-emerald-600" />
                  <span>Đăng Chuyến Lên CarMate (Bảo Mật Profile)</span>
                </h2>
                <p className="text-[11px] text-slate-400">Tự do đặt giá • Ẩn số điện thoại chống đối thủ quấy phá</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold block">1. Bạn Là Chủ Xe Hay Người Cần Đi? *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPostRole('driver')}
                    className={`py-2.5 px-2 rounded-2xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                      postRole === 'driver'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                        : isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Car className="w-5 h-5" />
                    <span>Chủ Xe (Có Ghế Trống)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostRole('passenger')}
                    className={`py-2.5 px-2 rounded-2xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                      postRole === 'passenger'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span>Hành Khách (Cần Ghép)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold block mb-1">2. Chọn Tuyến Đường *</label>
                <select
                  value={postRouteCategory}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setPostRouteCategory(newCat);
                    const bench = ROUTE_BENCHMARKS[newCat];
                    if (bench) setInputPrice(bench.suggestedRate);
                  }}
                  className={`w-full rounded-xl px-3 py-2 text-xs font-bold border ${
                    isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                  }`}
                >
                  {Object.entries(ROUTE_BENCHMARKS).map(([key, val]) => (
                    <option key={key} value={key}>{key}: {val.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold block">3. Chiều Tuyến Đường *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPostDirection('province_to_sg')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 ${
                      postDirection === 'province_to_sg'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold'
                        : isLight
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    <span>Tỉnh ➔ Sài Gòn (Đi Lên)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostDirection('sg_to_province')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 ${
                      postDirection === 'sg_to_province'
                        ? 'bg-blue-100 text-blue-900 border-blue-400 font-bold'
                        : isLight
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    <span>Sài Gòn ➔ Về Tỉnh (Đi Về)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold block mb-1">4. Khung Giờ Khởi Hành (1 Tiếng) *</label>
                <select
                  name="timeSlot"
                  defaultValue="07:00-08:00"
                  className={`w-full rounded-xl px-3 py-2 text-xs font-bold border ${
                    isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                  }`}
                >
                  {TIME_SLOTS.filter((s) => s.id !== 'all').map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-bold block mb-1">Điểm Đón Cụ Thể *</label>
                  <input
                    type="text"
                    name="fromLocation"
                    key={`from-${postDirection}`}
                    defaultValue={postDirection === 'province_to_sg' ? 'Lộc Ninh (Chợ Lộc Ninh - QL13)' : 'Sân Bay Tân Sơn Nhất (Ga T1/T2)'}
                    required
                    className={`w-full rounded-xl px-3 py-2 text-xs border ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold block mb-1">Điểm Đến / Trả Khách *</label>
                  <input
                    type="text"
                    name="toLocation"
                    key={`to-${postDirection}`}
                    defaultValue={postDirection === 'province_to_sg' ? 'Sài Gòn (Bến xe Miền Đông mới / Hàng Xanh)' : 'Chơn Thành - Bình Long - Lộc Ninh (Bình Phước)'}
                    required
                    className={`w-full rounded-xl px-3 py-2 text-xs border ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                    }`}
                  />
                </div>
              </div>

              {/* LƯU Ý KHI ĐĂNG CHUYẾN SÂN BAY (BẢO VỆ CẢ CHỦ XE & KHÁCH) */}
              <div className="p-3 rounded-2xl border border-amber-300 bg-amber-50/80 dark:bg-amber-950/40 text-slate-800 dark:text-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300 text-xs">
                  <Plane className="w-3.5 h-3.5 text-amber-600" />
                  <span>Lưu ý đối với lộ trình qua Sân Bay:</span>
                </div>
                <p className="text-[10.5px] text-slate-600 dark:text-slate-300 leading-tight">
                  • <strong>Hành lý đi ghép:</strong> Mỗi người tối đa 1 vali (20-24 inch) + 1 balo nhỏ để đảm bảo cốp xe.<br/>
                  • <strong>Thời gian:</strong> Nên trừ hao kẹt xe 2,5 - 3 tiếng trước giờ bay. Ga sân bay cấm đỗ xe quá 15 phút.
                </p>
              </div>

              {/* BƯỚC ĐỊNH GIÁ */}
              <div className="bg-slate-100 border border-slate-300/80 rounded-2xl p-3.5 space-y-3 text-xs text-slate-900">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    5. Chi Phí Chia Sẻ / Người (đ):
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Xăng + cầu đường: {formatVND(currentBenchmark.minSafePrice)} - {formatVND(currentBenchmark.maxSafePrice)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold block mb-1">
                      {postRole === 'driver' ? 'Số Ghế Trống Nhận' : 'Số Ghế Cần Đi'} *
                    </label>
                    <select
                      name="seats"
                      defaultValue="3"
                      className="w-full rounded-xl px-3 py-2 text-xs font-bold border bg-white border-slate-300 text-slate-900"
                    >
                      <option value="1">1 ghế</option>
                      <option value="2">2 ghế</option>
                      <option value="3">3 ghế</option>
                      <option value="4">4 ghế</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold block mb-1">
                      Chi phí / người (đ) *
                    </label>
                    <input
                      type="number"
                      step="10000"
                      value={inputPrice}
                      onChange={(e) => setInputPrice(parseInt(e.target.value || '0', 10))}
                      required
                      className={`w-full rounded-xl px-3 py-2 text-xs font-black border bg-white ${
                        isPriceValid
                          ? 'border-emerald-500 text-emerald-700'
                          : 'border-rose-500 text-rose-600'
                      }`}
                    />
                  </div>
                </div>

                {isTooLow && (
                  <div className="bg-rose-50 border border-rose-300 rounded-xl p-2.5 text-xs text-rose-900">
                    ⚠️ Chi phí dưới {formatVND(currentBenchmark.minSafePrice)} thấp hơn tiền xăng + cầu đường thực tế. Khách có thể nghi ngờ tin ảo.
                  </div>
                )}

                {isTooHigh && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-900">
                    ⚠️ Chi phí vượt {formatVND(currentBenchmark.maxSafePrice)} — cao hơn chi phí thực tế tuyến này. Nên điều chỉnh để dễ ghép hơn.
                  </div>
                )}

                {postRole === 'driver' && isPriceValid && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-emerald-700" />
                      Chính Sách Giảm Giá Khi Ghép Nhóm:
                    </span>

                    <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                      {[0, 5, 10, 15, 20].map((percent) => (
                        <button
                          key={percent}
                          type="button"
                          onClick={() => setCustomDiscount(percent)}
                          className={`py-1.5 rounded-lg font-bold border transition-all ${
                            customDiscount === percent
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {percent === 0 ? '0%' : `-${percent}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold block mb-1">
                  SĐT Xác Thực (Hệ thống tự động ẩn, chỉ đối tác cọc 50k mới thấy) *
                </label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue="0988.234.567"
                  required
                  className={`w-full rounded-xl px-3 py-2 text-xs border ${
                    isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={!isPriceValid}
                className={`w-full py-3 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  isPriceValid
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-98'
                    : 'bg-amber-100 text-amber-700 border border-amber-300 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>{isPriceValid ? 'Đăng Chuyến Lên CarMate' : 'Điều Chỉnh Giá Trong Khung Thị Trường'}</span>
              </button>
            </form>
          )}

          {/* ========================================================
              TAB 4: CHUYẾN ĐÃ ĐẶT (CHỐT KÈO 100% & CỌC 50K)
              ======================================================== */}
          {activeTab === 'booked' && (
            <div className="space-y-4">
              {/* BANNER CAM KẾT CHỐT KÈO 100% & CỌC 50K */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 border border-emerald-300 rounded-2xl p-3.5 text-slate-900 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                    <Scale className="w-5 h-5 text-emerald-700" />
                    <span>Quy Chế Chốt Kèo 100% & Cọc Giữ Chỗ 50k</span>
                  </div>
                  <button
                    onClick={() => setShowPolicyModal(true)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-emerald-400 text-emerald-800 text-[11px] font-bold rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Xem Quy Chế</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700">
                  <div className="bg-white/85 p-2 rounded-xl border border-emerald-200 shadow-xs">
                    <p className="font-bold text-emerald-900 flex items-center gap-1">
                      <span>🔒</span>
                      <span>Chốt Kèo 100% (Đường Xa):</span>
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      Sàn giữ 100% tiền trung gian. Đã chốt là đi — <strong>TUYỆT ĐỐI KHÔNG HỦY</strong> để tránh lỡ dở công việc hai bên.
                    </p>
                  </div>
                  <div className="bg-white/85 p-2 rounded-xl border border-blue-200 shadow-xs">
                    <p className="font-bold text-blue-900 flex items-center gap-1">
                      <span>🎫</span>
                      <span>Cọc Giữ Chỗ 50k:</span>
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      <strong>Hủy trước &gt; 8h hoàn 100% cọc</strong> (tối đa 3 lần/tháng). Hủy dưới 8h / ngủ quên mất cọc đền đối tác.
                    </p>
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 font-medium">
                  ⏳ Mọi trường hợp đối tác ngủ quên / không đến: Sàn đối soát GPS và chuyển tiền bồi thường trong vòng <strong>5 ngày làm việc</strong>.
                </p>
              </div>

              {bookedEscrows.length === 0 ? (
                <div className={`rounded-3xl p-8 text-center border space-y-3 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-800/40 border-slate-800'
                }`}>
                  <ShieldCheck className="w-14 h-14 text-slate-400 mx-auto" />
                  <h3 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                    Chưa có giao dịch chốt kèo nào
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Vào tab <strong className="text-emerald-600">Sàn Chợ</strong> hoặc <strong className="text-amber-600">Khớp Lệnh</strong> để chốt kèo chắc chắn đi nhé!
                  </p>
                </div>
              ) : (
                bookedEscrows.map((record) => (
                  <div
                    key={record.escrowId}
                    className={`border-2 rounded-2xl p-4 shadow-md space-y-3 ${
                      record.commitmentType === 'full_deal' ? 'border-emerald-400' : 'border-blue-400'
                    } ${isLight ? 'bg-white' : 'bg-slate-800'}`}
                  >
                    <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-100' : 'border-slate-700'}`}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">MÃ: {record.escrowId}</span>
                          {record.commitmentType === 'full_deal' ? (
                            <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                              <span>🔒</span>
                              <span>Chốt Kèo 100%</span>
                            </span>
                          ) : (
                            <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                              <span>🎫</span>
                              <span>Cọc 50k Giữ Chỗ</span>
                            </span>
                          )}
                        </div>
                        <h4 className={`text-sm font-black mt-0.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{record.contactName}</h4>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                        record.commitmentType === 'full_deal'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-blue-100 text-blue-900 border-blue-300'
                      }`}>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {record.partyRole} ({record.seats} Ghế)
                      </span>
                    </div>

                    {/* CẢNH BÁO SÂN BAY TRỪ HAO THỜI GIAN */}
                    {record.isAirportTrip && (
                      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Plane className="w-3.5 h-3.5 text-amber-600" />
                          <span>Chuyến Sân Bay: Chủ động đón trước 2,5 - 3 tiếng để kịp check-in</span>
                        </span>
                        <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-black">Lưu ý giờ</span>
                      </div>
                    )}

                    <div className="bg-emerald-900 text-white rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Unlock className="w-3 h-3 text-emerald-300" /> SĐT Thật (Đã Mở)
                        </span>
                        <p className="text-base font-black text-emerald-300 font-mono mt-0.5">
                          {record.contactPhone}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCallingData(record)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1 shadow cursor-pointer active:scale-95"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Gọi</span>
                        </button>

                        <a
                          href={`https://zalo.me/${record.contactPhone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow active:scale-95"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Zalo</span>
                        </a>
                      </div>
                    </div>

                    <div className={`rounded-xl p-2.5 text-xs space-y-1 border ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900/80 border-slate-700 text-slate-200'
                    }`}>
                      <p><span className="text-slate-400">Khung giờ:</span> <strong className="text-emerald-600">{record.timeSlot}</strong></p>
                      <p><span className="text-slate-400">Điểm đón:</span> <span>{record.from}</span></p>
                      <p><span className="text-slate-400">Điểm đến:</span> <span>{record.to}</span></p>
                    </div>

                    {/* KHỐI HIỂN THỊ TIỀN THEO HÌNH THỨC */}
                    <div className={`rounded-xl p-2.5 text-xs space-y-1.5 border ${
                      isLight ? 'bg-slate-50 border-slate-100' : 'bg-slate-900/50 border-slate-800'
                    }`}>
                      {record.commitmentType === 'full_deal' ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-800 flex items-center gap-1">
                              <span>🔒</span>
                              <span>Chốt Kèo 100% (CarMate bảo chứng an toàn):</span>
                            </span>
                            <span className="font-black text-emerald-600">{formatVND(record.fullTripAmount || record.totalDeal)}</span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[11px]">
                            <span>Thanh toán thêm trên xe:</span>
                            <span className="font-black text-emerald-700">0đ (Đã thanh toán trọn gói qua CarMate)</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-blue-800 flex items-center gap-1">
                              <span>🎫</span>
                              <span>Tiền cọc giữ chỗ (Sàn tạm giữ):</span>
                            </span>
                            <span className="font-black text-blue-600">{formatVND(record.depositAmount || 50000)}</span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[11px]">
                            <span>Thanh toán thêm khi lên xe:</span>
                            <span className="font-black text-slate-800">{formatVND(record.remainingCash)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* TRẠNG THÁI & HÀNH ĐỘNG HUỶ / PHẠT / BÁO TRỄ */}
                    {record.status === 'completed' ? (
                      <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 text-xs text-emerald-900 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-black">🎉 CHUYẾN ĐI ĐÃ HOÀN THÀNH</p>
                          <p className="text-[10px] text-emerald-700 mt-0.5">
                            Hai bên đã xác nhận hoàn thành chuyến đi. Sàn đã giải ngân {formatVND(record.fullTripAmount || record.totalDeal || record.depositAmount)} cho chủ xe.
                          </p>
                        </div>
                      </div>
                    ) : record.status === 'delay_reported' ? (
                      <div className="space-y-2">
                        <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-900 flex items-center gap-2">
                          <Timer className="w-4 h-4 text-amber-600 shrink-0 animate-spin" />
                          <div>
                            <p className="font-black">⏱️ ĐÃ BÁO CÁO ĐỐI TÁC TRỄ HẸN ({record.delayMinutes || 15} PHÚT)</p>
                            <p className="text-[10px] text-amber-700 mt-0.5">
                              Sàn đã gửi cảnh báo giục tài xế. Nếu quá 15 phút không liên lạc được, bấm "Báo Bùng / Ngủ Quên" để sàn giải quyết bồi thường trong 5 ngày làm việc.
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleReportBung(record)}
                          className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                          <span>Chờ Quá 15p Không Đến ➔ Báo Bùng / Ngủ Quên</span>
                        </button>
                      </div>
                    ) : record.status === 'cancelled_free' ? (
                      <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 text-xs text-emerald-900 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-black">✅ ĐÃ HUỶ CỌC TRƯỚC 8 TIẾNG (HỢP LỆ)</p>
                          <p className="text-[10px] text-emerald-700 mt-0.5">
                            Lý do: {record.cancelReason || 'Thay đổi kế hoạch'}. Sàn đã hoàn trả 100% tiền cọc ({formatVND(record.depositAmount)}) về ví của bạn.
                          </p>
                        </div>
                      </div>
                    ) : record.status === 'cancelled_penalty' ? (
                      <div className="bg-rose-50 border border-rose-300 rounded-xl p-2.5 text-xs text-rose-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <p className="font-black">⚠️ ĐÃ HUỶ CỌC DƯỚI 8 TIẾNG / BÙNG KÈO</p>
                          <p className="text-[10px] text-rose-700 mt-0.5">
                            Lý do: {record.cancelReason || 'Việc bận đột xuất'}. Toàn bộ tiền cọc {formatVND(record.depositAmount)} được chuyển bồi thường cho đối tác bị lỡ kế hoạch trong vòng 5 ngày làm việc.
                          </p>
                        </div>
                      </div>
                    ) : record.status === 'pending_review' ? (
                      <div className="space-y-2">
                        <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-900 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-spin" />
                          <div>
                            <p className="font-black">⏳ ĐANG XÁC MINH BÁO CÁO (HẸN TRONG 5 NGÀY LÀM VIỆC)</p>
                            <p className="text-[10px] text-amber-700 mt-0.5">
                              Sàn đang kiểm tra đối soát GPS, lịch sử cuộc gọi, tin nhắn 2 bên. Sau khi xác minh đúng đối tác ngủ quên/bùng kèo, tiền bồi thường ({formatVND(record.commitmentType === 'full_deal' ? (record.fullTripAmount || record.totalDeal) : record.depositAmount)}) sẽ được chuyển thẳng cho bạn.
                            </p>
                          </div>
                        </div>
                        {/* NÚT DEMO: Sàn duyệt / từ chối (thực tế chỉ admin mới có) */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleApproveCompensation(record)}
                            className="py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Demo: Duyệt Bồi Thường (5 Ngày)</span>
                          </button>
                          <button
                            onClick={() => handleRejectReport(record)}
                            className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            <span>Demo: Từ Chối</span>
                          </button>
                        </div>
                      </div>
                    ) : record.status === 'compensated' ? (
                      <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 text-xs text-emerald-900 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-black">✅ ĐÃ XÁC MINH & BỒI THƯỜNG XONG (5 NGÀY)</p>
                          <p className="text-[10px] text-emerald-700 mt-0.5">
                            Sàn đã hoàn tất xác minh và chuyển toàn bộ tiền bồi thường cho bạn do đối tác ngủ quên/bùng kèo. Đối tác đã bị khóa tài khoản vĩnh viễn.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {record.commitmentType === 'full_deal' ? (
                          /* GIAO DIỆN CHỐT KÈO 100%: TUYỆT ĐỐI KHÔNG CÓ NÚT HỦY CHUYẾN */
                          <>
                            <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-[11px] space-y-0.5">
                              <p className="font-black flex items-center gap-1">
                                <span>🔒</span>
                                <span>ĐÃ CHỐT KÈO 100% — TUYỆT ĐỐI KHÔNG THỂ HỦY</span>
                              </p>
                              <p className="text-[10.5px] text-amber-900 leading-snug">
                                Đoạn đường đi xa, hai bên đã lên lịch công việc chắc chắn nên không áp dụng hủy chuyến. Bên nào tự ý bỏ đi hoặc ngủ quên sẽ mất toàn bộ tiền đền đối tác sau 5 ngày làm việc.
                              </p>
                            </div>

                            {/* NÚT XÁC NHẬN HOÀN THÀNH CHUYẾN ĐI (GIẢI NGÂN) */}
                            <button
                              onClick={() => handleCompleteTrip(record)}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all active:scale-98"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Xác Nhận Đã Đến Nơi ➔ Giải Ngân Cho Chủ Xe</span>
                            </button>

                            {/* NÚT BÁO TRỄ */}
                            <button
                              onClick={() => {
                                setDelayModalRecord(record);
                                setDelayMinutes(15);
                              }}
                              className="w-full py-2 px-2 rounded-xl text-[11px] font-bold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-98 transition-all"
                            >
                              <Timer className="w-3.5 h-3.5 text-amber-600" />
                              <span>Báo Đối Tác Đến Trễ Hẹn (&gt;15p)</span>
                            </button>

                            {/* NÚT BÁO BÙNG / NGỦ QUÊN ĐỂ SÀN XÁC MINH 5 NGÀY */}
                            <button
                              onClick={() => handleReportBung(record)}
                              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              <span>Báo Bùng / Ngủ Quên ➔ Sàn Xác Minh 5 Ngày & Chuyển Tiền</span>
                            </button>
                          </>
                        ) : (
                          /* GIAO DIỆN CỌC 50K: CÓ NÚT HỦY TRƯỚC 8 TIẾNG */
                          <>
                            <div className={`flex items-center justify-between text-[10px] px-2.5 py-1.5 rounded-lg border ${
                              isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-blue-600" />
                                <span>Cọc 50k: Xe chờ <strong>15 phút</strong></span>
                              </span>
                              <span>Huỷ &gt;8h: <strong>Hoàn cọc (max 3 lần/tháng)</strong></span>
                            </div>

                            {/* NÚT THAO TÁC 2 CHIỀU: BÁO TRỄ & HUỶ CỌC */}
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => {
                                  setDelayModalRecord(record);
                                  setDelayMinutes(15);
                                }}
                                className="py-2 px-2 rounded-xl text-[11px] font-bold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-98 transition-all"
                              >
                                <Timer className="w-3.5 h-3.5 text-amber-600" />
                                <span>Báo Trễ Hẹn (&gt;15p)</span>
                              </button>

                              <button
                                onClick={() => {
                                  setCancelModalRecord(record);
                                  setIsCancelWithin8Hours(false);
                                  setCancelReasonText('Thay đổi lịch trình cá nhân');
                                }}
                                className={`py-2 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-98 transition-all ${
                                  isLight
                                    ? 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    : 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300'
                                }`}
                              >
                                <Ban className="w-3.5 h-3.5 text-rose-500" />
                                <span>Huỷ Cọc Giữ Chỗ</span>
                              </button>
                            </div>

                            {/* NÚT BÁO BÙNG KÈO ĐỂ SÀN XÁC MINH 5 NGÀY */}
                            <button
                              onClick={() => handleReportBung(record)}
                              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              <span>Báo Bùng Cọc / Không Đến ➔ Sàn Xác Minh 5 Ngày</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ========================================================
              TAB VIP
              ======================================================== */}
          {activeTab === 'vip' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-500 text-slate-950 rounded-3xl p-4.5 shadow-lg relative overflow-hidden">
                <span className="bg-slate-950 text-amber-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                  Gói Hội Viên Chủ Xe
                </span>
                <h2 className="text-xl font-black tracking-tight mt-2 text-slate-950">
                  Chủ Xe VIP Pro — CarMate
                </h2>
                <p className="text-xs font-bold text-slate-900 mt-0.5">
                  Lấp đầy xe siêu tốc 2 chiều • Ghim TOP đầu toàn quốc • 0% phí sàn
                </p>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-950">99.000đ</span>
                  <span className="text-xs font-bold text-slate-900">/tháng</span>
                </div>
              </div>

              <div className={`border rounded-3xl p-4 shadow-sm space-y-3 ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-800/90 border-slate-700/80'
              }`}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <BadgePercent className="w-4 h-4 text-emerald-600" />
                  <span>Quyền Lợi Gói VIP Pro</span>
                </h3>

                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2 text-emerald-700 font-bold">
                    <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span><strong>0% phí sàn</strong> (Miễn 5.000đ/cuốc khớp lệnh)</span>
                  </li>
                  <li className="flex items-start gap-2 text-amber-700 font-bold">
                    <Check className="w-4 h-4 shrink-0 text-amber-500" />
                    <span><strong>Ghim TOP 1</strong> trên Sàn Chợ toàn quốc</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-700">
                    <Check className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>Ưu tiên đẩy thông báo khi có Khách đăng tìm xe</span>
                  </li>
                </ul>

                <button
                  onClick={() => {
                    setIsDriverVip(true);
                    showToast('🎉 Bạn đang là Chủ Xe VIP Pro - 0% Phí Sàn!');
                  }}
                  className="w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 cursor-pointer active:scale-98"
                >
                  <Crown className="w-4 h-4 text-slate-950" />
                  <span>{isDriverVip ? 'Bạn Đang Là Chủ Xe VIP Pro (Đang Hoạt Động)' : 'Nâng Cấp Gói VIP Ngay (99.000đ/Tháng)'}</span>
                </button>
              </div>

              {/* ROADMAP TƯƠNG LAI: CHUYÊN TUYẾN SÂN BAY RIÊNG BIỆT */}
              <div className={`border border-dashed rounded-3xl p-4 space-y-2 ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-700' : 'bg-slate-900/50 border-slate-700 text-slate-300'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600">
                    <Plane className="w-4 h-4" />
                    <span>Chuyên Tuyến Sân Bay (Dịch Vụ Riêng)</span>
                  </span>
                  <span className="text-[9px] bg-blue-100 text-blue-800 font-black px-2 py-0.5 rounded-full">
                    Sắp Ra Mắt
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Dành riêng cho các chuyến xe dịch vụ chuyên sân bay: Tích hợp theo dõi mã hiệu chuyến bay tự động, đón tận sảnh ga đến T1/T2, và chính sách cam kết thời gian riêng biệt.
                </p>
              </div>
            </div>
          )}

        </main>

        {/* ========================================================
            MODAL ESCROW DEPOSIT (CHỐT KÈO 100% HOẶC CỌC 50K)
            ======================================================== */}
        {selectedItemForEscrow && (() => {
          const pricing = calculatePricing(selectedItemForEscrow, bookingSeatsCount);
          const isDriverOffer = selectedItemForEscrow.type === 'driver_offer';
          const maxCapacity = selectedItemForEscrow.availableSeats || selectedItemForEscrow.capacity || 4;
          const depositAmount = 50000 * bookingSeatsCount;

          return (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
              <div className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto border ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
              }`}>
                
                <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {isDriverOffer ? 'Khách Khớp Ghế Đi Chung' : 'Chủ Xe Nhận Đón Hành Khách'}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {isDriverOffer ? 'Chốt kèo 100% (không hủy) hoặc Cọc 50k (hủy trước 8h)' : 'Nhận đón và khớp lịch với hành khách'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedItemForEscrow(null)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {depositStep === 'review' && (
                  <div className="space-y-3.5">
                    
                    <div className={`rounded-2xl p-3 border space-y-1.5 text-xs ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                          Đối tác: {selectedItemForEscrow.publicName}
                        </span>
                        <span className="text-emerald-600 font-bold">{selectedItemForEscrow.timeSlotLabel}</span>
                      </div>
                      <p className="text-slate-600">
                        {selectedItemForEscrow.from} ➔ {selectedItemForEscrow.to}
                      </p>
                    </div>

                    {isDriverOffer && (
                      <div className={`p-3 rounded-2xl border flex items-center justify-between ${
                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
                      }`}>
                        <div>
                          <span className="text-xs font-bold block">Số ghế muốn ghép:</span>
                          <span className="text-[11px] text-slate-500">Cọc 50k/ghế bảo chứng</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setBookingSeatsCount(Math.max(1, bookingSeatsCount - 1))}
                            className="w-7 h-7 rounded-lg bg-slate-300 hover:bg-slate-400 text-slate-900 font-black flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="text-base font-black text-emerald-600">{bookingSeatsCount}</span>
                          <button
                            type="button"
                            onClick={() => setBookingSeatsCount(Math.min(maxCapacity, bookingSeatsCount + 1))}
                            className="w-7 h-7 rounded-lg bg-slate-300 hover:bg-slate-400 text-slate-900 font-black flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}

                    {/* CẢNH BÁO SÂN BAY HAI CHIỀU (BẢO VỆ CẢ KHÁCH VÀ CHỦ XE) */}
                    {isAirportRoute(selectedItemForEscrow) && (
                      <div className="p-3.5 rounded-2xl border-2 border-amber-400 bg-amber-50/90 dark:bg-amber-950/40 text-slate-900 dark:text-slate-100 space-y-2 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-black text-xs text-amber-900 dark:text-amber-300">
                            <Plane className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>LƯU Ý CHUYẾN SÂN BAY (BẢO VỆ CẢ 2 BÊN)</span>
                          </div>
                          <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded">
                            Đi chung tiết kiệm
                          </span>
                        </div>
                        <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1 pl-1">
                          <li>• <strong>Giờ giấc:</strong> Chủ động hẹn trước giờ bay ít nhất <strong>2,5 - 3 tiếng</strong> để phòng ngừa kẹt xe giờ cao điểm.</li>
                          <li>• <strong>Hành lý đi ghép:</strong> Tối đa <strong>1 vali tiêu chuẩn (20-24 inch) + 1 balo nhỏ/ghế</strong> để đủ chỗ cốp xe.</li>
                          <li>• <strong>Quy định ga T1/T2:</strong> Sân bay cấm đỗ lâu, chủ xe chỉ hỗ trợ chờ tối đa <strong>15 phút</strong> tại điểm đón.</li>
                        </ul>
                        <p className="text-[10.5px] text-amber-900 dark:text-amber-300/90 italic pt-1 border-t border-amber-300/60">
                          💡 Nếu bạn có lịch bay khẩn cấp hoặc cần cam kết giờ tuyệt đối 100%, vui lòng cân nhắc thuê xe taxi/dịch vụ riêng.
                        </p>
                      </div>
                    )}

                    {/* CHỌN HÌNH THỨC CAM KẾT: CHỐT KÈO 100% (ĐI XA - KHÔNG HỦY) vs CỌC 50K (LINH HOẠT - HỦY TRƯỚC 8H) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold block">Chọn phương thức cam kết chuyến đi:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setBookingCommitmentType('full_deal')}
                          className={`p-3 rounded-2xl text-left border cursor-pointer transition-all ${
                            bookingCommitmentType === 'full_deal'
                              ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 shadow-sm'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">🔒 Chốt Kèo 100%</span>
                            <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded">Khuyên Dùng</span>
                          </div>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">
                            Thanh toán 100% qua sàn. Đi đường xa an tâm, <strong>tuyệt đối không hủy</strong>.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBookingCommitmentType('deposit_50k')}
                          className={`p-3 rounded-2xl text-left border cursor-pointer transition-all ${
                            bookingCommitmentType === 'deposit_50k'
                              ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-950/40 shadow-sm'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-black text-blue-800 dark:text-blue-300">🎫 Cọc Giữ Chỗ 50k</span>
                            <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded">Linh Hoạt</span>
                          </div>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">
                            Cọc 50k/ghế. <strong>Được hủy trước &gt; 8h</strong> hoàn 100% cọc (max 3 lần/tháng).
                          </p>
                        </button>
                      </div>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 space-y-2 text-xs text-slate-900">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Chi phí chuyến đi ({bookingSeatsCount} ghế):</span>
                        <span className="font-bold text-slate-900">
                          {formatVND(pricing.total)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-emerald-800 font-black pt-1 border-t border-emerald-200">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> 
                          {bookingCommitmentType === 'full_deal' ? 'Thanh toán trọn gói 100% (Sàn giữ an toàn):' : 'Tiền cọc giữ chỗ (Sàn tạm giữ):'}
                        </span>
                        <span>
                          {bookingCommitmentType === 'full_deal'
                            ? formatVND(pricing.total)
                            : formatVND(50000 * bookingSeatsCount)}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-xs font-bold">
                        <span>Thanh toán thêm trên xe:</span>
                        <span className="text-emerald-900 font-black">
                          {bookingCommitmentType === 'full_deal'
                            ? '0đ (Đã thanh toán trọn gói qua CarMate)'
                            : formatVND(Math.max(0, pricing.total - 50000 * bookingSeatsCount))}
                        </span>
                      </div>
                    </div>

                    {/* CAM KẾT VĂN MINH & QUY TẮC PHÂN BIỆT 2 HÌNH THỨC */}
                    <div className={`p-2.5 rounded-xl border text-[11px] space-y-1.5 ${
                      isLight ? 'bg-amber-50/70 border-amber-200 text-slate-800' : 'bg-slate-900/90 border-amber-500/30 text-slate-300'
                    }`}>
                      <div className="flex items-center justify-between font-bold text-amber-900">
                        <span className="flex items-center gap-1">
                          <Scale className="w-3.5 h-3.5 text-amber-600" />
                          <span>Quy Chế Cam Kết & Huỷ Chuyến:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPolicyModal(true)}
                          className="text-[10px] text-blue-600 underline font-semibold cursor-pointer"
                        >
                          Xem chi tiết
                        </button>
                      </div>

                      {bookingCommitmentType === 'full_deal' ? (
                        <div className="p-2 rounded-lg bg-emerald-100/80 border border-emerald-300 text-emerald-950 space-y-1 text-[10px]">
                          <p className="font-black flex items-center gap-1">
                            <span>🔒</span>
                            <span>ĐÃ CHỐT KÈO 100%: TUYỆT ĐỐI KHÔNG HUỶ!</span>
                          </p>
                          <p className="leading-tight">
                            Đoạn đường đi xa, ai cũng đã lên lịch công việc chắc chắn. Không áp dụng hủy chuyến. Bên nào tự ý bỏ ngang hoặc ngủ quên sẽ mất toàn bộ tiền chuyến đi để bồi thường cho đối tác.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1 text-[10px] pt-0.5">
                          <div className="flex items-center gap-1">
                            <span>🟢</span>
                            <span>Hủy &gt;8h (max 3 lần/tháng): <strong>Hoàn cọc 50k</strong></span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>⏱️</span>
                            <span>Xe chờ tối đa: <strong>15 phút</strong></span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>🔴</span>
                            <span>Hủy &lt;8h / ngủ quên: <strong>Mất cọc 50k</strong></span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>⏳</span>
                            <span>Xác minh bồi thường: <strong>5 ngày làm việc</strong></span>
                          </div>
                        </div>
                      )}

                      <div className="pt-1.5 border-t border-amber-200/80 dark:border-amber-800/50 text-[9.5px] text-amber-900 dark:text-amber-300 font-semibold flex items-center gap-1">
                        <span>🤝</span>
                        <span>Đi chung văn minh, đôi bên cùng có lợi • Tôn trọng & thân thiện trên mọi hành trình</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setDepositStep('qr')}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>
                        {bookingCommitmentType === 'full_deal'
                          ? `Quét Mã Chốt Kèo 100% (${formatVND(pricing.total)})`
                          : `Quét Mã Cọc Giữ Chỗ (${formatVND(50000 * bookingSeatsCount)})`}
                      </span>
                    </button>
                  </div>
                )}

                {depositStep === 'qr' && (
                  <div className="space-y-3.5 text-center">
                    <div className="bg-white text-slate-900 rounded-2xl p-4 shadow-inner max-w-[280px] mx-auto space-y-2 border border-slate-200">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase block">VietQR • MB Bank (Bảo Chứng 24/7)</span>
                      
                      <div className="relative w-36 h-36 mx-auto bg-slate-50 rounded-xl p-2 border-2 border-slate-300 flex items-center justify-center">
                        <div className="grid grid-cols-6 gap-1 w-full h-full p-1 bg-white">
                          {Array.from({ length: 36 }).map((_, i) => (
                            <div
                              key={i}
                              className={`rounded-xs ${
                                (i % 2 === 0 || i % 7 === 0 || i < 6 || i > 30) ? 'bg-slate-900' : 'bg-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                            {bookingCommitmentType === 'full_deal' ? '100%' : '50K'}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-0.5 text-left text-[11px] pt-1 border-t border-slate-200">
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            {bookingCommitmentType === 'full_deal' ? 'Số tiền chốt kèo:' : 'Số tiền cọc:'}
                          </span>
                          <strong className="text-emerald-700 font-black">
                            {formatVND(bookingCommitmentType === 'full_deal' ? pricing.total : (50000 * bookingSeatsCount))}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Người nhận:</span>
                          <strong className="text-slate-800">CARMATE VIETNAM</strong>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setDepositStep('review')}
                        className={`py-2.5 rounded-xl text-xs font-bold ${
                          isLight ? 'bg-slate-200 text-slate-800' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        Quay Lại
                      </button>

                      <button
                        onClick={handleConfirmEscrow}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Xác Nhận Đã Chuyển</span>
                      </button>
                    </div>
                  </div>
                )}

                {depositStep === 'success' && (
                  <div className="py-6 text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-600/30">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h3 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>Khớp Lệnh Thành Công!</h3>
                    <p className="text-xs text-slate-400">
                      Đang chuyển hướng sang trang <strong className="text-emerald-600">Chuyến Đã Cọc</strong> để mở khóa SĐT đối tác...
                    </p>
                  </div>
                )}

              </div>
            </div>
          );
        })()}

        {/* MODAL GỌI ĐIỆN */}
        {callingData && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-xs rounded-3xl p-5 text-center space-y-4 shadow-2xl border ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
            }`}>
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <Phone className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Liên hệ đối tác</span>
                <h3 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{callingData.contactName}</h3>
                <p className="text-lg font-black text-emerald-600 font-mono mt-1">
                  {callingData.contactPhone}
                </p>
              </div>

              <div className="space-y-2">
                <a
                  href={`tel:${callingData.contactPhone.replace(/[^0-9]/g, '')}`}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow"
                >
                  <Phone className="w-4 h-4" />
                  <span>Bấm Gọi Điện Thoại</span>
                </a>

                <button
                  onClick={() => setCallingData(null)}
                  className={`w-full py-2 rounded-xl text-xs font-bold ${
                    isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 1: QUY CHẾ HUỶ & PHẠT CÔNG BẰNG 2 BÊN */}
        {showPolicyModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[88vh] overflow-y-auto border ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
            }`}>
              {/* Drag handle */}
              <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 sm:hidden" />

              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">Quy Chế Huỷ & Phạt 2 Chiều</h3>
                    <p className="text-[11px] text-slate-400">Văn minh • Đúng giờ • Bảo vệ cả Khách & Chủ xe</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPolicyModal(false)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Khối Văn Hóa Đi Chung Văn Minh & Bình Đẳng */}
              <div className="p-3.5 rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-amber-950/40 space-y-2 shadow-xs">
                <div className="flex items-center gap-2 font-black text-emerald-900 dark:text-emerald-300 text-xs">
                  <HeartHandshake className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>VĂN HÓA ĐỒNG HÀNH: ĐÔI BÊN CÙNG CÓ LỢI & TÔN TRỌNG LẪN NHAU</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  CarMate là cộng đồng kết nối <strong>chia sẻ chi phí đi chung</strong> xe ô tô văn minh: Chủ xe chia sẻ ghế trống trên hành trình có sẵn để giảm bớt tiền xăng, hành khách ghép chuyến để có hành trình thoải mái, lịch thiệp và tiết kiệm.
                </p>
                <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800/60 text-slate-700 dark:text-slate-300 text-[11px] space-y-1">
                  <p className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1">
                    <span>🌱</span>
                    <span>Quy chuẩn ứng xử thân thiện & bình đẳng:</span>
                  </p>
                  <p className="leading-relaxed">
                    • <strong>Đồng hành như bạn bè:</strong> Cả chủ xe và người đi xe đối xử với nhau lịch thiệp, nhã nhặn, tôn trọng không gian và thời gian của nhau.
                  </p>
                  <p className="leading-relaxed">
                    • <strong>Giữ gìn chuyến đi tích cực:</strong> Luôn đúng hẹn, giữ gìn vệ sinh chung, trao đổi nhẹ nhàng để mỗi chuyến đi đều là một trải nghiệm dễ chịu cho cả hai bên.
                  </p>
                </div>
              </div>

              {/* Các Khối Quy Tắc Chi Tiết */}
              <div className="space-y-3 text-xs leading-relaxed">
                {/* Khối 1: Chốt Kèo 100% */}
                <div className="p-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-black text-emerald-900 dark:text-emerald-300">
                    <span>🔒</span>
                    <span>1. HÌNH THỨC "CHỐT KÈO 100%" (ĐƯỜNG XA — TUYỆT ĐỐI KHÔNG HỦY)</span>
                  </div>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 pl-1">
                    <li>• <strong>Đã chốt là đi — Không có chuyện hủy:</strong> Vì chặng đường xa liên tỉnh, hai bên đã lên kế hoạch công việc và thời gian đón rước từ sớm. Ráng chịu vì trách nhiệm với nhau!</li>
                    <li>• <strong>Bỏ chuyến / Ngủ quên / Không đến:</strong> Mất toàn bộ 100% tiền chuyến đi để chuyển bồi thường cho bên bị hại (sàn xác minh trong 5 ngày làm việc).</li>
                    <li>• <strong>Hoàn thành chuyến:</strong> Khách bấm "Xác nhận đã đến nơi" để sàn giải ngân tiền cho chủ xe.</li>
                  </ul>
                </div>

                {/* Khối 2: Cọc Giữ Chỗ 50k */}
                <div className="p-3 rounded-2xl border border-blue-300 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-black text-blue-900 dark:text-blue-300">
                    <span>🎫</span>
                    <span>2. HÌNH THỨC "CỌC GIỮ CHỖ 50K" (LINH HOẠT)</span>
                  </div>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 pl-1">
                    <li>• <strong>Hủy sớm trước &gt; 8 tiếng:</strong> Được hoàn <strong>100% tiền cọc 50k</strong> về ví (áp dụng tối đa <strong>3 lần/tháng</strong> để tránh làm phiền đối tác).</li>
                    <li>• <strong>Hủy sát giờ (&lt; 8 tiếng) hoặc ngủ quên:</strong> <strong>Mất 100% tiền cọc 50k</strong>, sàn chuyển cọc bồi thường chi phí chuẩn bị cho đối tác.</li>
                    <li>• <strong>Xe chờ tối đa 15 phút:</strong> Quá 15 phút không liên lạc được, đối tác có quyền báo bùng cọc.</li>
                  </ul>
                </div>

                {/* Khối 3: Cảnh báo chuyến Sân Bay */}
                <div className="p-3 rounded-2xl border border-amber-300 bg-amber-50/80 dark:bg-amber-950/40 dark:border-amber-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-black text-amber-900 dark:text-amber-300">
                    <Plane className="w-4 h-4 text-amber-600" />
                    <span>3. QUY ĐỊNH CHUYẾN SÂN BAY (BẢO VỆ CẢ KHÁCH VÀ CHỦ XE)</span>
                  </div>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 pl-1 text-[11px]">
                    <li>• <strong>Chủ động thời gian:</strong> Khách cần đặt giờ đón sớm trước giờ bay ít nhất <strong>2,5 - 3 tiếng</strong> để phòng ngừa kẹt xe cửa ngõ.</li>
                    <li>• <strong>Quy chuẩn hành lý:</strong> Đi ghép chia sẻ không gian, mỗi hành khách tối đa <strong>1 vali cỡ trung (20-24 inch) + 1 balo nhỏ</strong> để tránh quá tải cốp xe.</li>
                    <li>• <strong>Thời gian chờ tại ga sân bay:</strong> Chủ xe chỉ có thể dừng chờ tối đa <strong>15 phút</strong> do quy định cấm dừng đỗ của an ninh sân bay (tránh bị phạt nguội).</li>
                    <li>• <strong>Chuyến bay delay / Đổi giờ bay:</strong> Khách cần báo ngay cho chủ xe. Nếu trễ quá thời gian chờ, hai bên lịch sự thỏa thuận hoặc hủy êm đẹp, không bắt chủ xe chịu trận tại sân bay.</li>
                    <li>• <strong>Đi việc gấp / khẩn cấp:</strong> Khách nên chủ động thuê taxi hoặc xe dịch vụ riêng để đảm bảo lịch trình.</li>
                  </ul>
                </div>

                {/* Khối 4: Quy trình xác minh minh bạch trong 5 ngày */}
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-black text-slate-800 dark:text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>4. XÁC MINH CÔNG KHAI TRONG VÒNG 5 NGÀY LÀM VIỆC</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    Mọi yêu cầu bồi thường đều được ban quản trị CarMate đối chiếu qua dữ liệu GPS, nhật ký cuộc gọi, thời gian hẹn và tin nhắn trao đổi giữa 2 bên trong vòng <strong>5 ngày làm việc</strong> trước khi giải ngân. Tránh tuyệt đối tình trạng phá sàn hoặc vu khống nhau.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPolicyModal(false)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg cursor-pointer transition-all active:scale-98"
              >
                Tôi Đã Hiểu & Đồng Ý Quy Chế
              </button>
            </div>
          </div>
        )}

        {/* MODAL 2: XÁC NHẬN HUỶ CHUYẾN (HỦY SỚM VS HỦY SÁT GIỜ) */}
        {cancelModalRecord && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 border ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
            }`}>
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                    <Ban className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">Xác Nhận Huỷ Chuyến #{cancelModalRecord.escrowId}</h3>
                    <p className="text-[11px] text-slate-400">Áp dụng quy chế huỷ công bằng 2 chiều</p>
                  </div>
                </div>
                <button
                  onClick={() => setCancelModalRecord(null)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chọn mốc thời gian huỷ */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold block">1. Thời điểm bạn huỷ chuyến:</label>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    Đã huỷ tháng này: <strong className="text-amber-600">{cancelCountThisMonth}/3 lần</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCancelWithin8Hours(false)}
                    className={`p-3 rounded-2xl text-left border text-xs font-bold transition-all ${
                      !isCancelWithin8Hours
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span>Trước &gt; 8 tiếng</span>
                      <CheckCircle2 className={`w-3.5 h-3.5 ${!isCancelWithin8Hours ? 'text-emerald-600' : 'opacity-0'}`} />
                    </div>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-normal">
                      Hoàn 100% tiền ({formatVND(cancelModalRecord.fullTripAmount || cancelModalRecord.totalDeal || cancelModalRecord.depositAmount)})
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCancelWithin8Hours(true)}
                    className={`p-3 rounded-2xl text-left border text-xs font-bold transition-all ${
                      isCancelWithin8Hours
                        ? 'border-rose-500 bg-rose-50/80 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span>Dưới 8 tiếng / Ngủ quên</span>
                      <AlertTriangle className={`w-3.5 h-3.5 ${isCancelWithin8Hours ? 'text-rose-600' : 'opacity-0'}`} />
                    </div>
                    <p className="text-[10px] text-rose-700 dark:text-rose-400 font-normal">
                      Không hoàn tiền (Đền đối tác)
                    </p>
                  </button>
                </div>
              </div>

              {/* Lý do huỷ */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold block">2. Lý do huỷ chuyến:</label>
                <select
                  value={cancelReasonText}
                  onChange={(e) => setCancelReasonText(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs font-bold border ${
                    isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                  }`}
                >
                  <option value="Thay đổi lịch trình cá nhân">Thay đổi lịch trình cá nhân / Việc bận đột xuất</option>
                  <option value="Không liên hệ được với đối tác">Không liên hệ được với đối tác</option>
                  <option value="Đã tìm được phương tiện khác">Đã tìm được phương tiện khác</option>
                  <option value="Lý do sức khoẻ">Lý do sức khoẻ</option>
                  <option value="Lý do khác">Lý do khác</option>
                </select>
              </div>

              {/* Cảnh báo hậu quả */}
              <div className={`p-3 rounded-2xl border text-xs leading-relaxed ${
                isCancelWithin8Hours
                  ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
              }`}>
                {isCancelWithin8Hours ? (
                  <p>
                    ⚠️ <strong>Lưu ý huỷ dưới 8 tiếng / ngủ quên:</strong> Đối tác đã sắp xếp lịch trình và thời gian đón bạn. Tiền chuyến đi <strong>{formatVND(cancelModalRecord.fullTripAmount || cancelModalRecord.totalDeal || cancelModalRecord.depositAmount)}</strong> sẽ không được hoàn lại mà được chuyển bồi thường cho đối tác trong vòng <strong>5 ngày làm việc</strong> sau khi sàn xác minh.
                  </p>
                ) : (
                  <p>
                    ✅ <strong>Huỷ hợp lệ trước 8 tiếng:</strong> Bạn huỷ trước hơn 8 tiếng (lượt {cancelCountThisMonth + 1}/3 trong tháng), tiền <strong>{formatVND(cancelModalRecord.fullTripAmount || cancelModalRecord.totalDeal || cancelModalRecord.depositAmount)}</strong> sẽ được hoàn trả 100% về ví của bạn ngay.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCancelModalRecord(null)}
                  className={`py-2.5 rounded-xl text-xs font-bold ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Quay Lại
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCancelTrip}
                  className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-all active:scale-98"
                >
                  Xác Nhận Huỷ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: BÁO CÁO ĐỐI TÁC ĐẾN TRỄ HẸN (> 15 PHÚT) */}
        {delayModalRecord && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 border ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
            }`}>
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Timer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">Báo Đối Tác Đến Trễ Hẹn</h3>
                    <p className="text-[11px] text-slate-400">Đơn #{delayModalRecord.escrowId} • {delayModalRecord.timeSlot}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDelayModalRecord(null)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Thông tin đối tác */}
              <div className={`p-3 rounded-2xl border text-xs space-y-1 ${
                isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}>
                <div className="flex justify-between">
                  <span className="text-slate-400">Đối tác:</span>
                  <strong className="text-slate-900 dark:text-white">{delayModalRecord.contactName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">SĐT:</span>
                  <strong className="text-emerald-600 font-mono">{delayModalRecord.contactPhone}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Điểm hẹn:</span>
                  <span className="text-right truncate max-w-[200px]">{delayModalRecord.from}</span>
                </div>
              </div>

              {/* Mức độ trễ */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold block">Thời gian đối tác đã trễ so với giờ hẹn:</label>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[15, 30, 45].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDelayMinutes(m)}
                      className={`py-2 px-2 rounded-xl font-bold border transition-all ${
                        delayMinutes === m
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                          : isLight
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {m} phút
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 text-xs text-amber-900 space-y-1.5 leading-relaxed">
                <p className="font-bold flex items-center gap-1 text-amber-950">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Quy chuẩn thời gian chờ của CarMate:</span>
                </p>
                <p>
                  • Cả khách và chủ xe chỉ có nghĩa vụ chờ tối đa <strong>15 phút</strong>.
                </p>
                <p>
                  • Sau khi bạn gửi báo cáo, sàn sẽ kích hoạt chuông cảnh báo khẩn cấp tới đối tác. Nếu sau 15 phút tiếp theo đối tác vẫn không có mặt, bạn có quyền bấm <strong>"Báo Bùng Chuyến"</strong> để sàn xác minh bồi thường.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDelayModalRecord(null)}
                  className={`py-2.5 rounded-xl text-xs font-bold ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Bỏ Qua
                </button>

                <button
                  type="button"
                  onClick={handleConfirmReportDelay}
                  className="py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-1.5"
                >
                  <Timer className="w-4 h-4" />
                  <span>Gửi Cảnh Báo Trễ</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER + PHÁP LÝ */}
        <footer className={`px-4 py-2 space-y-1 border-t transition-colors duration-300 ${
          isLight ? 'bg-white/90 border-slate-200 text-slate-500' : 'bg-slate-950/90 border-slate-800/80 text-slate-400'
        }`}>
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 font-medium">
              <Fuel className="w-3.5 h-3.5 text-emerald-600" />
              <span>CarMate • Bạn Đồng Hành • Chia Sẻ Chi Phí Văn Minh</span>
            </div>
            <div className="flex items-center gap-1 font-bold">
              <span>Hotline:</span>
              <span className="text-emerald-700 font-mono">1900.6868</span>
            </div>
          </div>
          <p className={`text-[9px] leading-tight ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
            ⚖️ CarMate là nền tảng kết nối chia sẻ chi phí đi chung xe ô tô (đôi bên cùng có lợi, giảm gánh nặng tiền xăng & chi phí đi lại), không phải đơn vị kinh doanh vận tải. Người đi xe và chủ xe đồng hành trên tinh thần văn minh, bình đẳng và tôn trọng lẫn nhau. Chủ xe tự chịu trách nhiệm pháp lý về phương tiện.
          </p>
        </footer>

      </div>
    </div>
  );
}
