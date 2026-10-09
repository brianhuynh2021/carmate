/**
 * CarMate Emergency Call Guard - MIT Invariant Logic
 * 
 * LOGIC INVARIANTS:
 * 1. 100% private by default: Do not show phone number (SĐT), Gmail, Telegram between the 2 parties.
 * 2. Valid call: ring time must be >= 25 seconds (MIN_CALL_DURATION_FOR_EMERGENCY = 25).
 * 3. Unlock threshold: at least 2 valid missed calls are required (REQUIRED_UNANSWERED_CALLS = 2).
 * 4. Asymmetric Privacy: unlocks ONLY for the person who made the 2 calls.
 *    The recipient (who did not answer) and third parties must absolutely not see the number.
 */

export const MIN_CALL_DURATION_FOR_EMERGENCY = 25; // seconds
export const REQUIRED_UNANSWERED_CALLS = 2; // times

// Fallback in-memory cache for Node.js / SSR environments
const memoryStore = new Map();

function getStorageKey(bookingId, callerId) {
  const cleanBooking = String(bookingId || '').trim();
  const cleanCaller = String(callerId || 'guest').trim();
  return `carmate_call_guard_${cleanBooking}_${cleanCaller}`;
}

function getRawData(key) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const val = globalThis.localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    }
  } catch {
    // fallback to memoryStore
  }
  return memoryStore.get(key) || null;
}

function setRawData(key, data) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(key, JSON.stringify(data));
    }
  } catch {
    // Ignore storage quota errors if any
  }
  memoryStore.set(key, data);
}

/**
 * Get the emergency call status of the caller for a specific trip
 * @param {Object} params
 * @param {string} params.bookingId - Trip ID / escrow ID
 * @param {string} params.callerId - ID or phone number of the caller
 * @returns {{ isUnlocked: boolean, attempts: number, remainingAttempts: number, qualifiedAttempts: Array }}
 */
export function getEmergencyCallStatus({ bookingId, callerId }) {
  if (!bookingId || !callerId) {
    return {
      isUnlocked: false,
      attempts: 0,
      remainingAttempts: REQUIRED_UNANSWERED_CALLS,
      qualifiedAttempts: []
    };
  }

  const key = getStorageKey(bookingId, callerId);
  const data = getRawData(key) || { attempts: 0, qualifiedAttempts: [], isUnlocked: false };

  const attemptsCount = Array.isArray(data.qualifiedAttempts) ? data.qualifiedAttempts.length : (data.attempts || 0);
  const isUnlocked = attemptsCount >= REQUIRED_UNANSWERED_CALLS;

  return {
    isUnlocked,
    attempts: attemptsCount,
    remainingAttempts: Math.max(0, REQUIRED_UNANSWERED_CALLS - attemptsCount),
    qualifiedAttempts: data.qualifiedAttempts || []
  };
}

/**
 * Record one voice call made in the App
 * @param {Object} params
 * @param {string} params.bookingId - Trip ID / escrow ID
 * @param {string} params.callerId - ID or phone number of the caller
 * @param {number} params.durationSeconds - Number of seconds the phone rang
 * @param {boolean} [params.answered=false] - Whether the counterparty answered
 * @returns {{ qualified: boolean, durationSeconds: number, attempts: number, remainingAttempts: number, isUnlocked: boolean, reason?: string }}
 */
export function recordCallAttempt({ bookingId, callerId, durationSeconds = 0, answered = false }) {
  if (!bookingId || !callerId) {
    return {
      qualified: false,
      durationSeconds,
      attempts: 0,
      remainingAttempts: REQUIRED_UNANSWERED_CALLS,
      isUnlocked: false,
      reason: 'Thiếu thông tin chuyến đi hoặc người gọi'
    };
  }

  const key = getStorageKey(bookingId, callerId);
  const data = getRawData(key) || { attempts: 0, qualifiedAttempts: [], isUnlocked: false };

  // If the call was answered -> it does not count as a missed call
  if (answered) {
    return {
      qualified: false,
      durationSeconds,
      attempts: data.qualifiedAttempts?.length || 0,
      remainingAttempts: Math.max(0, REQUIRED_UNANSWERED_CALLS - (data.qualifiedAttempts?.length || 0)),
      isUnlocked: Boolean(data.isUnlocked),
      reason: 'Cuộc gọi đã kết nối thành công, không tính vào số lần nhỡ'
    };
  }

  // Check the minimum ring duration >= 25 seconds
  if (durationSeconds < MIN_CALL_DURATION_FOR_EMERGENCY) {
    return {
      qualified: false,
      durationSeconds,
      attempts: data.qualifiedAttempts?.length || 0,
      remainingAttempts: Math.max(0, REQUIRED_UNANSWERED_CALLS - (data.qualifiedAttempts?.length || 0)),
      isUnlocked: Boolean(data.isUnlocked),
      reason: `Đổ chuông ${durationSeconds}s chưa đủ thời lượng tối thiểu ${MIN_CALL_DURATION_FOR_EMERGENCY}s`
    };
  }

  // Valid call: not answered and rang >= 25s
  const now = new Date().toISOString();
  const updatedQualified = [
    ...(data.qualifiedAttempts || []),
    { timestamp: now, durationSeconds }
  ];

  const newAttempts = updatedQualified.length;
  const isUnlocked = newAttempts >= REQUIRED_UNANSWERED_CALLS;

  const newData = {
    attempts: newAttempts,
    qualifiedAttempts: updatedQualified,
    isUnlocked,
    unlockedAt: isUnlocked ? (data.unlockedAt || now) : null
  };

  setRawData(key, newData);

  return {
    qualified: true,
    durationSeconds,
    attempts: newAttempts,
    remainingAttempts: Math.max(0, REQUIRED_UNANSWERED_CALLS - newAttempts),
    isUnlocked,
    unlockedAt: newData.unlockedAt
  };
}

/**
 * Quick check of whether the counterparty's phone number (SĐT) has been unlocked for the caller
 * @param {Object} params
 * @param {string} params.bookingId
 * @param {string} params.callerId
 * @returns {boolean}
 */
export function isEmergencyPhoneUnlocked({ bookingId, callerId }) {
  const status = getEmergencyCallStatus({ bookingId, callerId });
  return status.isUnlocked;
}

/**
 * Reset the emergency call status (when the trip is completed or cancelled)
 * @param {Object} params
 * @param {string} params.bookingId
 * @param {string} params.callerId
 */
export function resetEmergencyCallStatus({ bookingId, callerId }) {
  if (!bookingId || !callerId) return;
  const key = getStorageKey(bookingId, callerId);
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
  memoryStore.delete(key);
}
