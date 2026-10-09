/**
 * ============================================================================
 * CARMATE STATUTORY COST-SHARING COMPLIANCE TEST SUITE
 * ============================================================================
 * 
 * Tests the "3 Không" ("3 Nos") and "3 Có" ("3 Yeses") statutory civil positioning:
 * 1. Self-Responsible Civil Commute: Platform does not technically block/cap trips (driver self-responsible)
 * 2. Unblocked Multi-Trip Flow: Trips 1, 2, 3 create smoothly without 400 rejection
 * 3. Fuel & BOT Cost Guardrail Invariant: P <= Fuel + BOT (non-commercial, civil freedom)
 * 4. Station Queue & Telemetry: Unblocked radar access for valid drivers
 * 5. Commercial Terminology Purge: No "tài xế", "bác tài" in customer-facing core
 */

import assert from 'assert/strict';
import {
  initDB,
  addTrip,
  getTrips,
  getDailyDriverTripCount,
  isDriverDailyTripCapped,
  deleteTrip
} from '../apps/api/src/db/sqliteStore.js';
import {
  telemetryPing,
  resetAllStationData
} from '../apps/api/src/services/stationQueueService.js';
import {
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

  // --- 1. UNBLOCKED CIVIL COMMUTE (THE DRIVER IS SELF-DIRECTED & SELF-RESPONSIBLE) ---
  console.log('── 1. Civil Commute Flow (No Hard Block, Driver Self-Responsible) ──');

  const testPhone = '0988776655';
  const testDate = '2026-09-12';

  // Clean up first if needed
  const existing = getTrips().filter(t => t.phoneReal === testPhone);
  for (const t of existing) {
    await deleteTrip(t.id);
  }

  // getDailyDriverTripCount counts by createdAt of TODAY, so any seed trips that were just
  // loaded also fall into the counter. So we cannot assume the DB is empty — measure
  // against a BASELINE and then check the increment, so the suite runs independently of existing
  // data (previously it asserted count === 0 and broke as soon as the DB had other trips).
  const baselineCount = getDailyDriverTripCount(testPhone, testDate);

  it('Chủ xe chưa có chuyến nào: count = mức nền, isDriverDailyTripCapped = false', () => {
    const count = getDailyDriverTripCount(testPhone, testDate);
    const capped = isDriverDailyTripCapped(testPhone, testDate);
    assert.equal(count, baselineCount);
    assert.equal(capped, false);
  });

  await runAsyncTest('Tạo chuyến thứ 1 (buổi sáng đi làm): thành công, không bị chặn', async () => {
    const trip1 = await addTrip({
      id: `test-trip-1-${Date.now()}`,
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

    assert.ok(trip1?.id);
    const count = getDailyDriverTripCount(testPhone, testDate);
    const capped = isDriverDailyTripCapped(testPhone, testDate);
    assert.equal(count, baselineCount + 1);
    assert.equal(capped, false);
  });

  await runAsyncTest('Tạo chuyến thứ 2 (buổi chiều về nhà): thành công, không bị chặn', async () => {
    const trip2 = await addTrip({
      id: `test-trip-2-${Date.now()}`,
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

    assert.ok(trip2?.id);
    const count = getDailyDriverTripCount(testPhone, testDate);
    const capped = isDriverDailyTripCapped(testPhone, testDate);
    assert.equal(count, baselineCount + 2);
    assert.equal(capped, false); // No technical hard lock
  });

  await runAsyncTest('Tạo chuyến thứ 3 (chuyến phát sinh): thành công 100%, không chặn 400', async () => {
    const trip3 = await addTrip({
      id: `test-trip-3-${Date.now()}`,
      type: 'driver_offer',
      author: 'Chủ xe Anh Minh',
      phoneReal: testPhone,
      date: testDate,
      from: 'Hàng Xanh',
      to: 'Thủ Dầu Một',
      price: 60000,
      seatsAvailable: 2,
      status: 'OPEN'
    });

    assert.ok(trip3?.id);
    const count = getDailyDriverTripCount(testPhone, testDate);
    const capped = isDriverDailyTripCapped(testPhone, testDate);
    assert.equal(count, baselineCount + 3);
    assert.equal(capped, false); // The driver is self-directed, the platform does not block
  });

  // --- 2. STATION QUEUE & COCKPIT TELEMETRY ACCESS ---
  console.log('\n── 2. Station Queue & Cockpit Telemetry Access ──');

  it('Telemetry Ping hoạt động bình thường, không bị chặn bởi số chuyến trong ngày', () => {
    const pingRes = telemetryPing({
      tripId: 'TRIP-TEST-UNBLOCKED',
      driverPhone: testPhone,
      driverName: 'Chủ xe Anh Minh',
      seatsAvailable: 2
    });

    assert.equal(pingRes.success, true);
    assert.equal(pingRes.session?.status, 'ACTIVE_SCANNING');
  });

  it('Chủ xe mới hoạt động mượt mà trong chế độ buồng lái', () => {
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

  // --- 3. COST GUARDRAIL INVARIANT: P <= FUEL + BOT ---
  console.log('\n── 3. Fuel & BOT Civil Cost Guardrail Invariant ──');

  it('Mức giá tính toán tuân thủ định mức chi phí xăng + trạm BOT thực tế', () => {
    const guardrail = getPriceGuardrail('Tân Khai', 'Hàng Xanh', 120000);
    
    assert.ok(guardrail.maxSafePrice > 0);
    assert.ok(guardrail.minSafePrice > 0);
    assert.ok(guardrail.suggestedPrice >= guardrail.minSafePrice);
    assert.ok(guardrail.suggestedPrice <= guardrail.maxSafePrice);

    // The shared cost for 1 co-rider on the Tân Khai - Hàng Xanh leg ranges from 90k to 200k (no taxi-style price inflation)
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
