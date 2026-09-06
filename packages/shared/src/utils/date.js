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

/** Dung sai sau giờ khởi hành trước khi bài đăng hết hạn (30 phút) */
export const EXPIRY_TOLERANCE_MS = 30 * 60 * 1000;

/**
 * Trích xuất ngày khởi hành (Date object) từ thuộc tính `date` của chuyến
 */
export const parseTripDate = (dateStr, baseDate = new Date()) => {
  const base = new Date(baseDate);
  if (!dateStr) return new Date(base.getFullYear(), base.getMonth(), base.getDate());

  const str = String(dateStr).trim();
  const lower = str.toLowerCase();

  // 1. Chuỗi ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  // 2. Chứa "Hôm nay"
  if (lower.includes('hôm nay')) {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate());
  }

  // 3. Chứa "Ngày mai" hoặc "mai"
  if (lower.includes('ngày mai') || lower.includes('mai')) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() + 1);
    return d;
  }

  // 4. Định dạng dd/mm (ví dụ: "07/09" hoặc "Thứ 2 (07/09)")
  const dmMatch = str.match(/(\d{1,2})\/(\d{1,2})/);
  if (dmMatch) {
    const day = Number(dmMatch[1]);
    const month = Number(dmMatch[2]) - 1;
    let year = base.getFullYear();
    // Nếu tháng nhỏ hơn tháng hiện tại hơn 2 tháng, giả định là năm sau
    if (month < base.getMonth() - 2) {
      year += 1;
    }
    return new Date(year, month, day);
  }

  // 5. Thứ trong tuần (vd "Thứ 2", "Thứ 3"...)
  const dayMap = [
    { regex: /chủ nhật|cn/i, day: 0 },
    { regex: /thứ 2|thứ hai|t2/i, day: 1 },
    { regex: /thứ 3|thứ ba|t3/i, day: 2 },
    { regex: /thứ 4|thứ tư|t4/i, day: 3 },
    { regex: /thứ 5|thứ năm|t5/i, day: 4 },
    { regex: /thứ 6|thứ sáu|t6/i, day: 5 },
    { regex: /thứ 7|thứ bảy|t7/i, day: 6 }
  ];
  for (const item of dayMap) {
    if (item.regex.test(lower)) {
      const nextDate = getNextWeekdayDate(item.day, base);
      return new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
    }
  }

  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
};

/**
 * Tính toán mốc thời gian kết thúc xuất phát của chuyến xe (Timestamp ms)
 */
export const getTripEndTimestamp = (trip, baseDate = new Date()) => {
  if (!trip) return 0;
  const tripDate = parseTripDate(trip.date, baseDate);
  const year = tripDate.getFullYear();
  const month = tripDate.getMonth();
  const day = tripDate.getDate();

  // 1. Phân tích giờ từ timeSlot hoặc exactTime
  let endHour = 23;
  let endMinute = 59;
  let crossMidnight = false;

  const rawSlot = trip.timeSlot || '';
  // Khớp định dạng HH:MM-HH:MM hoặc HH:MM – HH:MM
  const slotMatch = rawSlot.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (slotMatch) {
    const startH = Number(slotMatch[1]);
    endHour = Number(slotMatch[3]);
    endMinute = Number(slotMatch[4]);
    // Nếu giờ kết thúc < giờ bắt đầu (ví dụ: 23:00 - 03:00) thì chuyến kéo dài qua nửa đêm
    if (endHour < startH) {
      crossMidnight = true;
    }
  } else if (trip.exactTime && /^\d{1,2}:\d{2}$/.test(trip.exactTime)) {
    const parts = trip.exactTime.split(':');
    endHour = Number(parts[0]);
    endMinute = Number(parts[1]);
  } else if (trip.departureTime && /(\d{1,2}):(\d{2})/.test(trip.departureTime)) {
    const timeMatch = trip.departureTime.match(/(\d{1,2}):(\d{2})/);
    endHour = Number(timeMatch[1]);
    endMinute = Number(timeMatch[2]);
  } else if (rawSlot.includes('03:00-05:00')) {
    endHour = 5; endMinute = 0;
  } else if (rawSlot.includes('05:00-07:00')) {
    endHour = 7; endMinute = 0;
  } else if (rawSlot.includes('07:00-09:00')) {
    endHour = 9; endMinute = 0;
  } else if (rawSlot.includes('09:00-11:00')) {
    endHour = 11; endMinute = 0;
  } else if (rawSlot.includes('11:00-13:00')) {
    endHour = 13; endMinute = 0;
  } else if (rawSlot.includes('13:00-15:00')) {
    endHour = 15; endMinute = 0;
  } else if (rawSlot.includes('15:00-17:00')) {
    endHour = 17; endMinute = 0;
  } else if (rawSlot.includes('17:00-19:00')) {
    endHour = 19; endMinute = 0;
  } else if (rawSlot.includes('19:00-21:00')) {
    endHour = 21; endMinute = 0;
  } else if (rawSlot.includes('21:00-23:00')) {
    endHour = 23; endMinute = 0;
  }

  const resultDate = new Date(year, month, day, endHour, endMinute, 0, 0);
  if (crossMidnight) {
    resultDate.setDate(resultDate.getDate() + 1);
  }

  return resultDate.getTime();
};

