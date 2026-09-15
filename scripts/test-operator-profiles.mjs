import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carmate-operators-'));
process.env.CARMATE_DATA_DIR = testDir;
delete process.env.SEED_DEMO_DATA;
process.env.NODE_ENV = 'test';
const store = await import('../apps/api/src/db/sqliteStore.js');
const profiles = await import('../apps/api/src/services/operatorProfiles.js');
const controller = await import('../apps/api/src/controllers/operatorController.js');
await store.initDB();
let db = store.getRawDB();
const NOW = Date.now();
const iso = offset => new Date(NOW + offset).toISOString();
const admin = { id: 'test-admin', role: 'admin' };
const alice = { id: 'owner-alice', phone: '0918374625' };
const bob = { id: 'owner-bob', phone: '0918365742' };
let passed = 0;
function check(name, run) { run(); passed++; console.log(`✓ ${name}`); }
function seedUser(user) {
  db.prepare('INSERT INTO users (id,phone,name,role,isBanned,payload) VALUES (?,?,?,?,?,?)').run(user.id, user.phone, user.id, 'driver', 0, JSON.stringify(user));
}
function counts() { return { users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n, trips: db.prepare('SELECT COUNT(*) AS n FROM trips').get().n }; }
const business = {
  name: 'Nhà xe thử nghiệm', kind: 'business', contactPhone: '19006952', corridor: 'Tuyến QL13', coverage: ['Bù Đốp', 'Sài Gòn'],
  scheduleNote: 'Liên hệ kiểm tra giờ chạy', pricingMode: 'listed', priceNote: '180.000đ tham khảo', pickupNote: 'Hai bên chốt điểm đón',
  source: { kind: 'website', url: 'https://example.com/operator', label: 'Trang liên hệ nhà xe thử nghiệm' },
  checkedAt: iso(-60_000), freshUntil: iso(86_400_000), status: 'published',
  contactPublicationBasis: 'official_business_source', authorizationNote: 'Nguồn thử nghiệm trong dữ liệu cô lập: số tổng đài được công khai.'
};
const proof = (knownContactPhone = business.contactPhone) => ({
  knownContactPhone, channel: 'phone', reviewedAt: iso(20_000), authorityNote: 'Bằng chứng thử nghiệm: đã kiểm tra quyền quản lý qua tổng đài độc lập.'
});
const approve = id => profiles.reviewOperatorClaim(id, { status: 'approved', resolutionNote: 'Đã xác nhận quyền đại diện.', evidence: proof() }, admin, { now: NOW + 30_000 });

