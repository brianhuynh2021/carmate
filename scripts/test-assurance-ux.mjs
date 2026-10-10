/**
 * TESTS FOR THE ASSURANCE SCORE, HUMANIZED STATIONS & DEPARTURE CHIPS
 *
 * Three invariants protected here:
 *   1. Never over-promise: a "Chuyến đảm bảo" (guaranteed trip) must have a REAL backup vehicle
 *   2. Never fabricate reputation: a driver with 0 trips must not default to 100% on-time
 *   3. Never fabricate phone numbers: an unverified hotline must not show a call button
 */

import assert from 'node:assert';
import {
  computeAssurance,
  ASSURANCE_LEVELS,
  getAssurancePromise,
  describeHub,
  getHubAmenities,
  buildDepartureChips,
  buildCustomChip,
  toLocalIsoDate,
  hasVerifiedHotline,
  FIXED_CORRIDOR_COACH_SCHEDULES,
  EMERGENCY_TRANSIT_LIFEBUOYS,
  VIRTUAL_HUBS
} from '@carmate/shared';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  console.log(`✅ ${label}`);
  passed += 1;
}

/** Fixed time marks within today, so results do not change depending on when the test runs. */
const at = (h, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

console.log('\n🧪 KIỂM THỬ CHỈ SỐ AN TÂM & TRẢI NGHIỆM KHÁCH\n');

// ── 1. Assurance score ────────────────────────────────────────────────
console.log('── 1. CHỈ SỐ AN TÂM ──');

const guaranteed = computeAssurance({
  baseCertainty: 1, trustScore: 98, completedTrips: 14, lateReports: 0, backupCount: 2
});
ok(guaranteed.level === ASSURANCE_LEVELS.GUARANTEED, 'Uy tín cao + có xe dự phòng -> "Chuyến đảm bảo"');
ok(guaranteed.canPromiseTime === true, 'Chỉ mức đảm bảo mới được phép hứa mốc giờ cụ thể');

const noBackup = computeAssurance({
  baseCertainty: 1, trustScore: 98, completedTrips: 14, lateReports: 0, backupCount: 0
});
ok(noBackup.level === ASSURANCE_LEVELS.COMMUNITY,
   'KHÔNG có xe dự phòng -> hạ xuống "Chuyến cộng đồng" dù điểm rất cao');
ok(noBackup.canPromiseTime === false, 'Không có xe đỡ thì KHÔNG được hứa chắc với khách');

const newDriver = computeAssurance({ baseCertainty: 1, trustScore: 95, completedTrips: 0, backupCount: 3 });
ok(newDriver.onTimeRate === null, 'Chủ xe 0 chuyến -> tỷ lệ đúng giờ là null, KHÔNG bịa thành 100%');
ok(newDriver.level !== ASSURANCE_LEVELS.GUARANTEED, 'Chủ xe chưa có lịch sử không được lên mức đảm bảo');
ok(newDriver.reasons[0].includes('chưa có lịch sử'), 'Nói thẳng là chưa có lịch sử, không giấu');

const lowTrust = computeAssurance({ baseCertainty: 1, trustScore: 60, completedTrips: 20, lateReports: 6, backupCount: 3 });
ok(lowTrust.level !== ASSURANCE_LEVELS.GUARANTEED, 'Uy tín thấp -> không được gắn nhãn đảm bảo');
ok(Math.abs(lowTrust.onTimeRate - 0.7) < 0.01, 'Tỷ lệ đúng giờ tính đúng từ lịch sử thật (14/20)');

ok(getAssurancePromise(guaranteed, '08:30').includes('08:30'),
   'Lời cam kết mức đảm bảo nêu rõ mốc giờ');
ok(!getAssurancePromise(newDriver, '08:30').includes('tự điều xe'),
   'Mức thấp hơn KHÔNG mượn giọng chắc chắn của mức đảm bảo');

// ── 2. Humanized stations ─────────────────────────────────────────────
console.log('\n── 2. TRẠM NHÂN BẢN HOÁ ──');

const gasHub = VIRTUAL_HUBS.find((h) => h.category === 'GAS_STATION');
const gas = describeHub(gasHub);
ok(gas.amenities.length >= 4, `Cây xăng có đủ tiện ích (${gas.amenities.length} mục)`);
ok(gas.amenities.some((a) => a.id === 'SHELTER'), 'Cây xăng chắc chắn có mái che');
ok(gas.amenities.some((a) => a.id === 'LIGHTING'), 'Cây xăng có đèn sáng ban đêm');
ok(Boolean(gas.safetyNote), 'Có lời dặn an toàn cho người đứng đợi');
ok(Boolean(gas.landmark), 'Có mốc nhận diện thực địa, không chỉ toạ độ GPS');

const junctionHub = VIRTUAL_HUBS.find((h) => h.category === 'JUNCTION');
const junction = describeHub(junctionHub);
ok(junction.amenities.length < gas.amenities.length,
   'Ngã tư có ít tiện ích hơn cây xăng — nói đúng sự thật, không tô hồng');
ok(junction.safetyNote.includes('lề') || junction.safetyNote.includes('lòng đường'),
   'Ngã tư được cảnh báo đứng lùi khỏi lòng đường');

ok(VIRTUAL_HUBS.every((h) => getHubAmenities(h).length > 0),
   'MỌI trạm đều có ít nhất một tiện ích, không trạm nào trống thông tin');

// ── 3. Departure chips ────────────────────────────────────────────────
console.log('\n── 3. CHIP KHỞI HÀNH ──');

const at6 = at(6);
const at23 = at(23);

const chips6 = buildDepartureChips({ now: at6 });
const chips23 = buildDepartureChips({ now: at23 });

ok(chips6.length === 3 && chips23.length === 3,
   'Trả về 3 chip, nhường ô thứ 4 trong lưới 2x2 cho nút "Chọn ngày khác"');
ok(chips6.every((c) => /\(\d+h-\d+h\)$/.test(c.display)),
   'Mỗi chip in thẳng được một câu "Chiều nay (14h-18h)", giao diện không phải tự ghép');
// A window that crosses midnight must be called "Đêm" (Night), not "Khuya nay" (late tonight),
// which is misleading (suggests it is still within today). After 16h it is pushed below the
// tomorrow-morning windows, so look for it at any position in the list, not just the first chip.
const overnightChip = buildDepartureChips({ now: at(15) }).find((c) => c.windowId === 'late_night');
ok(overnightChip && overnightChip.display.startsWith('Đêm'),
   'Khung vắt qua nửa đêm gọi là "Đêm nay", không phải "Khuya nay"');
ok(chips6.every((c) => c.dayOffset === 0), '6h sáng: cả 4 chip đều trong hôm nay');
ok(chips23.every((c) => c.dayOffset === 1),
   '23h đêm: cả 3 chip đều là ngày mai — nhu cầu thật lúc này là chuyến sáng mai');
ok(chips6.every((c) => /^\d{2}:00$/.test(c.timeSlot)), 'Mỗi chip mang khung giờ hợp lệ để tra cứu');
ok(chips6.every((c) => c.label && c.hint && c.dayLabel && c.display), 'Chip đủ nhãn, gợi ý giờ và nhãn ngày');

// A self-chosen-date chip must have the same shape as an auto-generated chip
// so the UI renders both through one code path
const custom = buildCustomChip({ date: '2026-12-25', windowId: 'early_morning' });
ok(custom && custom.isCustom === true, 'Dựng được chip từ ngày khách tự chọn');
ok(custom.timeSlot === '04:00' && custom.date === '2026-12-25', 'Chip tự chọn mang đúng ngày và khung giờ');
ok(['id','label','hint','display','timeSlot','windowId'].every((k) => k in custom),
   'Chip tự chọn có đủ các trường như chip tự sinh');

const at15 = at(15);
const chips15 = buildDepartureChips({ now: at15 });
ok(!chips15.some((c) => c.dayOffset === 0 && c.windowId === 'early_morning'),
   '15h chiều: KHÔNG còn chìa ra "Sáng sớm hôm nay" đã trôi qua');

// ── 4. Never fabricate phone numbers ──────────────────────────────────
console.log('\n── 4. KHÔNG BỊA SỐ ĐIỆN THOẠI ──');

ok(FIXED_CORRIDOR_COACH_SCHEDULES.every((b) => b.hotline === null || b.verified === true),
   'Mọi hotline xe khách hoặc là null, hoặc đã được đánh dấu kiểm chứng');
ok(FIXED_CORRIDOR_COACH_SCHEDULES.every((b) => !hasVerifiedHotline(b)),
   'Hiện chưa số nào được xác minh -> giao diện KHÔNG hiện nút gọi nào');
ok(FIXED_CORRIDOR_COACH_SCHEDULES.every((b) => Boolean(b.guidance)),
   'Bù lại: mọi phương án đều có chỉ dẫn khách tự làm được ngay tại chỗ');
ok(FIXED_CORRIDOR_COACH_SCHEDULES.every((b) => b.ticketPrice === null),
   'Giá vé chưa xác minh để null, không bịa con số cụ thể');

const invented = ['1900 6962', '1900 6065', '0271 3888 888', '0271 3888 999', '1900.0123', '1900.6079', '0903.116.116'];
const allText = JSON.stringify([...FIXED_CORRIDOR_COACH_SCHEDULES, ...EMERGENCY_TRANSIT_LIFEBUOYS]);
ok(invented.every((num) => !allText.includes(num)),
   'Toàn bộ số tổng đài bịa trước đây đã bị gỡ sạch');

const emergency = EMERGENCY_TRANSIT_LIFEBUOYS.find((l) => l.hotline);
ok(!emergency || emergency.hotline === '113',
   'Số duy nhất còn lại là 113 — số công khai toàn quốc, luôn đúng');

// ── Chips slide dynamically with the real time ────────────────────────
console.log('\n── 5. CHIP TRƯỢT ĐỘNG THEO GIỜ THỰC ──');

const chipsAt = (h, m = 0) => buildDepartureChips({ now: at(h, m) });

// Never offer a window that has already passed
for (const [h, m] of [[7, 0], [13, 0], [16, 30], [20, 0], [23, 30]]) {
  const first = chipsAt(h, m)[0];
  const endMin = (first.toHour % 24 || 24) * 60 + (first.dayOffset > 0 ? 1440 : 0);
  ok(endMin > h * 60 + m || first.dayOffset > 0,
     `${h}h${m || ''}: chip đầu (${first.display}) vẫn còn đặt được, không phải khung đã qua`);
}

// CUT OFF PAST TIME: at 16h30 it must be "Chiều nay (16h30-18h)" (this afternoon), not (14h-18h)
const at1630 = chipsAt(16, 30)[0];
ok(at1630.isPartial === true, '16h30: chip đầu được đánh dấu là khung đã bị cắt');
ok(at1630.display.includes('16h30'),
   `16h30 hiển thị "${at1630.display}" — cắt đúng phần giờ đã trôi qua, không ghi nguyên 14h`);
ok(at1630.timeSlot === '16:30', 'Khung gửi lên máy chủ cũng là 16:30, khớp với thứ khách nhìn thấy');

const at20 = chipsAt(20)[0];
ok(at20.display.includes('20h'), `20h hiển thị "${at20.display}" — cắt từ đúng giờ hiện tại`);

// PREFER TOMORROW MORNING OVER TONIGHT after 16h (a real need on the intercity route)
const evening = chipsAt(18);
ok(evening[1].dayOffset === 1 && evening[1].windowId.includes('morning'),
   `18h: chip 2 là "${evening[1].display}" — Sáng mai được đẩy lên trước Đêm nay`);
ok(!evening.slice(1).some((c) => c.windowId === 'late_night' && c.dayOffset === 0),
   'Sau 16h, "Đêm nay" không còn chiếm chỗ của các khung sáng mai');

// Before 16h the night window keeps its normal chronological order
const noon = chipsAt(13);
ok(noon.every((c) => c.dayOffset === 0), '13h: cả 3 chip vẫn trong hôm nay, chưa cần nhảy sang mai');

// Late at night, skip the rest of the night entirely and jump straight to tomorrow morning
const lateNight = chipsAt(23, 30);
ok(lateNight[0].dayOffset === 1,
   `23h30: chip đầu là "${lateNight[0].display}" — nhu cầu thật là chuyến sáng mai`);

// Always 3 chips at EVERY hour of the day, no hour is ever empty
for (let h = 0; h < 24; h++) {
  const c = chipsAt(h, 30);
  assert.ok(c.length === 3, `${h}h30 phải có đủ 3 chip, đang có ${c.length}`);
}
ok(true, 'Quét cả 24 giờ: giờ nào cũng có đủ 3 chip, không khung nào để trống');

// Regression guard: toISOString() converts to UTC and shifts the date in the UTC+7 time zone
console.log('\n── 6. NGÀY THEO LỊCH ĐỊA PHƯƠNG ──');
for (const day of ['2026-12-25', '2026-01-01', '2026-06-15']) {
  const c = buildCustomChip({ date: day, windowId: 'early_morning' });
  ok(c.date === day, `Chọn ${day} trả về đúng ${day} — không lệch một ngày vì quy đổi UTC`);
}
ok(toLocalIsoDate(new Date(2026, 11, 25, 0, 30)) === '2026-12-25',
   'Nửa đêm giờ Việt Nam vẫn là ngày hôm đó, không lùi về hôm trước');

console.log(`\n🎉 TẤT CẢ ${passed} KIỂM THỬ ĐỀU ĐẠT\n`);
