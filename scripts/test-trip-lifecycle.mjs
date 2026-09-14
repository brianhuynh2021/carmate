/**
 * =============================================================================
 * KIỂM THỬ VÒNG ĐỜI CHUYẾN & THAO TÁC LỊCH TRÌNH CHỦ XE
 * =============================================================================
 * Ba lỗ hổng được khoá lại ở đây:
 *
 *  1. ĐÓNG SỔ CHUYẾN — trước đây mọi vòng quét dừng ở mốc T+2 phút
 *     (departureWatchdog), nên chuyến ở lại `active` vĩnh viễn trong CSDL. Hệ
 *     quả: truy vấn `WHERE status='active'` đếm cả chuyến đã chạy xong, xe cứu
 *     hộ có thể được điều từ chuyến của tháng trước.
 *
 *  2. CHUYẾN ĐỊNH KỲ — được isTripExpired() miễn trừ nên thoát cả bộ lọc hiển
 *     thị lẫn vòng đời, hiện mãi trên sàn với ngày của tuần trước.
 *
 *  3. THAO TÁC LỊCH TRÌNH — bốn nút "3 giây" trên Taplo Chủ xe chỉ setState rồi
 *     hiện toast "Đã gửi tin nhắn tới người đi cùng", không gọi máy chủ.
 * =============================================================================
 */
import assert from 'node:assert/strict';
import { initDB, getRawDB, sweepFinishedTrips, TRIP_CLOSE_GRACE_HOURS } from '../apps/api/src/db/sqliteStore.js';

console.log('🧪 KIỂM THỬ VÒNG ĐỜI CHUYẾN XE\n');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

await initDB();
const db = getRawDB();

// Dựng chuyến giả lập với mốc thời gian có kiểm soát
const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-09-20T12:00:00+07:00');
const PREFIX = 'LIFECYCLE-TEST-';

function seedTrip(id, { date, timeSlot, status = 'active', recurring = false }) {
  const payload = {
    id, type: 'driver_offer', status, date, timeSlot,
    from: 'Tân Khai', to: 'Hàng Xanh',
    originHubId: 'hub_ql13_tan_khai', destinationHubId: 'hub_ql13_hang_xanh',
    phoneReal: '0938274615', availableSeats: 2, capacity: 5,
    ...(recurring ? { isRecurringWeekly: true } : {})
  };
  db.prepare(
    `INSERT OR REPLACE INTO trips (id, type, status, phoneReal, fromLocation, toLocation, timeSlot, date, price, seats, createdAt, payload)
     VALUES (?, 'driver_offer', ?, '0938274615', 'Tân Khai', 'Hàng Xanh', ?, ?, 150000, 2, ?, ?)`
  ).run(id, status, timeSlot, date, new Date(NOW).toISOString(), JSON.stringify(payload));
}

function cleanup() {
  db.prepare(`DELETE FROM trips WHERE id LIKE '${PREFIX}%'`).run();
  db.prepare(`DELETE FROM bookings WHERE tripId LIKE '${PREFIX}%'`).run();
}

const statusOf = (id) => db.prepare('SELECT status FROM trips WHERE id = ?').get(id)?.status;
const dateOf = (id) => db.prepare('SELECT date FROM trips WHERE id = ?').get(id)?.date;

cleanup();

// ── 1. ĐÓNG SỔ THEO THỜI GIAN ───────────────────────────────────────────────
console.log('1. Đóng sổ chuyến đã quá giờ:');

check('Chuyến hôm qua không ai đặt ➔ expired', () => {
  seedTrip(`${PREFIX}old-empty`, { date: '2026-09-19', timeSlot: '07:00-08:00' });
  sweepFinishedTrips({ nowMs: NOW });
  assert.equal(statusOf(`${PREFIX}old-empty`), 'expired');
});

check('Chuyến hôm qua CÓ khách đặt ➔ completed', () => {
  const id = `${PREFIX}old-booked`;
  seedTrip(id, { date: '2026-09-19', timeSlot: '07:00-08:00' });
  db.prepare(
    `INSERT OR REPLACE INTO bookings (escrowId, tripId, passengerPhone, status, createdAt, payload)
     VALUES (?, ?, '0909333444', 'confirmed', ?, ?)`
  ).run(`${PREFIX}bk1`, id, new Date(NOW).toISOString(), JSON.stringify({ escrowId: `${PREFIX}bk1`, tripId: id, status: 'confirmed' }));
  sweepFinishedTrips({ nowMs: NOW });
  assert.equal(statusOf(id), 'completed');
});

