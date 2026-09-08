/**
 * Xử lý số điện thoại sang định dạng chuẩn Zalo (ví dụ: 0900000019)
 */
export const cleanPhoneNumber = (phone = '') => {
  return phone.replace(/[^0-9]/g, '');
};

/**
 * Kiểm tra số điện thoại di động hợp lệ theo các nhà mạng chính thống Việt Nam
 * Hỗ trợ các đầu số: Viettel (03x, 086, 096-098), Vinaphone (081-085, 088, 091, 094),
 * Mobifone (070-079, 089, 090, 093), Vietnamobile/Wintel/Itelecom/Gmobile (052-059, 087, 092, 099)
 */
export const isValidVietnamesePhone = (phone = '') => {
  const cleaned = cleanPhoneNumber(phone);
  let normalized = cleaned;
  if (normalized.startsWith('84') && normalized.length === 11) {
    normalized = '0' + normalized.slice(2);
  }
  return /^(0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/.test(normalized);
};

/**
 * Nhận diện các số điện thoại có dấu hiệu giả mạo / số rác hiển nhiên:
 * - Không đúng định dạng mạng viễn thông Việt Nam
 * - Số dummy phổ biến (0123456789, 0987654321, 0900000000, ...)
 * - Đuôi có từ 6 chữ số giống hệt nhau (VD: 0900000000, 0911111111, 0988888888)
 * - Đuôi dãy số tuần tự tiến / lùi
 */
export const isLikelyFakePhone = (phone = '') => {
  const cleaned = cleanPhoneNumber(phone);
  let normalized = cleaned;
  if (normalized.startsWith('84') && normalized.length === 11) {
    normalized = '0' + normalized.slice(2);
  }
  if (!isValidVietnamesePhone(normalized)) return true;

  // Danh sách các số ảo / số thử nghiệm hiển nhiên
  const obviousDummies = [
    '0123456789',
    '0987654321',
    '0912345678',
    '0901234567',
    '0923456789',
    '0909090909',
    '0919191919',
    '0989898989',
    '0123123123',
    '0900000000'
  ];
  if (obviousDummies.includes(normalized)) return true;

  const last7 = normalized.slice(3);
  // Đuôi kết thúc bằng >= 6 chữ số giống hệt nhau (VD: 000000, 111111, 888888)
  if (/(\d)\1{5,}$/.test(last7)) return true;

  // Dãy tuần tự 7 số tiến / lùi
  const fakeSequences = ['1234567', '7654321', '9876543', '2345678', '8765432', '0123456', '6543210'];
  if (fakeSequences.some((seq) => last7.includes(seq))) return true;

  return false;
};

/**
 * Xử lý số điện thoại sang định dạng quốc tế (ví dụ: 84988234567 cho WhatsApp / Telegram)
 */
export const toInternationalPhone = (phone = '') => {
  let digits = cleanPhoneNumber(phone);
  if (digits.startsWith('0')) {
    digits = '84' + digits.slice(1);
  } else if (!digits.startsWith('84') && digits.length >= 9) {
    digits = '84' + digits;
  }
  return digits;
};

/**
 * Tạo liên kết mở trực tiếp cuộc trò chuyện trên Zalo.
 * Trả về chuỗi rỗng khi không có số hợp lệ, để nơi gọi tự quyết định
 * hiển thị gì thay thế (không dùng '#' vì nó nhảy về đầu trang).
 */
export const getZaloChatUrl = (phone = '', text = '') => {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return '';
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://zalo.me/${cleaned}${query}`;
};

export const getZaloChatLink = getZaloChatUrl;

/**
 * Tạo liên kết mở trực tiếp cuộc trò chuyện trên WhatsApp
 */
export const getWhatsAppChatUrl = (phone = '', text = '') => {
  const intl = toInternationalPhone(phone);
  if (!intl) return '#';
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${intl}${query}`;
};

/**
 * Tạo liên kết mở trực tiếp cuộc trò chuyện trên Telegram
 */
export const getTelegramChatUrl = (phoneOrUsername = '') => {
  if (!phoneOrUsername) return '#';
  if (phoneOrUsername.startsWith('@')) {
    return `https://t.me/${phoneOrUsername.slice(1)}`;
  }
  const intl = toInternationalPhone(phoneOrUsername);
  return `https://t.me/+${intl}`;
};

