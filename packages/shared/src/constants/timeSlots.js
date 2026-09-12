export const TIME_SLOTS = [
  { id: 'all', label: 'Tất cả giờ', labelEn: 'Any time', short: 'Tất cả', shortEn: 'Any' },
  {
    id: '03:00-05:00',
    label: '03:00 – 05:00 (Rạng sáng · Đi viện / Sân bay)',
    labelEn: '03:00 – 05:00 (Dawn / Hospital / Airport)',
    short: '03:00 – 05:00',
    shortEn: '03:00 – 05:00'
  },
  {
    id: '05:00-07:00',
    label: '05:00 – 07:00 (Sáng sớm · Tránh kẹt xe)',
    labelEn: '05:00 – 07:00 (Early morning)',
    short: '05:00 – 07:00',
    shortEn: '05:00 – 07:00'
  },
  {
    id: '07:00-09:00',
    label: '07:00 – 09:00 (Cao điểm sáng)',
    labelEn: '07:00 – 09:00 (Morning rush)',
    short: '07:00 – 09:00',
    shortEn: '07:00 – 09:00'
  },
  {
    id: '09:00-11:00',
    label: '09:00 – 11:00 (Giữa buổi sáng)',
    labelEn: '09:00 – 11:00 (Mid-morning)',
    short: '09:00 – 11:00',
    shortEn: '09:00 – 11:00'
  },
  {
    id: '11:00-13:00',
    label: '11:00 – 13:00 (Buổi trưa)',
    labelEn: '11:00 – 13:00 (Noon)',
    short: '11:00 – 13:00',
    shortEn: '11:00 – 13:00'
  },
  {
    id: '13:00-15:00',
    label: '13:00 – 15:00 (Đầu giờ chiều)',
    labelEn: '13:00 – 15:00 (Early afternoon)',
    short: '13:00 – 15:00',
    shortEn: '13:00 – 15:00'
  },
  {
    id: '15:00-17:00',
    label: '15:00 – 17:00 (Buổi chiều)',
    labelEn: '15:00 – 17:00 (Afternoon)',
    short: '15:00 – 17:00',
    shortEn: '15:00 – 17:00'
  },
  {
    id: '17:00-19:00',
    label: '17:00 – 19:00 (Tan tầm chiều)',
    labelEn: '17:00 – 19:00 (Evening rush)',
    short: '17:00 – 19:00',
    shortEn: '17:00 – 19:00'
  },
  {
    id: '19:00-21:00',
    label: '19:00 – 21:00 (Buổi tối)',
    labelEn: '19:00 – 21:00 (Evening)',
    short: '19:00 – 21:00',
    shortEn: '19:00 – 21:00'
  },
  {
    id: '21:00-23:00',
    label: '21:00 – 23:00 (Đêm muộn)',
    labelEn: '21:00 – 23:00 (Late night)',
    short: '21:00 – 23:00',
    shortEn: '21:00 – 23:00'
  },
  {
    id: '23:00-03:00',
    label: '23:00 – 03:00 (Khuya xuyên đêm)',
    labelEn: '23:00 – 03:00 (Midnight / Overnight)',
    short: '23:00 – 03:00',
    shortEn: '23:00 – 03:00'
  },
  // Backward compatibility alias:
  {
    id: '05:00-06:00',
    label: '05:00 – 06:00 (Sáng sớm)',
    labelEn: '05:00 – 06:00 (Early morning)',
    short: '05:00 – 06:00',
    shortEn: '05:00 – 06:00',
    isAlias: true
  },
  {
    id: '07:00-08:00',
    label: '07:00 – 08:00 (Cao điểm sáng)',
    labelEn: '07:00 – 08:00 (Morning peak)',
    short: '07:00 – 08:00',
    shortEn: '07:00 – 08:00',
    isAlias: true
  },
  {
    id: '09:00-10:00',
    label: '09:00 – 10:00 (Sáng)',
    labelEn: '09:00 – 10:00 (Morning)',
    short: '09:00 – 10:00',
    shortEn: '09:00 – 10:00',
    isAlias: true
  },
  {
    id: '13:00-14:00',
    label: '13:00 – 14:00 (Đầu giờ chiều)',
    labelEn: '13:00 – 14:00 (Early afternoon)',
    short: '13:00 – 14:00',
    shortEn: '13:00 – 14:00',
    isAlias: true
  },
  {
    id: '15:00-16:00',
    label: '15:00 – 16:00 (Chiều)',
    labelEn: '15:00 – 16:00 (Afternoon)',
    short: '15:00 – 16:00',
    shortEn: '15:00 – 16:00',
    isAlias: true
  },
  {
    id: '16:00-18:00',
    label: '16:00 – 18:00 (Tan tầm)',
    labelEn: '16:00 – 18:00 (Evening rush)',
    short: '16:00 – 18:00',
    shortEn: '16:00 – 18:00',
    isAlias: true
  },
  {
    id: '17:00-18:00',
    label: '17:00 – 18:00 (Tan tầm)',
    labelEn: '17:00 – 18:00 (Evening rush)',
    short: '17:00 – 18:00',
    shortEn: '17:00 – 18:00',
    isAlias: true
  },
  {
    id: '19:00-20:00',
    label: '19:00 – 20:00 (Tối)',
    labelEn: '19:00 – 20:00 (Evening)',
    short: '19:00 – 20:00',
    shortEn: '19:00 – 20:00',
    isAlias: true
  },
  {
    id: '21:00-22:00',
    label: '21:00 – 22:00 (Chuyến đêm)',
    labelEn: '21:00 – 22:00 (Night)',
    short: '21:00 – 22:00',
    shortEn: '21:00 – 22:00',
    isAlias: true
  },
  {
    id: '06:00-08:00',
    label: '06:00 – 08:00 (Sáng sớm)',
    labelEn: '06:00 – 08:00 (Morning)',
    short: '06:00 – 08:00',
    shortEn: '06:00 – 08:00',
    isAlias: true
  },
  {
    id: '08:00-10:00',
    label: '08:00 – 10:00 (Giữa sáng)',
    labelEn: '08:00 – 10:00 (Mid-morning)',
    short: '08:00 – 10:00',
    shortEn: '08:00 – 10:00',
    isAlias: true
  },
  {
    id: '14:00-15:00',
    label: '14:00 – 15:00 (Đầu giờ chiều)',
    labelEn: '14:00 – 15:00 (Early afternoon)',
    short: '14:00 – 15:00',
    shortEn: '14:00 – 15:00',
    isAlias: true
  },
  {
    id: '14:00-16:00',
    label: '14:00 – 16:00 (Buổi chiều)',
    labelEn: '14:00 – 16:00 (Afternoon)',
    short: '14:00 – 16:00',
    shortEn: '14:00 – 16:00',
    isAlias: true
  },
  {
    id: '18:00-20:00',
    label: '18:00 – 20:00 (Chập tối)',
    labelEn: '18:00 – 20:00 (Early evening)',
    short: '18:00 – 20:00',
    shortEn: '18:00 – 20:00',
    isAlias: true
  }
];

