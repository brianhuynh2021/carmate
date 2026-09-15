import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'carmate-operators-http-'));
process.env.CARMATE_DATA_DIR = directory;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-operator-http-suite-signing-key';
process.env.SEED_DEMO_DATA = 'false';
globalThis.fetch = () => { throw new Error('External network is disabled in this suite'); };
const store = await import('../apps/api/src/db/sqliteStore.js');
const { generateToken } = await import('../apps/api/src/utils/token.js');
const { default: router } = await import('../apps/api/src/routes/api.js');
const { sanitizeInput } = await import('../apps/api/src/middlewares/security.js');
await store.initDB();
const app = express();
app.use(express.json(), sanitizeInput);
app.use('/api', router);
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
let checks = 0;
function check(label, fn) { fn(); checks++; console.log(`✓ ${label}`); }
const admin = generateToken({ id: 'test-admin', role: 'admin' });
const businessPhone = '02838546721';
const owner = { id: 'test-operator-owner', phone: '0938546721', name: 'Chủ xe thử nghiệm' };
const intruder = { id: 'test-other-user', phone: businessPhone, name: 'Người khác' };
const token = generateToken(owner);
const otherToken = generateToken(intruder);
function call(method, endpoint, body, authToken, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: `/api${endpoint}`, method,
      headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), ...headers } }, res => {
      let content = ''; res.on('data', chunk => { content += chunk; });
      res.on('end', () => { try { resolve({ status: res.statusCode, ...JSON.parse(content) }); } catch (error) { reject(error); } });
    });
    req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
  });
}
try {
  await store.saveUser(owner);
  // The token deliberately copies the same phone, but represents a different existing account.
  await store.saveUser({ ...intruder, phone: '0938546722' });
  const now = new Date().toISOString();
  let response = await call('GET', '/admin/operators');
  check('Admin profiles require authentication', () => assert.equal(response.status, 401));
  response = await call('GET', '/operators/mine');
  check('Owner records require authentication', () => assert.equal(response.status, 401));
  response = await call('GET', '/operators');
  check('Unreviewed legacy imports do not become public supply', () => assert.deepEqual(response.data, []));
  response = await call('POST', '/admin/operators', {
    name: 'Nhà xe kiểm thử – không vận hành', kind: 'business', contactPhone: businessPhone,
    coverage: ['Tân Khai', 'Sài Gòn'], corridor: 'Tuyến QL13', scheduleNote: 'Lịch công bố cần gọi xác nhận',
    pricingMode: 'listed', priceNote: '150.000đ theo thông tin thử nghiệm', pickupNote: 'Tại trạm',
    source: { kind: 'website', url: 'https://example.com/test-operator', label: 'Nguồn kiểm thử' },
    checkedAt: now, freshUntil: new Date(Date.now() + 86400000).toISOString(), status: 'published',
    contactPublicationBasis: 'official_business_source', authorizationNote: 'Dữ liệu giả chỉ dùng trong kiểm thử cục bộ.'
  }, admin);
  check('An admin can publish a sourced reference profile', () => assert.equal(response.status, 201));
  const operatorId = response.data.id;
  response = await call('GET', `/operators/${operatorId}`);
  check('Public reference contains no account or private evidence and no live seat claim', () => {
    assert.equal(response.data.bookingConfirmed, false); assert.equal(response.data.liveSeats, null);
    assert.equal(response.data.ownerUserId, undefined); assert.equal(response.data.authorizationNote, undefined);
  });
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + 86400000));
  const trip = { type: 'driver_offer', from: 'Tân Khai', to: 'Hàng Xanh', originHubId: 'hub_ql13_tan_khai', destinationHubId: 'hub_ql13_hang_xanh',
    date: tomorrow, time: '07:00', timeSlot: '07:00', capacity: 5, availableSeats: 4, carType: 'Xe kiểm thử', licensePlate: 'TEST-45',
    phoneReal: businessPhone, pricingMode: 'listed', basePricePerSeat: 150000, pickupMode: 'station', maxDetourKm: 0, publicContactConsent: true };
  const authorization = { approved: true, channel: 'phone', knownContactPhone: businessPhone, approvedAt: now, evidenceNote: 'Đã đồng ý nội dung chính chuyến thử nghiệm này.' };
  const assisted = { requestId: 'test-assisted-request-0001', trip, authorization };
  response = await call('POST', `/admin/operators/${operatorId}/trips`, assisted, admin);
  check('Reference profile cannot create a fake account to publish a trip', () => assert.equal(response.status, 409));
  response = await call('POST', `/operators/${operatorId}/claims`, { message: 'Tôi đại diện hồ sơ thử nghiệm này.', ownerAttestation: true }, token);
  check('Logged-in claimant receives pending state, not ownership', () => assert.equal(response.data.status, 'pending'));
  const claimId = response.data.id;
  response = await call('PATCH', `/admin/operator-claims/${claimId}`, { status: 'approved', resolutionNote: 'Đã đối chiếu.', evidence: { knownContactPhone: '0938546723', channel: 'phone', reviewedAt: new Date().toISOString(), authorityNote: 'Đối chiếu thử nghiệm' } }, admin);
  check('Claim proof cannot switch to an arbitrary contact', () => assert.equal(response.status, 409));
  response = await call('PATCH', `/admin/operator-claims/${claimId}`, { status: 'approved', resolutionNote: 'Đã đối chiếu với người có quyền quản lý.', evidence: { knownContactPhone: businessPhone, channel: 'phone', reviewedAt: new Date().toISOString(), authorityNote: 'Đối chiếu quyền quản lý thử nghiệm.' } }, admin);
  check('Reviewed claim grants ownership', () => assert.equal(response.data.status, 'approved'));
  response = await call('POST', '/trips', { ...trip, operatorId }, otherToken);
  check('Copying a phone cannot publish on behalf of an operator', () => assert.equal(response.status, 403));
  response = await call('POST', `/admin/operators/${operatorId}/trips`, { ...assisted, authorization: { ...authorization, approved: false } }, admin);
  check('Assisted posting requires separate approval for that trip', () => assert.equal(response.status, 400));
  response = await call('POST', `/admin/operators/${operatorId}/trips`, { trip, authorization }, admin);
  check('An assisted request requires a retry-safe client identifier', () => assert.equal(response.status, 400));
  // Create the audit schema, then emulate a process interrupted before it inserted any trip.
  response = await call('POST', `/admin/operators/${operatorId}/trips`, { ...assisted, requestId: 'failed-test-request-0001', trip: { ...trip, from: '' } }, admin);
  assert.equal(response.status, 400);
  store.getRawDB().prepare('INSERT INTO operator_trip_authorizations (id,operatorId,ownerId,adminId,fingerprint,authorization,createdAt,status,startedAt) VALUES (?,?,?,?,?,?,?,?,?)').run(
    assisted.requestId, operatorId, owner.id, 'test-admin',
    crypto.createHash('sha256').update(JSON.stringify({ operatorId, ownerId: owner.id, tripInput: trip, auth: authorization })).digest('hex'),
    JSON.stringify(authorization), now, 'pending', Date.now() - 120000
  );
  response = await call('POST', `/admin/operators/${operatorId}/trips`, assisted, admin);
  check('Assisted trip keeps operator fare and existing manager identity', () => {
    assert.equal(response.status, 201, JSON.stringify(response)); assert.equal(response.data.basePricePerSeat, 150000); assert.equal(response.data.userId, owner.id);
    assert.equal(response.data.operatorId, operatorId); assert.equal(response.data.operatorEntryMode, 'assisted');
  });
  const tripId = response.data.id;
  check('A business can use its reviewed landline contact for a trip', () => assert.equal(response.data.phoneReal, businessPhone));
  check('An interrupted pending attempt can resume without inventing another account', () => assert.equal(store.getRawDB().prepare('SELECT status FROM operator_trip_authorizations WHERE id=?').get(assisted.requestId).status, 'published'));
  response = await call('POST', `/admin/operators/${operatorId}/trips`, assisted, admin);
  check('Repeated assisted posting returns the same trip', () => assert.equal(response.data.id, tripId));
  response = await call('PUT', `/trips/${tripId}`, { pickupNotes: 'Impersonated edit' }, otherToken);
  check('Same phone under another account cannot edit operator trip', () => assert.equal(response.status, 403));
  response = await call('GET', `/trips/${tripId}`, null, otherToken);
  check('Same phone cannot expose owner manifest or private approval evidence', () => {
    assert.equal(response.data.manifest, undefined); assert.equal(response.data.operatorAuthorization, undefined); assert.equal(response.data.phoneReal, undefined);
  });
  response = await call('PUT', `/trips/${tripId}`, { operatorId: 'spoofed-id', operatorName: 'spoofed-name' }, token);
  check('Existing trip attribution cannot be silently reassigned', () => assert.equal(response.data.operatorId, operatorId));
  response = await call('POST', `/operators/${operatorId}/reports`, { type: 'removal', message: 'Đề nghị kiểm tra nguồn và gỡ số thử nghiệm.', reporterContact: 'private@example.com' });
  check('Guest can submit a report without an account', () => { assert.equal(response.status, 201); assert.ok(response.data.accessToken); });
  const receipt = response.data;
  response = await call('POST', '/operator-reports/status', { id: receipt.id, accessToken: 'wrong-token' });
  check('Report status cannot be guessed by report id alone', () => assert.equal(response.status, 404));
  response = await call('PATCH', `/admin/operators/${operatorId}`, { status: 'hidden' }, admin);
  check('Hidden profile leaves the public directory', () => assert.equal(response.status, 200));
  response = await call('PATCH', `/admin/operator-reports/${receipt.id}`, { status: 'resolved', resolutionNote: 'Đã ẩn hồ sơ sau khi đối chiếu nguồn.' }, admin);
  check('Admin records a report outcome', () => assert.equal(response.data.status, 'resolved'));
  response = await call('POST', '/operator-reports/status', { id: receipt.id, accessToken: receipt.accessToken });
  check('Guest receipt shows handled outcome without private reporter data', () => { assert.equal(response.data.status, 'resolved'); assert.equal(response.data.reporterContact, undefined); });
  response = await call('POST', '/admin/drivers', { name: 'Unapproved fake account' }, admin);
  check('Legacy fake-account creation endpoint is retired', () => assert.equal(response.status, 410));
  for (let i = 0; i < 13; i++) response = await call('POST', `/operators/${operatorId}/reports`, { type: 'correction', message: 'Rate limit test message' }, null, { 'x-admin-key': 'forged' });
  check('Forged admin header cannot bypass guest report rate limit', () => assert.equal(response.status, 429));
  console.log(`Operator HTTP suite: ${checks} checks passed.`);
} finally {
  await new Promise(resolve => server.close(resolve));
  store.closeDB();
  fs.rmSync(directory, { recursive: true, force: true });
}
