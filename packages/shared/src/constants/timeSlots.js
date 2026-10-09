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
 * Normalizes and cleans time labels to a uniform 24h standard (Zero Fluff, First Principles)
 * Eliminates redundant part-of-day words ("Sáng" morning, "Chiều" afternoon, "Tối" evening, "AM", "PM") once the 24h standard is used (e.g. 05:00, 17:00)
 */
export const sanitizeTimeLabel = (str) => {
  if (!str || typeof str !== 'string') return '';
  let cleaned = str.trim();

  // Normalizes the 'h' notation to ':' (e.g. "7h" -> "7:00", "7h30" -> "7:30", "7h-8h" -> "7:00 - 8:00")
  cleaned = cleaned.replace(/(\d{1,2})h(\d{2})?/gi, (m, h, min) => `${h}:${min || '00'}`);

  // Normalizes hyphens to the standard en-dash: " – "
  cleaned = cleaned.replace(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/, '$1 – $2');

  // Normalizes 1-digit hours to 2 digits (e.g. "7:00" -> "07:00", "7:00 – 8:00" -> "07:00 – 08:00")
  cleaned = cleaned.replace(/^(\d):(\d{2})/, '0$1:$2').replace(/–\s*(\d):(\d{2})/, '– 0$1:$2');

  // Strips all redundant part-of-day words under the 24h standard: Sáng (morning), Chiều (afternoon), Trưa (noon), Tối (evening), Đêm (night), AM, PM
  cleaned = cleaned.replace(/\s*(?:sáng|chiều|trưa|tối|đêm|am|pm)(?:\s+mai|\s+hôm nay)?\b/gi, '').trim();

  return cleaned;
};

/** Checks whether a specific pickup time falls within a time slot */
export const isTimeInSlot = (timeStr, slotId) => {
  if (!timeStr || !slotId || slotId === 'all') return true;
  return mapTimeToSlot(timeStr) === slotId;
};

