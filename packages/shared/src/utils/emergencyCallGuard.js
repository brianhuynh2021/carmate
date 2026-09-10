/**
 * CarMate Emergency Call Guard - MIT Invariant Logic
 * 
 * BẤT BIẾN LOGIC:
 * 1. Mặc định 100% bảo mật: Không hiển thị SĐT, Gmail, Telegram giữa 2 bên.
 * 2. Cuộc gọi hợp lệ: Thời gian đổ chuông phải >= 25 giây (MIN_CALL_DURATION_FOR_EMERGENCY = 25).
 * 3. Ngưỡng mở khoá: Phải đạt tối thiểu 2 cuộc gọi nhỡ hợp lệ (REQUIRED_UNANSWERED_CALLS = 2).
 * 4. Bất đối xứng (Asymmetric Privacy): Chỉ mở khoá cho DUY NHẤT người đã thực hiện 2 cuộc gọi.
 *    Người nhận (không nghe máy) và bên thứ ba tuyệt đối không được xem số.
 */

export const MIN_CALL_DURATION_FOR_EMERGENCY = 25; // giây
export const REQUIRED_UNANSWERED_CALLS = 2; // lần

// Bộ nhớ đệm fallback cho môi trường Node.js / SSR
const memoryStore = new Map();

function getStorageKey(bookingId, callerId) {
  const cleanBooking = String(bookingId || '').trim();
  const cleanCaller = String(callerId || 'guest').trim();
  return `carmate_call_guard_${cleanBooking}_${cleanCaller}`;
}

function getRawData(key) {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    try {
      const val = globalThis.localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return memoryStore.get(key) || null;
    }
  }
  return memoryStore.get(key) || null;
}

function setRawData(key, data) {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    try {
      globalThis.localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Bỏ qua lỗi quota storage nếu có
    }
  }
  memoryStore.set(key, data);
}

/**
 * Lấy trạng thái cuộc gọi khẩn cấp của người gọi đối với chuyến đi cụ thể
 * @param {Object} params
 * @param {string} params.bookingId - Mã chuyến đi / mã ký quỹ
 * @param {string} params.callerId - ID hoặc SĐT của người gọi
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
 * Ghi nhận một lần gọi thoại trong App
 * @param {Object} params
 * @param {string} params.bookingId - Mã chuyến đi / mã ký quỹ
 * @param {string} params.callerId - ID hoặc SĐT của người gọi
 * @param {number} params.durationSeconds - Số giây đổ chuông
 * @param {boolean} [params.answered=false] - Đối tác có nghe máy hay không
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

  // Nếu cuộc gọi đã được nghe máy -> Không tính là cuộc gọi nhỡ
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

  // Kiểm tra thời lượng đổ chuông tối thiểu >= 25 giây
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

  // Cuộc gọi hợp lệ: Không nghe máy và đổ chuông >= 25s
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
 * Kiểm tra nhanh xem SĐT đối tác đã được mở khoá cho người gọi hay chưa
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
 * Đặt lại trạng thái cuộc gọi khẩn cấp (khi hoàn thành hoặc huỷ chuyến)
 * @param {Object} params
 * @param {string} params.bookingId
 * @param {string} params.callerId
 */
export function resetEmergencyCallStatus({ bookingId, callerId }) {
  if (!bookingId || !callerId) return;
  const key = getStorageKey(bookingId, callerId);
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    try {
      globalThis.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  memoryStore.delete(key);
}