/**
 * Kiểm tra xem một chuyến đi đã quá giờ (Hết hạn hiển thị công khai) hay chưa.
 * - Có dung sai 30 phút sau khi khung giờ khởi hành kết thúc.
 * - Các chuyến lặp hàng tuần (isRecurringWeekly) không bao giờ hết hạn.
 */
export const isTripExpired = (trip, now = new Date()) => {
  if (!trip) return false;

  // Nếu đã chủ động đóng / hoàn thành / hủy
  if (trip.status === 'completed' || trip.status === 'cancelled') {
    return true;
  }

  // Chuyến định kỳ lặp lại hàng tuần không hết hạn
  const isRecurring = Boolean(
    trip.isRecurringWeekly ||
    (trip.date && (String(trip.date).includes('hàng tuần') || String(trip.date).includes('Lặp lại')))
  );
  if (isRecurring) {
    return false;
  }

  const endTimestamp = getTripEndTimestamp(trip, now);
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime();

  // Quá giờ khởi hành + 30 phút dung sai
  return nowMs > (endTimestamp + EXPIRY_TOLERANCE_MS);
};

/**
 * Lấy chuỗi ngày mai định dạng YYYY-MM-DD
 */
export const getTomorrowISO = (baseDate = new Date()) => {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + 1);
  return formatDateISO(d);
};

/**
 * Phân nhóm các chuyến xe thành các cửa sổ thời gian (Temporal Windowing) chuẩn Apple:
 * - Hôm nay (Today)
 * - Ngày mai (Tomorrow)
 * - Sắp tới (Upcoming)
 * - Đã kết thúc / Hết hạn (Expired)
 */
export const groupTripsByTemporalWindow = (trips = [], now = new Date()) => {
  const today = new Date(now);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
  const dayAfterTomorrowStart = tomorrowStart + 24 * 60 * 60 * 1000;

  const result = {
    today: [],
    tomorrow: [],
    upcoming: [],
    expired: []
  };

  for (const trip of trips) {
    if (isTripExpired(trip, now)) {
      result.expired.push(trip);
      continue;
    }

    const tripDate = parseTripDate(trip.date, now);
    const tripStartMs = new Date(tripDate.getFullYear(), tripDate.getMonth(), tripDate.getDate()).getTime();

    if (tripStartMs < tomorrowStart) {
      result.today.push(trip);
    } else if (tripStartMs < dayAfterTomorrowStart) {
      result.tomorrow.push(trip);
    } else {
      result.upcoming.push(trip);
    }
  }

  return result;
};

