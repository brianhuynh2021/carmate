/**
 * TESTS FOR SPACE-TIME CONVERGENCE (SPACE-TIME RENDEZVOUS)
 *
 * Covers the 4 items just built:
 *   1. Stochastic ETA — an N(mu, sigma^2) distribution replacing crude division
 *   2. T-30 lock-in — fires only when P(25<=T<=35) >= 0.90
 *   3. Station handshake — confirmation, 2nd reminder, seat reclaimed after 10 minutes
 *   4. Shadow trip — swap when the delay probability exceeds the threshold, keeping the agreed meeting time
 */

import assert from 'node:assert';
import {
  computeEtaDistribution,
  etaQuantileSeconds,
  normalCdf,
  inverseNormalCdf,
  getPeakFactor
} from '@carmate/shared';
import {
  riderCheckIn,
  telemetryPing,
  evaluateT30Triggers,
  markT30Notified,
  riderConfirmOnTheWay,
  sweepHandshakeDeadlines,
  evaluateLatenessRisk,
  findShadowCandidate,
  applyShadowSwap,
  resetAllStationData,
  getRiderPass,
  getActiveCockpitSessions,
  T30_CONFIG
} from '../apps/api/src/services/stationQueueService.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  console.log(`✅ ${label}`);
  passed += 1;
}

// Fixed 10:00 time mark (outside peak hours) so results do not change depending on when the test runs
function at(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

console.log('\n🧪 KIỂM THỬ HỘI TỤ KHÔNG - THỜI GIAN\n');

// ───────────────────────────────────────────────────────────────────────
console.log('── 1. PHÂN PHỐI ETA NGẪU NHIÊN ──');

ok(Math.abs(normalCdf(0) - 0.5) < 1e-6, 'Phi(0) = 0.5 chính xác');
ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-3, 'Phi(1.96) ≈ 0.975 khớp bảng chuẩn');
ok(Math.abs(inverseNormalCdf(0.975) - 1.96) < 1e-3, 'Phi⁻¹(0.975) ≈ 1.96 (nghịch đảo đúng)');

const nowMs = at(10, 0);
const far = computeEtaDistribution({ currentS: 56.5, targetS: 132.5, currentSpeedKmh: 60, nowMs });
const near = computeEtaDistribution({ currentS: 130.0, targetS: 132.5, currentSpeedKmh: 40, nowMs });

ok(far.valid && near.valid, 'Tính được phân phối cho cả cự ly xa và gần');
ok(far.sigmaSeconds > near.sigmaSeconds * 3, 'Càng xa trạm sigma càng lớn (bất định tăng theo cự ly)');
ok(far.muSeconds > near.muSeconds, 'mu tỷ lệ thuận với quãng đường còn lại');

const p80 = etaQuantileSeconds(far, 0.8);
ok(p80 > far.muSeconds, 'Phân vị p80 lớn hơn mu (hứa giờ an toàn thì phải muộn hơn kỳ vọng)');

// Instantaneous speed of 0 (stopped at a red light) must NOT make the ETA blow up
const stalled = computeEtaDistribution({ currentS: 120, targetS: 132.5, currentSpeedKmh: 0, nowMs });
ok(Number.isFinite(stalled.muSeconds) && stalled.muSeconds < 90 * 60,
   'Xe dừng đèn đỏ (v=0) không làm ETA thành vô cực — đây là lỗi của công thức cũ');

// Peak hours must be slower than off-peak hours over the same distance
const peakEta = computeEtaDistribution({ currentS: 107, targetS: 132.5, nowMs: at(17, 30) });
const nightEta = computeEtaDistribution({ currentS: 107, targetS: 132.5, nowMs: at(23, 30) });
ok(peakEta.muSeconds > nightEta.muSeconds, 'Cao điểm chiều chậm hơn đêm trên cùng quãng đường');
ok(peakEta.sigmaSeconds > nightEta.sigmaSeconds, 'Cao điểm bất định hơn đêm (phương sai kẹt xe)');
ok(getPeakFactor(at(17, 30)).factor < 1 && getPeakFactor(at(23, 30)).factor > 1, 'Hệ số giờ cao điểm đúng chiều');

