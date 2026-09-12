/**
 * KIỂM THỬ MA TRẬN KHE THỜI GIAN (TIME-SLOTTED CORRIDOR MATRIX)
 *
 * Bất biến quan trọng nhất được kiểm ở đây: MÀN HÌNH KHÔNG BAO GIỜ TRỐNG.
 * Khách liên tỉnh bấm tìm chuyến mà nhận về danh sách rỗng là mất khách vĩnh viễn.
 */

import assert from 'node:assert';
import { initDB } from '../apps/api/src/db/sqliteStore.js';
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

// ── 1. Bất biến: không bao giờ trống ───────────────────────────────────
console.log('── 1. BẤT BIẾN "KHÔNG BAO GIỜ TRỐNG" ──');

const oddHour = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  timeSlot: '02:47', // giờ chắc chắn không có chuyến nào
  seatsNeeded: 1
});

ok(oddHour.success, 'Dựng được ma trận cho giờ hiếm 02:47');
ok(oddHour.slots.length > 0, 'Giờ không ai chạy vẫn trả về khe — màn hình không trống');
ok(oddHour.isEmpty === false, 'Cờ isEmpty luôn false theo thiết kế');
ok(oddHour.counts.shadow > 0, 'Thiếu chuyến thật thì bù bằng khe dự phòng');

// ── 2. Tầng CONFIRMED ──────────────────────────────────────────────────
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

// Cửa sổ ±30 phút phải loại chuyến quá xa giờ khách muốn
const noon = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  timeSlot: '12:00',
  seatsNeeded: 1
});
const noonHas5am = noon.slots.some((s) => s.tier === 'CONFIRMED' && s.departureLabel === '05:00');
ok(!noonHas5am, 'Chuyến 05:00 KHÔNG lọt vào kết quả cho giờ muốn 12:00 (cửa sổ ±30 phút)');

// Yêu cầu nhiều ghế hơn số còn trống -> phải loại
const bigGroup = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  timeSlot: '05:30',
  seatsNeeded: 4
});
ok(bigGroup.counts.confirmed < early.counts.confirmed || bigGroup.counts.confirmed === 0,
   'Nhóm 4 người không được ghép vào xe chỉ còn 1 ghế');

// ── 3. Tầng FORMING ────────────────────────────────────────────────────
console.log('\n── 3. TẦNG 🔵 FORMING (xe đang lăn bánh) ──');

const before = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  seatsNeeded: 1
});
ok(before.counts.forming === 0, 'Chưa có xe nào chạy -> chưa có tầng FORMING');

// Xe đang ở Chơn Thành (s=56.5), cách Bàu Bàng (s=84.5) khoảng 28km
telemetryPing({
  tripId: 'TRIP-LIVE', driverPhone: '0913000001', driverName: 'Anh Sơn',
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

// Xe đã VƯỢT QUA trạm thì không được tính
telemetryPing({
  tripId: 'TRIP-PASSED', driverPhone: '0913000002', plate: '61A-888.88',
  seatsAvailable: 3, lat: 10.8525, lng: 106.7214, speed: 45 // Ngã 4 Bình Phước, s=132.5
});
const afterPass = buildTimeSlotMatrix({
  originHubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  seatsNeeded: 1
});
ok(afterPass.counts.forming === 1, 'Xe đã vượt qua trạm KHÔNG được đưa vào kết quả');

// ── 4. Giá & thông tin kèm theo ────────────────────────────────────────
console.log('\n── 4. GIÁ VÀ THÔNG TIN TRẠM ──');

ok(withLive.tariff && withLive.tariff.pricePerSeat > 0, 'Trả kèm giá vé, giao diện không cần gọi thêm lượt');
ok(withLive.tariff.total === withLive.tariff.pricePerSeat * withLive.seatsNeeded, 'Tổng tiền khớp số ghế');
ok(withLive.station != null, 'Trả kèm tình trạng hàng đợi tại trạm');
ok(withLive.windowMinutes === MATRIX_CONFIG.NEIGHBOR_WINDOW_MINUTES, 'Công khai cửa sổ ±30 phút đang dùng');

// ── 5. Đầu vào sai ─────────────────────────────────────────────────────
console.log('\n── 5. ĐẦU VÀO KHÔNG HỢP LỆ ──');

const bad = buildTimeSlotMatrix({ originHubId: 'hub_khong_ton_tai', destinationHubId: 'hub_ql13_hang_xanh' });
ok(bad.success === false, 'Trạm không tồn tại -> báo lỗi rõ ràng, không ném exception');

// ── 6. CHỐNG TÁI PHÁT: LỌC CHẶNG VÀ CHIỀU ĐI ──────────────────────────
console.log('\n── 6. LỌC ĐÚNG CHẶNG VÀ CHIỀU ĐI ──');

// Lỗi cũ: tầng CONFIRMED không lọc theo cặp trạm, nên MỌI chuyến trên sàn đều
// hiện ra như "🟢 chắc chắn 100%" cho bất kỳ chặng nào khách tìm.
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

// Chuyến ngoài hành lang (Vũng Tàu, Phan Thiết) không được lọt vào tầng đáng tin nhất
const allConfirmed = [...southIds, ...northIds];
ok(allConfirmed.length > 0 && !allConfirmed.includes('DRV-104') && !allConfirmed.includes('DRV-103'),
   'Chuyến Vũng Tàu / Phan Thiết KHÔNG hiện ở tầng "chắc chắn 100%" của tuyến QL13');

// ── 7. LỊCH CHẠY TOÀN TUYẾN & NGƯỠNG MẬT ĐỘ ───────────────────────────
console.log('\n── 7. LỊCH CHẠY TOÀN TUYẾN ──');

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

// Ngưỡng mật độ: đây là thứ quyết định nút đổi mặt giữa "xem lịch" và "đăng nhu cầu"
ok(typeof tl.isDense === 'boolean', 'Trả về cờ isDense để giao diện tự quyết định');
ok(tl.isDense === tl.totalTrips >= tl.minTripsForTimeline,
   `isDense khớp ngưỡng: ${tl.totalTrips} chuyến vs ngưỡng ${tl.minTripsForTimeline}`);
// Kiểm QUAN HỆ giữa mật độ và cờ, không kiểm một trạng thái nhất thời:
// dữ liệu seed thay đổi thì số chuyến đổi theo, nhưng quy tắc phải luôn đúng.
ok(
  tl.totalTrips >= tl.minTripsForTimeline ? tl.isDense === true : tl.isDense === false,
  `Quy tắc ngưỡng luôn đúng: ${tl.totalTrips} chuyến -> isDense=${tl.isDense} (mở màn lịch chạy khi và chỉ khi đủ dày)`
);

// Không lọc theo giờ: tổng chuyến phải >= số chuyến của một khung hẹp
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
console.log(`\n🎉 TẤT CẢ ${passed} KIỂM THỬ ĐỀU ĐẠT\n`);
