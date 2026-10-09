/**
 * TIME-SLOTTED CORRIDOR MATRIX TEST
 *
 * The most important invariant checked here: THE SCREEN IS NEVER EMPTY.
 * An intercity passenger who searches for a trip and gets back an empty list is lost for good.
 */

import assert from 'node:assert';
import { initDB, addTrip, deleteTrip } from '../apps/api/src/db/sqliteStore.js';
import { buildTimeSlotMatrix, buildCorridorTimeline, MATRIX_CONFIG } from '../apps/api/src/services/timeSlotMatrix.js';
import { telemetryPing, resetAllStationData } from '../apps/api/src/services/stationQueueService.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  console.log(`✅ ${label}`);
  passed += 1;
}

console.log('\n🧪 KIỂM THỬ MA TRẬN KHE THỜI GIAN\n');

await initDB();
resetAllStationData();

// ── 1. Invariant: never empty ─────────────────────────────────────────
console.log('── 1. BẤT BIẾN "KHÔNG BAO GIỜ TRỐNG" ──');

const oddHour = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  timeSlot: '02:47', // an hour that surely has no trips
  seatsNeeded: 1
});

ok(oddHour.success, 'Dựng được ma trận cho giờ hiếm 02:47');
ok(oddHour.slots.length > 0, 'Giờ không ai chạy vẫn trả về khe — màn hình không trống');
ok(oddHour.isEmpty === false, 'Cờ isEmpty luôn false theo thiết kế');
ok(oddHour.counts.shadow > 0, 'Thiếu chuyến thật thì bù bằng khe dự phòng');

// ── 2. CONFIRMED tier ─────────────────────────────────────────────────
console.log('\n── 2. TẦNG 🟢 CONFIRMED ──');

const early = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  timeSlot: '05:30',
  seatsNeeded: 1
});

ok(early.counts.confirmed >= 1, 'Tìm thấy chuyến thật trong cửa sổ ±30 phút');
const conf = early.slots.find((s) => s.tier === 'CONFIRMED');
ok(conf.certainty === 1.0, 'Chuyến đã có thật mang độ chắc chắn tuyệt đối');
ok(conf.action === 'CONFIRM_NOW', 'Hành động là xác nhận đi ngay, không phải chờ ghép');
ok(conf.seatsAvailable > 0, 'Đọc đúng số ghế còn trống (availableSeats, không phải seats)');
ok(conf.pricePerSeat > 0, 'Đọc đúng giá mỗi ghế (basePricePerSeat)');

// The ±30-minute window must exclude trips too far from the passenger's desired time
const noon = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  timeSlot: '12:00',
  seatsNeeded: 1
});
const noonHas5am = noon.slots.some((s) => s.tier === 'CONFIRMED' && s.departureLabel === '05:00');
ok(!noonHas5am, 'Chuyến 05:00 KHÔNG lọt vào kết quả cho giờ muốn 12:00 (cửa sổ ±30 phút)');

// A request for more seats than remain available -> must be excluded
const bigGroup = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  timeSlot: '05:30',
  seatsNeeded: 4
});
ok(bigGroup.counts.confirmed < early.counts.confirmed || bigGroup.counts.confirmed === 0,
   'Nhóm 4 người không được ghép vào xe chỉ còn 1 ghế');

// ── 3. FORMING tier ───────────────────────────────────────────────────
console.log('\n── 3. TẦNG 🔵 FORMING (xe đang lăn bánh) ──');

const before = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  seatsNeeded: 1
});
ok(before.counts.forming === 0, 'Chưa có xe nào chạy -> chưa có tầng FORMING');

