/**
 * ============================================================================
 * KIỂM THỬ TOÀN DIỆN CỖ MÁY CARMATE CẤP ĐỘ 3 (LEVEL 3 ENGINE TEST SUITE)
 * ============================================================================
 * 
 * 1. Mạng lưới Trạm đón ảo (Virtual Hubs & DARP-MP)
 * 2. Đón Tận Cửa Bù Trừ Minh Bạch (Compensated Doorstep Pricing)
 * 3. Đồ Thị Khả Năng Chia Sẻ (MIT Shareability Graph)
 * 4. Ghép Cặp Ổn Định Gale-Shapley (Deferred Acceptance - Nobel Memorial Prize)
 * 5. Thang Phạt Dốc Thời Gian (Time-Decay Penalty Engine)
 * 6. Mạng Lưới Cứu Hộ Đệm Khẩn Cấp (Standby Buffer Protocol)
 * 7. Tích Hợp API Thực Tế (E2E Endpoints: /api/intents, /api/intents/match, /api/intents/epochs)
 */

import {
  VIRTUAL_HUBS,
  DOORSTEP_CONFIG,
  getVirtualHubsByCorridor,
  findNearestVirtualHub
} from '@carmate/shared';

import {
  calculateShapleyFairPrice,
  buildShareabilityGraph,
  galeShapleyStableMatch,
  findStandbyBufferOffer,
  runBatchMatchingEpoch
} from '../apps/api/src/services/batchMatchingEngine.js';