// ───────────────────────────────────────────────────────────────────────
console.log('\n── 2. CHỐT T-30 ──');

resetAllStationData();

// Passenger waiting at Bàu Bàng (s=84.5), heading to Hàng Xanh
const checkin = riderCheckIn({
  hubId: 'hub_ql13_bau_bang',
  destinationHubId: 'hub_ql13_hang_xanh',
  seatsNeeded: 1,
  phone: '0909111222',
  name: 'Chị Lan'
});
ok(checkin.success, 'Khách check-in vào hàng đợi trạm Bàu Bàng');
const intentId = checkin.intent.intentId;

// Vehicle is VERY FAR (Lộc Ninh, s=0, 84km away) -> p80 exceeds the 45-minute ceiling, no notification yet
telemetryPing({
  tripId: 'TRIP-FAR', driverPhone: '0912000001', plate: '93A-111.11',
  seatsAvailable: 3, lat: 11.8540, lng: 106.5920, speed: 60
});
ok(evaluateT30Triggers(nowMs).length === 0,
   'Xe cách 84km KHÔNG bắn T-30 (p80 vượt trần 45 phút, bắt khách đợi quá lâu)');

// Vehicle at Bàu Bàng is too CLOSE to the station (2.5km) -> the passenger cannot make it out in time, and is not notified either
telemetryPing({
  tripId: 'TRIP-TOOCLOSE', driverPhone: '0912000009', plate: '93A-999.99',
  seatsAvailable: 3, lat: 11.2600, lng: 106.6180, speed: 55
});
ok(evaluateT30Triggers(nowMs).length === 0,
   'Xe chỉ còn 2-3km KHÔNG bắn T-30 (khách không còn đủ 20 phút để ra trạm)');

// Vehicle at Chơn Thành (s=56.5) is 28km from the station -> right in the reasonable early-notice zone
telemetryPing({
  tripId: 'TRIP-MAIN', driverPhone: '0912000002', driverName: 'Anh Hùng',
  plate: '93A-541.86', vehicleModel: 'Mitsubishi Xpander', seatsAvailable: 3,
  lat: 11.4791, lng: 106.6694, speed: 58
});

const triggers = evaluateT30Triggers(nowMs);
ok(triggers.length === 1, 'Xe cách ~28km kích hoạt đúng 1 chốt T-30');
ok(triggers[0].probability >= T30_CONFIG.CONFIDENCE_THRESHOLD,
   `P(khách còn kịp ra trạm) = ${triggers[0].probability} >= ngưỡng 0.85`);
ok(triggers[0].session.tripId === 'TRIP-MAIN',
   'Chọn đúng xe tới sớm nhất trong nhóm hợp lệ, bỏ qua xe ở Lộc Ninh và xe quá sát');
ok(triggers[0].safeEtaMs > triggers[0].etaMs, 'Giờ hứa với khách là p80, muộn hơn kỳ vọng');

markT30Notified(intentId, {
  etaMs: triggers[0].etaMs,
  safeEtaMs: triggers[0].safeEtaMs,
  tripId: 'TRIP-MAIN',
  nowMs
});
ok(evaluateT30Triggers(nowMs).length === 0, 'Đã bắn rồi thì không bắn lại (chống spam)');

// ───────────────────────────────────────────────────────────────────────
console.log('\n── 3. BẮT TAY RA TRẠM ──');

const sweep1 = sweepHandshakeDeadlines(nowMs + 1000);
ok(sweep1.needReminder.length === 0 && sweep1.expired.length === 0,
   'Vừa bắn xong: chưa nhắc, chưa thu hồi');

const sweep2 = sweepHandshakeDeadlines(nowMs + T30_CONFIG.REMINDER_AFTER_MS + 1000);
ok(sweep2.needReminder.length === 1, 'Im lặng 5 phút -> đưa vào danh sách nhắc lần 2');

