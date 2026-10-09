/**
 * Utilities for handling real calendar Dates/Months for CarMate Trips
 */

const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** Pad to 2 digits (e.g. 8 -> "08") */
const pad2 = (n) => String(n).padStart(2, '0');

/** Format a date as dd/mm */
const formatDateDayMonth = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
};

/** Format a date as YYYY-MM-DD */
const formatDateISO = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/**
 * Find the next date matching a day of the week (1 = Monday, ..., 6 = Saturday, 0 = Sunday)
 */
const getNextWeekdayDate = (targetDay, baseDate = new Date()) => {
  const date = new Date(baseDate);
  const currentDay = date.getDay();
  let distance = targetDay - currentDay;
  if (distance < 0) distance += 7;
  date.setDate(date.getDate() + distance);
  return date;
};

/**
 * Format an exact date label, 100% accurate, for Trip Cards and Modals:
 * - Always show the exact weekday and Day/Month: "Thứ 4, 09/09", "Thứ 5, 10/09", "Thứ 6, 11/09"...
 * - Do not show an ambiguous "Hôm nay" (today) / "Ngày mai" (tomorrow) on the card, so users and drivers know the exact schedule.
 * - Recurring trips: show the date of the specific run as usual, without inserting the text "Lặp lại hàng tuần" (repeats weekly) that clutters the dashboard card.
 * - Self-healing mechanism (Self-healing Invariant):
 *   If an old post stored a relative string such as "Ngày mai (09/09)" and today is 09/09,
 *   the system automatically detects that 09/09 is today and displays exactly "Thứ 4, 09/09"!
 */
export const formatCleanDateLabel = (dateStr, baseDate = new Date()) => {
  const base = new Date(baseDate);
  base.setHours(0, 0, 0, 0);

  if (!dateStr) {
    const weekday = WEEKDAY_NAMES[base.getDay()];
    const dm = formatDateDayMonth(base);
    return `${weekday}, ${dm}`;
  }

  const str = String(dateStr).trim();
  const cleanStr = str
    .replace(/\(Lặp lại hàng tuần\)/gi, '')
    .replace(/hàng tuần/gi, '')
    .trim();

  const targetDate = parseTripDate(cleanStr, base);
  targetDate.setHours(0, 0, 0, 0);

  const weekday = WEEKDAY_NAMES[targetDate.getDay()];
  const dm = formatDateDayMonth(targetDate);
  return `${weekday}, ${dm}`;
};

/** Tolerance after departure time before a post expires (30 minutes) */
const EXPIRY_TOLERANCE_MS = 30 * 60 * 1000;

/**
 * Extract the departure date (Date object) from the trip's `date` property
 */
export const parseTripDate = (dateStr, baseDate = new Date()) => {
  const base = new Date(baseDate);
  if (!dateStr) return new Date(base.getFullYear(), base.getMonth(), base.getDate());

  const str = String(dateStr).trim();
  const lower = str.toLowerCase();

  // 1. ISO string: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  // 2. dd/mm format (e.g. "07/09" or "Thứ 2 (07/09)" or "Ngày mai (09/09)")
  // A specific calendar date always has the highest priority, to avoid stale relative keywords
  const dmMatch = str.match(/(\d{1,2})\/(\d{1,2})/);
  if (dmMatch) {
    const day = Number(dmMatch[1]);
    const month = Number(dmMatch[2]) - 1;
    let year = base.getFullYear();
    // If the month is more than 2 months earlier than the current month, assume next year
    if (month < base.getMonth() - 2) {
      year += 1;
    }
    return new Date(year, month, day);
  }

  // 3. Contains "Hôm nay" (today) (when there is no accompanying dd/mm)
  if (lower.includes('hôm nay')) {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate());
  }

  // 4. Contains "Ngày mai" (tomorrow) or "mai" (when there is no accompanying dd/mm)
  if (lower.includes('ngày mai') || lower.includes('mai')) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() + 1);
    return d;
  }

  // 5. Contains "Hôm qua" (yesterday) (when there is no accompanying dd/mm)
  if (lower.includes('hôm qua')) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() - 1);
    return d;
  }

  // 6. Contains "cuối tuần" (weekend)
  if (lower.includes('cuối tuần')) {
    const sat = getNextWeekdayDate(6, base);
    return new Date(sat.getFullYear(), sat.getMonth(), sat.getDate());
  }

  // 7. Day of the week (e.g. "Thứ 2", "Thứ 3"...)
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
 * Compute the end-of-departure timestamp of the trip (Timestamp ms)
 */
