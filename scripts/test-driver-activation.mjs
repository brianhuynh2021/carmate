import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDriverDemandPreview, buildDriverTripPayload, createAuthContinuation, vietnamDate } from '../apps/web/src/utils/driverTripDraft.js';
import { ownedDriverTrips, realPositionPayload, confirmedTripManifest, currentManifest } from '../apps/web/src/utils/driverOperations.js';

const hubs = [{ id: 'origin', name: 'Trạm đi' }, { id: 'destination', name: 'Trạm đến' }];
const user = { id: 'owner-1', name: 'Chủ xe thử nghiệm' };
const now = new Date('2026-09-15T16:00:00Z');
const draft = {
  originHubId: 'origin', destinationHubId: 'destination', direction: 'binh_phuoc_to_tphcm',
  date: '2026-09-16', time: '05:00', capacity: 5, availableSeats: 4,
  pricingMode: 'contact', basePricePerSeat: 999000, pickupMode: 'hybrid', maxDetourKm: 3,
  pickupNotes: 'Có thể ghé gần trạm', carType: 'Xe kiểm thử', licensePlate: 'TEST-01',
  phoneReal: '+84 984 568 421', publicContactConsent: true
};
const build = (changes = {}, owner = user) => buildDriverTripPayload({ ...draft, ...changes }, owner, hubs, now);

test('driver operations only use trips owned by the authenticated identity', () => {
  const rows = [
    { id: 'mine', type: 'driver_offer', userId: user.id, status: 'full' },
    { id: 'other', type: 'driver_offer', userId: 'someone-else', phoneReal: draft.phoneReal },
    { id: 'closed', type: 'driver_offer', userId: user.id, status: 'cancelled' },
    { id: 'demand', type: 'passenger_request', userId: user.id }
  ];
  assert.deepEqual(ownedDriverTrips(rows, user.id).map((trip) => trip.id), ['mine']);
  assert.deepEqual(ownedDriverTrips(rows, null), []);
});

test('GPS must be fresh, finite and real; speed converts metres/sec to km/h', () => {
  const at = Date.now();
  const position = { timestamp: at, coords: { latitude: 11.3, longitude: 106.5, speed: 10, heading: null } };
  assert.deepEqual(realPositionPayload('mine', position, at), { tripId: 'mine', lat: 11.3, lng: 106.5, speed: 36, heading: null });
  assert.throws(() => realPositionPayload('mine', { ...position, timestamp: at - 16000 }, at), /GPS/);
  assert.throws(() => realPositionPayload('mine', { ...position, coords: { latitude: null, longitude: 106.5 } }, at), /GPS/);
  assert.throws(() => realPositionPayload('mine', { ...position, coords: { latitude: 91, longitude: 106.5 } }, at), /GPS/);
  assert.throws(() => realPositionPayload('', position, at), /GPS/);
});

test('unconfirmed and finished bookings are not displayed as current confirmed passengers', () => {
  const rows = [{ status: 'inquiring', bothConfirmed: false }, { status: 'confirmed', bothConfirmed: true }, { status: 'completed', bothConfirmed: true }, { status: 'cancelled', bothConfirmed: true }];
  assert.deepEqual(confirmedTripManifest({ manifest: rows }), [rows[1]]);
  assert.deepEqual(currentManifest([{ status: 'WAITING' }, { status: 'BOARDED' }, { status: 'COMPLETED' }]), [{ status: 'BOARDED' }]);
});

test('guest preview omits contact, pickup notes and vehicle identity', () => {
  const preview = buildDriverDemandPreview({ ...draft, userId: 'private-owner', contactName: 'Private name' });
  assert.equal(preview.originHubId, draft.originHubId);
  assert.equal(preview.availableSeats, 4);
  assert.equal(preview.basePricePerSeat, null);
  assert.equal(buildDriverDemandPreview({ ...draft, pricingMode: 'listed', basePricePerSeat: '175000' }).basePricePerSeat, 175000);
  for (const field of ['phoneReal', 'contactName', 'userId', 'licensePlate', 'carType', 'pickupNotes', 'publicContactConsent']) {
    assert.equal(Object.hasOwn(preview, field), false, field);
  }
});

test('contact means unknown price, never a platform tariff or zero', () => {
  const payload = build();
  assert.equal(payload.pricingMode, 'contact');
  assert.equal(payload.basePricePerSeat, null);
  assert.equal(payload.phoneReal, '0984568421');
});
test('a listed owner price survives unchanged', () => {
  assert.equal(build({ pricingMode: 'listed', basePricePerSeat: '175000' }).basePricePerSeat, 175000);
  assert.throws(() => build({ pricingMode: 'listed', basePricePerSeat: '' }), /giá/);
});
test('no publishable trip without an authenticated owner or contact consent', () => {
  assert.throws(() => build({}, null), /Đăng nhập/);
  assert.throws(() => build({ publicContactConsent: false }), /liên hệ/);
});
test('capacity counts the owner and never silently clamps oversold seats', () => {
  assert.equal(build({ capacity: 7, availableSeats: 6 }).availableSeats, 6);
  assert.throws(() => build({ capacity: 5, availableSeats: 5 }), /Số chỗ/);
});
test('vehicle details cannot fall back to an invented car', () => {
  assert.throws(() => build({ carType: '', licensePlate: '' }), /xe và biển số/);
});
test('hybrid detour conditions survive and station-only has no detour', () => {
  assert.equal(build().maxDetourKm, 3);
  assert.equal(build({ pickupMode: 'station', maxDetourKm: 10 }).maxDetourKm, 0);
  assert.throws(() => build({ maxDetourKm: -1 }), /đi vòng/);
});
test('departure is interpreted in Vietnam time across UTC midnight', () => {
  assert.equal(vietnamDate(new Date('2026-09-15T18:00:00Z')), '2026-09-16');
  assert.throws(() => build({ date: '2026-09-15', time: '22:59' }), /tương lai/);
});
test('authentication continuation is consumed before asynchronous work finishes', async () => {
  const pending = createAuthContinuation();
  let calls = 0;
  pending.set(async (owner) => { calls++; await Promise.resolve(); return build({}, owner); });
  const action = pending.take();
  const operation = action(user);
  assert.equal(pending.take(), null);
  assert.equal((await operation).userId, user.id);
  assert.equal(calls, 1);
});
test('closing authentication discards a pending publish action', () => {
  const pending = createAuthContinuation();
  pending.set(() => assert.fail('A dismissed action must not run'));
  pending.clear();
  assert.equal(pending.take(), null);
});
