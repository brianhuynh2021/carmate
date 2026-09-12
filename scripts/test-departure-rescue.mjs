/**
 * KIỂM THỬ CANH CHUYẾN & CHẾ ĐỘ CỨU HỘ (DEPARTURE WATCHDOG & RESCUE MODE)
 *
 * Bất biến quan trọng nhất: KHÁCH KHÔNG BAO GIỜ BỊ CHẾT ĐỨNG.
 * Tới T-20 mà chủ xe im lặng thì khách phải nhận được cảnh báo kèm hotline xe
 * khách, trong khi vẫn còn đủ thời gian thực tế để bắt chuyến khác.
 */

import assert from 'node:assert';
import { initDB, getRawDB, addBooking, getBookingById } from '../apps/api/src/db/sqliteStore.js';
import { initNotificationTables } from '../apps/api/src/services/notificationService.js';
import {
  evaluateDepartureCheckpoints,
  activateRescueMode,
  resolveDepartureMs,
  pickRelevantLifebuoys,
  applyLatePenalty,
  WATCHDOG_CONFIG
} from '../apps/api/src/services/departureWatchdog.js';
import { resetAllStationData } from '../apps/api/src/services/stationQueueService.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  console.log(`✅ ${label}`);
  passed += 1;
}

console.log('\n🧪 KIỂM THỬ CANH CHUYẾN & CHẾ ĐỘ CỨU HỘ\n');

await initDB();
initNotificationTables();
resetAllStationData();

const db = getRawDB();
db.prepare("DELETE FROM bookings WHERE escrowId LIKE 'TEST-DEP-%'").run();
db.prepare("DELETE FROM notifications WHERE phone IN ('0955000111','0955000222')").run();

/** Tạo một booking khởi hành sau `minutesFromNow` phút. */
async function makeBooking(id, minutesFromNow, extra = {}) {
  const dep = new Date(Date.now() + minutesFromNow * 60000);
  const hh = String(dep.getHours()).padStart(2, '0');
  const mm = String(dep.getMinutes()).padStart(2, '0');
  return addBooking({
    escrowId: id,
    tripId: null,
    status: 'zalo_active',
    date: dep.toISOString().slice(0, 10),
    timeSlot: `${hh}:${mm}`,
    driverPhone: '0955000111',
    passengerPhone: '0955000222',
    createdAt: Date.now(),
    ...extra
  });
}

// ── 1. Suy ra giờ khởi hành ────────────────────────────────────────────
console.log('── 1. SUY RA GIỜ KHỞI HÀNH ──');

ok(resolveDepartureMs({ date: '2026-09-20', timeSlot: '08:30' }) != null,
   'Đọc được giờ khởi hành từ ngày + khung giờ "08:30"');
ok(resolveDepartureMs({ date: '2026-09-20', timeSlot: '07:00-09:00' }) ===
   resolveDepartureMs({ date: '2026-09-20', timeSlot: '07:00' }),
   'Khung "07:00-09:00" lấy đúng mốc đầu 07:00');
ok(resolveDepartureMs({ date: '2026-09-20', timeSlot: 'sáng sớm' }) === null,
   'Chuỗi chữ tự do -> null, KHÔNG đoán bừa rồi bắn cảnh báo nhầm');
ok(resolveDepartureMs({ timeSlot: '08:30' }) === null, 'Thiếu ngày -> null');

// ── 2. Các mốc T-40 / T-30 / T-20 ──────────────────────────────────────
console.log('\n── 2. CÁC MỐC CANH CHUYẾN ──');

await makeBooking('TEST-DEP-40', WATCHDOG_CONFIG.ASK_READY_MINUTES);
let acts = evaluateDepartureCheckpoints({ activeSessions: [] });
let hit = acts.find((a) => a.booking.escrowId === 'TEST-DEP-40');
ok(hit?.action === 'ASK_READY', 'T-40: hỏi chủ xe đã sẵn sàng chưa');

