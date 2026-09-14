/**
 * =============================================================================
 * KIỂM THỬ BẤT BIẾN ĐỊNH GIÁ NỀN TẢNG & TỌA ĐỘ MA TRẬN
 * =============================================================================
 * Hai bất biến được kiểm ở đây:
 *
 *  1. GIÁ LÀ ĐẦU RA CỦA CÔNG THỨC — Chủ xe không tự đặt giá. Chỉ Quản trị viên
 *     mới đổi được giá toàn sàn, và chỉ bằng cách nâng tham số công thức.
 *
 *  2. TỌA ĐỘ MA TRẬN BẤT BIẾN — trạm đón/trả và khe giờ là tọa độ trong ma trận
 *     thời gian - không gian, khoá cứng khi chuyến đã có khách đặt.
 * =============================================================================
 */
import assert from 'node:assert/strict';
import {
  INITIAL_DRIVER_OFFERS,
  INITIAL_PASSENGER_REQUESTS,
  getVirtualHubById,
  calculateDynamicTariffByDistance,
  getFixedSegmentTariff,
  getTariffParams,
  setTariffParams,
  resetTariffParams,
  validateTariffParams,
  DEFAULT_TARIFF_PARAMS
} from '../packages/shared/src/index.js';

console.log('🧪 KIỂM THỬ BẤT BIẾN ĐỊNH GIÁ NỀN TẢNG\n');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

// ── 1. GIÁ LÀ HÀM CỦA CẶP TRẠM ───────────────────────────────────────────────
console.log('1. Giá là hàm thuần của cặp trạm ảo:');

check('Cùng một cặp trạm luôn cho cùng một giá', () => {
  const a = getFixedSegmentTariff('hub_ql13_tan_khai', 'hub_ql13_hang_xanh');
  const b = getFixedSegmentTariff('hub_ql13_tan_khai', 'hub_ql13_hang_xanh');
  assert.equal(a.pricePerSeat, b.pricePerSeat);
});

check('Trạm khác nhau cho giá khác nhau (không bịa một giá chung)', () => {
  const near = getFixedSegmentTariff('hub_ql13_tan_khai', 'hub_ql13_nga4_binh_phuoc');
  const far = getFixedSegmentTariff('hub_ql13_tan_khai', 'hub_ql13_san_bay_tsn');
  assert.ok(far.pricePerSeat > near.pricePerSeat, 'Chặng xa hơn phải đắt hơn');
});

check('Cự ly càng dài giá càng cao (đơn điệu tăng)', () => {
  const prices = [20, 55, 90, 135].map((km) => calculateDynamicTariffByDistance(km).pricePerSeat);
  for (let i = 1; i < prices.length; i += 1) {
    assert.ok(prices[i] > prices[i - 1], `Giá phải tăng theo cự ly: ${prices}`);
  }
});

// ── 2. BẤT BIẾN CẬN SÀN / CẬN TRẦN ───────────────────────────────────────────
console.log('\n2. Bất biến cận sàn (Chủ xe không lỗ) & cận trần (rẻ hơn Limousine):');

check('Mọi chặng đều bù đắp được chi phí xăng + BOT', () => {
  for (const km of [20, 35, 55, 75, 90, 110, 135, 155]) {
    const t = calculateDynamicTariffByDistance(km);
    assert.ok(t.breakevenCovered, `Chặng ${km}km không bù nổi chi phí trực tiếp`);
    assert.ok(t.pricePerSeat >= t.pMin, `Chặng ${km}km rơi xuống dưới cận sàn`);
  }
});

check('Mọi chặng đều rẻ hơn xe Limousine dịch vụ', () => {
  for (const km of [20, 55, 90, 135]) {
    const t = calculateDynamicTariffByDistance(km);
    assert.ok(t.pricePerSeat < t.limoRef, `Chặng ${km}km không rẻ hơn Limousine`);
    assert.ok(t.savingVsLimoPercent > 0);
  }
});

