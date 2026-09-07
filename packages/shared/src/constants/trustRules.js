// CARMATE TRUST & REPUTATION POLICY RULES (Quy chuẩn Tín nhiệm & Uy tín Động)
// Tuân thủ triệt để 4 trụ cột: MIT (Invariants), Stanford (B=MAP), Cursor (Edge AI 0ms), Apple (Liquid Aesthetics)

export const DEFAULT_TRUST_RULES = [
  {
    id: 'verified_phone',
    title: 'Xác thực số điện thoại OTP',
    description: 'Điểm khởi tạo cơ bản khi đăng ký và xác thực SĐT thành công',
    points: 50,
    type: 'base', // 'base' | 'add' | 'sub' | 'cap'
    role: 'all', // 'all' | 'driver' | 'passenger'
    category: 'identity',
    enabled: true,
    isLocked: true // Tiêu chí gốc bất biến
  },
  {
    id: 'avatar_photo',
    title: 'Ảnh đại diện chính diện rõ mặt',
    description: 'Có ảnh chân dung rõ mặt, nâng cao độ tin cậy khi đón trả',
    points: 5,
    type: 'add',
    role: 'all',
    category: 'identity',
    enabled: true,
    isLocked: false
  },
  {
    id: 'profile_gender',
    title: 'Minh bạch thông tin Giới tính',
    description: 'Cập nhật rõ ràng giới tính, giúp chủ xe & người đi cùng dễ dàng ghép chuyến an tâm',
    points: 3,
    type: 'add',
    role: 'all',
    category: 'identity',
    enabled: true,
    isLocked: false
  },
  {
    id: 'no_avatar_cap',
    title: 'Khóa trần điểm khi thiếu ảnh đại diện',
    description: 'Chưa có ảnh đại diện thì điểm tín nhiệm tối đa bị giới hạn, triệt tiêu tài khoản ẩn danh',
    points: 65,
    type: 'cap',
    role: 'all',
    category: 'invariant',
    enabled: true,
    isLocked: true
  },
  {
    id: 'cccd_verified',
    title: 'Căn cước công dân gắn chip (VNeID)',
    description: 'Đã đối chiếu thông tin định danh cá nhân hợp pháp',
    points: 15,
    type: 'add',
    role: 'all',
    category: 'identity',
    enabled: true,
    isLocked: false
  },
  {
    id: 'gplx_verified',
    title: 'Giấy phép lái xe hợp lệ (B2 / C1)',
    description: 'Chứng nhận đủ điều kiện điều khiển ô tô lưu hành toàn quốc',
    points: 10,
    type: 'add',
    role: 'driver',
    category: 'legal',
    enabled: true,
    isLocked: false
  },
  {
    id: 'vehicle_verified',
    title: 'Đăng ký xe & Biển số chính chủ',
    description: 'Xác minh Cavet xe và biển kiểm soát lưu hành',
    points: 10,
    type: 'add',
    role: 'driver',
    category: 'vehicle',
    enabled: true,
    isLocked: false
  },
  {
    id: 'vehicle_photos',
    title: 'Bộ 3 ảnh thực tế của xe',
    description: 'Ảnh thật ngoại thất, nội thất khoang lái sạch sẽ và văn minh',
    points: 5,
    type: 'add',
    role: 'driver',
    category: 'vehicle',
    enabled: true,
    isLocked: false
  },
  {
    id: 'safe_trips_history',
    title: 'Chuyến đi an toàn hoàn tất',
    description: 'Tích lũy 2 điểm/chuyến đi an toàn thành công (tối đa cộng dồn 15 điểm)',
    points: 2,
    maxAccumulated: 15,
    type: 'accumulate',
    role: 'all',
    category: 'activity',
    enabled: true,
    isLocked: false
  },
  {
    id: 'high_rating',
    title: 'Đánh giá xuất sắc từ bạn đồng hành',
    description: 'Điểm đánh giá bình quân từ bạn đồng hành đạt từ 4.8 sao trở lên',
    points: 5,
    type: 'add',
    role: 'all',
    category: 'community',
    enabled: true,
    isLocked: false
  },
  {
    id: 'passenger_punctual',
    title: 'Đón trả đúng hẹn & Lịch thiệp',
    description: 'Người đi cùng luôn có mặt đúng giờ hẹn, tôn trọng không gian xe gia đình',
    points: 10,
    type: 'add',
    role: 'passenger',
    category: 'community',
    enabled: true,
    isLocked: false
  },
  {
    id: 'penalty_late',
    title: 'Bị báo cáo trễ hẹn không lý do',
    description: 'Trễ hẹn trên 15 phút làm ảnh hưởng đến lộ trình chung',
    points: -10,
    type: 'sub',
    role: 'all',
    category: 'penalty',
    enabled: true,
    isLocked: false
  },
  {
    id: 'penalty_cancel',
    title: 'Hủy chuyến sát giờ hẹn (< 2 giờ)',
    description: 'Hủy chuyến sát giờ làm gián đoạn kế hoạch di chuyển của đối phương',
    points: -15,
    type: 'sub',
    role: 'all',
    category: 'penalty',
    enabled: true,
    isLocked: false
  },
  {
    id: 'penalty_mismatch',
    title: 'Bị báo cáo xe không trùng khớp',
    description: 'Đang trong quá trình đối soát do đón sai xe đã cam kết',
    points: -20,
    type: 'sub',
    role: 'driver',
    category: 'penalty',
    enabled: true,
    isLocked: false
  }
];

export const TRUST_TIERS = [
  { min: 0, max: 64, id: 'new', label: 'Thành viên Mới', badgeColor: 'slate', description: 'Cần bổ sung ảnh đại diện để mở khóa trần điểm' },
  { min: 65, max: 79, id: 'verified', label: 'Đã Xác Thực Cơ Bản', badgeColor: 'sky', description: 'Đã đối chiếu danh tính cơ bản' },
  { min: 80, max: 89, id: 'trusted', label: 'Tín Nhiệm Cao', badgeColor: 'emerald', description: 'Được cộng đồng tin cậy, ưu tiên hiển thị trên sàn' },
  { min: 90, max: 99, id: 'elite', label: 'Thành Viên Tinh Hoa', badgeColor: 'amber', description: 'Hồ sơ đầy đủ, phương tiện chuẩn mực & nhiều chuyến an toàn' },
  { min: 100, max: 100, id: 'perfect', label: 'Tín Nhiệm Tuyệt Đối', badgeColor: 'purple', description: 'Hạng kỳ cựu xuất sắc toàn diện' }
];
