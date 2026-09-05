export const TIME_SLOTS = [
  { id: 'all', label: 'Tất cả giờ', labelEn: 'Any time', short: 'Tất cả', shortEn: 'Any' },
  { id: '03:00-05:00', label: '03:00 – 05:00 (Rạng sáng · Đi viện / Sân bay)', labelEn: '03:00 – 05:00 (Dawn / Hospital / Airport)', short: '03:00 – 05:00', shortEn: '03:00 – 05:00' },
  { id: '05:00-07:00', label: '05:00 – 07:00 (Sáng sớm · Tránh kẹt xe)', labelEn: '05:00 – 07:00 (Early morning)', short: '05:00 – 07:00', shortEn: '05:00 – 07:00' },
  { id: '07:00-09:00', label: '07:00 – 09:00 (Cao điểm sáng)', labelEn: '07:00 – 09:00 (Morning rush)', short: '07:00 – 09:00', shortEn: '07:00 – 09:00' },
  { id: '09:00-11:00', label: '09:00 – 11:00 (Giữa buổi sáng)', labelEn: '09:00 – 11:00 (Mid-morning)', short: '09:00 – 11:00', shortEn: '09:00 – 11:00' },
  { id: '11:00-13:00', label: '11:00 – 13:00 (Buổi trưa)', labelEn: '11:00 – 13:00 (Noon)', short: '11:00 – 13:00', shortEn: '11:00 – 13:00' },
  { id: '13:00-15:00', label: '13:00 – 15:00 (Đầu giờ chiều)', labelEn: '13:00 – 15:00 (Early afternoon)', short: '13:00 – 15:00', shortEn: '13:00 – 15:00' },
  { id: '15:00-17:00', label: '15:00 – 17:00 (Buổi chiều)', labelEn: '15:00 – 17:00 (Afternoon)', short: '15:00 – 17:00', shortEn: '15:00 – 17:00' },
  { id: '17:00-19:00', label: '17:00 – 19:00 (Tan tầm chiều)', labelEn: '17:00 – 19:00 (Evening rush)', short: '17:00 – 19:00', shortEn: '17:00 – 19:00' },
  { id: '19:00-21:00', label: '19:00 – 21:00 (Buổi tối)', labelEn: '19:00 – 21:00 (Evening)', short: '19:00 – 21:00', shortEn: '19:00 – 21:00' },
  { id: '21:00-23:00', label: '21:00 – 23:00 (Đêm muộn)', labelEn: '21:00 – 23:00 (Late night)', short: '21:00 – 23:00', shortEn: '21:00 – 23:00' },
  { id: '23:00-03:00', label: '23:00 – 03:00 (Khuya xuyên đêm)', labelEn: '23:00 – 03:00 (Midnight / Overnight)', short: '23:00 – 03:00', shortEn: '23:00 – 03:00' },
  // Backward compatibility alias:
  { id: '05:00-06:00', label: '05:00 – 06:00 (Sáng sớm)', labelEn: '05:00 – 06:00 (Early morning)', short: '05:00 – 06:00', shortEn: '05:00 – 06:00', isAlias: true },
  { id: '07:00-08:00', label: '07:00 – 08:00 (Cao điểm sáng)', labelEn: '07:00 – 08:00 (Morning peak)', short: '07:00 – 08:00', shortEn: '07:00 – 08:00', isAlias: true },
  { id: '09:00-10:00', label: '09:00 – 10:00 (Sáng)', labelEn: '09:00 – 10:00 (Morning)', short: '09:00 – 10:00', shortEn: '09:00 – 10:00', isAlias: true },
  { id: '13:00-14:00', label: '13:00 – 14:00 (Đầu giờ chiều)', labelEn: '13:00 – 14:00 (Early afternoon)', short: '13:00 – 14:00', shortEn: '13:00 – 14:00', isAlias: true },
  { id: '15:00-16:00', label: '15:00 – 16:00 (Chiều)', labelEn: '15:00 – 16:00 (Afternoon)', short: '15:00 – 16:00', shortEn: '15:00 – 16:00', isAlias: true },
  { id: '17:00-18:00', label: '17:00 – 18:00 (Tan tầm)', labelEn: '17:00 – 18:00 (Evening rush)', short: '17:00 – 18:00', shortEn: '17:00 – 18:00', isAlias: true },
  { id: '19:00-20:00', label: '19:00 – 20:00 (Tối)', labelEn: '19:00 – 20:00 (Evening)', short: '19:00 – 20:00', shortEn: '19:00 – 20:00', isAlias: true },
  { id: '21:00-22:00', label: '21:00 – 22:00 (Chuyến đêm)', labelEn: '21:00 – 22:00 (Night)', short: '21:00 – 22:00', shortEn: '21:00 – 22:00', isAlias: true }
];

/** Lấy nhãn khung giờ theo ngôn ngữ, fallback về chuỗi thô của item. Hỗ trợ hiển thị giờ chính xác nếu có (ví dụ: 04:30). */
export const getTimeSlotLabel = (idOrItem, lang = 'vi', variant = 'short') => {
  const exactTime = typeof idOrItem === 'object' ? idOrItem?.exactTime : null;
  const id = typeof idOrItem === 'string' ? idOrItem : idOrItem?.timeSlot;
  const slot = TIME_SLOTS.find((s) => s.id === id);

  if (exactTime) {
    if (!slot || slot.id === 'all') return exactTime;
    const slotText = variant === 'short' ? (lang === 'en' ? slot.shortEn : slot.short) : (lang === 'en' ? slot.labelEn : slot.label);
    return `${exactTime} (${slotText})`;
  }

  if (!slot) {
    if (typeof idOrItem === 'object') return idOrItem?.timeSlotLabel || idOrItem?.timeSlot || '';
    return idOrItem || '';
  }
  if (variant === 'short') return lang === 'en' ? slot.shortEn : slot.short;
  return lang === 'en' ? slot.labelEn : slot.label;
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
