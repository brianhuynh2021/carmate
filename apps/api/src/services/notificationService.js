/**
 * =============================================================================
 * CARMATE NOTIFICATION SERVICE — OUT-OF-APP PUSH CHANNELS
 * =============================================================================
 * The intercity problem differs from Grab in one vital way: the most important moments
 * (the night before and the early morning) are exactly when the passenger is NOT opening the app.
 * Every radar algorithm, Shadow Fleet, T-30 is meaningless without a way to wake up the user.
 *
 * Multi-channel architecture, tried in priority order; stop at the first channel that succeeds:
 *   1. Web Push (VAPID)  — free, instant, needs a browser that has granted permission
 *   2. Zalo ZNS          — widest reach in VN, charged per message
 *   3. In-app queue      — always succeeds, the passenger sees it the next time they open the app
 *
 * Tier 3 never fails so this function never throws errors outward:
 * the scheduler calls it inside a loop, and a single throw would kill the whole sweep tick.
 * =============================================================================
 */

import crypto from 'crypto';
import { getRawDB } from '../db/sqliteStore.js';

/** Kinds of notifications the system emits (used for filtering and deduplication). */
export const NOTIFICATION_KINDS = Object.freeze({
  T30_APPROACH: 'T30_APPROACH',           // Vehicle is ~30 minutes from the station
  CHECKIN_REMINDER: 'CHECKIN_REMINDER',   // Second reminder if the confirm button has not been tapped
  SEAT_RELEASED: 'SEAT_RELEASED',         // Seat revoked due to no confirmation
  SHADOW_SWAP: 'SHADOW_SWAP',             // Switched to a backup vehicle
  DRIVER_CONFIRM_REQUEST: 'DRIVER_CONFIRM_REQUEST', // Nudge the driver to lock in the schedule
  RIDER_READY: 'RIDER_READY',             // Tell the driver: the passenger is at the station
  TRIP_AT_RISK: 'TRIP_AT_RISK'            // Internal alert for operations
});

let vapidConfigured = false;
let webpushLib = null;

/**
 * Loads web-push lazily. The library is optional: if the environment has not installed it
 * or VAPID is not configured, the system keeps running and falls through to the next channel.
 */
async function getWebPush() {
  if (webpushLib !== null) return webpushLib;

  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@carmate.vn';

  if (!publicKey || !privateKey) {
    webpushLib = false; // mark as "tried, not usable"
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

/** Initializes 2 tables: device subscriptions and the notification log. */
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

/** Normalizes the phone number to digits only so lookups are consistent. */
function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * Saves a device's Web Push subscription.
 * One person may have several devices; endpoint is the unique key.
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

/** Removes a subscription when the user turns off notifications or the endpoint is dead. */
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

/** Tier 1: Web Push. Returns the number of devices that received it successfully. */
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
        // 404/410 = endpoint is permanently dead, delete it right away to avoid retrying forever
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
 * Tier 2: Zalo ZNS. Only works when an access token and template id are present.
 * Keeps the function signature unchanged so that once the business gets ZNS approved, only environment variables need to be filled in.
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
 * SEND A NOTIFICATION — the single entry point for the whole system.
 *
 * `dedupeKey` prevents duplicate firing: the scheduler sweeps every 60 seconds, and without this key
 * a trip approaching the station would get T-30 fired dozens of times in a row. The key is declared
 * UNIQUE at the database layer so even if two processes run in parallel only one record gets through.
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

  // Deduplication: try writing the log BEFORE sending. If the key already exists then
  // this notification has already been fired; stop immediately and do not send again.
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

  // Tier 1 -> Tier 2 -> Tier 3 (in-app, already written above so it always succeeds)
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

/** Reads a user's in-app inbox. */
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
 * Marks as read (one notification or all of a phone number's).
 *
 * Every statement is constrained by `phone`, even when a `notificationId` is present:
 * notification IDs are guessable strings, and without this constraint a stranger could mark
 * someone else's mail as read and make them miss the vehicle-arrival alert.
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

/** The public VAPID key for browser subscription (not a secret). */
export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/** Prunes notification logs older than N days to keep the database from bloating. */
export function pruneOldNotifications(days = 30) {
  const db = getRawDB();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const info = db.prepare('DELETE FROM notifications WHERE createdAt < ?').run(cutoff);
  return info.changes;
}
