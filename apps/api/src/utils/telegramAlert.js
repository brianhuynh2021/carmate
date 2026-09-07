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
 * Gửi tin nhắn thô tới Telegram Bot
 * @param {string} text - Nội dung tin nhắn
 * @param {object} options - Tuỳ chọn { parseMode: 'HTML', disableNotification: false }
 * @returns {Promise<boolean>}
 */
export async function sendTelegramMessage(text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_LOG_CHAT_ID;

  if (!token || !chatId) {
    return false;
  }

  // 1. Tuyệt đối KHÔNG gửi tin nhắn ra Telegram thật khi đang chạy bộ kiểm thử tự động
  if (
    options.isTest ||
    options.req?.isAutomatedTest ||
    options.req?.headers?.['x-carmate-testing'] === 'true' ||
    process.env.CARMATE_DISABLE_TELEGRAM === 'true' ||
    process.env.NODE_ENV === 'test'
  ) {
    return false;
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

  return sendTelegramMessage(message, { parseMode: 'HTML', req });
}

/**
 * Bắn thông báo nghiệp vụ kinh doanh (Có Chủ xe tạo chuyến, hoặc có Khách đặt xe)
 * @param {object} params - { title, details, req }
 */
export async function sendBusinessAlert({ title, details = {}, req = null }) {
  // 1. Chặn tuyệt đối khi là request từ bộ test tự động
  if (
    req?.isAutomatedTest ||
    req?.headers?.['x-carmate-testing'] === 'true' ||
    process.env.CARMATE_DISABLE_TELEGRAM === 'true' ||
    process.env.NODE_ENV === 'test'
  ) {
    return false;
  }

  // 2. Ở môi trường phát triển (development/local), mặc định không spam tin nhắn tạo chuyến / đặt chỗ
  // vào Telegram của Founder trừ khi chủ động bật ENABLE_DEV_TELEGRAM_ALERTS=true hoặc dùng mock token test
  const isProduction = process.env.NODE_ENV === 'production';
  const enableDevAlerts = process.env.ENABLE_DEV_TELEGRAM_ALERTS === 'true';
  const isMockToken = process.env.TELEGRAM_BOT_TOKEN?.startsWith('mock_');
  if (!isProduction && !enableDevAlerts && !isMockToken) {
    return false;
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

/**
 * Hàm hỗ trợ Unit Testing dọn dẹp cache
 */
export function _resetDeduplicationCache() {
  alertCache.clear();
}
export function _getDeduplicationCacheSize() {
  return alertCache.size;
}
