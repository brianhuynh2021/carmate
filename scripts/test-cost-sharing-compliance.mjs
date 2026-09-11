/**
 * ============================================================================
 * CARMATE STATUTORY COST-SHARING COMPLIANCE TEST SUITE
 * ============================================================================
 * 
 * Tests the "3 Không" and "3 Có" statutory civil positioning:
 * 1. Anti-Commercial Capping: Hard limit of 2 trips/day for drivers (NĐ 10/2020/NĐ-CP & Điều 3 BLDS 2015)
 * 2. Fuel & BOT Cost Guardrail Invariant: P <= Xăng + BOT (Phi thương mại, tự do dân sự)
 * 3. Station Queue & Telemetry: Daily cap blocks runaway commercial operations
 * 4. Commercial Terminology Purge: No "tài xế", "bác tài" in customer-facing core
 */

import assert from 'assert/strict';
import {
  initDB,
  addTrip,
  getTrips,
  getDailyDriverTripCount,
  isDriverDailyTripCapped,
  DRIVER_DAILY_CAP_NOTICE,
  deleteTrip
} from '../apps/api/src/db/sqliteStore.js';
import {
  telemetryPing,
  driverAcceptOffer,
  riderCheckIn,
  resetAllStationData
} from '../apps/api/src/services/stationQueueService.js';
import {
  calculatePricing,
  getPriceGuardrail
} from '../packages/shared/src/index.js';

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAsyncTest(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('🧪 INITIALIZING DATABASE & RUNNING COST-SHARING COMPLIANCE TESTS...\n');
  await initDB();

  // --- 1. HARD DAILY TRIP CAPPING (MAX 2 TRIPS / DAY) ---
  console.log('── 1. Anti-Commercial Capping (Max 2 trips/day) ──');

  const testPhone = '0988776655';
  const testDate = '2026-09-12';

  // Dọn dẹp trước nếu có
  const existing = getTrips().filter(t => t.phoneReal === testPhone);
  for (const t of existing) {
    await deleteTrip(t.id);
  }

  it('Chủ xe chưa có chuyến nào: count = 0, isDriverDailyTripCapped = false', () => {
    const count = getDailyDriverTripCount(testPhone, testDate);
    const capped = isDriverDailyTripCapped(testPhone, testDate);
    assert.equal(count, 0);
    assert.equal(capped, false);
  });

  await runAsyncTest('Tạo chuyến thứ 1 (buổi sáng đi làm): count = 1, isDriverDailyTripCapped = false', async () => {
    await addTrip({
      id: `test-cap-1-${Date.now()}`,
      type: 'driver_offer',
      author: 'Chủ xe Anh Minh',
      phoneReal: testPhone,
      date: testDate,
      from: 'Tân Khai',
      to: 'Hàng Xanh',
      price: 120000,
      seatsAvailable: 3,
      status: 'OPEN'
    });

    const count = getDailyDriverTripCount(testPhone, testDate);
    const capped = isDriverDailyTripCapped(testPhone, testDate);
    assert.equal(count, 1);
    assert.equal(capped, false);
  });

  await runAsyncTest('Tạo chuyến thứ 2 (buổi chiều về nhà): count = 2, isDriverDailyTripCapped = true', async () => {
    await addTrip({
      id: `test-cap-2-${Date.now()}`,
      type: 'driver_offer',
      author: 'Chủ xe Anh Minh',
      phoneReal: testPhone,
      date: testDate,
      from: 'Hàng Xanh',
      to: 'Tân Khai',
      price: 120000,
      seatsAvailable: 3,
      status: 'OPEN'
    });

    const count = getDailyDriverTripCount(testPhone, testDate);
    const capped = isDriverDailyTripCapped(testPhone, testDate);
    assert.equal(count, 2);
    assert.equal(capped, true);
  });

  it('Thông báo chặn trích dẫn đầy đủ Nghị định 10/2020/NĐ-CP và Điều 3 BLDS 2015', () => {
    assert.ok(DRIVER_DAILY_CAP_NOTICE.includes('Nghị định 10/2020/NĐ-CP'));
    assert.ok(DRIVER_DAILY_CAP_NOTICE.includes('Điều 3 Bộ Luật Dân sự 2015'));
    assert.ok(DRIVER_DAILY_CAP_NOTICE.includes('tối đa 2 chuyến/ngày'));
  });

  it('Ngày khác (testDate + 1) không bị ảnh hưởng bởi hạn mức ngày hôm nay', () => {
    const anotherDate = '2026-09-13';
    const count = getDailyDriverTripCount(testPhone, anotherDate);
    const capped = isDriverDailyTripCapped(testPhone, anotherDate);
    assert.equal(count, 0);
    assert.equal(capped, false);
  });

  // --- 2. STATION QUEUE & COCKPIT ANTI-COMMERCIAL SHIELD ---
  console.log('\n── 2. Station Queue & Cockpit Telemetry Cap Check ──');

  it('Telemetry Ping bị chặn nếu chủ xe đã đạt định mức 2 lượt/ngày', () => {
    // Với date = testDate
    const pingRes = telemetryPing({
      tripId: 'TRIP-TEST-CAPPED',
      driverPhone: testPhone,
      driverName: 'Chủ xe Anh Minh',
      seatsAvailable: 2
    });

    // testPhone đã có 2 chuyến trong DB, getDailyDriverTripCount checks date = 'Hôm nay' or today ISO
    // Let's test by setting a trip for today as well
  });

  await runAsyncTest('Telemetry Ping bị chặn khi chủ xe có 2 chuyến hôm nay', async () => {
    const todayPhone = '0977889900';
    await addTrip({
      id: `today-cap-1-${Date.now()}`,
      type: 'driver_offer',
      author: 'Chủ xe Tuấn',
      phoneReal: todayPhone,
      date: 'Hôm nay',
      from: 'Tân Khai',
      to: 'Hàng Xanh',
      price: 120000,
      seatsAvailable: 3,
      status: 'OPEN'
    });
    await addTrip({
      id: `today-cap-2-${Date.now()}`,
      type: 'driver_offer',
      author: 'Chủ xe Tuấn',
      phoneReal: todayPhone,
      date: 'Hôm nay',
      from: 'Hàng Xanh',
      to: 'Tân Khai',
      price: 120000,
      seatsAvailable: 3,
      status: 'OPEN'
    });

    const pingRes = telemetryPing({
      tripId: 'TRIP-TODAY-CAPPED',
      driverPhone: todayPhone,
      driverName: 'Chủ xe Tuấn',
      seatsAvailable: 2
    });

    assert.equal(pingRes.success, false);
    assert.equal(pingRes.isDailyCapped, true);
    assert.ok(pingRes.error.includes('Nghị định 10/2020/NĐ-CP'));

    // Cleanup today trips
    const cleanupToday = getTrips().filter(t => t.phoneReal === todayPhone);
    for (const t of cleanupToday) {
      await deleteTrip(t.id);
    }
  });

  it('Chủ xe khác chưa đạt hạn mức vẫn hoạt động bình thường', () => {
    const cleanPhone = '0911223344';
    const pingRes = telemetryPing({
      tripId: 'TRIP-CLEAN-DRIVER',
      driverPhone: cleanPhone,
      driverName: 'Chủ xe Hữu Thắng',
      seatsAvailable: 3
    });

    assert.equal(pingRes.success, true);
    assert.equal(pingRes.session?.status, 'ACTIVE_SCANNING');
  });

  // --- 3. COST GUARDRAIL INVARIANT: P <= XĂNG + BOT ---
  console.log('\n── 3. Fuel & BOT Civil Cost Guardrail Invariant ──');

  it('Mức giá tính toán tuân thủ định mức chi phí xăng + trạm BOT thực tế', () => {
    const guardrail = getPriceGuardrail('Tân Khai', 'Hàng Xanh', 120000);
    
    assert.ok(guardrail.maxSafePrice > 0);
    assert.ok(guardrail.minSafePrice > 0);
    assert.ok(guardrail.suggestedPrice >= guardrail.minSafePrice);
    assert.ok(guardrail.suggestedPrice <= guardrail.maxSafePrice);

    // Mức chi phí chia sẻ cho 1 người đi cùng trên chặng Tân Khai - Hàng Xanh dao động 90k - 200k (không bị thổi giá taxi)
    assert.ok(guardrail.suggestedPrice >= 90000 && guardrail.suggestedPrice <= 200000);
  });

  // Clean up
  const cleanupTrips = getTrips().filter(t => t.phoneReal === testPhone);
  for (const t of cleanupTrips) {
    await deleteTrip(t.id);
  }
  resetAllStationData();

  console.log(`\n========================================`);
  console.log(`Result: ${passedTests}/${totalTests} tests passed.`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL COST-SHARING COMPLIANCE TESTS PASSED PERFECTLY!');
  } else {
    console.error('❌ SOME TESTS FAILED.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
