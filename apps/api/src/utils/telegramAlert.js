/**
 * CarMate Telegram Bot Alerting Engine (0đ Miễn phí & Độc lập)
 * Tự động bắn cảnh báo lỗi hệ thống và thông báo cuốc xe mới về điện thoại của Founder.
 */

// Bộ nhớ đệm chống spam tin nhắn liên tiếp (Deduplication Cache)
const alertCache = new Map();
const DEDUP_TTL_MS = 60 * 1000; // 60 giây

function escapeHtml(text = '') {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Kiểm tra xem request hoặc lỗi có xuất phát từ môi trường phát triển cục bộ (localhost/dev) hay không
 * @param {object} req - Express Request object
 * @param {Error|object} error - Error object
 * @returns {boolean}
 */
export function isLocalhostRequest(req = null, error = null) {
  if (!req && !error) return false;

  // 1. Kiểm tra IP của máy khách (Client IP)
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

  // 2. Kiểm tra Host, Origin, Referer header
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

  // 3. Kiểm tra Error stack trace (ví dụ lỗi client crash từ http://localhost:5173/src/...)
  const stack = error?.stack || (typeof error === 'string' ? error : '');
  if (stack && (stack.includes('localhost:') || stack.includes('127.0.0.1:'))) {
    return true;
  }

  return false;
}

/**
 * Gửi tin nhắn thô tới Telegram Bot
 * @param {string} text - Nội dung tin nhắn
 * @param {object} options - Tuỳ chọn { parseMode: 'HTML', disableNotification: false, req, error }
 * @returns {Promise<boolean>}
 */
export async function sendTelegramMessage(text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || process.env.TELEGRAM_LOG_CHAT_ID;

  if (!token || !chatId) {
    return false;
  }

  const isMockToken = token.startsWith('mock_');

  // 1. Tuyệt đối KHÔNG gửi tin nhắn ra Telegram thật khi đang chạy bộ kiểm thử tự động,
  // hoặc khi đang phát triển / debug ở môi trường local / localhost.
  // Chỉ bắn cảnh báo Telegram khi ở môi trường Production thật sự,
  // hoặc khi chủ động bật ENABLE_DEV_TELEGRAM_ALERTS=true để lập trình viên test bot.
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

    // Nếu không phải production và không bật ENABLE_DEV_TELEGRAM_ALERTS
    if (!isProduction && !enableDevAlerts) {
      return false;
    }

    // Nếu request xuất phát từ localhost / 127.0.0.1 / ::1
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
      signal: AbortSignal.timeout(6000) // Timeout 6s để không treo luồng
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`[Telegram Alert] Gửi tin nhắn thất bại (${response.status}):`, errText);
      return false;
    }

    return true;
  } catch (err) {
    // Không bao giờ để lỗi Telegram làm sập server
    console.warn('[Telegram Alert] Lỗi kết nối mạng:', err.message);
    return false;
  }
}

/**
 * Bắn cảnh báo sự cố kỹ thuật (Crash / Error 500)
 * @param {object} params - { error, req, source }
 */
export async function sendSystemErrorAlert({ error, req = null, source = 'API Server' }) {
  const errorMessage = error?.message || String(error || 'Lỗi không xác định');
  const path = req ? `${req.method || 'GET'} ${req.originalUrl || req.url || '/'}` : 'Hệ thống';

  // Chống spam trong môi trường dev / localhost: Tuyệt đối không gửi Telegram khi ở localhost hoặc dev
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

  // Chống spam: Nếu cùng 1 lỗi trên cùng 1 path xảy ra liên tục trong 60s, bỏ qua
  const dedupKey = `${source}:${path}:${errorMessage}`;
  const now = Date.now();
  const lastSent = alertCache.get(dedupKey);

  if (lastSent && now - lastSent < DEDUP_TTL_MS) {
    return false; // Đã gửi trong 60s trước, bỏ qua
  }
  alertCache.set(dedupKey, now);

  // Dọn dẹp cache cũ định kỳ nếu lớn hơn 200 bản ghi
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
 * Bắn thông báo nghiệp vụ kinh doanh (Có Chủ xe tạo chuyến, hoặc có Khách đặt xe)
 * @param {object} params - { title, details, req }
 */
export async function sendBusinessAlert({ title, details = {}, req = null }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const isMockToken = token?.startsWith('mock_');

  // 1. Chặn tuyệt đối khi là request từ bộ test tự động (trừ khi là mock token cho unit test)
  if (!isMockToken) {
    if (
      req?.isAutomatedTest ||
      req?.headers?.['x-carmate-testing'] === 'true' ||
      process.env.CARMATE_DISABLE_TELEGRAM === 'true' ||
      process.env.NODE_ENV === 'test'
    ) {
      return false;
    }

    // 2. Ở môi trường phát triển (development/local), mặc định không spam tin nhắn tạo chuyến / đặt chỗ
    // vào Telegram của Founder trừ khi chủ động bật ENABLE_DEV_TELEGRAM_ALERTS=true
    const isProduction = process.env.NODE_ENV === 'production';
    const enableDevAlerts = process.env.ENABLE_DEV_TELEGRAM_ALERTS === 'true';
    if (!isProduction && !enableDevAlerts) {
      return false;
    }

    // 3. Nếu request xuất phát từ localhost / 127.0.0.1 / ::1
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

  // Thông báo nghiệp vụ có thể gửi chế độ không rung chuông phiền nếu cần
  return sendTelegramMessage(message, { parseMode: 'HTML', disableNotification: false, req });
}

// Bộ đệm chống spam thông báo khớp chuyến liên tiếp (2 giờ cho mỗi cặp người/chuyến)
const matchAlertCooldownMap = new Map();
const MATCH_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 tiếng

/**
 * Gửi thông báo gợi ý bạn đồng hành khớp lộ trình qua Telegram Bot (0đ)
 * Chuẩn MIT & Anti-Spam: Chỉ gửi khi độ khớp cao, có cooldown 2 tiếng, không để lộ PII.
 */
export async function sendSmartMatchTelegramAlert({ targetTelegramId, matchedTrip, score = 90, fuelSavings = 0, req = null }) {
  if (!targetTelegramId || !matchedTrip) return false;

  const cleanChatId = String(targetTelegramId).trim();
  const key = `${cleanChatId}_${matchedTrip.id}`;
  const now = Date.now();
  const lastSent = matchAlertCooldownMap.get(key) || 0;
  if (now - lastSent < MATCH_COOLDOWN_MS) {
    return false; // Đã gửi trong 2h qua, chặn spam
  }
  matchAlertCooldownMap.set(key, now);

  // Dọn dẹp cache nếu quá lớn
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
 * Gửi thông báo trực tiếp cho Chủ xe qua Telegram Bot khi có Người đi cùng gửi yêu cầu ghép chuyến
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
 * Bắn tin nhắn tức thì về Telegram khi có khách đặt chỗ mới (Concierge MVP Flow):
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
 * Hàm hỗ trợ Unit Testing dọn dẹp cache
 */
export function _resetDeduplicationCache() {
  alertCache.clear();
  matchAlertCooldownMap.clear();
}
export function _getDeduplicationCacheSize() {
  return alertCache.size;
}
