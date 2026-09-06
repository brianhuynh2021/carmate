/**
 * nlpTripParser.js — Vietnamese Carpooling Natural Language Parser
 * Thiết kế theo triết lý Cursor: Nhận diện văn phong tiếng Việt tự nhiên
 * từ bài đăng Facebook/Zalo, bóc tách thực thể tức thì (0ms latency, 100% clientside).
 */

const KNOWN_LOCATIONS = [
  // Miền Bắc
  'Hà Nội', 'Hải Phòng', 'Ninh Bình', 'Quảng Ninh', 'Hạ Long', 'Nam Định', 'Thái Bình',
  'Hưng Yên', 'Hải Dương', 'Bắc Ninh', 'Bắc Giang', 'Vĩnh Phúc', 'Phú Thọ', 'Thái Nguyên',
  'Lạng Sơn', 'Hòa Bình', 'Hà Nam', 'Thanh Hóa', 'Nghệ An', 'Vinh', 'Hà Tĩnh',
  'Mỹ Đình', 'Giáp Bát', 'Nước Ngầm', 'Big C Thăng Long', 'Cầu Giấy', 'Long Biên', 'Hà Đông',
  // Miền Trung & Tây Nguyên
  'Đà Nẵng', 'Huế', 'Hội An', 'Quảng Nam', 'Tam Kỳ', 'Quảng Ngãi', 'Bình Định', 'Quy Nhơn',
  'Phú Yên', 'Tuy Hòa', 'Nha Trang', 'Khánh Hòa', 'Cam Ranh', 'Phan Rang', 'Ninh Thuận',
  'Phan Thiết', 'Bình Thuận', 'Mũi Né', 'Kon Tum', 'Gia Lai', 'Pleiku', 'Đắk Lắk',
  'Buôn Ma Thuột', 'Đắk Nông', 'Lâm Đồng', 'Đà Lạt', 'Bảo Lộc', 'Đức Trọng',
  // Miền Nam
  'Sài Gòn', 'TP.HCM', 'TP HCM', 'Hồ Chí Minh', 'Bình Phước', 'Lộc Ninh', 'Bù Đốp', 'Bình Long',
  'Chơn Thành', 'Đồng Xoài', 'Bình Dương', 'Thủ Dầu Một', 'Bến Cát', 'Dĩ An', 'Thuận An',
  'Đồng Nai', 'Biên Hòa', 'Long Thành', 'Vũng Tàu', 'Bà Rịa', 'Phú Mỹ', 'Tây Ninh',
  'Trảng Bàng', 'Củ Chi', 'Long An', 'Tân An', 'Tiền Giang', 'Mỹ Tho', 'Bến Tre',
  'Vĩnh Long', 'Trà Vinh', 'Cần Thơ', 'Hậu Giang', 'Sóc Trăng', 'Bạc Liêu', 'Cà Mau',
  'Hàng Xanh', 'Bến xe Miền Đông', 'BX Miền Đông', 'Bến xe Miền Tây', 'BX Miền Tây', 'Tân Sơn Nhất', 'An Sương'
];

