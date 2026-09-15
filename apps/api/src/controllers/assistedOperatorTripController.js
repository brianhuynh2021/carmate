import crypto from 'node:crypto';
import { cleanPhoneNumber } from '@carmate/shared';
import { getRawDB, getUserById, getTripById, getTrips } from '../db/sqliteStore.js';
import { getOperatorRecord, assertOperatorManager } from '../services/operatorProfiles.js';
import { createTrip } from './tripController.js';

// A private audit record is separate from public trip payloads and contact cards.
export async function createAssistedOperatorTrip(req, res) {
  let auditId;
  let db;
  try {
    if (!req.admin) return res.status(403).json({ success: false, error: 'Cần quyền quản trị.' });
    const profile = getOperatorRecord(req.params.id);
    const owner = profile?.ownerUserId ? getUserById(profile.ownerUserId) : null;
    if (!owner || owner.id !== profile.ownerUserId || profile.status !== 'published') {
      return res.status(409).json({ success: false, error: 'Nhà xe cần nhận quyền quản lý trước khi nhập hộ chuyến. Hồ sơ tham khảo không tạo tài khoản hoặc chuyến tự động.' });
    }
    assertOperatorManager(profile.id, owner);
    const auth = req.body?.authorization || {};
    const approvedAt = Date.parse(auth.approvedAt);
    const note = String(auth.evidenceNote || '').trim();
    const now = Date.now();
    if (auth.approved !== true || !['phone', 'zalo', 'email', 'in_person'].includes(auth.channel)
      || !Number.isFinite(approvedAt) || approvedAt > now + 60000 || approvedAt < now - 7 * 86400000
      || note.length < 10 || note.length > 2000
      || cleanPhoneNumber(auth.knownContactPhone) !== cleanPhoneNumber(profile.contactPhone)) {
      return res.status(400).json({ success: false, error: 'Ghi nhận sự đồng ý cho chính chuyến này qua số liên hệ đã duyệt, kênh xác nhận, thời điểm trong 7 ngày qua và nội dung đối chiếu (10–2.000 ký tự).' });
    }
    const tripInput = req.body?.trip;
    if (!tripInput || typeof tripInput !== 'object' || Array.isArray(tripInput) || tripInput.publicContactConsent !== true) {
      return res.status(400).json({ success: false, error: 'Cần đầy đủ chuyến cụ thể và đồng ý công khai số liên hệ trên tin.' });
    }
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ operatorId: profile.id, ownerId: owner.id, tripInput, auth })).digest('hex');
    auditId = String(req.body.requestId || '');
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(auditId)) return res.status(400).json({ success: false, error: 'Mã thao tác không hợp lệ.' });
    db = getRawDB();
    db.exec(`CREATE TABLE IF NOT EXISTS operator_trip_authorizations (
      id TEXT PRIMARY KEY, operatorId TEXT NOT NULL, ownerId TEXT NOT NULL,
      adminId TEXT NOT NULL, fingerprint TEXT NOT NULL, authorization TEXT NOT NULL,
      createdAt TEXT NOT NULL, tripId TEXT, status TEXT NOT NULL, startedAt INTEGER
    )`);
    if (!db.pragma('table_info(operator_trip_authorizations)').some(column => column.name === 'startedAt')) {
      db.exec('ALTER TABLE operator_trip_authorizations ADD COLUMN startedAt INTEGER');
    }
    const previous = db.prepare('SELECT * FROM operator_trip_authorizations WHERE id = ?').get(auditId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) return res.status(409).json({ success: false, error: 'Mã thao tác đã dùng cho nội dung khác.' });
      // Recover an interrupted response without publishing the same trip twice.
      const existing = (previous.tripId && getTripById(previous.tripId)) || getTrips({ type: 'drivers', includeHidden: true, includeExpired: true }).find(t => t.assistedEntryId === auditId);
      if (existing) return res.json({ success: true, data: existing, repeated: true });
      if (previous.status === 'pending' && now - (previous.startedAt || Date.parse(previous.createdAt)) < 60000) {
        return res.status(409).json({ success: false, error: 'Thao tác đang được xử lý. Kiểm tra danh sách chuyến; có thể thử lại sau một phút nếu chưa xuất hiện.' });
      }
      // An old pending attempt without a persisted trip can safely resume after restart.
      db.prepare("UPDATE operator_trip_authorizations SET status = 'pending', startedAt = ? WHERE id = ?").run(now, auditId);
    } else {
      db.prepare('INSERT INTO operator_trip_authorizations (id,operatorId,ownerId,adminId,fingerprint,authorization,createdAt,status,startedAt) VALUES (?,?,?,?,?,?,?,?,?)').run(
        auditId, profile.id, owner.id, String(req.admin.id || req.admin.userId || req.admin.sessionId || req.admin.phone || req.admin.role), fingerprint,
        JSON.stringify({ approvedAt: new Date(approvedAt).toISOString(), channel: auth.channel, knownContactPhone: profile.contactPhone, evidenceNote: note, approved: true }),
        new Date().toISOString(), 'pending', now
      );
    }
    let status = 200;
    let result;
    await createTrip({ user: owner, operatorAssistedEntryId: auditId, body: { ...tripInput, type: 'driver_offer', operatorId: profile.id } }, {
      status(code) { status = code; return this; },
      json(value) { result = value; return this; }
    });
    db.prepare('UPDATE operator_trip_authorizations SET status = ?, tripId = ? WHERE id = ?').run(result?.success ? 'published' : 'failed', result?.data?.id || null, auditId);
    return res.status(status).json(result || { success: false, error: 'Chưa nhận được kết quả đăng chuyến.' });
  } catch (error) {
    if (db && auditId) db.prepare("UPDATE operator_trip_authorizations SET status = 'failed' WHERE id = ? AND status = 'pending'").run(auditId);
    return res.status(error.status || 400).json({ success: false, error: error.message });
  }
}
