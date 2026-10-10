/**
 * =============================================================================
 * MIGRATE LEGACY TRIPS TO VIRTUAL STATION COORDINATES (LEGACY TRIP -> HUB COORDINATES)
 * =============================================================================
 * Previously, posted trips stored the origin/destination as free text typed by the user, and the price was
 * entered by the driver. Now that the price is an OUTPUT of the formula and stations are COORDINATES in the
 * space-time matrix, those trips lack a station code, so:
 *   - segment fares cannot be recomputed,
 *   - they cannot be projected onto the corridor (Frenet) to build the FORMING tier,
 *   - opening the trip edit form shows an empty station field.
 *
 * This script reverse-resolves the free text to a station code, sets originHubId/destinationHubId,
 * then recomputes the price using the formula currently in effect.
 *
 * Dry run (writes nothing):  node scripts/migrate-trips-to-hubs.mjs
 * Real write:                node scripts/migrate-trips-to-hubs.mjs --apply
 * =============================================================================
 */
import Database from 'better-sqlite3';
import path from 'path';
import {
  VIRTUAL_HUBS,
  getVirtualHubById,
  getFixedSegmentTariff,
  INITIAL_DRIVER_OFFERS,
  INITIAL_PASSENGER_REQUESTS
} from '../packages/shared/src/index.js';

const APPLY = process.argv.includes('--apply');
const DB_PATH = path.resolve(process.cwd(), 'apps/api/data/carmate.sqlite');

/**
 * Resolves a free-form place-name string to a virtual station code.
 * Prefers the longest (most specific) station name so "ngã 4 bình phước" is not swallowed by
 * "bình phước" — same principle as the gazetteer in timeSlotMatrix.
 */
function resolveHubId(explicitHubId, ...freeTexts) {
  if (explicitHubId && getVirtualHubById(explicitHubId)) return explicitHubId;

  const candidates = VIRTUAL_HUBS.map((h) => ({
    hub: h,
    keys: [h.shortName, h.name, h.landmark].filter(Boolean).map((k) => String(k).toLowerCase())
  })).sort((a, b) => Math.max(...b.keys.map((k) => k.length)) - Math.max(...a.keys.map((k) => k.length)));

  for (const text of freeTexts) {
    const raw = String(text || '').trim().toLowerCase();
    if (!raw) continue;
    const hit = candidates.find((c) => c.keys.some((k) => raw.includes(k) || k.includes(raw)));
    if (hit) return hit.hub.id;
  }
  return '';
}

const db = new Database(DB_PATH);
const rows = db.prepare('SELECT id, type, status, fromLocation, toLocation, price, payload FROM trips').all();

// Seed trips are the source of truth: mockData already carries the station codes and formula-correct
// prices, so take the new payload directly instead of reverse-resolving from free text.
const SEED_BY_ID = new Map(
  [...INITIAL_DRIVER_OFFERS, ...INITIAL_PASSENGER_REQUESTS].map((t) => [t.id, t])
);
// Seed trip on a route that was removed from mockData (outside the corridor with virtual stations):
// keeping it in the DB would invent a route the platform cannot serve.
const isStaleSeed = (id) => /^(DRV|REQ)-\d+$/.test(id) && !SEED_BY_ID.has(id);

console.log(`\n🔎 Quét ${rows.length} chuyến trong CSDL${APPLY ? ' (GHI THẬT)' : ' (CHẠY THỬ — không ghi gì)'}\n`);

const migrated = [];
const alreadyOk = [];
const failed = [];
const stale = [];