export function parseNaturalTrip(text) {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  if (raw.length < 5) return null;

  const lower = raw.toLowerCase();

  // 1. Phân loại vai trò (Chủ xe hay Khách)
  const isPassenger = /(tìm xe|cần xe|cần ghép|tìm xe ghép|ai có xe|cần đi|xin ghép|cho em ghép|cho e ghép|khách cần|cần tìm)/i.test(lower);
  const role = isPassenger ? 'passenger' : 'driver';

  // 2. Số điện thoại Zalo (10 số, đầu 03, 05, 07, 08, 09)
  let phoneReal = '';
  const phoneMatch = raw.match(/(?:0|\+84)[35789][0-9]{8}|(?:0|\+84)[35789][0-9]{1,2}[.\s]?[0-9]{3}[.\s]?[0-9]{3,4}/);
  if (phoneMatch) {
    phoneReal = phoneMatch[0].replace(/[^0-9]/g, '');
    if (phoneReal.startsWith('84')) phoneReal = '0' + phoneReal.slice(2);
  }

  // 3. Giá tiền (VD: 150k, 150.000, 200k, 180 nghìn, 150000, phụ xăng 120k, phụ 100k)
  let price = null;
  const priceKMatch = lower.match(/(?:phụ xăng|tiền xăng|phụ|chia sẻ|giá|vé)?\s*(\d{2,3})\s*(?:k|nghìn|ngàn)/i);
  if (priceKMatch) {
    price = parseInt(priceKMatch[1], 10) * 1000;
  } else {
    const priceFullMatch = raw.match(/(\d{2,3})[.,](\d{3})/);
    if (priceFullMatch) {
      price = parseInt(priceFullMatch[1] + priceFullMatch[2], 10);
    } else {
      const priceRawMatch = raw.match(/(\d{5,6})\s*(?:đ|vnd|đồng)?/i);
      if (priceRawMatch) {
        price = parseInt(priceRawMatch[1], 10);
      }
    }
  }

  // 4. Số ghế trống hoặc cần tìm (VD: còn 3 ghế, còn 1 ghế sau, chỉ nhận 1 khách, dư 2 chỗ...)
  let seats = null;
  const seatsMatch = lower.match(/(?:còn|trống|cần|ghép|chỉ nhận|nhận|dư|còn lại|chở thêm|chỉ chở)\s*([1-7])\s*(?:ghế\s*sau|ghế|chỗ|người|vé|khách)/i) ||
                     lower.match(/([1-7])\s*(?:ghế|chỗ|người|khách)\b/);
  if (seatsMatch) {
    seats = parseInt(seatsMatch[1], 10);
  }

  // 5. Loại xe & Phân loại Biển Trắng / Biển Vàng & Xe Gia Đình Có Người Thân
  const hasRelatives = /(vợ con|vợ|con nhỏ|người nhà|gia đình mình|chở vợ|chở con)/i.test(lower);
  let carCategory = 'family_car';
  let carType = 'Xe 7 chỗ';

  if (/(tiện chuyến|biển vàng|xe dịch vụ|xe ghép)/i.test(lower)) {
    carCategory = 'convenient_trip';
  } else if (hasRelatives || /(xe nhà|xe gia đình|biển trắng)/i.test(lower)) {
    carCategory = 'family_car';
  }

  if (/xpander/i.test(lower)) carType = 'Mitsubishi Xpander (Xe 7 chỗ)';
  else if (/veloz/i.test(lower)) carType = 'Toyota Veloz Cross (Xe 7 chỗ)';
  else if (/innova/i.test(lower)) carType = 'Toyota Innova (Xe 7 chỗ)';
  else if (/carnival/i.test(lower)) carType = 'Kia Carnival (Xe 7 chỗ)';
  else if (/cross|corolla/i.test(lower)) carType = 'Toyota Corolla Cross (Xe 5 chỗ)';
  else if (/7\s*chỗ/i.test(lower)) carType = hasRelatives ? 'Xe 7 chỗ gia đình (chở người thân)' : 'Xe 7 chỗ rộng rãi';
  else if (/5\s*chỗ|4\s*chỗ/i.test(lower)) carType = hasRelatives ? 'Xe 5 chỗ gia đình (chở người thân)' : 'Xe 5 chỗ cá nhân';
  else if (hasRelatives) carType = 'Xe gia đình (chở người thân)';

  // 6. Thời gian & Khung giờ
  let scheduleDay = 'Hôm nay';
  if (/ngày mai|sáng mai|chiều mai|tối mai/i.test(lower)) scheduleDay = 'Ngày mai';
  else if (/cuối tuần/i.test(lower)) scheduleDay = 'Cuối tuần';
  else if (/thứ 2|thứ hai/i.test(lower)) scheduleDay = 'Sáng Thứ 2';
  else if (/thứ 3|thứ ba/i.test(lower)) scheduleDay = 'Sáng Thứ 3';
  else if (/thứ 4|thứ tư/i.test(lower)) scheduleDay = 'Chiều Thứ 4';
  else if (/thứ 5|thứ năm/i.test(lower)) scheduleDay = 'Chiều Thứ 5';
  else if (/thứ 6|thứ sáu/i.test(lower)) scheduleDay = 'Chiều Thứ 6';
  else if (/thứ 7|thứ bảy/i.test(lower)) scheduleDay = 'Sáng Thứ 7';
  else if (/chủ nhật|cn/i.test(lower)) scheduleDay = 'Chủ nhật';

  let timeSlot = '07:00-09:00';
  let exactTime = '';
  const hourMatch = lower.match(/(\d{1,2})\s*(?:h|:|giờ)(\d{2})?\s*(sáng|trưa|chiều|tối|đêm|khuya)?/);
  if (hourMatch) {
    let h = parseInt(hourMatch[1], 10);
    const m = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0;
    const period = hourMatch[3];
    if ((period === 'chiều' || period === 'tối') && h < 12) h += 12;
    if ((period === 'đêm' || period === 'khuya') && h < 12 && h >= 6) h += 12;

    exactTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    if (h >= 3 && h < 5) timeSlot = '03:00-05:00';
    else if (h >= 5 && h < 7) timeSlot = '05:00-07:00';
    else if (h >= 7 && h < 9) timeSlot = '07:00-09:00';
    else if (h >= 9 && h < 11) timeSlot = '09:00-11:00';
    else if (h >= 11 && h < 13) timeSlot = '11:00-13:00';
    else if (h >= 13 && h < 15) timeSlot = '13:00-15:00';
    else if (h >= 15 && h < 17) timeSlot = '15:00-17:00';
    else if (h >= 17 && h < 19) timeSlot = '17:00-19:00';
    else if (h >= 19 && h < 21) timeSlot = '19:00-21:00';
    else if (h >= 21 && h < 23) timeSlot = '21:00-23:00';
    else timeSlot = '23:00-03:00';
  } else if (/rạng sáng|đi viện|bệnh viện|sân bay sớm/i.test(lower)) {
    timeSlot = '03:00-05:00';
  } else if (/sáng sớm/i.test(lower)) {
    timeSlot = '05:00-07:00';
  } else if (/trưa|buổi trưa/i.test(lower)) {
    timeSlot = '11:00-13:00';
  } else if (/tan tầm|tan ca/i.test(lower)) {
    timeSlot = '17:00-19:00';
  } else if (/khuya|xuyên đêm|nửa đêm|đêm muộn|bay đêm/i.test(lower)) {
    timeSlot = '23:00-03:00';
  }

  // 7. Điểm xuất phát (from) & Điểm đến (to)
  let fromLocation = '';
  let toLocation = '';

  // Cách A: Tìm các từ khoá chuyển tiếp (từ A đi/về/đến B)
  const routePatterns = [
    /(?:từ|chạy từ|đón tại|xuất phát từ)\s+([^,.\n]+?)\s+(?:đi|về|đến|tới|sang)\s+([^,.\n]+)/i,
    /([^,.\n]+?)\s*(?:->|=>|➔|⇄|–|-)\s*([^,.\n]+)/i,
    /(?:chạy|đi|tuyến)\s+([^,.\n]+?)\s+(?:về|đi|đến|tới|sang)\s+([^,.\n]+)/i
  ];

  for (const pattern of routePatterns) {
    const match = raw.match(pattern);
    if (match && match[1] && match[2]) {
      const candidateFrom = match[1].trim();
      const candidateTo = match[2].trim();
      if (candidateFrom.length >= 2 && candidateTo.length >= 2) {
        fromLocation = candidateFrom;
        toLocation = candidateTo;
        break;
      }
    }
  }

  // Cách B: Quét theo danh bạ địa danh nếu chưa tìm thấy
  if (!fromLocation || !toLocation) {
    const foundLocations = [];
    for (const loc of KNOWN_LOCATIONS) {
      const idx = lower.indexOf(loc.toLowerCase());
      if (idx !== -1) {
        foundLocations.push({ name: loc, index: idx });
      }
    }
    foundLocations.sort((a, b) => a.index - b.index);

    if (foundLocations.length >= 2) {
      if (!fromLocation) fromLocation = foundLocations[0].name;
      if (!toLocation) toLocation = foundLocations[1].name;
    } else if (foundLocations.length === 1) {
      if (!fromLocation) fromLocation = foundLocations[0].name;
    }
  }

  // Tiện đón dọc đường (Waypoints)
  let waypointNote = '';
  const waypointMatch = raw.match(/(?:đón dọc|tiện đường|dọc theo|dọc)\s+([^,.\n]+)/i);
  if (waypointMatch) {
    waypointNote = `Dọc ${waypointMatch[1].trim()}`;
  }

  // 8. Nhận gửi kèm hàng hóa / bưu phẩm tiện chuyến
  const acceptsParcel = /(gửi hàng|gửi đồ|chuyển đồ|nhận đồ|nhận hàng|chở đồ|kèm hàng|bưu phẩm|kiện hàng)/i.test(lower);

  return {
    role,
    fromLocation: fromLocation.replace(/^(mình|tôi|em|anh|chúng tôi)\s+/i, '').trim(),
    toLocation: toLocation.replace(/\s+(xe|còn|giá|sđt|zalo|lúc|khoảng).*/i, '').trim(),
    waypointNote,
    scheduleDay,
    timeSlot,
    exactTime,
    seats: seats || (role === 'driver' ? (hasRelatives ? 1 : 3) : 1),
    price: price || 150000,
    phoneReal,
    carCategory,
    carType,
    hasRelatives,
    acceptsParcel,
    rawText: raw
  };
}