export const getTripEndTimestamp = (trip, baseDate = new Date()) => {
  if (!trip) return 0;
  const tripDate = parseTripDate(trip.date, baseDate);
  const year = tripDate.getFullYear();
  const month = tripDate.getMonth();
  const day = tripDate.getDate();

  // 1. Parse the hour from timeSlot or exactTime
  let endHour = 23;
  let endMinute = 59;
  let crossMidnight = false;

  const rawSlot = trip.timeSlot || '';
  // Match the format HH:MM-HH:MM or HH:MM – HH:MM
  const slotMatch = rawSlot.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (slotMatch) {
    const startH = Number(slotMatch[1]);
    endHour = Number(slotMatch[3]);
    endMinute = Number(slotMatch[4]);
    // If the end hour < the start hour (e.g. 23:00 - 03:00) the trip spans midnight
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
    endHour = 5;
    endMinute = 0;
  } else if (rawSlot.includes('05:00-07:00')) {
    endHour = 7;
    endMinute = 0;
  } else if (rawSlot.includes('07:00-09:00')) {
    endHour = 9;
    endMinute = 0;
  } else if (rawSlot.includes('09:00-11:00')) {
    endHour = 11;
    endMinute = 0;
  } else if (rawSlot.includes('11:00-13:00')) {
    endHour = 13;
    endMinute = 0;
  } else if (rawSlot.includes('13:00-15:00')) {
    endHour = 15;
    endMinute = 0;
  } else if (rawSlot.includes('15:00-17:00')) {
    endHour = 17;
    endMinute = 0;
  } else if (rawSlot.includes('17:00-19:00')) {
    endHour = 19;
    endMinute = 0;
  } else if (rawSlot.includes('19:00-21:00')) {
    endHour = 21;
    endMinute = 0;
  } else if (rawSlot.includes('21:00-23:00')) {
    endHour = 23;
    endMinute = 0;
  }

  const resultDate = new Date(year, month, day, endHour, endMinute, 0, 0);
  if (crossMidnight) {
    resultDate.setDate(resultDate.getDate() + 1);
  }

  return resultDate.getTime();
};

/**
 * Check whether a trip is past its time (no longer shown publicly) or not.
 * - Has a 30-minute tolerance after the departure time window ends.
 * - Weekly recurring trips (isRecurringWeekly) never expire.
 */
export const isTripExpired = (trip, now = new Date()) => {
  if (!trip) return false;

  // If it was actively closed / completed / cancelled
  if (trip.status === 'completed' || trip.status === 'cancelled') {
    return true;
  }

  // Weekly recurring trips never expire
  const isRecurring = Boolean(
    trip.isRecurringWeekly ||
    (trip.date && (String(trip.date).includes('hàng tuần') || String(trip.date).includes('Lặp lại')))
  );
  if (isRecurring) {
    return false;
  }

  const endTimestamp = getTripEndTimestamp(trip, now);
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime();

  // Past departure time + 30-minute tolerance
  return nowMs > endTimestamp + EXPIRY_TOLERANCE_MS;
};

/**
 * Get tomorrow's date as a YYYY-MM-DD string
 */
export const getTomorrowISO = (baseDate = new Date()) => {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + 1);
  return formatDateISO(d);
};

/**
 * Group trips into time windows (Temporal Windowing), Apple-style:
 * - Today
 * - Tomorrow
 * - Upcoming
 * - Finished / Expired
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
