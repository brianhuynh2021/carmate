import crypto from 'node:crypto';
import { getRawDB, getTransitDirectory } from '../db/sqliteStore.js';

export class OperatorProfileError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new OperatorProfileError(message, status); };
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const kinds = ['business', 'individual'];
const states = ['draft', 'published', 'hidden'];
const sourceKinds = ['website', 'facebook', 'owner_contact', 'legacy_directory', 'other'];
const bases = ['official_business_source', 'owner_consent'];
const contentFields = ['coverage', 'scheduleNote', 'pricingMode', 'priceNote', 'pickupNote'];
const profileFields = ['name', 'kind', 'contactPhone', 'corridor', ...contentFields, 'source', 'checkedAt', 'freshUntil', 'status', 'contactPublicationBasis', 'authorizationNote'];
const sensitiveFields = ['name', 'kind', 'contactPhone', 'source', 'contactPublicationBasis'];
let initializedDb = null;

function text(value, field, max, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string') fail(`${field} phải là văn bản.`);
  const result = value.trim();
  if (result.length > max || (required && !result)) fail(`${field} ${required ? 'không được trống và ' : ''}không quá ${max} ký tự.`);
  return result;
}
function enumValue(value, allowed, field) {
  if (!allowed.includes(value)) fail(`${field} không hợp lệ.`);
  return value;
}
function phone(value, optional = false) {
  if (optional && (value == null || value === '')) return '';
  const raw = text(value, 'Số liên hệ', 40, true);
  if (!/^\+?[\d\s().-]+$/.test(raw)) fail('Số liên hệ không hợp lệ.');
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) fail('Số liên hệ phải có 8–15 chữ số.');
  return digits.startsWith('84') && digits.length === 11 ? `0${digits.slice(2)}` : digits;
}
function dateValue(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) fail(`${field} cần ngày giờ có múi giờ.`);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) fail(`${field} cần có múi giờ.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail(`${field} không hợp lệ.`);
  return new Date(ms).toISOString();
}
function normalizeSource(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Cần thông tin nguồn.');
  const source = { kind: enumValue(value.kind, sourceKinds, 'Loại nguồn'), url: text(value.url, 'Đường dẫn nguồn', 1500), label: text(value.label, 'Tên nguồn', 200) };
  if (source.url) {
    let url;
    try { url = new URL(source.url); } catch { fail('Đường dẫn nguồn không hợp lệ.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('Nguồn phải là liên kết HTTP(S), không chứa thông tin đăng nhập.');
    source.url = url.href;
  }
  return source;
}
function normalizePatch(input, allowed = profileFields) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Dữ liệu hồ sơ không hợp lệ.');
  for (const key of Object.keys(input)) if (!allowed.includes(key)) fail(`Không được cập nhật trường ${key}.`);
  const patch = {};
  for (const key of allowed) if (own(input, key)) {
    if (key === 'name') patch[key] = text(input[key], 'Tên', 160, true);
    else if (key === 'kind') patch[key] = enumValue(input[key], kinds, 'Loại chủ xe');
    else if (key === 'contactPhone') patch[key] = phone(input[key], true);
    else if (key === 'status') patch[key] = enumValue(input[key], states, 'Trạng thái hồ sơ');
    else if (key === 'pricingMode') patch[key] = enumValue(input[key], ['listed', 'contact'], 'Cách ghi giá');
    else if (key === 'contactPublicationBasis') patch[key] = input[key] == null || input[key] === '' ? null : enumValue(input[key], bases, 'Căn cứ công khai liên hệ');
    else if (key === 'source') patch[key] = normalizeSource(input[key]);
    else if (['checkedAt', 'freshUntil'].includes(key)) patch[key] = dateValue(input[key], key);
    else if (key === 'coverage') {
      if (!Array.isArray(input[key]) || input[key].length > 30) fail('Khu vực phục vụ phải là danh sách, tối đa 30 mục.');
      patch[key] = [...new Set(input[key].map(item => text(item, 'Khu vực', 200, true)))];
    } else patch[key] = text(input[key], key, key === 'authorizationNote' ? 3000 : key === 'corridor' ? 160 : 1500);
  }
  return patch;
}
function nowIso(now) { return new Date(now).toISOString(); }
function saveProfile(database, record) {
  database.prepare('INSERT INTO operator_profiles (id,status,ownerUserId,payload) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,ownerUserId=excluded.ownerUserId,payload=excluded.payload')
    .run(record.id, record.status, record.ownerUserId || null, JSON.stringify(record));
}
function readRecord(table, id, database = ensureStore()) {
  if (typeof id !== 'string' || !id || id.length > 160) return null;
  const row = database.prepare(`SELECT payload FROM ${table} WHERE id=?`).get(id);
  return row ? JSON.parse(row.payload) : null;
}
function requireProfile(id, database = ensureStore()) {
  return readRecord('operator_profiles', id, database) || fail('Không tìm thấy hồ sơ.', 404);
}
function ensureStore() {
  const database = getRawDB();
  if (initializedDb === database) return database;
  database.exec(`
    CREATE TABLE IF NOT EXISTS operator_profiles (id TEXT PRIMARY KEY,status TEXT NOT NULL,ownerUserId TEXT,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS operator_claims (id TEXT PRIMARY KEY,operatorId TEXT NOT NULL,claimantUserId TEXT NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_pending_claim ON operator_claims(operatorId,claimantUserId) WHERE status='pending';
    CREATE TABLE IF NOT EXISTS operator_reports (id TEXT PRIMARY KEY,operatorId TEXT NOT NULL,status TEXT NOT NULL,accessTokenHash TEXT NOT NULL,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS operator_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL);
  `);
  database.transaction(() => {
    if (database.prepare("SELECT value FROM operator_meta WHERE key='legacy_import_v1'").get()) return;
    for (const [index, old] of getTransitDirectory().entries()) {
      const legacyId = String(old.id || index);
      const id = `operator-legacy-${crypto.createHash('sha256').update(legacyId).digest('hex').slice(0, 20)}`;
      const record = {
        id, name: String(old.shortName || old.operator || old.name || 'Hồ sơ cần rà soát').slice(0, 160), kind: 'business',
        contactPhone: String(old.hotline || old.contactPhone || '').replace(/\D/g, '').slice(0, 15),
        corridor: String(old.corridor || '').slice(0, 160), coverage: Array.isArray(old.coverage) ? old.coverage.map(String).slice(0, 30) : old.coverage ? [String(old.coverage).slice(0, 200)] : [],
        scheduleNote: String(old.frequency || '').slice(0, 1500), pricingMode: old.priceRef ? 'listed' : 'contact', priceNote: String(old.priceRef || '').slice(0, 1500), pickupNote: String(old.note || '').slice(0, 1500),
        source: { kind: 'legacy_directory', url: '', label: 'Danh bạ nội bộ cũ — cần kiểm tra nguồn' },
        checkedAt: null, freshUntil: null, status: 'draft', contactPublicationBasis: null, authorizationNote: '', ownerUserId: null,
        publicationReview: null, contentUpdatedByOwner: false,
        importedFrom: { kind: 'transit_directory', legacyId, legacyVerificationNotAccepted: true },
        createdAt: nowIso(Date.now()), updatedAt: nowIso(Date.now()), history: []
      };
      saveProfile(database, record);
    }
    database.prepare("INSERT INTO operator_meta (key,value) VALUES ('legacy_import_v1',?)").run(nowIso(Date.now()));
  })();
  initializedDb = database;
  return database;
}
function exactUser(user, database = ensureStore()) {
  if (!user?.id || typeof user.id !== 'string') fail('Vui lòng đăng nhập.', 401);
  // Do not use getUserById: its legacy phone alias must not establish authority.
  const row = database.prepare('SELECT id,isBanned,payload FROM users WHERE id=?').get(user.id);
  if (!row || row.id !== user.id) fail('Tài khoản không còn hợp lệ.', 401);
  const stored = JSON.parse(row.payload || '{}');
  if (row.isBanned || stored.isBanned) fail('Tài khoản không được thực hiện thao tác này.', 403);
  return { ...stored, id: row.id };
}
function adminActor(admin) {
  if (!admin || !['admin', 'super_admin'].includes(admin.role)) fail('Cần quyền quản trị.', 403);
  return String(admin.id || admin.userId || admin.sessionId || admin.role).slice(0, 160);
}
function publicHistory(history = []) { return history.map(({ status, at, note }) => ({ status, at, note })); }
function freshness(record, now) {
  if (!record.checkedAt || !record.freshUntil) return 'unreviewed';
  return Date.parse(record.freshUntil) > now ? 'fresh' : 'stale';
}
export function projectPublicOperator(record, { now = Date.now() } = {}) {
  const fresh = freshness(record, now);
  return {
    id: record.id, name: record.name, kind: record.kind, contactPhone: record.contactPhone,
    corridor: record.corridor || '', coverage: record.coverage, scheduleNote: record.scheduleNote,
    pricingMode: record.pricingMode, priceNote: record.priceNote, pickupNote: record.pickupNote,
    source: record.source, checkedAt: record.checkedAt, freshUntil: record.freshUntil,
    status: record.status, freshness: fresh, priceStale: record.pricingMode === 'listed' && fresh !== 'fresh',
    managementStatus: record.ownerUserId ? 'claimed' : 'unclaimed', updatedAt: record.updatedAt,
    contentUpdatedByOwner: Boolean(record.contentUpdatedByOwner), bookingConfirmed: false, liveSeats: null
  };
}
function projectClaim(claim) {
  return { id: claim.id, operatorId: claim.operatorId, operatorName: claim.operatorName, status: claim.status,
    message: claim.message, createdAt: claim.createdAt, updatedAt: claim.updatedAt,
    resolutionNote: claim.resolutionNote || '', history: publicHistory(claim.history) };
}
function projectReport(report) {
  return { id: report.id, operatorId: report.operatorId, type: report.type, status: report.status,
    createdAt: report.createdAt, updatedAt: report.updatedAt, resolutionNote: report.resolutionNote || '', history: publicHistory(report.history) };
}
function allRecords(table, database = ensureStore()) {
  return database.prepare(`SELECT payload FROM ${table}`).all().map(row => JSON.parse(row.payload));
}
const searchable = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
function listLimit(value) { return Math.max(1, Math.min(200, Math.floor(Number(value) || 200))); }
function reviewList(records, query, unresolved) {
  const offset = Math.max(0, Math.floor(Number(query.offset) || 0));
  return records.filter(record => !query.status || record.status === query.status)
    .sort((a, b) => Number(unresolved.includes(b.status)) - Number(unresolved.includes(a.status)) || Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id))
    .slice(offset, offset + listLimit(query.limit));
}

export function getOperatorRecord(id) { return readRecord('operator_profiles', id); }
export function getTripOperatorAttribution(trip) {
  if (!trip?.operatorId) return { operatorId: null, operatorName: null };
  const profile = getOperatorRecord(trip.operatorId);
  return profile?.status === 'published' && profile.ownerUserId && profile.ownerUserId === trip.userId
    ? { operatorId: profile.id, operatorName: profile.name }
    : { operatorId: null, operatorName: null };
}
export function assertOperatorManager(id, user) {
  const database = ensureStore(), actor = exactUser(user, database), profile = requireProfile(id, database);
  if (!profile.ownerUserId || profile.ownerUserId !== actor.id) fail('Bạn chưa được duyệt quyền quản lý hồ sơ này.', 403);
  return profile;
}
export function listOperators({ q = '', kind, corridor = '', limit, now = Date.now() } = {}) {
  const query = searchable(q).slice(0, 200), route = searchable(corridor).slice(0, 160);
  return allRecords('operator_profiles').filter(profile => profile.status === 'published')
    .filter(profile => !kind || profile.kind === kind)
    .filter(profile => !route || !profile.corridor || searchable(profile.corridor).includes(route) || searchable(profile.coverage.join(' ')).includes(route))
    .filter(profile => !query || searchable([profile.name, ...profile.coverage, profile.corridor].join(' ')).includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi')).slice(0, listLimit(limit)).map(profile => projectPublicOperator(profile, { now }));
}
export function getPublicOperator(id, { now = Date.now() } = {}) {
  const profile = requireProfile(id);
  if (profile.status !== 'published') fail('Không tìm thấy hồ sơ công khai.', 404);
  return projectPublicOperator(profile, { now });
}
export function listMyOperators(user) {
  const actor = exactUser(user);
  return { profiles: allRecords('operator_profiles').filter(profile => profile.ownerUserId === actor.id).map(profile => projectPublicOperator(profile)),
    claims: allRecords('operator_claims').filter(claim => claim.claimantUserId === actor.id).map(projectClaim) };
}
function publicationProof(record, actorId, now) {
  if (!record.name || !record.contactPhone || !record.source?.label || record.source.kind === 'legacy_directory') fail('Cần tên, liên hệ và nguồn đã kiểm tra trước khi công khai.');
  if (!record.contactPublicationBasis || !record.authorizationNote || record.authorizationNote.length < 10) fail('Cần căn cứ và ghi chú bằng chứng cho phép công khai liên hệ.');
  if (record.kind === 'individual' && record.contactPublicationBasis !== 'owner_consent') fail('Số cá nhân chỉ được công khai khi có bằng chứng chủ số đồng ý.');
  if (record.contactPublicationBasis === 'official_business_source' &&
    (record.kind !== 'business' || !['website', 'facebook'].includes(record.source.kind) || !record.source.url)) fail('Cần nguồn công khai chính thức của nhà xe.');
  if (!record.checkedAt || !record.freshUntil || Date.parse(record.checkedAt) > now || Date.parse(record.freshUntil) <= Date.parse(record.checkedAt)) fail('Cần thời điểm đã kiểm tra và hạn kiểm tra lại hợp lệ; không ghi xác nhận ở tương lai.');
  return { contactPhone: record.contactPhone, source: record.source, contactPublicationBasis: record.contactPublicationBasis,
    checkedAt: record.checkedAt, reviewedAt: nowIso(now), reviewedBy: actorId, authorizationNote: record.authorizationNote };
}
function validateDates(record, now) {
  if (record.checkedAt && Date.parse(record.checkedAt) > now) fail('Thời điểm đã kiểm tra không được ở tương lai.');
  if (record.freshUntil && (!record.checkedAt || Date.parse(record.freshUntil) <= Date.parse(record.checkedAt))) fail('Hạn kiểm tra lại phải sau thời điểm đã kiểm tra.');
}
export function createOperator(input, admin, { now = Date.now() } = {}) {
  const actorId = adminActor(admin), database = ensureStore(), patch = normalizePatch(input);
  const record = { id: `operator-${crypto.randomUUID()}`, name: '', kind: 'business', contactPhone: '', corridor: '', coverage: [], scheduleNote: '',
    pricingMode: 'contact', priceNote: '', pickupNote: '', source: { kind: 'other', url: '', label: '' }, checkedAt: null, freshUntil: null,
    status: 'draft', contactPublicationBasis: null, authorizationNote: '', ...patch,
    ownerUserId: null, publicationReview: null, contentUpdatedByOwner: false, createdAt: nowIso(now), updatedAt: nowIso(now), history: [] };
  if (!record.name) fail('Cần tên hồ sơ.');
  validateDates(record, now);
  if (record.status === 'published') record.publicationReview = publicationProof(record, actorId, now);
  record.history.push({ status: record.status, at: nowIso(now), note: 'Tạo hồ sơ', actorId });
  saveProfile(database, record);
  return record;
}
export function updateOperator(id, input, admin, { now = Date.now() } = {}) {
  const actorId = adminActor(admin), database = ensureStore(), patch = normalizePatch(input);
  return database.transaction(() => {
    const current = requireProfile(id, database), record = { ...current, ...patch, updatedAt: nowIso(now) };
    const sensitiveChanged = sensitiveFields.some(key => own(patch, key) && JSON.stringify(patch[key]) !== JSON.stringify(current[key]));
    const contentChanged = contentFields.some(key => own(patch, key) && JSON.stringify(patch[key]) !== JSON.stringify(current[key]));
    if (sensitiveChanged) record.publicationReview = null;
    const recheck = own(patch, 'checkedAt') || own(patch, 'freshUntil') || record.status === 'published' && current.status !== 'published' || sensitiveChanged && record.status === 'published';
    if ((contentChanged || sensitiveChanged) && !own(patch, 'checkedAt')) { record.checkedAt = null; record.freshUntil = null; }
    if (sensitiveChanged && record.status === 'published' && !['source', 'contactPublicationBasis', 'authorizationNote', 'checkedAt', 'freshUntil'].every(key => own(patch, key))) fail('Đổi danh tính, số hoặc nguồn cần ghi lại đầy đủ bằng chứng và mốc kiểm tra trước khi công khai.');
    validateDates(record, now);
    if (record.status === 'published' && (recheck || !record.publicationReview)) {
      record.publicationReview = publicationProof(record, actorId, now);
      record.contentUpdatedByOwner = false;
    }
    record.history = [...current.history, { status: record.status, at: nowIso(now), note: 'Quản trị cập nhật hồ sơ', actorId, changedFields: Object.keys(patch) }];
    saveProfile(database, record); return record;
  })();
}
export function updateOwnedOperator(id, input, user, { now = Date.now() } = {}) {
  const patch = normalizePatch(input, contentFields), database = ensureStore();
  return database.transaction(() => {
    const current = assertOperatorManager(id, user);
    const record = { ...current, ...patch, checkedAt: null, freshUntil: null, contentUpdatedByOwner: true, updatedAt: nowIso(now),
      history: [...current.history, { status: current.status, at: nowIso(now), note: 'Người quản lý cập nhật nội dung; cần kiểm tra lại', actorId: user.id, changedFields: Object.keys(patch) }] };
    saveProfile(database, record); return projectPublicOperator(record, { now });
  })();
}
export function adminListOperators(query = {}, admin) {
  adminActor(admin);
  const offset = Math.max(0, Math.floor(Number(query.offset) || 0));
  return allRecords('operator_profiles').filter(profile => !query.status || profile.status === query.status)
    .filter(profile => !query.q || searchable(profile.name).includes(searchable(query.q)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(offset, offset + listLimit(query.limit));
}
export function adminGetOperator(id, admin) {
  adminActor(admin);
  return requireProfile(id);
}

export function createOperatorClaim(operatorId, input, user, { now = Date.now() } = {}) {
  const database = ensureStore(), actor = exactUser(user, database);
  if (input?.ownerAttestation !== true) fail('Cần xác nhận bạn có thẩm quyền đại diện cho chủ xe hoặc nhà xe.');
  const message = text(input.message, 'Thông tin đại diện', 2000, true);
  return database.transaction(() => {
    const profile = requireProfile(operatorId, database);
    if (profile.status !== 'published') fail('Không tìm thấy hồ sơ công khai.', 404);
    if (profile.ownerUserId) fail(profile.ownerUserId === actor.id ? 'Bạn đã quản lý hồ sơ này.' : 'Hồ sơ đã có người quản lý được duyệt.', 409);
    const pending = database.prepare("SELECT payload FROM operator_claims WHERE operatorId=? AND claimantUserId=? AND status='pending'").get(operatorId, actor.id);
    if (pending) {
      const previous = JSON.parse(pending.payload);
      if (previous.knownContactSnapshot === profile.contactPhone) return projectClaim(previous);
      const note = 'Kênh liên hệ hồ sơ đã đổi; yêu cầu mới thay thế để kiểm tra qua kênh hiện tại.';
      const replaced = { ...previous, status: 'rejected', resolutionNote: note, updatedAt: nowIso(now),
        history: [...previous.history, { status: 'rejected', at: nowIso(now), note, actorId: actor.id }] };
      database.prepare("UPDATE operator_claims SET status='rejected',payload=? WHERE id=? AND status='pending'").run(JSON.stringify(replaced), previous.id);
    }
    const claim = { id: `claim-${crypto.randomUUID()}`, operatorId, operatorName: profile.name, claimantUserId: actor.id,
      message, ownerAttestation: true, status: 'pending', knownContactSnapshot: profile.contactPhone,
      createdAt: nowIso(now), updatedAt: nowIso(now), resolutionNote: '', history: [{ status: 'pending', at: nowIso(now), note: 'Đã gửi yêu cầu nhận quản lý', actorId: actor.id }] };
    database.prepare('INSERT INTO operator_claims (id,operatorId,claimantUserId,status,payload) VALUES (?,?,?,?,?)').run(claim.id, operatorId, actor.id, claim.status, JSON.stringify(claim));
    return projectClaim(claim);
  })();
}
export function adminListClaims(query = {}, admin) {
  adminActor(admin); return reviewList(allRecords('operator_claims'), query, ['pending']);
}
export function reviewOperatorClaim(id, input, admin, { now = Date.now() } = {}) {
  const actorId = adminActor(admin), database = ensureStore();
  const status = enumValue(input?.status, ['approved', 'rejected'], 'Trạng thái duyệt');
  const resolutionNote = text(input.resolutionNote, 'Kết luận xử lý', 2000, true);
  return database.transaction(() => {
    const claim = readRecord('operator_claims', id, database) || fail('Không tìm thấy yêu cầu nhận quản lý.', 404);
    if (claim.status === status) return claim;
    if (claim.status !== 'pending') fail('Yêu cầu này đã được xử lý; không thể đổi kết luận.', 409);
    const profile = requireProfile(claim.operatorId, database);
    let evidence = null;
    if (status === 'approved') {
      if (profile.ownerUserId) fail('Hồ sơ đã có người quản lý được duyệt.', 409);
      exactUser({ id: claim.claimantUserId }, database);
      if (profile.status !== 'published' || !profile.publicationReview || profile.publicationReview.contactPhone !== profile.contactPhone) fail('Cần duyệt nguồn và kênh liên hệ độc lập của hồ sơ trước.', 409);
      if (claim.knownContactSnapshot !== profile.contactPhone) fail('Kênh liên hệ đã thay đổi từ khi gửi yêu cầu; cần gửi yêu cầu mới.', 409);
      const proof = input.evidence || {};
      evidence = { knownContactPhone: phone(proof.knownContactPhone), channel: enumValue(proof.channel, ['phone', 'zalo', 'email', 'in_person'], 'Kênh kiểm tra'),
        reviewedAt: dateValue(proof.reviewedAt, 'Thời điểm kiểm tra quyền'), authorityNote: text(proof.authorityNote, 'Bằng chứng quyền đại diện', 3000, true),
        sourceSnapshot: profile.publicationReview.source, contactCheckedAt: profile.publicationReview.checkedAt };
      if (evidence.knownContactPhone !== phone(profile.publicationReview.contactPhone)) fail('Phải xác nhận quyền qua đúng kênh liên hệ đã được kiểm tra độc lập.', 409);
      if (!evidence.reviewedAt || Date.parse(evidence.reviewedAt) > now || Date.parse(evidence.reviewedAt) < Date.parse(claim.createdAt)) fail('Cần thời điểm kiểm tra thực tế sau khi nhận yêu cầu, không ở tương lai.');
      if (evidence.authorityNote.length < 10) fail('Cần mô tả rõ bằng chứng quyền đại diện.');
      const next = { ...profile, ownerUserId: claim.claimantUserId, ownershipClaimId: claim.id, ownershipApprovedAt: nowIso(now), updatedAt: nowIso(now),
        history: [...profile.history, { status: profile.status, at: nowIso(now), note: 'Duyệt người quản lý sau khi kiểm tra quyền đại diện', actorId }] };
      const assigned = database.prepare('UPDATE operator_profiles SET ownerUserId=?,payload=? WHERE id=? AND ownerUserId IS NULL').run(claim.claimantUserId, JSON.stringify(next), profile.id);
      if (assigned.changes !== 1) fail('Một người quản lý khác đã được duyệt trước.', 409);
    }
    const reviewed = { ...claim, status, resolutionNote, evidence, reviewedBy: actorId, updatedAt: nowIso(now), history: [...claim.history, { status, at: nowIso(now), note: resolutionNote, actorId }] };
    database.prepare('UPDATE operator_claims SET status=?,payload=? WHERE id=? AND status=?').run(status, JSON.stringify(reviewed), id, 'pending');
    return reviewed;
  })();
}

export function createOperatorReport(operatorId, input, { now = Date.now() } = {}) {
  const database = ensureStore(), profile = requireProfile(operatorId, database);
  if (profile.status !== 'published') fail('Không tìm thấy hồ sơ công khai.', 404);
  const type = enumValue(input?.type, ['correction', 'removal'], 'Loại phản ánh');
  const message = text(input.message, 'Nội dung phản ánh', 3000, true);
  const reporterContact = text(input.reporterContact, 'Liên hệ người phản ánh', 200);
  const report = { id: `report-${crypto.randomUUID()}`, operatorId, operatorName: profile.name, type, message, reporterContact,
    status: 'pending', createdAt: nowIso(now), updatedAt: nowIso(now), resolutionNote: '', history: [{ status: 'pending', at: nowIso(now), note: 'Đã tiếp nhận phản ánh' }] };
  const accessToken = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(accessToken).digest('hex');
  database.prepare('INSERT INTO operator_reports (id,operatorId,status,accessTokenHash,payload) VALUES (?,?,?,?,?)').run(report.id, operatorId, report.status, hash, JSON.stringify(report));
  return { ...projectReport(report), accessToken };
}
export function getOperatorReportStatus(id, accessToken) {
  const database = ensureStore();
  if (typeof id !== 'string' || id.length > 160 || typeof accessToken !== 'string' || accessToken.length > 200) fail('Không tìm thấy phản ánh hoặc mã tra cứu không đúng.', 404);
  const row = database.prepare('SELECT accessTokenHash,payload FROM operator_reports WHERE id=?').get(id);
  const supplied = crypto.createHash('sha256').update(accessToken).digest();
  const expected = Buffer.from(row?.accessTokenHash || '0'.repeat(64), 'hex');
  if (!crypto.timingSafeEqual(supplied, expected) || !row) fail('Không tìm thấy phản ánh hoặc mã tra cứu không đúng.', 404);
  return projectReport(JSON.parse(row.payload));
}
export function adminListReports(query = {}, admin) {
  adminActor(admin); return reviewList(allRecords('operator_reports'), query, ['pending', 'reviewing']);
}
export function reviewOperatorReport(id, input, admin, { now = Date.now() } = {}) {
  const actorId = adminActor(admin), database = ensureStore();
  const status = enumValue(input?.status, ['reviewing', 'resolved', 'rejected'], 'Trạng thái phản ánh');
  const resolutionNote = text(input.resolutionNote, 'Ghi chú xử lý', 2000, true);
  return database.transaction(() => {
    const current = readRecord('operator_reports', id, database) || fail('Không tìm thấy phản ánh.', 404);
    if (current.status === status && (status !== 'reviewing' || current.resolutionNote === resolutionNote)) return current;
    if (!['pending', 'reviewing'].includes(current.status)) fail('Phản ánh đã được kết luận; không thể đổi trạng thái.', 409);
    const report = { ...current, status, resolutionNote, updatedAt: nowIso(now),
      history: [...current.history, { status, at: nowIso(now), note: resolutionNote, actorId }] };
    database.prepare('UPDATE operator_reports SET status=?,payload=? WHERE id=?').run(status, JSON.stringify(report), id);
    return report;
  })();
}
