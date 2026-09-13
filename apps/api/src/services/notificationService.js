/**
 * =============================================================================
 * CARMATE NOTIFICATION SERVICE — KÊNH ĐẨY RA NGOÀI APP
 * =============================================================================
 * Bài toán liên tỉnh khác Grab ở một điểm sống còn: thời khắc quan trọng nhất
 * (đêm hôm trước và rạng sáng) là lúc khách KHÔNG mở app. Mọi thuật toán radar,
 * Shadow Fleet, T-30 đều vô nghĩa nếu không có cách đánh thức người dùng.
 *
 * Kiến trúc đa kênh, thử theo thứ tự ưu tiên, kênh nào thành công thì dừng:
 *   1. Web Push (VAPID)  — miễn phí, tức thời, cần trình duyệt đã cấp quyền
 *   2. Zalo ZNS          — phủ rộng nhất tại VN, tốn phí theo tin
 *   3. Hàng đợi in-app   — luôn thành công, khách thấy khi mở app lần sau
 *
 * Bậc 3 không bao giờ thất bại nên hàm này không bao giờ ném lỗi ra ngoài:
 * scheduler gọi nó trong vòng lặp, một cú ném sẽ giết cả nhịp quét.
 * =============================================================================
 */

import crypto from 'crypto';
import { getRawDB } from '../db/sqliteStore.js';

/** Các loại thông báo hệ thống phát ra (dùng cho lọc và chống trùng). */
export const NOTIFICATION_KINDS = Object.freeze({
  T30_APPROACH: 'T30_APPROACH',           // Xe còn ~30 phút tới trạm
  CHECKIN_REMINDER: 'CHECKIN_REMINDER',   // Nhắc lần 2 nếu chưa bấm xác nhận
  SEAT_RELEASED: 'SEAT_RELEASED',         // Chỗ bị thu hồi do không xác nhận
  SHADOW_SWAP: 'SHADOW_SWAP',             // Đã chuyển sang xe hỗ trợ
  DRIVER_CONFIRM_REQUEST: 'DRIVER_CONFIRM_REQUEST', // Nhắc chủ xe chốt lịch
  RIDER_READY: 'RIDER_READY',             // Báo chủ xe: khách đã ra trạm
  TRIP_AT_RISK: 'TRIP_AT_RISK'            // Cảnh báo nội bộ cho vận hành
});

let vapidConfigured = false;
let webpushLib = null;

/**
 * Nạp web-push một cách lười biếng (lazy). Thư viện là tuỳ chọn: nếu môi trường
 * chưa cài hoặc chưa cấu hình VAPID, hệ thống vẫn chạy và tự rơi xuống kênh sau.
 */
async function getWebPush() {
  if (webpushLib !== null) return webpushLib;

  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@carmate.vn';

  if (!publicKey || !privateKey) {
    webpushLib = false; // đánh dấu "đã thử, không dùng được"
    return false;
  }

  try {
    const mod = await import('web-push');
    const wp = mod.default || mod;
    if (!vapidConfigured) {
      wp.setVapidDetails(subject, publicKey, privateKey);
      vapidConfigured = true;
    }
    webpushLib = wp;
    return wp;
  } catch {
    console.warn('[Notify] web-push chưa được cài, bỏ qua kênh Web Push.');
    webpushLib = false;
    return false;
  }
}