/**
 * Chuẩn hóa và làm sạch nhãn thời gian theo chuẩn 24h đồng nhất (Zero Fluff, First Principles)
 * Triệt tiêu các từ ngữ chỉ buổi dư thừa ("Sáng", "Chiều", "Tối", "AM", "PM") khi đã dùng chuẩn 24h (VD: 05:00, 17:00)
 */
export const sanitizeTimeLabel = (str) => {
  if (!str || typeof str !== 'string') return '';
  let cleaned = str.trim();

  // Chuẩn hóa ký hiệu 'h' sang ':' (VD: "7h" -> "7:00", "7h30" -> "7:30", "7h-8h" -> "7:00 - 8:00")
  cleaned = cleaned.replace(/(\d{1,2})h(\d{2})?/gi, (m, h, min) => `${h}:${min || '00'}`);

  // Chuẩn hóa dấu gạch ngang sang en-dash chuẩn: " – "
  cleaned = cleaned.replace(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/, '$1 – $2');

  // Chuẩn hóa giờ 1 chữ số thành 2 chữ số (vd: "7:00" -> "07:00", "7:00 – 8:00" -> "07:00 – 08:00")
  cleaned = cleaned.replace(/^(\d):(\d{2})/, '0$1:$2').replace(/–\s*(\d):(\d{2})/, '– 0$1:$2');

  // Bỏ toàn bộ từ chỉ buổi dư thừa trong chuẩn 24h: Sáng, Chiều, Trưa, Tối, Đêm, AM, PM
  cleaned = cleaned.replace(/\s*(?:sáng|chiều|trưa|tối|đêm|am|pm)(?:\s+mai|\s+hôm nay)?\b/gi, '').trim();

  return cleaned;
};

