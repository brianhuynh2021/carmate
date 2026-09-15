import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safeSourceUrl, operatorPhone, operatorFreshness, ownerPatch, parseCoverage,
  parseReceipts, mergeReceipt, parseCopiedReceipt, ownerStateLabel
} from '../apps/web/src/components/operators/operatorPresentation.js';

test('public source links accept HTTP(S) without credentials only', () => {
  assert.equal(safeSourceUrl('https://example.com/source'), 'https://example.com/source');
  assert.equal(safeSourceUrl('http://example.com'), 'http://example.com/');
  for (const value of ['javascript:alert(1)', 'data:text/html,bad', '/relative', '//example.com', 'https://user:secret@example.com', '', null]) assert.equal(safeSourceUrl(value), null);
});

test('only usable phone values become telephone links', () => {
  assert.equal(operatorPhone('0901 234 567'), '0901234567');
  assert.equal(operatorPhone('+84 (901) 234-567'), '+84901234567');
  for (const value of ['090xxx4567', 'tel:0901234567', '1234', '09+01234567', undefined]) assert.equal(operatorPhone(value), null);
});

test('expired, missing and contradictory review dates cannot appear current', () => {
  const now = Date.parse('2026-09-15T10:00:00Z');
  const valid = { checkedAt: '2026-09-14T10:00:00Z', freshUntil: '2026-09-16T10:00:00Z', freshness: 'fresh' };
  assert.equal(operatorFreshness(valid, now).state, 'fresh');
  assert.equal(operatorFreshness({ ...valid, freshUntil: '2026-09-15T10:00:00Z' }, now).state, 'stale');
  assert.equal(operatorFreshness({ ...valid, freshness: 'stale' }, now).state, 'stale');
  assert.equal(operatorFreshness({ ...valid, checkedAt: null }, now).state, 'unknown');
  assert.equal(operatorFreshness({ ...valid, freshUntil: null }, now).state, 'unknown');
  assert.equal(operatorFreshness({ ...valid, checkedAt: '2026-09-17T10:00:00Z' }, now).state, 'unknown');
  assert.equal(operatorFreshness({ ...valid, freshness: 'unreviewed' }, now).state, 'unknown');
});

test('owner edits contain only five permitted fields and contact mode has no stale quoted price', () => {
  const patch = ownerPatch({ coverage: '  Hớn Quản\nSài Gòn,Hớn Quản ', scheduleNote: ' sáng ', pickupNote: ' liên hệ ', pricingMode: 'contact', priceNote: 'old price', checkedAt: 'forged', source: { url: 'forged' }, ownerUserId: 'other', contactPhone: 'private' });
  assert.deepEqual(patch, { coverage: ['Hớn Quản', 'Sài Gòn'], scheduleNote: 'sáng', pickupNote: 'liên hệ', pricingMode: 'contact', priceNote: '' });
  assert.equal(ownerPatch({ pricingMode: 'listed', priceNote: ' 100.000đ / ghế ' }).priceNote, '100.000đ / ghế');
  assert.deepEqual(parseCoverage(''), []);
});

test('private report receipts can be restored without accepting malformed or oversized credentials', () => {
  const receipt = { id: 'report-example', accessToken: 'test-private-token' };
  assert.deepEqual(parseCopiedReceipt(JSON.stringify({ ...receipt, status: 'forged' })), receipt);
  for (const value of ['bad json', '[]', '{}', '{"id":"report-example"}', JSON.stringify({ ...receipt, accessToken: 'x'.repeat(201) })]) assert.equal(parseCopiedReceipt(value), null);
  assert.deepEqual(parseReceipts('invalid'), []);
  assert.deepEqual(parseReceipts(JSON.stringify([receipt, { id: 'missing-token' }])), [receipt]);
  assert.equal(mergeReceipt([receipt], { ...receipt, status: 'resolved' }).length, 1);
  assert.equal(mergeReceipt([receipt], { ...receipt, status: 'resolved' })[0].status, 'resolved');
  assert.equal(ownerStateLabel('unexpected'), 'Chưa rõ trạng thái');
  assert.equal(ownerStateLabel('pending'), 'Chờ kiểm tra');
});