try {
  store.saveTransitDirectory([{ id: 'legacy-known', operator: 'Danh bạ cũ thử nghiệm', hotline: '0912345678', verified: true, verifiedAt: '2026-09-12', priceRef: '100.000đ' }]);
  seedUser(alice); seedUser(bob);
  const baseline = counts();
  check('Starting without a seed flag never inserts demonstration trips', () => assert.equal(baseline.trips, 0));
  const imported = profiles.adminListOperators({}, admin);
  check('Legacy verification never becomes publication or a fabricated check date', () => {
    assert.equal(imported.length, 1); assert.equal(imported[0].status, 'draft');
    assert.equal(imported[0].checkedAt, null); assert.equal(imported[0].freshUntil, null);
    assert.equal(imported[0].source.kind, 'legacy_directory'); assert.equal(imported[0].publicationReview, null);
    assert.deepEqual(profiles.listOperators(), []);
  });
  store.saveTransitDirectory([{ id: 'later-old-row', operator: 'New legacy row', hotline: '0912345678' }]);
  check('Legacy import runs once and never creates users or trips', () => {
    assert.equal(profiles.adminListOperators({}, admin).length, 1); assert.deepEqual(counts(), baseline);
  });
  check('Admin APIs reject a normal account and forged ownership fields', () => {
    assert.throws(() => profiles.createOperator(business, alice), { status: 403 });
    assert.throws(() => profiles.createOperator({ ...business, ownerUserId: alice.id }, admin), { status: 400 });
  });
  check('Publication requires explicit evidence, source, and checked dates', () => {
    assert.throws(() => profiles.createOperator({ ...business, authorizationNote: '' }, admin, { now: NOW }), { status: 400 });
    assert.throws(() => profiles.createOperator({ ...business, source: { kind: 'legacy_directory', label: 'Old data', url: '' } }, admin, { now: NOW }), { status: 400 });
    assert.throws(() => profiles.createOperator({ ...business, checkedAt: null }, admin, { now: NOW }), { status: 400 });
    assert.throws(() => profiles.createOperator({ ...business, checkedAt: iso(1000) }, admin, { now: NOW }), { status: 400 });
    assert.throws(() => profiles.createOperator({ ...business, source: { kind: 'website', label: 'Wrong protocol', url: 'javascript:alert(1)' } }, admin, { now: NOW }), { status: 400 });
  });
  check('Personal contact cannot use the public-business basis', () => assert.throws(() => profiles.createOperator({ ...business, kind: 'individual' }, admin, { now: NOW }), { status: 400 }));
  const individual = profiles.createOperator({ ...business, name: 'Chủ xe thử nghiệm', kind: 'individual', contactPhone: '0919873654',
    source: { kind: 'owner_contact', label: 'Chủ số đồng ý công khai', url: '' }, contactPublicationBasis: 'owner_consent',
    authorizationNote: 'Bằng chứng thử nghiệm: chủ số đã đồng ý công khai liên hệ này.' }, admin, { now: NOW });
  check('Explicit owner-consent evidence can publish a personal profile', () => assert.equal(individual.status, 'published'));
  const profile = profiles.createOperator(business, admin, { now: NOW });
  const view = profiles.getPublicOperator(profile.id, { now: NOW });
  check('Public profile is a directory entry, without live seats or private identity', () => {
    assert.equal(view.bookingConfirmed, false); assert.equal(view.liveSeats, null); assert.equal(view.managementStatus, 'unclaimed');
    for (const field of ['ownerUserId', 'authorizationNote', 'publicationReview', 'history', 'importedFrom', 'reporterContact']) assert.equal(view[field], undefined);
    assert.equal(view.freshness, 'fresh'); assert.equal(view.priceStale, false); assert.deepEqual(counts(), baseline);
  });
  check('Stale price remains labeled rather than silently appearing current', () => {
    const stale = profiles.getPublicOperator(profile.id, { now: NOW + 2 * 86_400_000 });
    assert.equal(stale.freshness, 'stale'); assert.equal(stale.priceStale, true); assert.equal(stale.priceNote, business.priceNote);
  });
  check('Search uses actual profile coverage and unknown IDs remain 404', () => {
    assert.ok(profiles.listOperators({ q: 'bu dop', corridor: 'Tuyến QL13' }).some(item => item.id === profile.id));
    assert.throws(() => profiles.getPublicOperator('unknown'), { status: 404 });
    assert.throws(() => profiles.getPublicOperator(imported[0].id), { status: 404 });
  });
  check('Claims require a real exact-ID account and explicit authority attestation', () => {
    assert.throws(() => profiles.createOperatorClaim(profile.id, { message: 'Own this', ownerAttestation: true }, { id: alice.phone }), { status: 401 });
    assert.throws(() => profiles.createOperatorClaim(profile.id, { message: 'Own this', ownerAttestation: true }, { id: 'missing', phone: business.contactPhone }), { status: 401 });
    assert.throws(() => profiles.createOperatorClaim(profile.id, { message: 'Own this' }, alice), { status: 400 });
  });
  const claimAlice = profiles.createOperatorClaim(profile.id, { message: 'Tôi có thẩm quyền đại diện.', ownerAttestation: true }, { ...alice, phone: business.contactPhone }, { now: NOW });
  const claimBob = profiles.createOperatorClaim(profile.id, { message: 'Kiểm tra đại diện thứ hai.', ownerAttestation: true }, bob, { now: NOW });
  check('Copying the operator phone only creates a pending request; repeated submit is idempotent', () => {
    assert.equal(claimAlice.status, 'pending'); assert.equal(profiles.getOperatorRecord(profile.id).ownerUserId, null);
    assert.equal(profiles.createOperatorClaim(profile.id, { message: 'Retry', ownerAttestation: true }, alice).id, claimAlice.id);
    assert.throws(() => profiles.assertOperatorManager(profile.id, alice), { status: 403 });
  });
  check('Approval requires matching known-contact authority evidence', () => {
    assert.throws(() => profiles.reviewOperatorClaim(claimAlice.id, { status: 'approved', resolutionNote: 'Approve' }, admin, { now: NOW + 30_000 }), { status: 400 });
    assert.throws(() => profiles.reviewOperatorClaim(claimAlice.id, { status: 'approved', resolutionNote: 'Approve', evidence: proof('0915554321') }, admin, { now: NOW + 30_000 }), { status: 409 });
    assert.throws(() => profiles.reviewOperatorClaim(claimAlice.id, { status: 'approved', resolutionNote: 'Approve', evidence: { ...proof(), reviewedAt: iso(60_000) } }, admin, { now: NOW + 30_000 }), { status: 400 });
  });
  const approved = approve(claimAlice.id);
  check('First reviewed claimant wins atomically; another approval cannot replace the owner', () => {
    assert.equal(approved.status, 'approved'); assert.equal(profiles.assertOperatorManager(profile.id, alice).ownerUserId, alice.id);
    assert.throws(() => approve(claimBob.id), { status: 409 });
    assert.equal(profiles.getOperatorRecord(profile.id).ownerUserId, alice.id);
    assert.equal(profiles.adminListClaims({}, admin).find(claim => claim.id === claimBob.id).status, 'pending');
    assert.equal(approve(claimAlice.id).history.length, approved.history.length);
  });
  check('Mine exposes only own claims and profiles, without private reviewer evidence', () => {
    const mine = profiles.listMyOperators(alice);
    assert.equal(mine.profiles.length, 1); assert.equal(mine.claims.length, 1);
    assert.equal(mine.claims[0].evidence, undefined); assert.equal(mine.claims[0].claimantUserId, undefined);
    assert.equal(mine.claims[0].history[1].actorId, undefined); assert.equal(profiles.listMyOperators(bob).profiles.length, 0);
    assert.equal(profiles.getPublicOperator(profile.id).managementStatus, 'claimed');
  });
  check('An unrelated owner cannot edit a profile even with a copied phone', () => assert.throws(() => profiles.updateOwnedOperator(profile.id, { priceNote: 'Wrong' }, { ...bob, phone: alice.phone }), { status: 403 }));
  check('Owner cannot replace the verified phone, source, identity, or timestamps', () => {
    for (const patch of [{ contactPhone: bob.phone }, { source: business.source }, { name: 'Hijack' }, { checkedAt: iso(0) }, { status: 'published' }]) assert.throws(() => profiles.updateOwnedOperator(profile.id, patch, alice), { status: 400 });
  });
  const edited = profiles.updateOwnedOperator(profile.id, { priceNote: 'Giá mới, cần kiểm tra lại' }, alice, { now: NOW + 40_000 });
  check('Owner content changes invalidate old freshness without changing contact provenance', () => {
    assert.equal(edited.checkedAt, null); assert.equal(edited.freshUntil, null); assert.equal(edited.freshness, 'unreviewed'); assert.equal(edited.priceStale, true);
    assert.equal(edited.contactPhone, business.contactPhone); assert.equal(edited.status, 'published');
    assert.equal(profiles.getOperatorRecord(profile.id).publicationReview.contactPhone, business.contactPhone);
  });
  check('Admin cannot silently replace the contact under previous publication evidence', () => assert.throws(() => profiles.updateOperator(profile.id, { contactPhone: bob.phone }, admin), { status: 400 }));
  profiles.updateOperator(profile.id, { checkedAt: iso(40_000), freshUntil: iso(86_400_000), authorizationNote: 'Đã kiểm tra lại giá và nội dung qua nguồn chính thức.' }, admin, { now: NOW + 50_000 });
  check('Explicit admin recheck establishes new freshness', () => assert.equal(profiles.getPublicOperator(profile.id, { now: NOW + 50_000 }).freshness, 'fresh'));
  profiles.reviewOperatorClaim(claimBob.id, { status: 'rejected', resolutionNote: 'Một đại diện khác đã được xác nhận.' }, admin);
  check('Claim decisions require a note and cannot change after final review', () => {
    assert.throws(() => profiles.reviewOperatorClaim(claimBob.id, { status: 'approved', resolutionNote: 'Switch owner', evidence: proof() }, admin), { status: 409 });
    assert.throws(() => profiles.reviewOperatorClaim(claimBob.id, { status: 'rejected', resolutionNote: '' }, admin), { status: 400 });
  });
  const report = profiles.createOperatorReport(profile.id, { type: 'correction', message: 'Giờ chạy cần cập nhật.', reporterContact: 'private-reporter@example.test' }, { now: NOW });
  check('Guest correction issues a secret status token, stored only as a hash', () => {
    assert.ok(report.accessToken.length >= 40); assert.equal(report.status, 'pending'); assert.equal(report.reporterContact, undefined);
    const stored = db.prepare('SELECT * FROM operator_reports WHERE id=?').get(report.id);
    assert.notEqual(stored.accessTokenHash, report.accessToken); assert.ok(!stored.payload.includes(report.accessToken));
  });
  check('Guessing a report ID cannot reveal its status or reporter contact', () => {
    assert.throws(() => profiles.getOperatorReportStatus(report.id, 'wrong'), { status: 404 });
    assert.throws(() => profiles.getOperatorReportStatus('unknown', report.accessToken), { status: 404 });
    const status = profiles.getOperatorReportStatus(report.id, report.accessToken);
    assert.equal(status.status, 'pending'); assert.equal(status.reporterContact, undefined); assert.equal(status.message, undefined);
    assert.equal(profiles.getPublicOperator(profile.id).reporterContact, undefined);
  });
  check('Unknown, private, and overlong report targets are rejected', () => {
    assert.throws(() => profiles.createOperatorReport('unknown', { type: 'removal', message: 'Remove' }), { status: 404 });
    assert.throws(() => profiles.createOperatorReport(imported[0].id, { type: 'removal', message: 'Remove' }), { status: 404 });
    assert.throws(() => profiles.createOperatorReport(profile.id, { type: 'correction', message: 'x'.repeat(3001) }), { status: 400 });
  });
  profiles.reviewOperatorReport(report.id, { status: 'reviewing', resolutionNote: 'Đang kiểm tra lịch chạy với nhà xe.' }, admin, { now: NOW + 1000 });
  profiles.reviewOperatorReport(report.id, { status: 'resolved', resolutionNote: 'Đã kiểm tra và cập nhật thông tin lịch chạy.' }, admin, { now: NOW + 2000 });
  check('Report review retains its history and requires a meaningful conclusion', () => {
    const status = profiles.getOperatorReportStatus(report.id, report.accessToken);
    assert.equal(status.status, 'resolved'); assert.equal(status.history.length, 3); assert.equal(status.history[2].actorId, undefined);
    assert.throws(() => profiles.reviewOperatorReport(report.id, { status: 'rejected', resolutionNote: 'Undo' }, admin), { status: 409 });
    assert.throws(() => profiles.reviewOperatorReport(report.id, { status: 'resolved', resolutionNote: '' }, admin), { status: 400 });
    assert.equal(profiles.adminListReports({}, admin)[0].reporterContact, 'private-reporter@example.test');
    assert.equal(profiles.getPublicOperator(profile.id).status, 'published');
  });
  const removal = profiles.createOperatorReport(profile.id, { type: 'removal', message: 'Đề nghị ẩn số liên hệ.' });
  profiles.updateOperator(profile.id, { status: 'hidden' }, admin, { now: NOW + 60_000 });
  profiles.reviewOperatorReport(removal.id, { status: 'resolved', resolutionNote: 'Hồ sơ đã được ẩn sau khi kiểm tra yêu cầu.' }, admin);
  check('Removal hides the profile while keeping the report and audit history', () => {
    assert.throws(() => profiles.getPublicOperator(profile.id), { status: 404 });
    assert.equal(profiles.getOperatorReportStatus(removal.id, removal.accessToken).status, 'resolved');
    assert.ok(profiles.getOperatorRecord(profile.id).history.length > 1);
  });
  const newClaim = profiles.createOperatorClaim(individual.id, { message: 'Tôi là đại diện cần kiểm tra.', ownerAttestation: true }, bob, { now: NOW + 100_000 });
  const oldOpen = profiles.createOperatorReport(individual.id, { type: 'correction', message: 'Đang chờ kiểm tra.' }, { now: NOW - 100_000 });
  const newestOpen = profiles.createOperatorReport(individual.id, { type: 'removal', message: 'Đề nghị rà soát mới nhất.' }, { now: NOW + 100_000 });
  check('Admin queues show unresolved work first and support status filters and pagination', () => {
    assert.equal(profiles.adminListClaims({ limit: 1 }, admin)[0].id, newClaim.id);
    assert.equal(profiles.adminListReports({ limit: 1 }, admin)[0].id, newestOpen.id);
    assert.equal(profiles.adminListReports({ limit: 1, offset: 1 }, admin)[0].id, oldOpen.id);
    assert.ok(profiles.adminListReports({ status: 'resolved' }, admin).every(item => item.status === 'resolved'));
    assert.ok(profiles.adminListClaims({ status: 'approved' }, admin).every(item => item.status === 'approved'));
  });
  profiles.updateOperator(individual.id, { contactPhone: '0918574632', source: individual.source,
    contactPublicationBasis: 'owner_consent', authorizationNote: 'Đã đối chiếu sự đồng ý cho số liên hệ mới.', checkedAt: iso(150_000), freshUntil: iso(86_400_000) }, admin, { now: NOW + 150_000 });
  const renewedClaim = profiles.createOperatorClaim(individual.id, { message: 'Gửi lại để đối chiếu qua kênh mới.', ownerAttestation: true }, bob, { now: NOW + 160_000 });
  check('A changed contact can receive a fresh claim instead of leaving the claimant stuck', () => {
    assert.notEqual(renewedClaim.id, newClaim.id);
    assert.equal(profiles.adminListClaims({}, admin).find(item => item.id === newClaim.id).status, 'rejected');
    assert.equal(renewedClaim.status, 'pending');
  });
  check('Public trip attribution requires the actual approved manager and a visible profile', () => {
    assert.equal(profiles.getTripOperatorAttribution({ operatorId: individual.id, userId: bob.id }).operatorName, null);
    assert.equal(profiles.getTripOperatorAttribution({ operatorId: profile.id, userId: alice.id }).operatorName, null);
  });
  store.closeDB(); await store.initDB(); db = store.getRawDB();
  check('Restart preserves profiles, approved ownership, reports, and the import marker', () => {
    assert.equal(profiles.getOperatorRecord(profile.id).status, 'hidden'); assert.equal(profiles.assertOperatorManager(profile.id, alice).ownerUserId, alice.id);
    assert.equal(profiles.getOperatorReportStatus(report.id, report.accessToken).status, 'resolved');
    assert.equal(profiles.adminListOperators({}, admin).length, 3); assert.deepEqual(counts(), baseline);
  });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  controller.adminListOperatorsHandler({ query: {}, user: admin, body: { role: 'admin' } }, res);
  check('Controller never treats body/user role as an admin portal session', () => { assert.equal(res.statusCode, 403); assert.equal(res.body.success, false); });
  const staleProfile = profiles.createOperator({ ...business, name: 'Stale HTTP', checkedAt: iso(-3000), freshUntil: iso(-2000) }, admin, { now: NOW });
  controller.listOperatorsHandler({ query: { q: 'Stale HTTP', now: '0' } }, res);
  check('Public query cannot spoof the clock to make expired information fresh', () => { assert.equal(res.body.data.find(item => item.id === staleProfile.id).freshness, 'stale'); });
  console.log(`\n${passed} operator-profile invariants passed.`);
} finally {
  store.closeDB(); fs.rmSync(testDir, { recursive: true, force: true });
}
