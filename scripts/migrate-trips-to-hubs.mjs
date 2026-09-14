/**
 * =============================================================================
 * DI TRÚ CHUYẾN CŨ VỀ TỌA ĐỘ TRẠM ẢO (LEGACY TRIP -> HUB COORDINATES)
 * =============================================================================
 * Chuyến đăng trước đây lưu điểm đi/đến bằng chữ người dùng tự gõ và giá do
 * Chủ xe tự nhập. Kể từ khi giá là ĐẦU RA của công thức và trạm là TỌA ĐỘ trong
 * ma trận thời gian - không gian, những chuyến đó thiếu mã trạm nên:
 *   - không tính lại được cước phân đoạn,
 *   - không chiếu được lên hành lang (Frenet) để dựng tầng FORMING,
 *   - mở form sửa chuyến sẽ thấy ô trạm trống.
 *
 * Script này dò ngược chữ tự do về mã trạm, gắn originHubId/destinationHubId
 * rồi tính lại giá theo đúng công thức đang áp dụng.
 *
 * Chạy thử (không ghi gì):  node scripts/migrate-trips-to-hubs.mjs
 * Ghi thật:                 node scripts/migrate-trips-to-hubs.mjs --apply
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
 * Dò một chuỗi địa danh tự do về mã trạm ảo.
 * Ưu tiên tên trạm dài (cụ thể) nhất để "ngã 4 bình phước" không bị
 * "bình phước" nuốt mất — cùng nguyên tắc với gazetteer của timeSlotMatrix.
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

// Chuyến mẫu (seed) là nguồn chuẩn: mockData đã gắn sẵn mã trạm và giá đúng
// công thức, nên lấy thẳng payload mới thay vì dò ngược từ chữ tự do.
const SEED_BY_ID = new Map(
  [...INITIAL_DRIVER_OFFERS, ...INITIAL_PASSENGER_REQUESTS].map((t) => [t.id, t])
);
// Chuyến mẫu của tuyến đã bị gỡ khỏi mockData (ngoài hành lang có trạm ảo):
// giữ lại trong CSDL là bịa ra tuyến nền tảng không phục vụ được.
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

  // 3a. Chuyến mẫu của tuyến đã gỡ -> xoá khỏi CSDL
  if (isStaleSeed(row.id)) {
    stale.push({ id: row.id, from: payload.from || row.fromLocation, to: payload.to || row.toLocation });
    continue;
  }

  // 3b. Chuyến mẫu còn hiệu lực -> lấy thẳng payload chuẩn từ mockData.
  // So sánh "đã đúng chưa" phải dựa trên payload ĐANG NẰM TRONG CSDL, nên giữ
  // bản gốc lại; trộn seed vào chỉ để dựng payload mới sẽ ghi xuống.
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
  // Giá chuyến Chủ xe là đầu ra công thức. Bài tìm xe của khách giữ nguyên mức
  // mong muốn của họ — đó là nguyện vọng, không phải giá bán.
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
  // Cột targetTripId chỉ có ở một số bản CSDL, nên dò trước khi dựng câu lệnh.
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
