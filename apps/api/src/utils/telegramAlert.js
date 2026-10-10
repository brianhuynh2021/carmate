/**
 * CarMate Telegram Bot Alerting Engine (0 VND, Free & Independent)
 * Automatically fires system error alerts and new trip notifications to the Founder's phone.
 */

// Cache to prevent consecutive message spam (Deduplication Cache)
const alertCache = new Map();
const DEDUP_TTL_MS = 60 * 1000; // 60 seconds

function escapeHtml(text = '') {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Checks whether a request or error originates from a local development environment (localhost/dev)
 * @param {object} req - Express Request object
 * @param {Error|object} error - Error object
 * @returns {boolean}
 */
export function isLocalhostRequest(req = null, error = null) {
  if (!req && !error) return false;

  // 1. Check the client IP
  const clientIp = req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress;
  if (clientIp) {
    const ipStr = String(clientIp).toLowerCase().trim();
    if (
      ipStr === '::1' ||
      ipStr === '127.0.0.1' ||
      ipStr === '::ffff:127.0.0.1' ||
      ipStr.startsWith('127.') ||
      ipStr.includes('localhost')
    ) {
      return true;
    }
  }

  // 2. Check the Host, Origin, Referer headers
  const host = req?.headers?.host || req?.hostname;
  if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
    return true;
  }

  const origin = req?.headers?.origin;
  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return true;
  }

  const referer = req?.headers?.referer;
  if (referer && (referer.includes('localhost') || referer.includes('127.0.0.1'))) {
    return true;
  }

  // 3. Check the Error stack trace (e.g. a client crash error from http://localhost:5173/src/...)
  const stack = error?.stack || (typeof error === 'string' ? error : '');
  if (stack && (stack.includes('localhost:') || stack.includes('127.0.0.1:'))) {
    return true;
  }

  return false;
}

/**
 * Sends a raw message to the Telegram Bot
 * @param {string} text - Message content
 * @param {object} options - Options { parseMode: 'HTML', disableNotification: false, req, error }
 * @returns {Promise<boolean>}
 */
export async function sendTelegramMessage(text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || process.env.TELEGRAM_LOG_CHAT_ID;

  if (!token || !chatId) {
    return false;
  }

  const isMockToken = token.startsWith('mock_');

  // 1. ABSOLUTELY do NOT send messages to the real Telegram while the automated test suite is running,
  // or while developing / debugging in a local / localhost environment.
  // Only fire Telegram alerts in a genuine Production environment,
  // or when ENABLE_DEV_TELEGRAM_ALERTS=true is deliberately enabled so developers can test the bot.
  if (!isMockToken) {
    if (
      options.isTest ||
      options.req?.isAutomatedTest ||
      options.req?.headers?.['x-carmate-testing'] === 'true' ||
      process.env.CARMATE_DISABLE_TELEGRAM === 'true' ||
      process.env.NODE_ENV === 'test'
    ) {
      return false;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const enableDevAlerts = process.env.ENABLE_DEV_TELEGRAM_ALERTS === 'true';

    // If not production and ENABLE_DEV_TELEGRAM_ALERTS is not enabled
    if (!isProduction && !enableDevAlerts) {
      return false;
    }

    // If the request originates from localhost / 127.0.0.1 / ::1
    if (!enableDevAlerts && isLocalhostRequest(options.req, options.error)) {
      return false;
    }
  }

  const { parseMode = 'HTML', disableNotification = false } = options;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
        disable_notification: disableNotification
      }),
      signal: AbortSignal.timeout(6000) // 6s timeout so the thread does not hang
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`[Telegram Alert] Gửi tin nhắn thất bại (${response.status}):`, errText);
      return false;
    }

    return true;
  } catch (err) {
    // Never let a Telegram failure bring the server down
    console.warn('[Telegram Alert] Lỗi kết nối mạng:', err.message);
    return false;
  }
}

/**
 * Fires a technical incident alert (Crash / Error 500)
 * @param {object} params - { error, req, source }
 */