import {
  initDB,
  createIntent,
  deleteIntent,
  applyCancellationPenalty,
  saveUser,
  getUserByPhone,
  deleteUserAccount
} from '../apps/api/src/db/sqliteStore.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runLevel3Suite() {
  console.log('\n=============================================================');
  console.log('🚀 KHỞI ĐỘNG BỘ KIỂM THỬ CARMATE CẤP ĐỘ 3 (AUTONOMOUS ENGINE)');
  console.log('=============================================================\n');

  await initDB();

  // --- 1. KIỂM THỬ MẠNG LƯỚI TRẠM ĐÓN ẢO & CẤU HÌNH DOORSTEP ---
  console.log('--- 1. Kiểm thử Trạm đón ảo (Virtual Hubs) & Cấu hình Đón Tận Cửa ---');
  assert(Array.isArray(VIRTUAL_HUBS) && VIRTUAL_HUBS.length >= 15, `Đầy đủ trạm đón ảo (hiện có ${VIRTUAL_HUBS.length} trạm)`);
  
  const ql13Hubs = getVirtualHubsByCorridor('Tuyến QL13');
  assert(ql13Hubs.length >= 8, `Hành lang Tuyến QL13 có ${ql13Hubs.length} trạm đón ảo chuẩn hóa`);
  
  const n2Hubs = getVirtualHubsByCorridor('Tuyến N2');
  assert(n2Hubs.length >= 6, `Hành lang Tuyến N2 có ${n2Hubs.length} trạm đón ảo kết nối Miền Tây`);

  // Kiểm tra thời gian dừng đón 5 phút (300 giây)
  const sampleHub = ql13Hubs[0];
  assert(sampleHub.curbsideWindowSeconds === 300, 'Quy chuẩn dừng đón tối đa 5 phút (300 giây curbside window)');

  // Kiểm tra tìm trạm gần nhất
  const nearest = findNearestVirtualHub(11.84, 106.59, 'Tuyến QL13');
  assert(nearest && nearest.name.includes('Lộc Ninh'), `Tìm trạm ảo gần nhất chuẩn xác: ${nearest?.name}`);

  // Cấu hình Đón Tận Nhà
  assert(DOORSTEP_CONFIG.DEFAULT_SURCHARGE === 40000, 'Phụ phí đón tận nhà chuẩn 40.000đ hỗ trợ xăng ngõ ngách');
  assert(DOORSTEP_CONFIG.MAX_NEIGHBORHOOD_RADIUS_KM <= 2.0, 'Bán kính láng giềng ghép đón tận nhà <= 2km (tiện lợi cho bà con, an toàn cho chủ xe)');
  assert(DOORSTEP_CONFIG.COMPENSATION_DISCOUNT_RATIO === 0.5, '50% phụ phí được chia lại đền bù cho các khách khác cùng xe');

  // --- 2. KIỂM THỬ ĐỊNH GIÁ SHAPLEY FAIR PRICING & COMPENSATED DOORSTEP ---
  console.log('\n--- 2. Kiểm thử Định giá Toán học Shapley Value & Bồi thường Đón Cửa ---');
  // Chuyến chuẩn QL13 (149km): 1 khách thường
  const normalPrice = calculateShapleyFairPrice({
    distanceKm: 149,
    corridor: 'Tuyến QL13',
    numPassengers: 1,
    isDoorstep: false,
    otherPassengersCount: 0
  });
  assert(normalPrice.finalPrice > 0, `Giá Shapley chuẩn: ${normalPrice.finalPrice.toLocaleString('vi-VN')}đ`);
  assert(normalPrice.doorstepSurcharge === 0, 'Khách đón tại Trạm ảo phụ phí = 0đ');

  // 1 khách có con nhỏ chọn đón tận nhà (+40k)
  const doorstepPrice = calculateShapleyFairPrice({
    distanceKm: 149,
    corridor: 'Tuyến QL13',
    numPassengers: 1,
    isDoorstep: true,
    otherPassengersCount: 0
  });
  assert(
    doorstepPrice.finalPrice === normalPrice.basePrice + 40000,
    `Khách đón tận cửa trả thêm đúng 40.000đ: ${doorstepPrice.finalPrice.toLocaleString('vi-VN')}đ`
  );

  // Khách thứ 2 đón ở trạm ảo được giảm trừ tiền đền bù thời gian chờ
  const compensatedOther = calculateShapleyFairPrice({
    distanceKm: 149,
    corridor: 'Tuyến QL13',
    numPassengers: 1,
    isDoorstep: false,
    otherPassengersCount: 1
  });
  assert(
    compensatedOther.compensationDiscount === 20000,
    `Khách cùng xe được giảm trừ đúng 20.000đ (50% của 40k): Tiết kiệm còn ${compensatedOther.finalPrice.toLocaleString('vi-VN')}đ`
  );

  // --- 3. KIỂM THỬ ĐỒ THỊ CHIA SẺ & THUẬT TOÁN GALE-SHAPLEY ---
  console.log('\n--- 3. Kiểm thử Đồ thị Shareability & Thuật toán Ghép Cặp Gale-Shapley ---');
  const mockDrivers = [
    { id: 'DRV-1', authorName: 'Chủ xe 1', phone: '0911000001', seats: 3, routeCategory: 'Tuyến QL13', trustScore: 98, from: 'Lộc Ninh', to: 'Sài Gòn' },
    { id: 'DRV-2', authorName: 'Chủ xe 2', phone: '0911000002', seats: 2, routeCategory: 'Tuyến QL13', trustScore: 95, from: 'Bình Long', to: 'Sài Gòn' }
  ];

  const mockPassengers = [
    { id: 'PAS-1', contactName: 'Khách 1', phone: '0988000001', seats: 1, routeCategory: 'Tuyến QL13', trustScore: 98, from: 'Lộc Ninh', to: 'Sài Gòn', isDoorstep: 0 },
    { id: 'PAS-2', contactName: 'Khách 2', phone: '0988000002', seats: 2, routeCategory: 'Tuyến QL13', trustScore: 92, from: 'Lộc Ninh', to: 'Sài Gòn', isDoorstep: 1 },
    { id: 'PAS-3', contactName: 'Khách 3', phone: '0988000003', seats: 1, routeCategory: 'Tuyến QL13', trustScore: 95, from: 'Bình Long', to: 'Sài Gòn', isDoorstep: 0 },
    { id: 'PAS-4', contactName: 'Khách 4', phone: '0988000004', seats: 1, routeCategory: 'Tuyến QL13', trustScore: 90, from: 'Bình Long', to: 'Sài Gòn', isDoorstep: 0 }
  ];

  const graph = buildShareabilityGraph(mockDrivers, mockPassengers);
  assert(graph.edges.length > 0, `Dựng đồ thị thành công với ${graph.edges.length} liên kết tương thích`);

  const matchResult = galeShapleyStableMatch(graph);
  assert(matchResult.totalMatchedDrivers >= 1, `Ghép được ${matchResult.totalMatchedDrivers} chủ xe`);
  assert(matchResult.totalMatchedPassengers >= 3, `Ghép thành công ${matchResult.totalMatchedPassengers} hành khách`);
  
  const avgUtilization = Math.round(
    matchResult.matchedClusters.reduce((sum, c) => sum + c.seatUtilizationRate, 0) / matchResult.matchedClusters.length
  );
  assert(avgUtilization >= 80, `Tỷ lệ tối ưu ghế đạt ${avgUtilization}% (chuẩn hiệu quả toàn cục)`);

  // --- 4. KIỂM THỬ THANG PHẠT THỜI GIAN HỦY (TIME-DECAY PENALTY ENGINE) ---
  console.log('\n--- 4. Kiểm thử Kỷ luật Hủy Chuyến (Time-Decay Penalty Engine) ---');
  const testUserPhone = '0933999999';
  await saveUser({
    phone: testUserPhone,
    name: 'Người dùng Thử nghiệm',
    trustScore: 98
  });

  const mockBooking = {
    escrowId: 'ESC-TEST-PENALTY',
    tripId: 'DRV-1',
    passengerPhone: testUserPhone
  };

  // Kịch bản A: Hủy trước 3 tiếng (> 120 phút) -> Safe Free
  const penaltySafe = await applyCancellationPenalty(mockBooking, testUserPhone, 180);
  assert(penaltySafe.penaltyTier === 'safe_free', 'Hủy trước 3 tiếng: Tier = safe_free');
  assert(penaltySafe.penaltyPoints === 0, 'Hủy trước 3 tiếng: Không bị trừ điểm tín nhiệm (0 pts)');

  // Kịch bản B: Hủy cận giờ (60 phút) -> Warning (-15 pts)
  const penaltyWarn = await applyCancellationPenalty(mockBooking, testUserPhone, 60);
  assert(penaltyWarn.penaltyTier === 'warning', 'Hủy trước 60 phút: Tier = warning');
  assert(penaltyWarn.penaltyPoints === 15, 'Hủy trước 60 phút: Trừ 15 điểm tín nhiệm');
  let updatedUser = getUserByPhone(testUserPhone);
  assert(updatedUser.trustScore === 83, `Điểm tín nhiệm sau phạt cảnh cáo: ${updatedUser.trustScore} (98 - 15)`);

  // Kịch bản C: Hủy sát giờ (15 phút) -> Severe Freeze (-40 pts & Khoá 7 ngày)
  const penaltySevere = await applyCancellationPenalty(mockBooking, testUserPhone, 15);
  assert(penaltySevere.penaltyTier === 'severe_freeze', 'Hủy trước 15 phút: Tier = severe_freeze');
  assert(penaltySevere.penaltyPoints === 40, 'Hủy trước 15 phút: Trừ 40 điểm tín nhiệm');
  assert(penaltySevere.freezeDays === 7, 'Hủy trước 15 phút: Tạm khoá tài khoản 7 ngày');
  updatedUser = getUserByPhone(testUserPhone);
  assert(updatedUser.trustScore === 43, `Điểm tín nhiệm sau vi phạm nặng: ${updatedUser.trustScore} (83 - 40)`);
  assert(updatedUser.freezeUntil > Date.now(), 'Tài khoản đã bị đóng băng tự động');

  // Dọn sạch user test
  await deleteUserAccount(updatedUser.id, testUserPhone);

  // --- 5. KIỂM THỬ MẠNG LƯỚI CỨU HỘ ĐỆM KHẨN CẤP (STANDBY BUFFER) ---
  console.log('\n--- 5. Kiểm thử Radar Cứu hộ Đệm Khẩn cấp (Standby Buffer) ---');
  const primaryRequest = {
    tripId: 'DRV-MAIN',
    direction: 'SG_BINHPHUOC',
    seats: 1
  };
  const activeOffers = [
    { id: 'DRV-MAIN', authorName: 'Chủ xe chính', direction: 'SG_BINHPHUOC', seats: 2, trustScore: 90 },
    { id: 'DRV-STANDBY-1', authorName: 'Chủ xe dự phòng 1', direction: 'SG_BINHPHUOC', seats: 2, trustScore: 98 },
    { id: 'DRV-STANDBY-2', authorName: 'Chủ xe dự phòng 2', direction: 'BINHPHUOC_SG', seats: 2, trustScore: 99 } // Ngược chiều
  ];

  const standby = findStandbyBufferOffer(primaryRequest, activeOffers);
  assert(standby !== null, 'Tìm thấy xe dự phòng khả thi trong buffer');
  assert(standby.id === 'DRV-STANDBY-1', `Xe dự phòng ưu tiên đúng: ${standby.authorName} (${standby.id})`);

  // --- 6. KIỂM THỬ TÍCH HỢP HỆ THỐNG GOM PHIÊN (BATCH MATCHING EPOCH) ---
  console.log('\n--- 6. Kiểm thử Điều phối Phiên Khớp Lệnh (Batch Matching Epoch) ---');
  // Tạo 1 Driver Intent và 1 Passenger Intent
  const driverIntent = await createIntent({
    role: 'driver',
    originHubId: 'hub_ql13_cho_loc_ninh',
    originName: 'Chợ Lộc Ninh',
    destinationHubId: 'hub_ql13_hang_xanh',
    destinationName: 'Ngã tư Hàng Xanh',
    corridor: 'Tuyến QL13',
    phone: '0911223344',
    contactName: 'Chủ xe QL13 Test',
    seats: 3
  });

  const passengerIntent = await createIntent({
    role: 'passenger',
    originHubId: 'hub_ql13_cho_loc_ninh',
    originName: 'Chợ Lộc Ninh',
    destinationHubId: 'hub_ql13_hang_xanh',
    destinationName: 'Ngã tư Hàng Xanh',
    corridor: 'Tuyến QL13',
    phone: '0988776655',
    contactName: 'Khách Đi Cùng Test',
    seats: 1,
    isDoorstep: 1,
    doorstepAddress: 'Hẻm 12 Lộc Tấn'
  });

  assert(driverIntent.id && passengerIntent.id, 'Tạo các Intent thành công vào SQLite');

  // Chạy gom phiên vi mô
  const epochResult = await runBatchMatchingEpoch({
    epochType: 'micro_batch',
    corridor: 'Tuyến QL13'
  });

  assert(epochResult.success === true, 'Thực thi gom phiên vi mô thành công');
  assert(epochResult.totalMatchedDrivers >= 1, `Khớp lệnh thành công ${epochResult.totalMatchedDrivers} chủ xe`);
  assert(epochResult.totalMatchedPassengers >= 1, `Khớp lệnh thành công ${epochResult.totalMatchedPassengers} khách`);

  // Dọn sạch intents sau test
  await deleteIntent(driverIntent.id);
  await deleteIntent(passengerIntent.id);

  // =============================================================
  console.log('\n=============================================================');
  console.log('📊 TỔNG KẾT BỘ KIỂM THỬ CARMATE CẤP ĐỘ 3 (LEVEL 3):');
  console.log(`- Tổng số bài test: ${passedTests + failedTests}`);
  console.log(`- Số bài ĐẠT (PASS): ${passedTests} / ${passedTests + failedTests} (${Math.round((passedTests / (passedTests + failedTests)) * 100)}%)`);
  console.log(`- Số bài LỖI (FAIL): ${failedTests}`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('🎉 TẤT CẢ KIỂM THỬ LEVEL 3 ĐÃ ĐẠT 100%! HỆ THỐNG SẴN SÀNG TRIỂN KHAI VẬN HÀNH.\n');
  }
}

runLevel3Suite().catch((err) => {
  console.error('Lỗi khi chạy bộ kiểm thử Level 3:', err);
  process.exit(1);
});