const confirm = riderConfirmOnTheWay({ intentId, clientLat: 11.2382, clientLng: 106.6125 });
ok(confirm.success && confirm.handshakeStatus === 'ON_THE_WAY', 'Khách bấm "Tôi đang ra trạm" thành công');
ok(confirm.distanceToHubM != null && confirm.distanceToHubM < 500, 'Tính được cự ly khách tới trạm từ GPS');

const sweep3 = sweepHandshakeDeadlines(nowMs + T30_CONFIG.HANDSHAKE_GRACE_MS + 60000);
ok(sweep3.expired.length === 0, 'Đã xác nhận thì KHÔNG bị thu hồi chỗ dù quá 10 phút');

// The second passenger is completely silent -> must have their seat reclaimed
const silent = riderCheckIn({
  hubId: 'hub_ql13_bau_bang', destinationHubId: 'hub_ql13_hang_xanh',
  seatsNeeded: 1, phone: '0909333444', name: 'Anh Tuấn'
});
markT30Notified(silent.intent.intentId, { etaMs: nowMs + 1800000, tripId: 'TRIP-MAIN', nowMs });
const sweep4 = sweepHandshakeDeadlines(nowMs + T30_CONFIG.HANDSHAKE_GRACE_MS + 1000);
ok(sweep4.expired.length === 1, 'Khách im lặng quá 10 phút -> thu hồi chỗ');
ok(sweep4.expired[0].rider.handshakeStatus === 'NO_RESPONSE', 'Đánh dấu đúng trạng thái NO_RESPONSE');

const silentPass = getRiderPass(silent.intent.intentId);
ok(silentPass.success && silentPass.intent.status === 'WAITING',
   'Thu hồi chỗ KHÔNG huỷ chuyến — khách vẫn trong hàng đợi chờ xe kế tiếp');

// ───────────────────────────────────────────────────────────────────────
console.log('\n── 4. CHUYẾN SHADOW ──');

// The primary vehicle is stuck: backs up to Tân Khai (s=44.5) and is almost stationary
telemetryPing({
  tripId: 'TRIP-MAIN', driverPhone: '0912000002', plate: '93A-541.86',
  seatsAvailable: 3, lat: 11.5620, lng: 106.6340, speed: 4
});

const atRisk = evaluateLatenessRisk(nowMs + 5 * 60 * 1000);
ok(atRisk.length >= 1, 'Radar phát hiện khách có nguy cơ trễ khi xe chính mắc kẹt');
ok(atRisk[0].lateness.probability > 0.5, `Xác suất trễ ${atRisk[0].lateness.probability} vượt ngưỡng cảnh báo`);

// No other vehicle yet -> no Shadow can be found
const noCandidate = findShadowCandidate({
  hubId: 'hub_ql13_bau_bang', seatsNeeded: 1,
  committedAtMs: atRisk[0].committedAt, excludeTripId: 'TRIP-MAIN', nowMs
});
ok(noCandidate === null, 'Chưa có xe nào khác trên tuyến -> không tìm được chuyến Shadow');

// A Shadow vehicle appears at Chơn Thành, running freely
telemetryPing({
  tripId: 'TRIP-SHADOW', driverPhone: '0912000003', driverName: 'Anh Nam',
  plate: '61A-892.41', vehicleModel: 'Toyota Vios', seatsAvailable: 4,
  lat: 11.4791, lng: 106.6694, speed: 62
});

const candidate = findShadowCandidate({
  hubId: 'hub_ql13_bau_bang', seatsNeeded: 1,
  committedAtMs: nowMs + 45 * 60 * 1000, excludeTripId: 'TRIP-MAIN', nowMs
});
ok(candidate !== null, 'Tìm được chuyến Shadow chạy sau nhưng kịp mốc cam kết');
ok(candidate.session.tripId === 'TRIP-SHADOW', 'Chọn đúng xe hỗ trợ');
ok(candidate.lateness.probability <= 0.35, 'Chỉ nhận xe có xác suất trễ thấp (<=35%)');

const beforeSwap = getRiderPass(intentId).intent;
const committedBefore = beforeSwap.safeArrivalMs;