/**
 * generateSmartZaloDraft — Soạn thảo tin nhắn Zalo thông minh chuẩn văn hóa Việt Nam
 * Hỗ trợ 2 chiều: Khách ghép ghế hoặc Người gửi bưu phẩm kiện hàng
 */
export function generateSmartZaloDraft({
  driverName = 'anh/chị',
  from = '',
  to = '',
  timeSlot = '',
  date = 'Hôm nay',
  seats = 1,
  price = 0,
  pickupPoint = '',
  isParcel = false,
  hasRelatives = false
}) {
  const pickupText = pickupPoint ? `\n• Điểm hẹn đón: ${pickupPoint}` : '';
  const priceText = price ? `\n• Chi phí phụ xăng dự kiến: ${new Intl.NumberFormat('vi-VN').format(price)}đ/ghế` : '';

  if (isParcel) {
    return `Chào ${driverName}, em thấy xe mình chạy tuyến ${from} ➔ ${to} lúc ${timeSlot} (${date}).
Em có 1 kiện đồ nhỏ muốn gửi kèm theo xe. Anh cho em gửi vị trí đón nhận bưu phẩm qua Zalo này nhé! Cảm ơn anh.`;
  }

  const relativeNote = hasRelatives ? ' (em biết xe có người nhà, em đi 1 mình gọn gàng)' : '';

  return `Chào ${driverName}, em thấy chuyến xe của anh trên CarMate:
• Lộ trình: ${from} ➔ ${to}
• Khung giờ: ${timeSlot} (${date})
• Số người đăng ký: ${seats} người${relativeNote}${pickupText}${priceText}
• Cam kết: Em cam kết có mặt đúng giờ hẹn, không hủy gấp.
Anh cho em xin điểm hẹn đón thuận tiện nhất của anh nhé!`;
}