await makeBooking('TEST-DEP-30', WATCHDOG_CONFIG.REMIND_MINUTES);
acts = evaluateDepartureCheckpoints({ activeSessions: [] });
hit = acts.find((a) => a.booking.escrowId === 'TEST-DEP-30');
ok(hit?.action === 'REMIND_READY', 'T-30: nhắc lần 2');

await makeBooking('TEST-DEP-20', WATCHDOG_CONFIG.RESCUE_MINUTES);
acts = evaluateDepartureCheckpoints({ activeSessions: [] });
hit = acts.find((a) => a.booking.escrowId === 'TEST-DEP-20');
ok(hit?.action === 'ACTIVATE_RESCUE', 'T-20: BẬT CHẾ ĐỘ CỨU HỘ');
ok(hit.reason === 'NO_GPS_SIGNAL', 'Ghi đúng lý do: không có tín hiệu GPS nào');
ok(Array.isArray(hit.lifebuoys) && hit.lifebuoys.length > 0,
   'Kèm sẵn danh sách xe khách cứu hộ, không để khách tự đi tìm');

// Chuyến còn xa (T-90) chưa bị đụng tới
await makeBooking('TEST-DEP-90', 90);
acts = evaluateDepartureCheckpoints({ activeSessions: [] });
ok(!acts.some((a) => a.booking.escrowId === 'TEST-DEP-90'),
   'Chuyến còn 90 phút chưa bị làm phiền');

// ── 3. Chủ xe đã xác nhận thì im lặng ──────────────────────────────────
console.log('\n── 3. CHỦ XE ĐÃ XÁC NHẬN ──');

await makeBooking('TEST-DEP-OK', WATCHDOG_CONFIG.RESCUE_MINUTES, {
  driverConfirmed: true,
  readyConfirmedAt: new Date().toISOString()
});
acts = evaluateDepartureCheckpoints({ activeSessions: [] });
ok(!acts.some((a) => a.booking.escrowId === 'TEST-DEP-OK'),
   'Chủ xe đã bấm "Tôi đang đi" -> KHÔNG bật cứu hộ, không làm phiền ai');

// Xe đang thực sự lăn bánh cũng được coi là sẵn sàng, dù chưa bấm nút
await makeBooking('TEST-DEP-DRIVING', WATCHDOG_CONFIG.RESCUE_MINUTES);
acts = evaluateDepartureCheckpoints({
  activeSessions: [{ driverPhone: '0955000111', lastPing: Date.now(), speed: 55 }]
});
ok(!acts.some((a) => a.booking.escrowId === 'TEST-DEP-DRIVING'),
   'Xe đang chạy 55km/h với GPS tươi -> tin hành động thật, không cần bấm nút');

// Xe có phiên nhưng mất tín hiệu lâu -> vẫn phải cứu hộ
await makeBooking('TEST-DEP-STALE', WATCHDOG_CONFIG.RESCUE_MINUTES);
acts = evaluateDepartureCheckpoints({
  activeSessions: [{ driverPhone: '0955000111', lastPing: Date.now() - 60 * 60000, speed: 0 }]
});
hit = acts.find((a) => a.booking.escrowId === 'TEST-DEP-STALE');
ok(hit?.action === 'ACTIVATE_RESCUE' && hit.reason === 'STALE_HEARTBEAT',
   'Xe đứng yên, mất tín hiệu 60 phút -> bật cứu hộ, ghi đúng lý do');

// ── 4. Bật cứu hộ: giữ chuyến, trừ điểm ────────────────────────────────
console.log('\n── 4. BẬT CỨU HỘ: GIỮ CHUYẾN & TRỪ ĐIỂM ──');

const rescue = await activateRescueMode({
  bookingId: 'TEST-DEP-20',
  reason: 'NO_GPS_SIGNAL',
  lifebuoys: pickRelevantLifebuoys(getBookingById('TEST-DEP-20'))
});
ok(rescue.success, 'Bật được Chế độ Cứu hộ');

const after = getBookingById('TEST-DEP-20');
ok(after.rescueMode === true, 'Booking được gắn cờ rescueMode');
ok(after.isCancelled === false && after.status === 'zalo_active',
   'CHUYẾN VẪN SỐNG — chủ xe tới muộn vẫn đón được, không tự huỷ');