const swap = applyShadowSwap({
  intentId, newTripId: 'TRIP-SHADOW', newEtaMs: candidate.distribution.etaMs
});
ok(swap.success, 'Hoán đổi khách sang chuyến Shadow thành công');
ok(swap.previousTripId === 'TRIP-MAIN', 'Ghi nhận đúng xe cũ để đối soát');
ok(swap.carInfo.plate === '61A-892.41', 'Thông tin xe mới được cập nhật cho khách');

const afterSwap = getRiderPass(intentId).intent;
ok(afterSwap.safeArrivalMs === committedBefore,
   'GIỮ NGUYÊN mốc giờ đã cam kết — khách không chịu hậu quả sự cố mình không gây ra');
ok(afterSwap.swapCount === 1, 'Đếm số lần hoán đổi để đối soát vận hành');
ok(afterSwap.matchedTripId === 'TRIP-SHADOW', 'Khách đã thuộc về xe hỗ trợ');

// ───────────────────────────────────────────────────────────────────────
console.log('\n── 5. CHỐNG TÁI PHÁT LỖI ĐÃ SỬA ──');

// (a) Seat leak on repeated swaps.
// Old bug: seats were only refunded when the rider was ARRIVING, but applyShadowSwap itself sets
// the rider back to OFFERED, so from the 2nd swap on the seat is deducted and never returned.
resetAllStationData();
telemetryPing({ tripId: 'SEAT-A', driverPhone: '0921', plate: 'A', seatsAvailable: 4, lat: 11.4791, lng: 106.6694, speed: 58 });
telemetryPing({ tripId: 'SEAT-B', driverPhone: '0922', plate: 'B', seatsAvailable: 4, lat: 11.4791, lng: 106.6694, speed: 58 });
const seatRider = riderCheckIn({ hubId: 'hub_ql13_bau_bang', destinationHubId: 'hub_ql13_hang_xanh', seatsNeeded: 2, phone: '0900', name: 'Ghế' });
const totalSeats = () =>
  ['SEAT-A', 'SEAT-B'].reduce((sum, id) => {
    const s = getActiveCockpitSessions().find((x) => x.tripId === id);
    return sum + (s?.seatsAvailable ?? 0);
  }, 0);

applyShadowSwap({ intentId: seatRider.intent.intentId, newTripId: 'SEAT-B' });
applyShadowSwap({ intentId: seatRider.intent.intentId, newTripId: 'SEAT-A' });
applyShadowSwap({ intentId: seatRider.intent.intentId, newTripId: 'SEAT-B' });
ok(totalSeats() === 6, `Hoán đổi 3 lần: tổng ghế còn ${totalSeats()}/8 — đúng 2 ghế bị giữ, không rò rỉ`);

applyShadowSwap({ intentId: seatRider.intent.intentId, newTripId: 'SEAT-B' });
ok(totalSeats() === 6, 'Hoán đổi về chính xe đang giữ khách không trừ ghế thêm lần nữa');

// (b) Lost GPS signal / a vehicle off the corridor must not be concluded to be late.
// Old bug: the projection fell back to marker 0, producing "100% late" for a perfectly normal driver.
resetAllStationData();
telemetryPing({ tripId: 'OFF-CORRIDOR', driverPhone: '0923', plate: 'C', seatsAvailable: 3, lat: 10.0, lng: 105.0, speed: 60 });
const offRider = riderCheckIn({ hubId: 'hub_ql13_bau_bang', destinationHubId: 'hub_ql13_hang_xanh', seatsNeeded: 1, phone: '0901', name: 'Lệch' });
markT30Notified(offRider.intent.intentId, { etaMs: nowMs + 1800000, safeEtaMs: nowMs + 2100000, tripId: 'OFF-CORRIDOR', nowMs });
ok(evaluateLatenessRisk(nowMs).length === 0,
   'Xe ngoài hành lang KHÔNG bị kết luận trễ — không cướp khách của chủ xe vì lỗi GPS');

resetAllStationData();
console.log(`\n🎉 TẤT CẢ ${passed} KIỂM THỬ ĐỀU ĐẠT\n`);