/** Kiểm tra giờ đón cụ thể có nằm trong khung giờ hay không */
export const isTimeInSlot = (timeStr, slotId) => {
  if (!timeStr || !slotId || slotId === 'all') return true;
  return mapTimeToSlot(timeStr) === slotId;
};

/** Lấy nhãn khung giờ theo ngôn ngữ, fallback về chuỗi thô của item. Hỗ trợ hiển thị giờ chính xác nếu có (ví dụ: 04:30). */
export const getTimeSlotLabel = (idOrItem, lang = 'vi', variant = 'short') => {
  const exactTime = typeof idOrItem === 'object' ? idOrItem?.exactTime : null;
  const id = typeof idOrItem === 'string' ? idOrItem : idOrItem?.timeSlot || idOrItem?.timeSlotId;
  const slot = TIME_SLOTS.find((s) => s.id === id);

  // Chỉ gắn exactTime nếu nó thực sự thuộc khung giờ tương ứng
  const isValidExactTime = exactTime && (!slot || slot.id === 'all' || isTimeInSlot(exactTime, slot.id));

  if (isValidExactTime) {
    if (!slot || slot.id === 'all') return sanitizeTimeLabel(exactTime);
    const slotText =
      variant === 'short' ? (lang === 'en' ? slot.shortEn : slot.short) : lang === 'en' ? slot.labelEn : slot.label;
    return `${sanitizeTimeLabel(exactTime)} (${slotText})`;
  }

  if (slot && slot.id !== 'all') {
    return variant === 'short'
      ? lang === 'en'
        ? slot.shortEn
        : slot.short
      : lang === 'en'
        ? slot.labelEn
        : slot.label;
  }

  if (typeof idOrItem === 'object') {
    const rawLabel = idOrItem?.timeSlotLabel || idOrItem?.timeSlot || '';
    // Tự động làm sạch nếu nhãn lưu cũ bị dính lỗi lệch giờ ví dụ "17:00 (03:00 – 05:00)"
    const mismatchMatch = String(rawLabel).match(/^(\d{1,2}:\d{2})\s*\((.*)\)$/);
    if (mismatchMatch) {
      const extractedTime = mismatchMatch[1];
      const innerSlot = mismatchMatch[2].trim();
      const matchedSlot = TIME_SLOTS.find((s) => s.short === innerSlot || s.label.includes(innerSlot));
      if (matchedSlot && !isTimeInSlot(extractedTime, matchedSlot.id)) {
        return matchedSlot.short;
      }
    }
    return sanitizeTimeLabel(rawLabel);
  }
  return sanitizeTimeLabel(idOrItem || '');
};

/** Tự động ánh xạ giờ chính xác (vd: 04:30) vào khung giờ 24/7 tương ứng */
export const mapTimeToSlot = (timeStr) => {
  if (!timeStr) return '07:00-09:00';
  const match = String(timeStr).match(/(\d{1,2})[:h](\d{2})?/i);
  if (!match) return '07:00-09:00';
  const h = parseInt(match[1], 10);
  if (h >= 3 && h < 5) return '03:00-05:00';
  if (h >= 5 && h < 7) return '05:00-07:00';
  if (h >= 7 && h < 9) return '07:00-09:00';
  if (h >= 9 && h < 11) return '09:00-11:00';
  if (h >= 11 && h < 13) return '11:00-13:00';
  if (h >= 13 && h < 15) return '13:00-15:00';
  if (h >= 15 && h < 17) return '15:00-17:00';
  if (h >= 17 && h < 19) return '17:00-19:00';
  if (h >= 19 && h < 21) return '19:00-21:00';
  if (h >= 21 && h < 23) return '21:00-23:00';
  return '23:00-03:00';
};

