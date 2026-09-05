/**
 * Xử lý số điện thoại sang định dạng chuẩn Zalo (ví dụ: 0988234567)
 */
export const cleanPhoneNumber = (phone = '') => {
  return phone.replace(/[^0-9]/g, '');
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
 * Tạo liên kết mở trực tiếp cuộc trò chuyện trên Zalo
 */
export const getZaloChatUrl = (phone = '') => {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return '#';
  return `https://zalo.me/${cleaned}`;
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
 * (Công cụ Product-Led Growth giúp tài xế tự kéo khách)
 */
export const generateSocialShareText = (trip) => {
  if (!trip) return '';

  const isDriver = trip.type === 'driver_offer';
  const roleText = isDriver ? '🚗 CHỦ XE TÌM BẠN ĐI CÙNG (XE GIA ĐÌNH TIỆN TUYẾN)' : '🙋 NGƯỜI CẦN ĐI TÌM XE GHÉP TIỆN ĐƯỜNG';
  const seatsText = isDriver ? `Còn trống: ${trip.availableSeats || 3} ghế` : `Cần tìm: ${trip.seatsNeeded || 1} người đi cùng`;
  const priceText = isDriver ? `${(trip.basePricePerSeat || 180000).toLocaleString('vi-VN')}đ / ghế (Trọn gói xăng & cầu đường)` : `Dự kiến: ${(trip.expectedPrice || 180000).toLocaleString('vi-VN')}đ / người`;

  const perksText = Array.isArray(trip.perks) && trip.perks.length > 0
    ? `\n✨ Tiện ích / Yêu cầu: ${trip.perks.join(' • ')}`
    : '';

  const parcelText = trip.acceptsParcel || (Array.isArray(trip.perks) && trip.perks.some(p => /hàng|đồ|bưu phẩm/i.test(p)))
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