// The vehicle is at Chơn Thành (s=56.5), about 28km from Bàu Bàng (s=84.5)
// A Cockpit session only appears on the marketplace when tied to a REAL post: a made-up trip id
// once produced a "ghost vehicle" that passengers could neither look up nor book. So the test
// must create a real trip first, just like the driver's flow in real life.
const liveTripId = `DRV-TEST-LIVE-${Date.now()}`;
const passedTripId = `DRV-TEST-PASSED-${Date.now()}`;
await addTrip({
  id: liveTripId,
  type: 'driver_offer',
  status: 'active',
  from: 'Bàu Bàng',
  to: 'Hàng Xanh',
  date: 'Hôm nay',
  timeSlot: '05:00-07:00',
  availableSeats: 3,
  capacity: 7,
  basePricePerSeat: 150000,
  phoneReal: '0913000001',
  carType: 'Toyota Innova'
});
await addTrip({
  id: passedTripId,
  type: 'driver_offer',
  status: 'active',
  from: 'Bàu Bàng',
  to: 'Hàng Xanh',
  date: 'Hôm nay',
  timeSlot: '05:00-07:00',
  availableSeats: 3,
  capacity: 7,
  basePricePerSeat: 150000,
  phoneReal: '0913000002',
  carType: 'Toyota Vios'
});

telemetryPing({
  tripId: liveTripId, driverPhone: '0913000001', driverName: 'Anh Sơn',
  plate: '61A-777.77', vehicleModel: 'Toyota Innova', seatsAvailable: 3,
  lat: 11.4791, lng: 106.6694, speed: 58
});

const withLive = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  seatsNeeded: 1
});

ok(withLive.counts.forming === 1, 'Xe đang chạy trên hành lang hiện thành tầng FORMING');
const forming = withLive.slots.find((s) => s.tier === 'FORMING');
ok(forming.etaMs > Date.now(), 'ETA là mốc trong tương lai, tính từ phân phối ngẫu nhiên');
ok(forming.etaSigmaMinutes > 0, 'Công khai độ bất định sigma thay vì giả vờ chắc chắn');
ok(forming.distanceKm > 20 && forming.distanceKm < 35, `Cự ly ${forming.distanceKm}km khớp vị trí thực`);
ok(forming.action === 'RESERVE_PRIORITY', 'Hành động là đặt chỗ ưu tiên, hệ thống tự khoá');
ok(forming.certainty < 1.0, 'Độ chắc chắn thấp hơn chuyến đã có thật');

// A vehicle that has already PASSED the station must not be counted
telemetryPing({
  tripId: passedTripId, driverPhone: '0913000002', plate: '61A-888.88',
  seatsAvailable: 3, lat: 10.8525, lng: 106.7214, speed: 45 // Ngã 4 Bình Phước, s=132.5
});
const afterPass = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  seatsNeeded: 1
});
ok(afterPass.counts.forming === 1, 'Xe đã vượt qua trạm KHÔNG được đưa vào kết quả');

// ── 4. Price & accompanying info ──────────────────────────────────────
console.log('\n── 4. GIÁ VÀ THÔNG TIN TRẠM ──');

ok(withLive.tariff && withLive.tariff.pricePerSeat > 0, 'Trả kèm giá vé, giao diện không cần gọi thêm lượt');
ok(withLive.tariff.total === withLive.tariff.pricePerSeat * withLive.seatsNeeded, 'Tổng tiền khớp số ghế');
ok(withLive.station != null, 'Trả kèm tình trạng hàng đợi tại trạm');
ok(withLive.windowMinutes === MATRIX_CONFIG.NEIGHBOR_WINDOW_MINUTES, 'Công khai cửa sổ ±30 phút đang dùng');

// ── 5. Invalid input ──────────────────────────────────────────────────
console.log('\n── 5. ĐẦU VÀO KHÔNG HỢP LỆ ──');

const bad = buildTimeSlotMatrix({ originHubId: 'hub_khong_ton_tai', destinationHubId: 'hub_ql13_hang_xanh' });
ok(bad.success === false, 'Trạm không tồn tại -> báo lỗi rõ ràng, không ném exception');

// ── 6. REGRESSION GUARD: LEG AND DIRECTION FILTER ────────────────────
console.log('\n── 6. LỌC ĐÚNG CHẶNG VÀ CHIỀU ĐI ──');

