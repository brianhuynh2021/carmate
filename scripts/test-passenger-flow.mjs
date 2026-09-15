import test from 'node:test';
import assert from 'node:assert/strict';
import { requestDeadline } from '@carmate/shared';
import { parseIntentTimeWindow, buildIntentTimeWindow, listedPrice, priceLabel, publicContactPhone, pickupLabel, freshnessLabel, departureChipTimeRange, bookingPickupWindow } from '../apps/web/src/components/market/tripPresentation.js';

const now = Date.parse('2026-09-15T00:00:00+07:00');
test('an evening search keeps its whole 18–22 window and API deadline', () => {
  const initial = parseIntentTimeWindow('18:00-22:00');
  assert.deepEqual(initial, { time: '18:00', durationMinutes: 240 });
  const window = buildIntentTimeWindow('2026-09-15', initial.time, initial.durationMinutes);
  assert.equal(window.timeSlot, '18:00-22:00');
  assert.equal(requestDeadline({ date: '2026-09-15', ...window }, now), Date.parse('2026-09-15T22:00:00+07:00'));
});
test('overnight search retains the following morning as its deadline', () => {
  const initial = parseIntentTimeWindow('22:00-04:00');
  assert.equal(initial.durationMinutes, 360);
  const window = buildIntentTimeWindow('2026-09-15', initial.time, initial.durationMinutes);
  assert.equal(requestDeadline({ date: '2026-09-15', ...window }, now), Date.parse('2026-09-16T04:00:00+07:00'));
});
test('explicit waiting selection extends the API range rather than being capped to 30 minutes', () => {
  const window = buildIntentTimeWindow('2026-09-15', '18:00', 120);
  assert.equal(window.timeSlot, '18:00-20:00');
  assert.equal(requestDeadline({ date: '2026-09-15', ...window }, now), Date.parse('2026-09-15T20:00:00+07:00'));
  assert.equal(window.departureTime, undefined);
});
test('all-day search and partially elapsed ranges are preserved', () => {
  assert.deepEqual(parseIntentTimeWindow('all'), { time: '00:00', durationMinutes: 1439 });
  assert.deepEqual(parseIntentTimeWindow('18:47-22:00'), { time: '18:47', durationMinutes: 193 });
});
test('unknown or legacy formula prices are not quoted; a listed zero is valid', () => {
  assert.equal(listedPrice({ pricePerSeat: 165000 }), null);
  assert.equal(listedPrice({ pricingMode: 'contact', basePricePerSeat: 165000 }), null);
  assert.equal(listedPrice({ pricingMode: 'listed', basePricePerSeat: 0 }), 0);
});
test('private or masked contact fields never become public call links', () => {
  assert.equal(publicContactPhone({ phoneReal: '0901234567' }), '');
  assert.equal(publicContactPhone({ publicContactPhone: '090***4567' }), '');
  assert.equal(publicContactPhone({ publicContactPhone: '0901 234 567' }), '0901234567');
});


test('departure chips retain their labelled end, including partial and overnight chips', () => {
  assert.equal(departureChipTimeRange({timeSlot:'18:00', toHour:22}), '18:00-22:00');
  assert.equal(departureChipTimeRange({timeSlot:'18:47', toHour:22}), '18:47-22:00');
  assert.equal(departureChipTimeRange({timeSlot:'22:00', toHour:28}), '22:00-04:00');
});

test('the selected matrix pickup window survives the booking request', () => {
  assert.deepEqual(bookingPickupWindow({pickupStartAt:'2026-09-15T22:00:00+07:00', pickupEndAt:'2026-09-16T00:45:00+07:00'}), {
    pickupStartAt:'2026-09-15T15:00:00.000Z', pickupEndAt:'2026-09-15T17:45:00.000Z', timeSlot:'22:00-00:45'
  });
  assert.deepEqual(bookingPickupWindow({pickupStartAt:'bad',pickupEndAt:null}), {});
});

test('the eleven presentation invariants remain true', () => {
  assert.equal(listedPrice({pricePerSeat:165000}), null);
  assert.equal(priceLabel({pricingMode:'contact',basePricePerSeat:165000}), 'Liên hệ');
  assert.equal(listedPrice({pricingMode:'listed',basePricePerSeat:0}), 0);
  assert.equal(listedPrice({pricingMode:'listed',basePricePerSeat:null}), null);
  assert.equal(listedPrice({pricingMode:'listed',basePricePerSeat:125000}), 125000);
  assert.equal(listedPrice({pricingMode:'listed',basePricePerSeat:'bad'}), null);
  assert.equal(publicContactPhone({phone:'0901234567',phoneReal:'0901234567'}), '');
  assert.equal(publicContactPhone({publicContactPhone:'090***4567'}), '');
  assert.equal(publicContactPhone({publicContactPhone:'0901 234 567'}), '0901234567');
  assert.equal(freshnessLabel({}), 'Chưa có thời điểm cập nhật');
  assert.equal(pickupLabel('hybrid'), 'Trạm hoặc điểm hẹn linh hoạt');
  assert.match(freshnessLabel({lastUpdatedAt:'2026-09-15T10:15:00+07:00'}), /^Cập nhật /);
});