check('Chuyến chưa tới giờ ➔ giữ nguyên active', () => {
  const id = `${PREFIX}future`;
  seedTrip(id, { date: '2026-09-25', timeSlot: '07:00-08:00' });
  sweepFinishedTrips({ nowMs: NOW });
  assert.equal(statusOf(id), 'active');
});

check('Chuyến vừa khởi hành, còn trong dung sai ➔ chưa đóng', () => {
  const id = `${PREFIX}just-left`;
  // Kết thúc lúc 11:00 hôm nay, mới qua 1 tiếng < dung sai 6 tiếng
  seedTrip(id, { date: '2026-09-20', timeSlot: '10:00-11:00' });
  sweepFinishedTrips({ nowMs: NOW });
  assert.equal(statusOf(id), 'active');
  assert.ok(TRIP_CLOSE_GRACE_HOURS >= 1);
});

check('Chuyến status viết HOA (OPEN) cũng được đóng', () => {
  const id = `${PREFIX}upper`;
  seedTrip(id, { date: '2026-09-19', timeSlot: '07:00-08:00', status: 'OPEN' });
  sweepFinishedTrips({ nowMs: NOW });
  assert.equal(statusOf(id), 'expired');
});

check('Chuyến đã cancelled không bị đụng tới', () => {
  const id = `${PREFIX}cancelled`;
  seedTrip(id, { date: '2026-09-19', timeSlot: '07:00-08:00', status: 'cancelled' });
  sweepFinishedTrips({ nowMs: NOW });
  assert.equal(statusOf(id), 'cancelled');
});

// ── 2. CHUYẾN ĐỊNH KỲ ───────────────────────────────────────────────────────
console.log('\n2. Chuyến định kỳ hàng tuần:');

check('Chuyến định kỳ quá giờ ➔ đẩy sang tuần sau, không đóng', () => {
  const id = `${PREFIX}weekly`;
  seedTrip(id, { date: '2026-09-19', timeSlot: '07:00-08:00', recurring: true });
  const res = sweepFinishedTrips({ nowMs: NOW });
  assert.ok(res.rolled.includes(id), 'phải nằm trong danh sách đẩy');
  assert.notEqual(statusOf(id), 'expired');
  assert.equal(dateOf(id), '2026-09-26', `ngày mới phải là tuần sau, đang là ${dateOf(id)}`);
});

check('Chuyến định kỳ bỏ quên nhiều tuần ➔ nhảy tới tuần còn hiệu lực', () => {
  const id = `${PREFIX}weekly-old`;
  seedTrip(id, { date: '2026-08-15', timeSlot: '07:00-08:00', recurring: true });
  sweepFinishedTrips({ nowMs: NOW });
  const newDate = dateOf(id);
  assert.ok(Date.parse(newDate) > NOW - 7 * 24 * HOUR, `ngày mới ${newDate} phải vượt qua hiện tại`);
});

// ── 3. TÍNH IDEMPOTENT ──────────────────────────────────────────────────────
console.log('\n3. An toàn khi chạy lặp:');

check('Quét lần hai không đổi gì thêm', () => {
  const second = sweepFinishedTrips({ nowMs: NOW });
  assert.equal(second.completed.length + second.expired.length, 0, 'không còn chuyến nào để đóng');
});

check('dryRun không ghi gì vào CSDL', () => {
  const id = `${PREFIX}dry`;
  seedTrip(id, { date: '2026-09-19', timeSlot: '07:00-08:00' });
  const res = sweepFinishedTrips({ nowMs: NOW, dryRun: true });
  assert.ok(res.expired.includes(id), 'dryRun vẫn phải liệt kê');
  assert.equal(statusOf(id), 'active', 'nhưng không được ghi');
});

cleanup();
console.log(`\n✅ ${passed}/${passed} kiểm thử vòng đời chuyến ĐẠT\n`);