export async function sendSystemErrorAlert({ error, req = null, source = 'API Server' }) {
  const errorMessage = error?.message || String(error || 'Lỗi không xác định');
  const path = req ? `${req.method || 'GET'} ${req.originalUrl || req.url || '/'}` : 'Hệ thống';

  // Spam prevention in dev / localhost environments: absolutely never send Telegram from localhost or dev
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const isMockToken = token?.startsWith('mock_');
  const isProduction = process.env.NODE_ENV === 'production';
  const enableDevAlerts = process.env.ENABLE_DEV_TELEGRAM_ALERTS === 'true';

  if (!isMockToken && !enableDevAlerts) {
    if (!isProduction || isLocalhostRequest(req, error)) {
      console.warn(`[Local/Dev Error Suppressed]: [${source}] ${path} - ${errorMessage} (Không gửi lên Telegram)`);
      return false;
    }
  }

  // Spam prevention: if the same error on the same path occurs repeatedly within 60s, skip it
  const dedupKey = `${source}:${path}:${errorMessage}`;
  const now = Date.now();
  const lastSent = alertCache.get(dedupKey);

  if (lastSent && now - lastSent < DEDUP_TTL_MS) {
    return false; // Already sent within the previous 60s, skip
  }
  alertCache.set(dedupKey, now);

  // Periodically clean up the old cache if it holds more than 200 records
  if (alertCache.size > 200) {
    for (const [key, timestamp] of alertCache.entries()) {
      if (now - timestamp > DEDUP_TTL_MS) {
        alertCache.delete(key);
      }
    }
  }

  const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const clientIp = req?.ip || req?.headers?.['x-forwarded-for'] || 'N/A';
  const stack = error?.stack ? error.stack.split('\n').slice(0, 5).join('\n') : '';

  let message = `🚨 <b>[CARMATE SYSTEM ERROR]</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📍 <b>Nguồn:</b> ${escapeHtml(source)}\n`;
  message += `⏰ <b>Thời gian:</b> ${timeStr}\n`;
  message += `🌐 <b>Request:</b> <code>${escapeHtml(path)}</code>\n`;
  message += `👤 <b>Client IP:</b> <code>${escapeHtml(clientIp)}</code>\n`;
  message += `⚠️ <b>Lỗi:</b> <code>${escapeHtml(errorMessage)}</code>\n`;

  if (stack) {
    message += `📜 <b>Call Stack:</b>\n<pre>${escapeHtml(stack.slice(0, 500))}</pre>\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━`;

  return sendTelegramMessage(message, { parseMode: 'HTML', req, error });
}

/**
 * Fires a business notification (a driver posts a trip, or a passenger books a ride)
 * @param {object} params - { title, details, req }
 */
export async function sendBusinessAlert({ title, details = {}, req = null }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const isMockToken = token?.startsWith('mock_');

  // 1. Block absolutely when the request comes from the automated test suite (unless it is a mock token for unit tests)
  if (!isMockToken) {
    if (
      req?.isAutomatedTest ||
      req?.headers?.['x-carmate-testing'] === 'true' ||
      process.env.CARMATE_DISABLE_TELEGRAM === 'true' ||
      process.env.NODE_ENV === 'test'
    ) {
      return false;
    }

    // 2. In development/local environments, by default do not spam trip-creation / booking messages
    // into the Founder's Telegram unless ENABLE_DEV_TELEGRAM_ALERTS=true is deliberately enabled
    const isProduction = process.env.NODE_ENV === 'production';
    const enableDevAlerts = process.env.ENABLE_DEV_TELEGRAM_ALERTS === 'true';
    if (!isProduction && !enableDevAlerts) {
      return false;
    }

    // 3. If the request originates from localhost / 127.0.0.1 / ::1
    if (!enableDevAlerts && isLocalhostRequest(req)) {
      return false;
    }
  }

  const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  let message = `🚗 <b>[CARMATE HOẠT ĐỘNG MỚI]</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🎉 <b>${escapeHtml(title)}</b>\n`;
  message += `⏰ <b>Thời gian:</b> ${timeStr}\n`;

  for (const [key, val] of Object.entries(details)) {
    if (val !== undefined && val !== null && val !== '') {
      message += `▫️ <b>${escapeHtml(key)}:</b> ${escapeHtml(String(val))}\n`;
    }
  }
  message += `━━━━━━━━━━━━━━━━━━━━`;

  // Business notifications can be sent without a disruptive notification sound if needed
  return sendTelegramMessage(message, { parseMode: 'HTML', disableNotification: false, req });
}

// Cache to prevent consecutive spam of trip-match notifications (2 hours per person/trip pair)
const matchAlertCooldownMap = new Map();
const MATCH_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Sends a notification suggesting a travel companion with a matching route via the Telegram Bot (0 VND)
 * MIT & Anti-Spam standard: only sends when the match is strong, has a 2-hour cooldown, and never exposes PII.
 */
export async function sendSmartMatchTelegramAlert({ targetTelegramId, matchedTrip, score = 90, fuelSavings = 0, req = null }) {
  if (!targetTelegramId || !matchedTrip) return false;

  const cleanChatId = String(targetTelegramId).trim();
  const key = `${cleanChatId}_${matchedTrip.id}`;
  const now = Date.now();
  const lastSent = matchAlertCooldownMap.get(key) || 0;
  if (now - lastSent < MATCH_COOLDOWN_MS) {
    return false; // Already sent in the past 2h, block spam
  }
  matchAlertCooldownMap.set(key, now);

  // Clean up the cache if it grows too large
  if (matchAlertCooldownMap.size > 500) {
    for (const [k, time] of matchAlertCooldownMap.entries()) {
      if (now - time > MATCH_COOLDOWN_MS) {
        matchAlertCooldownMap.delete(k);
      }
    }
  }

  const isDriver = matchedTrip.type === 'driver_offer';
  const roleName = isDriver ? `Chủ xe ${matchedTrip.maskedCode || 'CX'}` : `Khách đi cùng ${matchedTrip.maskedCode || 'KX'}`;
  const routeName = matchedTrip.routeCategory || 'Hành lang di chuyển';
  const fromTo = `${matchedTrip.from || 'Điểm đón'} ➔ ${matchedTrip.to || 'Điểm đến'}`;
  const timeStr = matchedTrip.departureTime || matchedTrip.date || 'Sắp khởi hành';
  const savingsText = fuelSavings > 0 ? `\n💰 <b>Chia sẻ tiền xăng:</b> ~${fuelSavings.toLocaleString('vi-VN')} ₫` : '';

  const message =
    `🚗 <b>[CARMATE RADAR AI - KHỚP ${score}%]</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👋 Chào bạn, vừa phát hiện <b>${roleName}</b> có lộ trình khớp hoàn hảo với bạn!\n\n` +
    `📍 <b>Tuyến:</b> ${escapeHtml(routeName)}\n` +
    `🛣️ <b>Lộ trình:</b> ${escapeHtml(fromTo)}\n` +
    `⏰ <b>Thời gian:</b> ${escapeHtml(timeStr)}${savingsText}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👉 <a href="https://carmate.vn/?matchTripId=${matchedTrip.id}">Nhấp vào đây để xem và kết nối ngay</a>`;

  return sendTelegramMessage(message, {
    chatId: cleanChatId,
    parseMode: 'HTML',
    disableNotification: false,
    req
  });
}

/**
 * Sends a direct notification to the driver via the Telegram Bot when a passenger submits a trip-matching request
 */
export async function sendDirectBookingTelegramAlert({ targetTelegramId, booking, passengerName, req = null }) {
  if (!targetTelegramId || !booking) return false;

  const cleanChatId = String(targetTelegramId).trim();
  const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const text = `🚗 <b>[CARMATE] BẠN CÓ YÊU CẦU GHÉP CHUYẾN MỚI!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Người đi cùng:</b> ${escapeHtml(passengerName || 'Người đi cùng')}\n` +
    `📍 <b>Lộ trình:</b> ${escapeHtml(booking.from || '')} ➔ ${escapeHtml(booking.to || '')}\n` +
    `⏰ <b>Khởi hành:</b> ${escapeHtml(booking.date || 'Hôm nay')} ${escapeHtml(booking.time || '')}\n` +
    `👥 <b>Số ghế:</b> ${booking.seats || booking.seatsBooked || 1} người\n` +
    `📍 <b>Điểm đón đề xuất:</b> ${escapeHtml(booking.pickupPoint || 'Thỏa thuận tiện đường')}\n` +
    `💬 <b>Lời nhắn:</b> "${escapeHtml(booking.passengerNote || 'Không có ghi chú')}"\n` +
    `⏰ <b>Nhận lúc:</b> ${timeStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👉 Mở CarMate vào Hộp thư để trao đổi và bấm [Chốt chuyến 15']!\n` +
    `🔗 https://carmate.vn`;

  return sendTelegramMessage(text, {
    chatId: cleanChatId,
    parseMode: 'HTML',
    disableNotification: false,
    req
  });
}

/**
 * Instantly fires a Telegram message when a new passenger booking comes in (Concierge MVP Flow).
 * The message is sent in Vietnamese; example ("ĐẶT CHỖ MỚI" = new booking, "Khách" = passenger, "Số lượng" = quantity,
 * "Tuyến" = route, "Tình trạng xe" = vehicle status):
 * [ĐẶT CHỖ MỚI] Sáng T3 (04:30)
 * • Khách: 0912.xxx.xxx
 * • Số lượng: 1 ghế
 * • Tuyến: [Ngã ba Tân Khai] ➔ [Cụm Chợ Rẫy]
 * • Tình trạng xe: Còn 2 chỗ trống
 */
export async function sendNewBookingTelegramAlert({
  timeLabel,
  passengerPhone,
  seats = 1,
  from,
  to,
  remainingSeats = 0,
  carModel,
  fullPlate,
  req = null
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const isMockToken = token?.startsWith('mock_');
  if (!isMockToken) {
    if (
      req?.isAutomatedTest ||
      req?.headers?.['x-carmate-testing'] === 'true' ||
      process.env.CARMATE_DISABLE_TELEGRAM === 'true' ||
      process.env.NODE_ENV === 'test'
    ) {
      return false;
    }
  }

  let text = `🚗 <b>[ĐẶT CHỖ MỚI] ${escapeHtml(timeLabel || 'Hành trình')}</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `• <b>Khách:</b> <code>${escapeHtml(passengerPhone || '09xx...')}</code>\n`;
  text += `• <b>Số lượng:</b> <b>${seats} ghế</b>\n`;
  text += `• <b>Tuyến:</b> [${escapeHtml(from || 'Trạm đón')}] ➔ [${escapeHtml(to || 'Trạm trả')}]\n`;
  if (carModel || fullPlate) {
    text += `• <b>Phương tiện:</b> ${escapeHtml(carModel || 'Xe tiện chuyến')} (${escapeHtml(fullPlate || 'Biển số thật')})\n`;
  }
  text += `• <b>Tình trạng xe:</b> Còn <b>${remainingSeats} chỗ trống</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📞 <i>Bấm gọi trực tiếp cho khách sau 1–2 phút để chốt giờ đón & đồ mang theo!</i>`;

  return sendTelegramMessage(text, {
    parseMode: 'HTML',
    disableNotification: false,
    req
  });
}

/**
 * Instantly fires a notification when a passenger cancels a seat (the message is sent in Vietnamese; "HỦY ĐẶT CHỖ" = booking
 * cancelled, "Hành khách" = passenger, "Chuyến đi" = trip, "Lý do" = reason, "Trạng thái xe" = vehicle status):
 * [HỦY ĐẶT CHỖ] 1 ghế trống đã mở lại
 * • Hành khách: 098***3750
 * • Chuyến đi: 16:00 ngày 14/09
 * • Tuyến: [Tân Khai] ➔ [Chợ Rẫy]
 * • Lý do: Đổi lịch khám bệnh
 * • Trạng thái xe: Đã tự động mở lại ghế trống trên hệ thống
 */
export async function sendBookingCancelledTelegramAlert({
  targetTelegramId,
  passengerPhone,
  seats = 1,
  timeSlot = '',
  date = '',
  from = '',
  to = '',
  reason = '',
  req = null
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const isMockToken = token?.startsWith('mock_');
  if (!isMockToken) {
    if (
      req?.isAutomatedTest ||
      req?.headers?.['x-carmate-testing'] === 'true' ||
      process.env.CARMATE_DISABLE_TELEGRAM === 'true' ||
      process.env.NODE_ENV === 'test'
    ) {
      return false;
    }
  }

  const cleanDigits = String(passengerPhone || '').replace(/\D/g, '');
  const maskedPhone = cleanDigits.length >= 8
    ? `${cleanDigits.slice(0, 3)}***${cleanDigits.slice(-4)}`
    : '098***xxxx';

  const timePart = timeSlot ? ` lúc ${escapeHtml(timeSlot)}` : '';
  const datePart = date ? ` ngày ${escapeHtml(date)}` : '';

  let text = `❌ <b>[HỦY ĐẶT CHỖ] ${seats} ghế trống đã mở lại</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `• <b>Hành khách:</b> <code>${escapeHtml(maskedPhone)}</code>\n`;
  text += `• <b>Chuyến đi:</b>${timePart}${datePart}\n`;
  if (from || to) {
    text += `• <b>Lộ trình:</b> [${escapeHtml(from || 'Điểm đón')}] ➔ [${escapeHtml(to || 'Điểm đến')}]\n`;
  }
  if (reason) {
    text += `• <b>Lý do hủy:</b> <i>${escapeHtml(reason)}</i>\n`;
  }
  text += `• <b>Trạng thái:</b> Đã tự động khôi phục <b>+${seats} chỗ trống</b> lên hệ thống.\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💡 <i>Mô hình 0đ cọc – Tự động mở ghế cho người khác cùng tuyến đặt ngay!</i>`;

  if (targetTelegramId) {
    sendTelegramMessage(text, {
      chatId: targetTelegramId,
      parseMode: 'HTML',
      disableNotification: false,
      req
    }).catch((e) => console.warn('[Telegram Cancel Alert] Gửi chủ xe thất bại:', e.message));
  }

  return sendTelegramMessage(text, {
    parseMode: 'HTML',
    disableNotification: false,
    req
  });
}

/**
 * Helper for Unit Testing to clear the cache
 */
export function _resetDeduplicationCache() {
  alertCache.clear();
  matchAlertCooldownMap.clear();
}
export function _getDeduplicationCacheSize() {
  return alertCache.size;
}