/**
 * Sinh liên kết chia sẻ trực tiếp chuyến đi qua Zalo Web
 * Mở cửa sổ Zalo Web Share chính thức để người dùng chọn Bạn bè hoặc Nhóm Zalo gửi tin
 */
export const getZaloShareUrl = (trip) => {
  if (!trip) return 'https://chat.zalo.me/';
  const url = `https://carmate.vn/t/${trip.id}`;
  return `https://sp.zalo.me/share_inline?link=${encodeURIComponent(url)}`;
};

/**
 * Lấy liên kết nhóm Zalo tiện chuyến cộng đồng CarMate
 */
export const getZaloGroupUrl = () => {
  return 'https://zalo.me/g/carmate';
};

/**
 * Sinh liên kết chia sẻ trực tiếp bài đăng lên Facebook
 */
export const getFacebookShareUrl = (trip) => {
  if (!trip) return 'https://www.facebook.com/sharer/sharer.php';
  const url = `https://carmate.vn/t/${trip.id}`;
  const quote = generateSocialShareText(trip);
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(quote)}`;
};

/**
 * Sinh liên kết chia sẻ trực tiếp chuyến đi lên Telegram
 */
export const getTelegramShareUrl = (trip) => {
  if (!trip) return '#';
  const url = `https://carmate.vn/t/${trip.id}`;
  const text = generateSocialShareText(trip);
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
};

/**
 * Sinh liên kết chia sẻ trực tiếp chuyến đi lên WhatsApp
 */
export const getWhatsAppShareUrl = (trip) => {
  if (!trip) return '#';
  const text = generateSocialShareText(trip);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
};

/**
 * Sinh nội dung đăng tin chia sẻ nhanh lên các Hội Nhóm Zalo / Facebook / Telegram
 * (Công cụ Product-Led Growth giúp Chủ xe kết nối Người đi cùng)
 */
export const generateSocialShareText = (trip) => {
  if (!trip) return '';

  const isDriver = trip.type === 'driver_offer';
  const roleText = isDriver
    ? '🚗 CHỦ XE TÌM BẠN ĐI CÙNG (XE GIA ĐÌNH TIỆN TUYẾN)'
    : '🙋 NGƯỜI CẦN ĐI TÌM XE GHÉP TIỆN ĐƯỜNG';
  const seatsText = isDriver
    ? `Còn trống: ${trip.availableSeats || 3} ghế`
    : `Cần tìm: ${trip.seatsNeeded || 1} người đi cùng`;
  const priceText = isDriver
    ? `${(trip.basePricePerSeat || 180000).toLocaleString('vi-VN')}đ / ghế (Trọn gói xăng & cầu đường)`
    : `Dự kiến: ${(trip.expectedPrice || 180000).toLocaleString('vi-VN')}đ / người`;

  const perksText =
    Array.isArray(trip.perks) && trip.perks.length > 0 ? `\n✨ Tiện ích / Yêu cầu: ${trip.perks.join(' • ')}` : '';

  const parcelText =
    trip.acceptsParcel || (Array.isArray(trip.perks) && trip.perks.some((p) => /hàng|đồ|bưu phẩm/i.test(p)))
      ? '\n📦 Có nhận gửi kèm bưu phẩm / đồ đạc tiện chuyến'
      : '';

  return `${roleText}
━━━━━━━━━━━━━━━━━━
📍 Lộ trình: ${trip.from} ➔ ${trip.to}
🕒 Xuất phát: ${trip.timeSlotLabel || trip.timeSlot} (${trip.date || 'Hôm nay'})
🚘 Phương tiện: ${trip.carType || 'Xe ô tô gia đình êm mát, không hút thuốc'}
💺 ${seatsText}
💰 Chi phí chia sẻ: ${priceText}${perksText}${parcelText}
━━━━━━━━━━━━━━━━━━
👉 Bấm link xem chi tiết chuyến & kết nối Zalo đón:
🔗 https://carmate.vn/t/${trip.id}
(0% phí trung gian • Xe gia đình văn minh • Lên xe gửi tiền xăng)`;
};
