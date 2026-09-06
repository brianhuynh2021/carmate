/**
 * Tiện ích xử lý Ngày/Tháng dương lịch thực tế cho Chuyến đi CarMate
 */

const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** Đệm 2 chữ số (vd: 8 -> "08") */
const pad2 = (n) => String(n).padStart(2, '0');

/** Định dạng ngày thành dd/mm */
export const formatDateDayMonth = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
};

/** Định dạng ngày thành YYYY-MM-DD */
export const formatDateISO = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/**
 * Lấy danh sách N ngày tới bắt đầu từ ngày hiện tại
 * Trả về nhãn thân thiện: "Hôm nay (06/09)", "Ngày mai (07/09)", "Thứ 3 (08/09)"...
 */
export const getUpcomingDays = (count = 7, baseDate = new Date()) => {
  const list = [];
  const start = new Date(baseDate);

  for (let i = 0; i < count; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);

    const dayName = WEEKDAY_NAMES[current.getDay()];
    const dm = formatDateDayMonth(current);
    const iso = formatDateISO(current);

    let prefix = dayName;
    if (i === 0) prefix = 'Hôm nay';
    else if (i === 1) prefix = 'Ngày mai';

    list.push({
      iso,
      dm,
      prefix,
      label: `${prefix} (${dm})`,
      weekday: dayName,
      fullDisplay: `${dayName}, ${dm}`
    });
  }

  return list;
};

/**
 * Tìm ngày tiếp theo khớp với thứ trong tuần (1 = Thứ 2, ..., 6 = Thứ 7, 0 = Chủ nhật)
 */
export const getNextWeekdayDate = (targetDay, baseDate = new Date()) => {
  const date = new Date(baseDate);
  const currentDay = date.getDay();
  let distance = targetDay - currentDay;
  if (distance < 0) distance += 7;
  date.setDate(date.getDate() + distance);
  return date;
};

/**
 * Chuẩn hóa chuỗi ngày bất kỳ (kể cả "Sáng Thứ 3", "Thứ 3", "2026-09-08")
 * Luôn trả về định dạng rõ ràng: "Thứ 3 (08/09)" hoặc "Hôm nay (06/09)"
 */
export const formatTripDateDisplay = (dateStr, baseDate = new Date()) => {
  if (!dateStr) {
    const today = new Date(baseDate);
    return `Hôm nay (${formatDateDayMonth(today)})`;
  }

  const str = String(dateStr).trim();
  const isRecurring = str.includes('Lặp lại hàng tuần') || str.includes('hàng tuần');
  const cleanStr = str.replace(/\(Lặp lại hàng tuần\)/gi, '').replace(/hàng tuần/gi, '').trim();

  // 1. Nếu đã có sẵn định dạng dd/mm (ví dụ "Thứ 3 (08/09)" hoặc "08/09")
  if (/\d{1,2}\/\d{1,2}/.test(cleanStr)) {
    return isRecurring ? `${cleanStr} · Lặp hàng tuần` : cleanStr;
  }

  // 2. Nếu là chuỗi ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    const parts = cleanStr.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const weekday = WEEKDAY_NAMES[d.getDay()];
    const formatted = `${weekday} (${formatDateDayMonth(d)})`;
    return isRecurring ? `${formatted} · Lặp hàng tuần` : formatted;
  }

  // 3. Xử lý các từ khóa tương đối
  const lower = cleanStr.toLowerCase();
  const today = new Date(baseDate);

  if (lower.includes('hôm nay')) {
    const res = `Hôm nay (${formatDateDayMonth(today)})`;
    return isRecurring ? `${res} · Lặp hàng tuần` : res;
  }

  if (lower.includes('ngày mai') || lower.includes('mai')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const res = `Ngày mai (${formatDateDayMonth(tomorrow)})`;
    return isRecurring ? `${res} · Lặp hàng tuần` : res;
  }

  if (lower.includes('cuối tuần')) {
    // Tìm Thứ 7 gần nhất
    const sat = getNextWeekdayDate(6, today);
    const res = `Cuối tuần (${formatDateDayMonth(sat)})`;
    return isRecurring ? `${res} · Lặp hàng tuần` : res;
  }

  // 4. Xử lý các thứ trong tuần: Thứ 2 -> Chủ nhật
  const dayMap = [
    { regex: /chủ nhật|cn/i, day: 0, name: 'Chủ nhật' },
    { regex: /thứ 2|thứ hai|t2/i, day: 1, name: 'Thứ 2' },
    { regex: /thứ 3|thứ ba|t3/i, day: 2, name: 'Thứ 3' },
    { regex: /thứ 4|thứ tư|t4/i, day: 3, name: 'Thứ 4' },
    { regex: /thứ 5|thứ năm|t5/i, day: 4, name: 'Thứ 5' },
    { regex: /thứ 6|thứ sáu|t6/i, day: 5, name: 'Thứ 6' },
    { regex: /thứ 7|thứ bảy|t7/i, day: 6, name: 'Thứ 7' }
  ];

  for (const item of dayMap) {
    if (item.regex.test(lower)) {
      const nextDate = getNextWeekdayDate(item.day, today);
      const res = `${item.name} (${formatDateDayMonth(nextDate)})`;
      return isRecurring ? `${res} · Lặp hàng tuần` : res;
    }
  }

  return isRecurring ? `${cleanStr} · Lặp hàng tuần` : cleanStr;
};