/** Khởi tạo 2 bảng: đăng ký thiết bị và nhật ký thông báo. */
export function initNotificationTables() {
  const db = getRawDB();
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      phone TEXT,
      userId TEXT,
      endpoint TEXT UNIQUE,
      p256dh TEXT,
      auth TEXT,
      userAgent TEXT,
      createdAt INTEGER,
      lastSuccessAt INTEGER,
      failureCount INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_push_phone ON push_subscriptions(phone);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      phone TEXT,
      userId TEXT,
      kind TEXT NOT NULL,
      title TEXT,
      body TEXT,
      data TEXT,
      channel TEXT,
      dedupeKey TEXT,
      readAt INTEGER,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notif_phone ON notifications(phone);
    CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(createdAt);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedupe ON notifications(dedupeKey);
  `);
}

/** Chuẩn hoá số điện thoại về dạng chỉ chứa chữ số để tra cứu nhất quán. */
function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * Lưu đăng ký nhận Web Push của một thiết bị.
 * Một người có thể có nhiều thiết bị; endpoint là khoá duy nhất.
 */
export function savePushSubscription({ phone, userId = null, subscription, userAgent = '' }) {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return { success: false, error: 'Thiếu thông tin đăng ký đẩy (endpoint/keys)' };
  }

  const db = getRawDB();
  db.prepare(
    `INSERT INTO push_subscriptions (id, phone, userId, endpoint, p256dh, auth, userAgent, createdAt, lastSuccessAt, failureCount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)
     ON CONFLICT(endpoint) DO UPDATE SET
       phone = excluded.phone,
       userId = excluded.userId,
       -- Trình duyệt có thể xoay khoá mã hoá trên cùng một endpoint. Không cập
       -- nhật thì mọi thông báo sau đó gửi đi đều không giải mã được, và đăng ký
       -- lại cũng không cứu được vì bản ghi cũ vẫn giữ khoá cũ.
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       failureCount = 0`
  ).run(
    `PUSH-${crypto.randomUUID()}`,
    normalizePhone(phone),
    userId,
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    userAgent.slice(0, 300),
    Date.now()
  );

  return { success: true };
}

/** Gỡ đăng ký khi người dùng tắt thông báo hoặc endpoint đã chết. */
export function removePushSubscription(endpoint) {
  const db = getRawDB();
  const info = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  return { success: true, removed: info.changes };
}

function getSubscriptionsForPhone(phone) {
  const db = getRawDB();
  return db
    .prepare('SELECT * FROM push_subscriptions WHERE phone = ? AND failureCount < 5')
    .all(normalizePhone(phone));
}

/** Bậc 1: Web Push. Trả về số thiết bị nhận thành công. */
async function trySendWebPush(phone, payload) {
  const wp = await getWebPush();
  if (!wp) return 0;

  const subs = getSubscriptionsForPhone(phone);
  if (subs.length === 0) return 0;

  const db = getRawDB();
  let delivered = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        db.prepare('UPDATE push_subscriptions SET lastSuccessAt = ?, failureCount = 0 WHERE endpoint = ?')
          .run(Date.now(), sub.endpoint);
        delivered += 1;
      } catch (err) {
        // 404/410 = endpoint đã chết hẳn, xoá ngay để khỏi thử lại mãi
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
        } else {
          db.prepare('UPDATE push_subscriptions SET failureCount = failureCount + 1 WHERE endpoint = ?')
            .run(sub.endpoint);
        }
      }
    })
  );

  return delivered;
}

/**
 * Bậc 2: Zalo ZNS. Chỉ hoạt động khi đã có access token và template id.
 * Giữ nguyên chữ ký hàm để khi doanh nghiệp duyệt ZNS chỉ cần đổ biến môi trường.
 */
async function trySendZaloZns(phone, payload) {
  const accessToken = process.env.ZALO_ZNS_ACCESS_TOKEN || '';
  const templateId = process.env.ZALO_ZNS_TEMPLATE_ID || '';
  if (!accessToken || !templateId) return 0;

  const cleanPhone = normalizePhone(phone).replace(/^0/, '84');

  try {
    const res = await fetch('https://business.openapi.zalo.me/message/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', access_token: accessToken },
      body: JSON.stringify({
        phone: cleanPhone,
        template_id: templateId,
        template_data: {
          title: payload.title?.slice(0, 100) || 'CarMate',
          content: payload.body?.slice(0, 200) || '',
          time: payload.data?.timeLabel || ''
        }
      })
    });
    const json = await res.json().catch(() => ({}));
    return json?.error === 0 ? 1 : 0;
  } catch {
    return 0;
  }
}

/**
 * GỬI THÔNG BÁO — điểm vào duy nhất cho toàn hệ thống.
 *
 * `dedupeKey` chống bắn trùng: scheduler quét mỗi 60 giây, nếu không có khoá này
 * thì một chuyến sắp tới trạm sẽ bị bắn T-30 hàng chục lần liên tiếp. Khoá được
 * đặt UNIQUE ở tầng database nên kể cả hai tiến trình chạy song song cũng chỉ
 * một bản ghi lọt qua.
 *
 * @returns {Promise<{success: boolean, channel: string, deduped?: boolean}>}
 */
export async function sendNotification({
  phone,
  userId = null,
  kind,
  title,
  body,
  data = {},
  dedupeKey = null
}) {
  const db = getRawDB();
  const cleanPhone = normalizePhone(phone);
  const id = `NOTIF-${crypto.randomUUID()}`;
  const now = Date.now();

  // Chống trùng: thử ghi nhật ký TRƯỚC khi gửi. Nếu khoá đã tồn tại thì
  // thông báo này đã được bắn rồi, dừng ngay không gửi lại.
  const key = dedupeKey || `${kind}:${cleanPhone}:${now}`;
  try {
    db.prepare(
      `INSERT INTO notifications (id, phone, userId, kind, title, body, data, channel, dedupeKey, readAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?)`
    ).run(id, cleanPhone, userId, kind, title, body, JSON.stringify(data), key, now);
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return { success: true, channel: 'deduped', deduped: true };
    }
    throw err;
  }

  const payload = { title, body, kind, data, notificationId: id };

  // Bậc 1 -> Bậc 2 -> Bậc 3 (in-app, đã ghi ở trên nên luôn thành công)
  let channel = 'inapp';
  try {
    if ((await trySendWebPush(cleanPhone, payload)) > 0) {
      channel = 'webpush';
    } else if ((await trySendZaloZns(cleanPhone, payload)) > 0) {
      channel = 'zns';
    }
  } catch (err) {
    console.warn('[Notify] Lỗi kênh đẩy, rơi về in-app:', err.message);
  }

  db.prepare('UPDATE notifications SET channel = ? WHERE id = ?').run(channel, id);
  return { success: true, channel, notificationId: id };
}

export const dispatchNotification = sendNotification;

/** Đọc hộp thư in-app của một người dùng. */
export function getNotifications({ phone, limit = 30, unreadOnly = false } = {}) {
  const db = getRawDB();
  const cleanPhone = normalizePhone(phone);
  const sql = unreadOnly
    ? 'SELECT * FROM notifications WHERE phone = ? AND readAt IS NULL ORDER BY createdAt DESC LIMIT ?'
    : 'SELECT * FROM notifications WHERE phone = ? ORDER BY createdAt DESC LIMIT ?';

  return db
    .prepare(sql)
    .all(cleanPhone, Math.min(100, Number(limit) || 30))
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      data: (() => {
        try {
          return JSON.parse(r.data || '{}');
        } catch {
          return {};
        }
      })(),
      channel: r.channel,
      isRead: r.readAt != null,
      createdAt: r.createdAt
    }));
}

/**
 * Đánh dấu đã đọc (một thông báo hoặc toàn bộ của một số điện thoại).
 *
 * Mọi câu lệnh đều ràng buộc theo `phone`, kể cả khi đã có `notificationId`:
 * mã thông báo là chuỗi đoán được, thiếu ràng buộc này thì người lạ có thể đánh
 * dấu đã đọc thư của người khác và khiến họ bỏ lỡ báo xe tới.
 */
export function markNotificationsRead({ phone, notificationId = null }) {
  const db = getRawDB();
  const now = Date.now();
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) return { success: false, error: 'Thiếu số điện thoại đã xác thực' };

  const info = notificationId
    ? db
        .prepare('UPDATE notifications SET readAt = ? WHERE id = ? AND phone = ? AND readAt IS NULL')
        .run(now, notificationId, cleanPhone)
    : db
        .prepare('UPDATE notifications SET readAt = ? WHERE phone = ? AND readAt IS NULL')
        .run(now, cleanPhone);

  return { success: true, updated: info.changes };
}

/** Khoá công khai VAPID cho trình duyệt đăng ký (không phải bí mật). */
export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/** Dọn nhật ký thông báo cũ hơn N ngày, tránh phình database. */
export function pruneOldNotifications(days = 30) {
  const db = getRawDB();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const info = db.prepare('DELETE FROM notifications WHERE createdAt < ?').run(cutoff);
  return info.changes;
}