// Old bug: the CONFIRMED tier did not filter by station pair, so EVERY trip on the marketplace
// showed up as "🟢 chắc chắn 100%" ("100% certain") for whichever leg the passenger searched.
const southbound = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  seatsNeeded: 1
});
const northbound = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_hang_xanh',
  destinationHubId: 'hub_ql13_bau_bang',
  seatsNeeded: 1
});

const southIds = southbound.slots.filter((s) => s.tier === 'CONFIRMED').map((s) => s.tripId);
const northIds = northbound.slots.filter((s) => s.tier === 'CONFIRMED').map((s) => s.tripId);

ok(southIds.length > 0, 'Chiều xuôi (về Sài Gòn) vẫn tìm được chuyến thật');
ok(!southIds.some((id) => northIds.includes(id)),
   'Không chuyến nào xuất hiện ở CẢ hai chiều — xe chạy ngược hướng bị loại đúng');
ok(northIds.every((id) => id.includes('RETURN')),
   'Chiều ngược chỉ còn đúng chuyến khứ hồi Sài Gòn → Bình Phước');

// Trips outside the corridor (Vũng Tàu, Phan Thiết) must not leak into the most trusted tier
const allConfirmed = [...southIds, ...northIds];
ok(allConfirmed.length > 0 && !allConfirmed.includes('DRV-104') && !allConfirmed.includes('DRV-103'),
   'Chuyến Vũng Tàu / Phan Thiết KHÔNG hiện ở tầng "chắc chắn 100%" của tuyến QL13');

// ── 7. FULL-ROUTE SCHEDULE & DENSITY THRESHOLD ───────────────────────
console.log('\n── 7. LỊCH CHẠY TOÀN TUYẾN ──');

resetAllStationData();

const tl = buildCorridorTimeline({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  seatsNeeded: 1
});

ok(tl.success, 'Dựng được lịch chạy toàn tuyến');
ok(tl.periods.length === 6, 'Chia đúng 6 buổi trong ngày');
ok(tl.periods.every((p) => p.label && p.hint && Array.isArray(p.trips)),
   'Mỗi buổi đều có nhãn, khung giờ và danh sách chuyến');
ok(tl.periods.some((p) => p.count === 0),
   'Buổi không có chuyến VẪN được giữ lại — chính khoảng trống là nơi cần gom nhu cầu');

// Density threshold: this is what decides the button's face-swap between "xem lịch" (view schedule) and "đăng nhu cầu" (post a request)
ok(typeof tl.isDense === 'boolean', 'Trả về cờ isDense để giao diện tự quyết định');
ok(tl.isDense === tl.totalTrips >= tl.minTripsForTimeline,
   `isDense khớp ngưỡng: ${tl.totalTrips} chuyến vs ngưỡng ${tl.minTripsForTimeline}`);
// Check the RELATIONSHIP between density and the flag, not a transient state:
// when the seed data changes the trip count changes with it, but the rule must always hold.
ok(
  tl.totalTrips >= tl.minTripsForTimeline ? tl.isDense === true : tl.isDense === false,
  `Quy tắc ngưỡng luôn đúng: ${tl.totalTrips} chuyến -> isDense=${tl.isDense} (mở màn lịch chạy khi và chỉ khi đủ dày)`
);

// Not filtered by time: the total trips must be >= the trip count of a narrow slot
const narrow = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  timeSlot: '05:00',
  seatsNeeded: 1
});
ok(tl.totalTrips >= narrow.counts.confirmed,
   'Lịch toàn tuyến bao trọn kết quả của một khung giờ hẹp');

const badTl = buildCorridorTimeline({ originHubId: 'hub_khong_co', destinationHubId: 'hub_ql13_hang_xanh' });
ok(badTl.success === false, 'Trạm không tồn tại -> báo lỗi, không ném exception');

resetAllStationData();
// Clean up the trips built specifically for the test so the marketplace has no leftover data
await deleteTrip(liveTripId);
await deleteTrip(passedTripId);
console.log(`\n🎉 TẤT CẢ ${passed} KIỂM THỬ ĐỀU ĐẠT\n`);
