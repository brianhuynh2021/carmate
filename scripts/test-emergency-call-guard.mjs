import assert from 'node:assert/strict';
import {
  MIN_CALL_DURATION_FOR_EMERGENCY,
  REQUIRED_UNANSWERED_CALLS,
  recordCallAttempt,
  getEmergencyCallStatus,
  isEmergencyPhoneUnlocked,
  resetEmergencyCallStatus
} from '../packages/shared/src/index.js';

console.log('=============================================================');
console.log('🧪 KIỂM THỬ BẤT BIẾN LOGIC: EMERGENCY CALL GUARD (MIT INVARIANT)');
console.log('=============================================================');

const bookingId = 'ESCROW-TEST-PICKUP-01';
const callerId = '0912345678';
const calleeId = '0987654321';

// Clean up before the test
resetEmergencyCallStatus({ bookingId, callerId });
resetEmergencyCallStatus({ bookingId, callerId: calleeId });

console.log('\n--- 1. Kiểm thử Giá trị Hằng số Cốt lõi ---');
assert.equal(MIN_CALL_DURATION_FOR_EMERGENCY, 25, 'Thời lượng tối thiểu phải là đúng 25s');
assert.equal(REQUIRED_UNANSWERED_CALLS, 2, 'Số lần gọi nhỡ bắt buộc phải là đúng 2 lần');
console.log('  ✅ [PASS] Hằng số cốt lõi: Đổ chuông tối thiểu 25s, yêu cầu 2 lần gọi nhỡ');

console.log('\n--- 2. Kiểm thử Ban đầu: 100% Khóa Bảo mật ---');
assert.equal(isEmergencyPhoneUnlocked({ bookingId, callerId }), false, 'Ban đầu phải tuyệt đối khóa SĐT');
const initStatus = getEmergencyCallStatus({ bookingId, callerId });
assert.equal(initStatus.attempts, 0);
assert.equal(initStatus.remainingAttempts, 2);
console.log('  ✅ [PASS] Trạng thái ban đầu: 100% bảo mật, còn thiếu 2 lần gọi');

console.log('\n--- 3. Kiểm thử Cuộc gọi < 25s (Gian lận nháy máy) ---');
const shortCallRes = recordCallAttempt({
  bookingId,
  callerId,
  durationSeconds: 15,
  answered: false
});
assert.equal(shortCallRes.qualified, false, 'Cuộc gọi 15s không được tính là hợp lệ');
assert.equal(shortCallRes.attempts, 0, 'Số lần hợp lệ vẫn phải là 0');
assert.equal(isEmergencyPhoneUnlocked({ bookingId, callerId }), false, 'Vẫn phải khóa');
console.log('  ✅ [PASS] Chống gian lận: Cuộc gọi 15s (<25s) bị từ chối tính điểm');

console.log('\n--- 4. Kiểm thử Cuộc gọi Đạt chuẩn Lần 1 (26s >= 25s) ---');
const call1Res = recordCallAttempt({
  bookingId,
  callerId,
  durationSeconds: 26,
  answered: false
});
assert.equal(call1Res.qualified, true, 'Cuộc gọi 26s phải hợp lệ');
assert.equal(call1Res.attempts, 1, 'Đã tích luỹ 1 lần');
assert.equal(call1Res.remainingAttempts, 1, 'Còn thiếu 1 lần');
assert.equal(call1Res.isUnlocked, false, 'Mới có 1 lần -> Chưa được mở khoá');
assert.equal(isEmergencyPhoneUnlocked({ bookingId, callerId }), false);
console.log('  ✅ [PASS] Lần 1 đạt chuẩn (26s): Ghi nhận 1/2, SĐT vẫn được bảo mật');

console.log('\n--- 5. Kiểm thử Cuộc gọi Thành công Kết nối (Answered: true) ---');
const answeredRes = recordCallAttempt({
  bookingId,
  callerId,
  durationSeconds: 40,
  answered: true
});
assert.equal(answeredRes.qualified, false, 'Cuộc gọi nghe máy không tính vào cuộc gọi nhỡ');
assert.equal(answeredRes.attempts, 1, 'Số lần nhỡ vẫn giữ nguyên là 1');
assert.equal(answeredRes.isUnlocked, false);
console.log('  ✅ [PASS] Cuộc gọi nghe máy: Không tính vào số lần gọi nhỡ');

console.log('\n--- 6. Kiểm thử Cuộc gọi Đạt chuẩn Lần 2 (30s >= 25s) -> MỞ KHOÁ ---');
const call2Res = recordCallAttempt({
  bookingId,
  callerId,
  durationSeconds: 30,
  answered: false
});
assert.equal(call2Res.qualified, true, 'Cuộc gọi 30s phải hợp lệ');
assert.equal(call2Res.attempts, 2, 'Đã tích luỹ đủ 2 lần');
assert.equal(call2Res.remainingAttempts, 0, 'Còn thiếu 0 lần');
assert.equal(call2Res.isUnlocked, true, 'Đã đủ 2 lần >= 25s -> Mở khoá thành công!');
assert.equal(isEmergencyPhoneUnlocked({ bookingId, callerId }), true, 'isEmergencyPhoneUnlocked phải trả về true');
console.log('  ✅ [PASS] Lần 2 đạt chuẩn (30s): MỞ KHOÁ THÀNH CÔNG cho người gọi');

console.log('\n--- 7. Kiểm thử Bất Biến Bất Đối Xứng (Asymmetric Privacy) ---');
// The callee (the person who answers) checks whether they can see the caller's number
const calleeUnlocked = isEmergencyPhoneUnlocked({ bookingId, callerId: calleeId });
assert.equal(calleeUnlocked, false, 'Người nhận (không nghe máy) tuyệt đối KHÔNG được mở khoá số của người gọi');
const calleeStatus = getEmergencyCallStatus({ bookingId, callerId: calleeId });
assert.equal(calleeStatus.attempts, 0);
assert.equal(calleeStatus.isUnlocked, false);
console.log('  ✅ [PASS] Bất đối xứng tuyệt đối: Người nhận không thực hiện gọi nên SĐT người gọi vẫn ẩn 100%');

console.log('\n--- 8. Kiểm thử Khôi phục Trạng thái (Reset) ---');
resetEmergencyCallStatus({ bookingId, callerId });
assert.equal(isEmergencyPhoneUnlocked({ bookingId, callerId }), false, 'Sau khi reset phải quay về trạng thái bảo mật');
console.log('  ✅ [PASS] Reset trạng thái an toàn: Xoá sạch khi hoàn tất chuyến đi');

console.log('\n=============================================================');
console.log('🎉 TẤT CẢ TEST CASE BẤT BIẾN EMERGENCY CALL GUARD ĐÃ ĐẠT 100%!');
console.log('=============================================================');