ok(Array.isArray(after.rescueLifebuoys) && after.rescueLifebuoys.length > 0,
   'Lưu kèm hotline xe khách vào booking để khách mở ra là thấy ngay');

const again = await activateRescueMode({ bookingId: 'TEST-DEP-20', reason: 'NO_GPS_SIGNAL', lifebuoys: [] });
ok(again.alreadyActive === true, 'Gọi lại không bật đè lần hai (nhịp quét chạy mỗi 60s)');

// Chuyến đã bật cứu hộ thì không bị đánh giá lại
acts = evaluateDepartureCheckpoints({ activeSessions: [] });
ok(!acts.some((a) => a.booking.escrowId === 'TEST-DEP-20' && a.action === 'ACTIVATE_RESCUE'),
   'Không bắn cảnh báo lặp cho chuyến đã ở chế độ cứu hộ');

// ── 5. Chế tài theo thang có sẵn ───────────────────────────────────────
console.log('\n── 5. CHẾ TÀI THEO THANG CÓ SẴN ──');

const { saveUser, getUserByPhone } = await import('../apps/api/src/db/sqliteStore.js');
await saveUser({ phone: '0955000111', name: 'Chủ xe test', role: 'driver', lateReports: 0, rescueIncidents: [] });

const pen1 = await applyLatePenalty('0955000111', 'TEST-DEP-PEN-1');
ok(pen1?.applied === true && pen1.rule === 'penalty_late',
   'Dùng đúng quy tắc penalty_late (-10) có sẵn, không tự chế luật mới');
ok(getUserByPhone('0955000111').lateReports === 1, 'Tăng bộ đếm lateReports lên 1');

const penDup = await applyLatePenalty('0955000111', 'TEST-DEP-PEN-1');
ok(penDup?.skipped === true, 'Cùng một chuyến không bị phạt hai lần');

await applyLatePenalty('0955000111', 'TEST-DEP-PEN-2');
const finalUser = getUserByPhone('0955000111');
ok(finalUser.lateReports === 2, 'Chuyến khác thì tính tiếp (lateReports = 2)');
ok(finalUser.isBanned !== true,
   'KHÔNG tự khoá tài khoản — chỉ trừ điểm, đúng lựa chọn dùng thang có sẵn');

// ── 6. Chọn xe khách phù hợp giờ ───────────────────────────────────────
console.log('\n── 6. CHỌN XE CỨU HỘ PHÙ HỢP GIỜ ──');

const morning = pickRelevantLifebuoys({ date: '2026-09-20', timeSlot: '05:00' });
const afternoon = pickRelevantLifebuoys({ date: '2026-09-20', timeSlot: '16:00' });
ok(morning.length > 0 && afternoon.length > 0, 'Giờ nào cũng có phương án, không bao giờ trả danh sách rỗng');
ok(morning[0].id !== afternoon[0].id || morning.length === 1,
   'Xếp theo độ gần giờ: chuyến sáng và chuyến chiều gợi ý khác nhau');
// Hotline chưa kiểm chứng thì để null; bù lại phải có chỉ dẫn khách tự làm được.
// Một số điện thoại bịa, gọi đúng lúc hoảng nhất mà không ai nghe, còn tệ hơn
// nhiều so với việc thành thật nói "chưa có số, hãy ra đây và vẫy xe".
ok(morning.every((b) => b.guidance && b.guidance.length > 20),
   'Mọi phương án đều có chỉ dẫn thực địa cụ thể thay cho số điện thoại bịa');
ok(morning.every((b) => b.hotline === null || b.verified === true),
   'Không phương án nào mang số điện thoại chưa được kiểm chứng');

db.prepare("DELETE FROM bookings WHERE escrowId LIKE 'TEST-DEP-%'").run();
resetAllStationData();
console.log(`\n🎉 TẤT CẢ ${passed} KIỂM THỬ ĐỀU ĐẠT\n`);