/** Gets the time slot label by language, falling back to the item's raw string. Supports showing the exact time if available (e.g. 04:30). */
export const getTimeSlotLabel = (idOrItem, lang = 'vi', variant = 'short') => {
  const exactTime = typeof idOrItem === 'object' ? idOrItem?.exactTime : null;
  const id = typeof idOrItem === 'string' ? idOrItem : idOrItem?.timeSlot || idOrItem?.timeSlotId;
  const slot = TIME_SLOTS.find((s) => s.id === id);

  // Only attach exactTime if it really belongs to the corresponding time slot
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
    // Automatically clean up if an old stored label has the time-mismatch bug, e.g. "17:00 (03:00 – 05:00)"
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

/** Automatically maps an exact time (e.g. 04:30) to the corresponding 24/7 time slot */
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
 * QUICK-PICK DEPARTURE WINDOW CHIPS (SMART DEPARTURE CHIPS)
 * =============================================================================
 * On intercity routes, TIME is first-class data — on par with Origin and
 * Destination, not a secondary line "book for another time" tucked away below. Pushing it
 * down to a secondary row is exactly what makes users assume the app works like the
 * "get a ride right now" model of an urban taxi.
 *
 * Real intercity riders only revolve around a few intents: heading home this afternoon, leaving
 * this evening, or leaving early tomorrow morning. Let them choose with ONE TAP instead of making them open a calendar.
 *
 * The chip list is COMPUTED FROM THE CURRENT TIME: at 20h in the evening, still showing the
 * "Chiều nay" (this afternoon) chip is meaningless. Windows that have already passed disappear automatically.
 */
export const DEPARTURE_WINDOWS = Object.freeze([
  // `label` is how Vietnamese people say it day to day, joined directly with "nay"/"mai" (today/tomorrow) to form
  // "Sáng mai" (tomorrow morning), "Chiều nay" (this afternoon) — understood at a glance, no mental translation needed.
  { id: 'early_morning', fromHour: 4, toHour: 8, label: 'Sáng sớm', labelEn: 'Early morning', hint: '04:00 – 08:00' },
  { id: 'morning', fromHour: 8, toHour: 11, label: 'Sáng', labelEn: 'Morning', hint: '08:00 – 11:00' },
  { id: 'noon', fromHour: 11, toHour: 14, label: 'Trưa', labelEn: 'Midday', hint: '11:00 – 14:00' },
  { id: 'afternoon', fromHour: 14, toHour: 18, label: 'Chiều', labelEn: 'Afternoon', hint: '14:00 – 18:00' },
  { id: 'evening', fromHour: 18, toHour: 22, label: 'Tối', labelEn: 'Evening', hint: '18:00 – 22:00' },
  { id: 'late_night', fromHour: 22, toHour: 28, label: 'Khuya', labelEn: 'Late night', hint: '22:00 – 04:00' }
]);

/**
 * Builds the list of chips suited to the current moment.
 *
 * Rule: a window is only meaningful if at least `minLeadMinutes` minutes remain
 * before it ends — nobody can book a trip for a window that closes in 10
 * minutes. Once today's windows are used up, switch to tomorrow's windows.
 *
 * @param {object} [opts]
 * @param {Date|number} [opts.now] - The current point in time
 * @param {number} [opts.limit] - Max number of chips (default 3, leaving the 4th slot for the
 *   "Chọn ngày khác" (pick another date) button — a 2x2 grid has only 4 cells, a 4th chip would push the button onto an odd row)
 * @param {number} [opts.minLeadMinutes] - At least how many minutes must remain
 * @returns {Array<{id, label, hint, dayOffset, dayLabel, timeSlot, fromHour, toHour}>}
 */
export function buildDepartureChips({ now = new Date(), limit = 3, minLeadMinutes = 45 } = {}) {
  const ref = now instanceof Date ? now : new Date(now);
  const nowMinutes = ref.getHours() * 60 + ref.getMinutes();
  const candidates = [];

  for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
    for (const w of DEPARTURE_WINDOWS) {
      const isOvernight = w.toHour > 24;
      const startMinutes = w.fromHour * 60;
      const endMinutes = w.toHour * 60;

      // Today's window is only meaningful if there is still enough time to book before it closes
      if (dayOffset === 0 && endMinutes - nowMinutes < minLeadMinutes) continue;

      // CUT OFF THE PART OF THE WINDOW THAT HAS ALREADY PASSED: at 16h30, "Chiều nay" (this afternoon) must be (16h30-18h),
      // not (14h-18h) — the first half of the window can no longer be booked, so showing
      // the whole window would be telling the passenger something wrong.
      const isPartial = dayOffset === 0 && nowMinutes > startMinutes;
      const effectiveStart = isPartial ? nowMinutes : startMinutes;

      const fmt = (mins) => {
        const h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
      };
      const shortHint = `${fmt(effectiveStart)}-${fmt(endMinutes)}`;

      const dayWord = isOvernight
        ? dayOffset === 0
          ? 'đêm nay'
          : 'đêm mai'
        : dayOffset === 0
          ? 'nay'
          : dayOffset === 1
            ? 'mai'
            : 'ngày kia';
      const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
      const label = isOvernight ? cap(dayWord) : `${w.label} ${dayWord}`;

      // PRIORITIZE BY THE REAL NEEDS OF INTERCITY ROUTES.
      // People in Bù Đốp / Lái Thiêu looking for a ride in the late afternoon are going to work or to see
      // a doctor TOMORROW MORNING — very few take a family car in the 22h-4h window. So after 16h, the
      // night window is pushed behind tomorrow's morning windows, even though it comes earlier in time.
      // The penalty must be large enough to cross the DAY boundary (each day is 10000 apart),
      // otherwise today's night window (key ~6000) would still always beat every tomorrow
      // morning window (key >10000) and the deprioritization would be meaningless.
      // +10000 pushes it down to tomorrow's level, +720 places it AFTER tomorrow's morning windows.
      const deprioritizeOvernight = isOvernight && nowMinutes >= 16 * 60;
      const sortKey =
        dayOffset * 10000 + effectiveStart + (deprioritizeOvernight ? 10000 + 720 : 0);

      candidates.push({
        id: `${w.id}_d${dayOffset}`,
        windowId: w.id,
        label,
        labelEn: dayOffset === 0 ? w.labelEn : `${w.labelEn} tomorrow`,
        hint: shortHint,
        display: `${label} (${shortHint})`,
        dayOffset,
        dayLabel: dayOffset === 0 ? 'Hôm nay' : dayOffset === 1 ? 'Ngày mai' : 'Ngày kia',
        fromHour: w.fromHour,
        toHour: w.toHour,
        isPartial,
        // Time slot sent to the server: if the window was cut, search from exactly the remaining start point
        timeSlot: `${String(Math.floor(effectiveStart / 60) % 24).padStart(2, '0')}:${String(
          effectiveStart % 60
        ).padStart(2, '0')}`,
        sortKey
      });
    }
  }

  candidates.sort((a, b) => a.sortKey - b.sortKey);
  // Drop sortKey from the result: it is an internal detail of the ranking,
  // not data the UI needs to know about.
  return candidates.slice(0, limit).map(({ sortKey: _sortKey, ...chip }) => chip);
}

/** The date (YYYY-MM-DD) corresponding to a chip. */
export function getChipDate(chip, now = new Date()) {
  const d = now instanceof Date ? new Date(now) : new Date(now);
  d.setDate(d.getDate() + (chip?.dayOffset || 0));
  return toLocalIsoDate(d);
}

/** Formats YYYY-MM-DD by the LOCAL calendar, without going through UTC. */
export function toLocalIsoDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Builds a chip from a date and time window that the passenger picks themselves in the calendar picker.
 * Returns the same shape as an auto-generated chip, so the UI shares a single rendering path.
 */
export function buildCustomChip({ date, windowId = 'morning' }) {
  const w = DEPARTURE_WINDOWS.find((x) => x.id === windowId) || DEPARTURE_WINDOWS[1];
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const dayOffset = Math.round((target - today) / 86400000);

  const dayLabel =
    dayOffset === 0 ? 'Hôm nay' : dayOffset === 1 ? 'Ngày mai' : `${d.getDate()}/${d.getMonth() + 1}`;
  const shortHint = `${w.fromHour % 24}h-${w.toHour % 24}h`;

  return {
    id: `custom_${target.getTime()}_${w.id}`,
    windowId: w.id,
    isCustom: true,
    label: `${dayLabel}`,
    hint: shortHint,
    display: `${dayLabel} (${shortHint})`,
    dayOffset,
    dayLabel,
    fromHour: w.fromHour,
    toHour: w.toHour,
    // Do NOT use toISOString(): it converts to UTC, and midnight in Vietnam time (UTC+7)
    // falls at 17h of the PREVIOUS day in UTC — a passenger who picks 25/12 would end up looking for trips on 24/12.
    date: toLocalIsoDate(target),
    timeSlot: `${String(w.fromHour % 24).padStart(2, '0')}:00`
  };
}
