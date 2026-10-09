/**
 * Convert a phone number into a digits-only format
 */
export const cleanPhoneNumber = (phone = '') => {
  return String(phone || '').replace(/[^0-9]/g, '');
};

/**
 * Normalize a Vietnamese mobile number to a uniform 10-digit form starting with 0 (e.g. 0912345678)
 * Handles the prefixes: +84, 84, or 9 digits missing the leading 0.
 */
export const normalizePhoneNumber = (phone = '') => {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return '';
  if (cleaned.startsWith('84') && cleaned.length === 11) {
    return '0' + cleaned.slice(2);
  }
  if (cleaned.length === 9 && !cleaned.startsWith('0')) {
    return '0' + cleaned;
  }
  return cleaned;
};

/**
 * Validate a mobile phone number against the main legitimate Vietnamese carriers
 * Supported prefixes: Viettel (03x, 086, 096-098), Vinaphone (081-085, 088, 091, 094),
 * Mobifone (070-079, 089, 090, 093), Vietnamobile/Wintel/Itelecom/Gmobile (052-059, 087, 092, 099)
 */
export const isValidVietnamesePhone = (phone = '') => {
  const normalized = normalizePhoneNumber(phone);
  return /^(0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/.test(normalized);
};

/**
 * Detect phone numbers that show signs of being fake / obvious junk numbers:
 * - Not in the format of a Vietnamese telecom network
 * - Common dummy numbers (0123456789, 0987654321, 0900000000, ...)
 * - Ending with 6 or more identical digits (e.g. 0900000000, 0911111111, 0988888888)
 * - Ending with an ascending / descending sequential run of digits
 */
export const isLikelyFakePhone = (phone = '') => {
  const normalized = normalizePhoneNumber(phone);
  if (!isValidVietnamesePhone(normalized)) return true;

  // List of obvious fake / test numbers
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
  // Ending with >= 6 identical digits (e.g. 000000, 111111, 888888)
  if (/(\d)\1{5,}$/.test(last7)) return true;

  // 7-digit sequential run, ascending / descending
  const fakeSequences = ['1234567', '7654321', '9876543', '2345678', '8765432', '0123456', '6543210'];
  if (fakeSequences.some((seq) => last7.includes(seq))) return true;

  return false;
};

/**
 * Convert a phone number into international format (e.g. 84988234567 for WhatsApp / Telegram)
 */
const toInternationalPhone = (phone = '') => {
  let digits = cleanPhoneNumber(phone);
  if (digits.startsWith('0')) {
    digits = '84' + digits.slice(1);
  } else if (!digits.startsWith('84') && digits.length >= 9) {
    digits = '84' + digits;
  }
  return digits;
};

/**
 * Create a link that opens a Zalo conversation directly.
 * Returns an empty string when there is no valid number, so the caller decides
 * what to display instead (do not use '#' because it jumps to the top of the page).
 */
export const getZaloChatUrl = (phone = '', text = '') => {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return '';
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://zalo.me/${cleaned}${query}`;
};

export const getZaloChatLink = getZaloChatUrl;

/**
 * Create a link that opens a Telegram conversation directly
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
 * Generate post content for quickly sharing to Zalo / Facebook / Telegram Groups
 * (A Product-Led Growth tool that helps Drivers connect with fellow passengers)
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
👉 Bấm link để giữ chỗ trước (0đ cọc • Khởi hành đúng giờ):
🔗 https://carmate.vn/t/${trip.id}
(0% phí trung gian • Xe gia đình văn minh • Lên xe gửi tiền xăng)`;
};