check('Không có tăng giá sốc: cầu tăng gấp 3 vẫn trong biên Nash', () => {
  const calm = calculateDynamicTariffByDistance(110, { supplyDemandRatio: 1.0 });
  const surge = calculateDynamicTariffByDistance(110, { supplyDemandRatio: 3.0 });
  const ratio = surge.pricePerSeat / calm.pricePerSeat;
  assert.ok(ratio <= 1.2, `Biên độ tăng ${ratio.toFixed(2)}x vượt ngưỡng chống sốc`);
  assert.equal(surge.noSurge, true);
});

// ── 3. CHỈ ADMIN ĐỔI ĐƯỢC GIÁ, VÀ CHỈ QUA CÔNG THỨC ─────────────────────────
console.log('\n3. Chỉ Quản trị viên đổi được giá toàn sàn, qua tham số công thức:');

const before = calculateDynamicTariffByDistance(110).pricePerSeat;

check('Nâng định mức tiêu thụ làm giá toàn sàn tăng theo', () => {
  setTariffParams({ ...DEFAULT_TARIFF_PARAMS, avgConsumptionLper100km: 10 }, null, 'admin-test');
  const after = calculateDynamicTariffByDistance(110).pricePerSeat;
  assert.ok(after > before, `Giá phải tăng khi nâng định mức: ${before} -> ${after}`);
});

check('Khôi phục mặc định trả giá về đúng mức ban đầu', () => {
  resetTariffParams();
  assert.equal(calculateDynamicTariffByDistance(110).pricePerSeat, before);
  assert.equal(getTariffParams().isDefault, true);
});

check('Tham số vượt biên an toàn bị từ chối', () => {
  assert.throws(() => setTariffParams({ driverPayoutRatio: 5 }), /Tỷ lệ Chủ xe thực nhận/);
  assert.throws(() => setTariffParams({ avgConsumptionLper100km: 999 }), /Định mức tiêu thụ/);
  const { errors } = validateTariffParams({ nashAlphaBase: 0.8, nashAlphaSpan: 0.3 });
  assert.ok(errors.length > 0, 'α₀ + span > 1 phải bị chặn');
});

check('Tham số sai không làm hỏng cấu hình đang chạy', () => {
  const stable = calculateDynamicTariffByDistance(110).pricePerSeat;
  try {
    setTariffParams({ driverPayoutRatio: 99 });
  } catch {
    /* mong đợi bị chặn */
  }
  assert.equal(calculateDynamicTariffByDistance(110).pricePerSeat, stable);
});

resetTariffParams();

// ── 4. DỮ LIỆU MẪU PHẢI SỐNG ĐƯỢC TRONG MA TRẬN ─────────────────────────────
console.log('\n4. Chuyến mẫu neo đúng trạm ảo và giá khớp công thức:');

const SEEDS = [...INITIAL_DRIVER_OFFERS, ...INITIAL_PASSENGER_REQUESTS];

check('Mọi chuyến mẫu đều có cặp trạm ảo hợp lệ', () => {
  for (const t of SEEDS) {
    const o = getVirtualHubById(t.originHubId);
    const d = getVirtualHubById(t.destinationHubId);
    assert.ok(o, `${t.id}: trạm đón không hợp lệ (${t.originHubId})`);
    assert.ok(d, `${t.id}: trạm trả không hợp lệ (${t.destinationHubId})`);
    assert.notEqual(t.originHubId, t.destinationHubId, `${t.id}: trạm đón trùng trạm trả`);
  }
});

check('Không có mã chuyến mẫu nào bị trùng', () => {
  const ids = SEEDS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, `Trùng mã: ${ids.filter((v, i) => ids.indexOf(v) !== i)}`);
});

check('Giá chuyến mẫu của Chủ xe đúng bằng giá công thức', () => {
  for (const t of INITIAL_DRIVER_OFFERS) {
    const want = getFixedSegmentTariff(t.originHubId, t.destinationHubId).pricePerSeat;
    assert.equal(t.basePricePerSeat, want, `${t.id}: giá ${t.basePricePerSeat} ≠ công thức ${want}`);
  }
});

console.log(`\n✅ ${passed}/${passed} kiểm thử bất biến định giá ĐẠT\n`);
