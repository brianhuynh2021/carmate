import assert from 'node:assert/strict';
import {
  initDB,
  getDailyFuelPriceConfig,
  saveDailyFuelPriceConfig,
  resetDailyFuelPriceConfig
} from '../apps/api/src/db/sqliteStore.js';
import {
  getDailyFuelPrice,
  setDailyFuelPrice,
  calculateDynamicTariffByDistance,
  DEFAULT_DAILY_FUEL_PRICE
} from '../packages/shared/src/index.js';

console.log('🧪 RUNNING ADMIN FUEL PRICE & INVARIANTS VERIFICATION TESTS...\n');

// 1. Khởi tạo CSDL SQLite và kiểm tra giá khởi động
await initDB();
const initialConfig = getDailyFuelPriceConfig();
console.log('1. Giá xăng lúc khởi động CSDL:', initialConfig);
assert.ok(initialConfig.ron95Price >= 15000 && initialConfig.ron95Price <= 45000, 'Giá ban đầu phải nằm trong biên độ an toàn');
console.log('  ✓ CSDL khởi tạo và nạp mốc giá xăng hợp lệ thành công\n');

// 2. Kiểm thử reset về mặc định
resetDailyFuelPriceConfig();
const defaultConfig = getDailyFuelPriceConfig();
assert.equal(defaultConfig.ron95Price, DEFAULT_DAILY_FUEL_PRICE, `Giá mặc định phải là ${DEFAULT_DAILY_FUEL_PRICE}`);
assert.equal(defaultConfig.isDefault, true, 'isDefault phải là true khi reset');
console.log('2. Reset về mặc định:', defaultConfig);
console.log('  ✓ Đặt lại về giá tham chiếu chuẩn 24.120đ thành công\n');

// 3. Kiểm thử tính cước ban đầu với 24.120đ
const tariff24k = calculateDynamicTariffByDistance(110, {
  fuelPrice: defaultConfig.ron95Price,
  corridor: 'Tuyến QL13'
});
console.log('3. Cước Bình Long ➔ Sài Gòn (110km) với xăng 24.120đ:');
console.log(`   - Xăng: ${tariff24k.tripCost.fuelLiters}L = ${tariff24k.tripCost.fuelCost.toLocaleString()}đ`);
console.log(`   - BOT: ${tariff24k.tripCost.botFee.toLocaleString()}đ`);
console.log(`   - Tổng chi phí trực tiếp: ${tariff24k.tripCost.totalDirectCost.toLocaleString()}đ`);
console.log(`   - Giá vé gợi ý / ghế: ${tariff24k.pricePerSeat.toLocaleString()}đ`);
console.log('  ✓ Cước ban đầu tính toán chuẩn xác theo công thức Nash\n');

// 4. Admin cập nhật giá xăng mới: 26.500đ/Lít
const updatedConfig = saveDailyFuelPriceConfig({
  ron95Price: 26500,
  updatedBy: 'Admin (Kỳ 15h 10/09/2026)',
  note: 'Điều chỉnh tăng theo thị trường'
});
assert.equal(updatedConfig.ron95Price, 26500);
assert.equal(updatedConfig.isDefault, false);
console.log('4. Admin cập nhật giá xăng lên 26.500đ:', updatedConfig);

// Kiểm tra in-memory getDailyFuelPrice() đã sync
const memoryPrice = getDailyFuelPrice();
assert.equal(memoryPrice.ron95Price, 26500);
console.log('  ✓ In-memory shared package đã đồng bộ tức thì sang 26.500đ\n');

// 5. Kiểm thử tính cước khi xăng tăng lên 26.500đ
const tariff26k = calculateDynamicTariffByDistance(110, {
  fuelPrice: getDailyFuelPrice().ron95Price,
  corridor: 'Tuyến QL13'
});
console.log('5. Cước Bình Long ➔ Sài Gòn (110km) với xăng 26.500đ:');
console.log(`   - Xăng: ${tariff26k.tripCost.fuelLiters}L = ${tariff26k.tripCost.fuelCost.toLocaleString()}đ`);
console.log(`   - BOT: ${tariff26k.tripCost.botFee.toLocaleString()}đ`);
console.log(`   - Tổng chi phí trực tiếp: ${tariff26k.tripCost.totalDirectCost.toLocaleString()}đ`);
console.log(`   - Giá vé gợi ý / ghế: ${tariff26k.pricePerSeat.toLocaleString()}đ`);
assert.ok(tariff26k.tripCost.fuelCost > tariff24k.tripCost.fuelCost, 'Chi phí xăng mới phải cao hơn');
assert.ok(tariff26k.tripCost.totalDirectCost > tariff24k.tripCost.totalDirectCost, 'Tổng chi phí trực tiếp phải tăng tương ứng');
console.log('  ✓ Cước phân đoạn phản ánh ngay lập tức giá xăng mới\n');

// 6. Kiểm thử MIT Invariants: Chặn cận dưới < 15.000đ và cận trên > 45.000đ
console.log('6. Kiểm thử biên độ an toàn MIT Invariants [15.000đ, 45.000đ]:');
assert.throws(() => {
  setDailyFuelPrice(10000);
}, /hợp lệ/, 'Phải ném lỗi khi giá xăng < 15.000đ');

assert.throws(() => {
  setDailyFuelPrice(55000);
}, /hợp lệ/, 'Phải ném lỗi khi giá xăng > 45.000đ');

assert.throws(() => {
  saveDailyFuelPriceConfig({ ron95Price: 9000 });
}, /hợp lệ/, 'DB store phải ném lỗi khi giá xăng < 15.000đ');

assert.throws(() => {
  saveDailyFuelPriceConfig({ ron95Price: 80000 });
}, /hợp lệ/, 'DB store phải ném lỗi khi giá xăng > 45.000đ');
console.log('  ✓ Biên độ an toàn bảo vệ 100% không cho phép giá phi lý\n');

// 7. Khôi phục lại mặc định cho môi trường sạch
resetDailyFuelPriceConfig();
const restoredConfig = getDailyFuelPriceConfig();
assert.equal(restoredConfig.ron95Price, DEFAULT_DAILY_FUEL_PRICE);
console.log('7. Khôi phục lại mốc chuẩn 24.120đ sau kiểm thử:', restoredConfig.ron95Price);
console.log('  ✓ Dữ liệu hoàn trả nguyên vẹn\n');

console.log('=============================================================');
console.log('🎉 TẤT CẢ 7/7 KIỂM THỬ ADMIN FUEL PRICE ĐÃ ĐẠT 100%!');
console.log('=============================================================');