for (const row of rows) {
  let payload = {};
  try {
    payload = JSON.parse(row.payload || '{}');
  } catch {
    failed.push({ id: row.id, reason: 'payload hỏng, không đọc được JSON' });
    continue;
  }

  // 3a. Seed trip on a removed route -> delete from the DB
  if (isStaleSeed(row.id)) {
    stale.push({ id: row.id, from: payload.from || row.fromLocation, to: payload.to || row.toLocation });
    continue;
  }

  // 3b. Seed trip still valid -> take the canonical payload straight from mockData.
  // The "is it already correct" comparison must be based on the payload CURRENTLY IN THE DB, so keep
  // the original; merging the seed in only builds the new payload that will be written.
  const seed = SEED_BY_ID.get(row.id);
  const dbPayload = payload;
  if (seed) payload = { ...payload, ...seed };

  const from = payload.from || row.fromLocation || '';
  const to = payload.to || row.toLocation || '';

  const originHubId = resolveHubId(payload.originHubId, from, payload.pickupSpot);
  const destHubId = resolveHubId(payload.destinationHubId, to, payload.dropoffSpot);

  if (!originHubId || !destHubId || originHubId === destHubId) {
    failed.push({
      id: row.id,
      reason: 'không dò được cặp trạm',
      from,
      to,
      got: `${originHubId || '∅'} / ${destHubId || '∅'}`
    });
    continue;
  }

  const tariff = getFixedSegmentTariff(originHubId, destHubId);
  const oldPrice = payload.basePricePerSeat ?? payload.expectedPrice ?? row.price ?? null;
  const isDriver = row.type !== 'passenger_request';

  const hadHubs = dbPayload.originHubId === originHubId && dbPayload.destinationHubId === destHubId;
  const priceMatches = isDriver ? dbPayload.basePricePerSeat === tariff.pricePerSeat : true;
  if (hadHubs && priceMatches) {
    alreadyOk.push(row.id);
    continue;
  }

  const next = { ...payload, originHubId, destinationHubId: destHubId, distanceKm: tariff.distanceKm };
  // A driver trip's price is a formula output. A passenger's ride search keeps their
  // desired price — that is a wish, not a selling price.
  if (isDriver) next.basePricePerSeat = tariff.pricePerSeat;

  migrated.push({
    id: row.id,
    type: row.type,
    route: `${getVirtualHubById(originHubId).shortName} ➔ ${getVirtualHubById(destHubId).shortName}`,
    distanceKm: tariff.distanceKm,
    oldPrice,
    newPrice: isDriver ? tariff.pricePerSeat : oldPrice,
    payload: next
  });
}

if (migrated.length > 0) {
  console.log('📦 Sẽ cập nhật:');
  for (const m of migrated) {
    const priceNote =
      m.oldPrice === m.newPrice ? `${m.newPrice}đ (giữ nguyên)` : `${m.oldPrice ?? '∅'}đ ➔ ${m.newPrice}đ`;
    console.log(`   ${m.id.padEnd(28)} ${m.route.padEnd(46)} ${String(m.distanceKm).padStart(3)}km  ${priceNote}`);
  }
  console.log();
}

if (stale.length > 0) {
  console.log('🗑️  Chuyến mẫu của tuyến đã gỡ (sẽ xoá khỏi CSDL):');
  for (const t of stale) console.log(`   ${t.id.padEnd(28)} ${t.from} ➔ ${t.to}`);
  console.log();
}

if (alreadyOk.length > 0) {
  console.log(`✅ Đã đúng sẵn, bỏ qua: ${alreadyOk.length} chuyến\n`);
}

if (failed.length > 0) {
  console.log('⚠️  Không dò được trạm (giữ nguyên, cần xử lý tay):');
  for (const f of failed) {
    console.log(`   ${f.id.padEnd(28)} ${f.reason}`);
    if (f.from) console.log(`      ${JSON.stringify(f.from)} ➔ ${JSON.stringify(f.to)}   dò được: ${f.got}`);
  }
  console.log();
}

if (APPLY && (migrated.length > 0 || stale.length > 0)) {
  const upd = db.prepare('UPDATE trips SET payload = ?, price = ? WHERE id = ?');
  const delTrip = db.prepare('DELETE FROM trips WHERE id = ?');
  // The targetTripId column only exists in some DB versions, so probe for it before building the statement.
  const bookingCols = db.prepare('PRAGMA table_info(bookings)').all().map((c) => c.name);
  const delBooking = bookingCols.includes('targetTripId')
    ? db.prepare('DELETE FROM bookings WHERE tripId = ? OR targetTripId = ?')
    : db.prepare('DELETE FROM bookings WHERE tripId = ?');
  const delBookingArgs = bookingCols.includes('targetTripId') ? (id) => [id, id] : (id) => [id];

  const run = db.transaction(() => {
    for (const m of migrated) upd.run(JSON.stringify(m.payload), m.newPrice ?? null, m.id);
    for (const t of stale) {
      delBooking.run(...delBookingArgs(t.id));
      delTrip.run(t.id);
    }
  });
  run();
  if (migrated.length > 0) console.log(`✍️  Đã cập nhật ${migrated.length} chuyến.`);
  if (stale.length > 0) console.log(`🗑️  Đã xoá ${stale.length} chuyến mẫu ngoài hành lang.`);
  console.log();
} else if (migrated.length > 0 || stale.length > 0) {
  console.log('ℹ️  Chạy lại với cờ --apply để ghi thật.\n');
}

db.close();