/**
 * =============================================================================
 * CHIP CHỌN NHANH KHUNG KHỞI HÀNH (SMART DEPARTURE CHIPS)
 * =============================================================================
 * Trên tuyến liên tỉnh, THỜI GIAN là dữ liệu cấp 1 — ngang hàng Nơi đi và Nơi
 * đến, không phải một dòng phụ "đặt cho lúc khác" nằm nép bên dưới. Đẩy nó
 * xuống hàng phụ chính là thứ khiến người dùng mặc định app chạy theo kiểu
 * "gọi xe tới ngay" của taxi nội đô.
 *
 * Người đi xe liên tỉnh thực tế chỉ xoay quanh vài ý định: chiều nay về, tối
 * nay đi, hoặc sáng mai đi sớm. Cho chọn bằng MỘT CHẠM thay vì bắt mở lịch.
 *
 * Danh sách chip được TÍNH THEO GIỜ HIỆN TẠI: 20h tối mà vẫn chìa ra chip
 * "Chiều nay" thì vô nghĩa. Khung đã trôi qua sẽ tự biến mất.
 */
export const DEPARTURE_WINDOWS = Object.freeze([
  { id: 'early_morning', fromHour: 4, toHour: 8, label: 'Sáng sớm', labelEn: 'Early morning', hint: '04:00 – 08:00' },
  { id: 'morning', fromHour: 8, toHour: 11, label: 'Buổi sáng', labelEn: 'Morning', hint: '08:00 – 11:00' },
  { id: 'noon', fromHour: 11, toHour: 14, label: 'Buổi trưa', labelEn: 'Midday', hint: '11:00 – 14:00' },
  { id: 'afternoon', fromHour: 14, toHour: 18, label: 'Buổi chiều', labelEn: 'Afternoon', hint: '14:00 – 18:00' },
  { id: 'evening', fromHour: 18, toHour: 22, label: 'Buổi tối', labelEn: 'Evening', hint: '18:00 – 22:00' },
  { id: 'late_night', fromHour: 22, toHour: 28, label: 'Khuya', labelEn: 'Late night', hint: '22:00 – 04:00' }
]);

/**
 * Dựng danh sách chip phù hợp với thời điểm hiện tại.
 *
 * Quy tắc: một khung chỉ còn ý nghĩa nếu vẫn còn ít nhất `minLeadMinutes` phút
 * trước khi nó kết thúc — không ai đặt được chuyến cho khung sắp đóng trong 10
 * phút nữa. Hết khung hôm nay thì chuyển sang khung của ngày mai.
 *
 * @param {object} [opts]
 * @param {Date|number} [opts.now] - Mốc hiện tại
 * @param {number} [opts.limit] - Số chip tối đa (mặc định 4)
 * @param {number} [opts.minLeadMinutes] - Phải còn ít nhất bao nhiêu phút
 * @returns {Array<{id, label, hint, dayOffset, dayLabel, timeSlot, fromHour, toHour}>}
 */
export function buildDepartureChips({ now = new Date(), limit = 4, minLeadMinutes = 45 } = {}) {
  const ref = now instanceof Date ? now : new Date(now);
  const nowMinutes = ref.getHours() * 60 + ref.getMinutes();
  const chips = [];

  // Duyệt hôm nay trước, rồi tới ngày mai
  for (let dayOffset = 0; dayOffset <= 1 && chips.length < limit; dayOffset++) {
    for (const w of DEPARTURE_WINDOWS) {
      if (chips.length >= limit) break;

      const endMinutes = w.toHour * 60;
      // Khung hôm nay đã trôi qua hoặc sắp đóng thì bỏ
      if (dayOffset === 0 && endMinutes - nowMinutes < minLeadMinutes) continue;

      const dayLabel = dayOffset === 0 ? 'Hôm nay' : 'Ngày mai';
      const startHour = String(w.fromHour % 24).padStart(2, '0');

      chips.push({
        id: `${w.id}_d${dayOffset}`,
        windowId: w.id,
        label: dayOffset === 0 ? w.label : `${w.label} mai`,
        labelEn: dayOffset === 0 ? w.labelEn : `${w.labelEn} tomorrow`,
        hint: w.hint,
        dayOffset,
        dayLabel,
        fromHour: w.fromHour,
        toHour: w.toHour,
        // Khung giờ gửi lên máy chủ để dò chuyến
        timeSlot: `${startHour}:00`
      });
    }
  }

  return chips;
}

/** Ngày (YYYY-MM-DD) tương ứng với một chip. */
export function getChipDate(chip, now = new Date()) {
  const d = now instanceof Date ? new Date(now) : new Date(now);
  d.setDate(d.getDate() + (chip?.dayOffset || 0));
  return d.toISOString().slice(0, 10);
}
