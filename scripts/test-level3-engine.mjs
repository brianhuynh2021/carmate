/**
 * ============================================================================
 * KIỂM THỬ TOÀN DIỆN CỖ MÁY CARMATE CẤP ĐỘ 3 (LEVEL 3 ENGINE TEST SUITE)
 * ============================================================================
 * 
 * 1. Mạng lưới Trạm đón ảo (Virtual Hubs & DARP-MP)
 * 2. Phân Bổ Chi Phí Công Bằng Shapley (100% Trạm Cây Xăng Trục Lộ)
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
  findNearestVirtualHub,
  getVirtualHubById,
  getFixedSegmentTariff,
  CORRIDOR_FIXED_SEGMENTS,
  calculateDynamicTariffByDistance,
  getDailyFuelPrice,
  setDailyFuelPrice,
  projectToCorridorFrenet,
  calculateKinematicTriggerDistance,
  isIntervalSchedulingFeasible
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
  saveUser,
  getUserByPhone,
  deleteUserAccount,
  createIntent,
  deleteIntent,
  applyCancellationPenalty
} from '../apps/api/src/db/sqliteStore.js';

import {
  riderCheckIn,
  getStationQueue,
  getRiderPass,
  telemetryPing,
  driverAcceptOffer,
  driverRejectOffer,
  driverVerifyPin,
  resetAllStationData
} from '../apps/api/src/services/stationQueueService.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    failedTests++;
    console.error(`❌ THẤT BẠI: ${message}`);
    process.exit(1);
  }
  passedTests++;
  console.log(`✅ ${message}`);
}

async function runLevel3Suite() {
  console.log('\n=============================================================');
  console.log('🚀 KHỞI ĐỘNG BỘ KIỂM THỬ CARMATE CẤP ĐỘ 3 (AUTONOMOUS ENGINE)');
  console.log('=============================================================\n');

  await initDB();

  // --- 1. KIỂM THỬ MẠNG LƯỚI TRẠM ĐÓN ẢO & CẤU HÌNH HUB ---
  console.log('--- 1. Kiểm thử Trạm đón ảo (Virtual Hubs) & Cấu hình 100% Trạm Cây Xăng ---');
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

  // Cấu hình Đón Trả 100% Trạm Cây Xăng (Triệt tiêu Đón Tận Nhà & Chia Tiền)
  assert(DOORSTEP_CONFIG.ENABLED === false, 'Hệ thống chuẩn hoá 100% đón tại trạm cây xăng Petrolimex (doorstep disabled)');
  assert(DOORSTEP_CONFIG.DEFAULT_SURCHARGE === 0, 'Phụ phí đón tận nhà = 0đ (loại bỏ hoàn toàn phụ thu ngõ ngách)');
  assert(DOORSTEP_CONFIG.COMPENSATION_DISCOUNT_RATIO === 0, 'Không chia chác tiền đền bù giữa các hành khách');

  // --- 2. KIỂM THỬ ĐỊNH GIÁ SHAPLEY FAIR PRICING (100% TRẠM CÂY XĂNG) ---
  console.log('\n--- 2. Kiểm thử Định giá Toán học Shapley Value (100% Trạm Cây Xăng) ---');
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
  assert(normalPrice.compensationDiscount === 0, 'Không chia tiền đền bù (triệt tiêu đón tận nhà)');

  // Bất biến: Giá vé chuẩn hóa 100% theo cự ly, không thu phụ phí đón tận nhà, không chia bù đắp
  const doorstepAttempt = calculateShapleyFairPrice({
    distanceKm: 149,
    corridor: 'Tuyến QL13',
    numPassengers: 1,
    isDoorstep: true,
    otherPassengersCount: 2
  });
  assert(
    doorstepAttempt.finalPrice === normalPrice.basePrice,
    `Bất biến giá công bằng: 100% khách trả đúng giá phân đoạn ${doorstepAttempt.finalPrice.toLocaleString('vi-VN')}đ (không phụ thu đón nhà, không chia bù đắp)`
  );
  assert(doorstepAttempt.doorstepSurcharge === 0, 'Phụ phí đón nhà triệt tiêu = 0đ');
  assert(doorstepAttempt.compensationDiscount === 0, 'Giảm trừ đền bù triệt tiêu = 0đ');

  // --- 3. KIỂM THỬ ĐỒ THỊ CHIA SẺ & THUẬT TOÁN GALE-SHAPLEY ---
  console.log('\n--- 3. Kiểm thử Đồ thị Shareability & Thuật toán Ghép Cặp Gale-Shapley ---');
  const mockDrivers = [
    { id: 'DRV-1', authorName: 'Chủ xe 1', phone: '0911000001', seats: 3, routeCategory: 'Tuyến QL13', trustScore: 98, from: 'Lộc Ninh', to: 'Sài Gòn' },
    { id: 'DRV-2', authorName: 'Chủ xe 2', phone: '0911000002', seats: 2, routeCategory: 'Tuyến QL13', trustScore: 95, from: 'Bình Long', to: 'Sài Gòn' }
  ];

  const mockPassengers = [
    { id: 'PAS-1', contactName: 'Khách 1', phone: '0988000001', seats: 1, routeCategory: 'Tuyến QL13', trustScore: 98, from: 'Lộc Ninh', to: 'Sài Gòn', isDoorstep: 0 },
    { id: 'PAS-2', contactName: 'Khách 2', phone: '0988000002', seats: 2, routeCategory: 'Tuyến QL13', trustScore: 92, from: 'Lộc Ninh', to: 'Sài Gòn', isDoorstep: 0 },
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
    isDoorstep: 0,
    doorstepAddress: ''
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

  // --- 8. KIỂM THỬ COCKPIT MODE & QR CHECK-IN TRẠM ẢO (CURBSIDE DISPATCH) ---
  console.log('\n--- 8. Kiểm thử Cockpit Taplo Ô Tô & QR Check-in Trạm Ảo ---');
  resetAllStationData();

  // 8.0 Kiểm thử bảng cước phân đoạn Metro Corridor (Dynamic Tariff & Fair Market Invariant)
  assert(Object.keys(CORRIDOR_FIXED_SEGMENTS).length >= 10, 'Bảng cước phân đoạn cố định Metro có ít nhất 10 chặng mẫu');

  const tariffBinhLong = getFixedSegmentTariff('hub_ql13_binh_long', 'hub_ql13_hang_xanh');
  assert(tariffBinhLong.pricePerSeat === 180000, 'Cước phân đoạn Bình Long ➔ Hàng Xanh chuẩn xác 180.000đ (Bù xăng 24k + 4 trạm BOT)');
  assert(tariffBinhLong.driverPayoutFor2Seats === 324000, 'Chủ xe nhận 324.000đ cho 2 ghế từ Bình Long (bù đủ 297k chi phí trực tiếp)');
  assert(tariffBinhLong.noSurge === true, 'Bất biến: Bình Long ➔ Hàng Xanh noSurge = true');

  const tariffTanKhai = getFixedSegmentTariff('hub_ql13_tan_khai', 'hub_ql13_hang_xanh');
  assert(tariffTanKhai.pricePerSeat === 150000, 'Cước phân đoạn Tân Khai ➔ Hàng Xanh chuẩn xác 150.000đ');
  assert(tariffTanKhai.driverPayoutFor2Seats === 270000, 'Chủ xe nhận 270.000đ cho 2 ghế từ Tân Khai (bù đủ 253k chi phí trực tiếp)');
  assert(tariffTanKhai.noSurge === true, 'Bất biến: Tân Khai ➔ Hàng Xanh noSurge = true');

  const tariffChonThanh = getFixedSegmentTariff('hub_ql13_nga4_chon_thanh', 'hub_ql13_hang_xanh');
  assert(tariffChonThanh.pricePerSeat === 120000, 'Cước phân đoạn Chơn Thành ➔ Hàng Xanh chuẩn xác 120.000đ');
  assert(tariffChonThanh.driverPayoutFor2Seats === 216000, 'Chủ xe nhận 216.000đ cho 2 ghế từ Chơn Thành (bù đủ 198k chi phí trực tiếp)');
  assert(tariffChonThanh.noSurge === true, 'Bất biến: Chơn Thành ➔ Hàng Xanh noSurge = true');

  const tariffLocal = getFixedSegmentTariff('hub_ql13_binh_long', 'hub_ql13_nga4_chon_thanh');
  assert(tariffLocal.pricePerSeat === 75000, 'Cước chặng ngắn Bình Long ➔ Chơn Thành chuẩn xác 75.000đ');
  assert(tariffLocal.driverPayoutFor2Seats === 135000, 'Chủ xe nhận 135.000đ cho 2 ghế chặng Bình Long ➔ Chơn Thành');

  // Kiểm thử các trạm trọng điểm mới thêm (TTHC Tân Khai, Vincom Chơn Thành, Vạn Phúc City)
  const hubTthcTanKhai = getVirtualHubById('hub_ql13_tthc_tan_khai');
  assert(hubTthcTanKhai && hubTthcTanKhai.category === 'ADMIN_CENTER', 'Trạm TTHC Hớn Quản (Tân Khai) được định danh chuẩn ADMIN_CENTER');

  const hubVincom = getVirtualHubById('hub_ql13_vincom_chon_thanh');
  assert(hubVincom && hubVincom.category === 'MALL', 'Trạm Vincom Plaza Chơn Thành được định danh chuẩn MALL');

  const hubVanPhuc = getVirtualHubById('hub_ql13_van_phuc_city');
  assert(hubVanPhuc && hubVanPhuc.category === 'URBAN_AREA', 'Trạm Vạn Phúc City được định danh chuẩn URBAN_AREA');

  // Kiểm thử Dynamic Pricing Engine tự động điều chỉnh theo chỉ số giá xăng hàng ngày
  const originalFuel = getDailyFuelPrice();
  assert(originalFuel.ron95Price === 24120, 'Giá xăng mặc định RON 95 là 24.120đ/L');

  // Thử nghiệm xăng tăng lên 26.500đ/L
  setDailyFuelPrice(26500);
  const updatedTariffBinhLong = calculateDynamicTariffByDistance(115, 'Tuyến QL13');
  assert(updatedTariffBinhLong.pricePerSeat >= 180000, 'Giá vé tự động điều chỉnh linh hoạt theo giá xăng mới');
  assert(updatedTariffBinhLong.breakevenCovered === true, 'Bất biến MIT: 2 ghế luôn bù đắp 100% chi phí xăng + BOT');

  // Khôi phục lại giá ban đầu
  setDailyFuelPrice(originalFuel.ron95Price);

  // 8.1 Khách quét QR check-in tại trạm Petrolimex Tân Khai
  const hubInfo = getVirtualHubById('hub_ql13_tan_khai');
  assert(hubInfo && hubInfo.name.includes('Petrolimex'), 'Trạm Petrolimex Tân Khai được định danh chuẩn xác');

  const checkinRes = riderCheckIn({
    hubId: 'hub_ql13_tan_khai',
    destinationHubId: 'hub_ql13_hang_xanh',
    seatsNeeded: 2,
    phone: '0988112233',
    name: 'Khách Chờ Cây Xăng'
  });

  assert(checkinRes.success === true, 'Khách check-in trạm ảo thành công');
  assert(checkinRes.intent && checkinRes.intent.pin && checkinRes.intent.pin.length === 4, 'Hệ thống sinh mã PIN 4 chữ số bảo mật');
  assert(checkinRes.intent.fuelSurcharge === 300000, 'Tính mức phụ xăng 2 khách Tân Khai ➔ Hàng Xanh: 300.000đ (150k x 2)');
  assert(checkinRes.intent.driverPayout === 270000, 'Mức chia sẻ thực nhận cho chủ xe (90%): 270.000đ');
  assert(checkinRes.intent.noSurge === true, 'Bất biến: Không phụ thu giờ cao điểm/mưa gió (noSurge: true)');

  // 8.2 Kiểm tra hàng đợi trạm
  const queueRes = getStationQueue('hub_ql13_tan_khai');
  assert(queueRes.waitingCount === 1, 'Hàng đợi trạm Tân Khai ghi nhận đúng 1 yêu cầu');
  assert(queueRes.queue[0].position === 1, 'Khách ở vị trí số 1 trong hàng đợi');

  // 8.3 Kiểm tra thẻ lên xe thời gian thực của khách
  const passRes = getRiderPass(checkinRes.intent.intentId);
  assert(passRes.success === true && passRes.intent.status === 'WAITING', 'Thẻ lên xe ở trạng thái WAITING chờ xe tới');

  // 8.4 Chủ xe chạy xe trên QL13 tiếp cận trạm Tân Khai (cách 2.8 km về phía Bắc)
  // Tọa độ tiếp cận: (11.5860, 106.6264) -> Trạm Tân Khai (11.5620, 106.6340) cách 2.8 km
  const pingRes = telemetryPing({
    tripId: 'TRIP-TEST-COCKPIT-1',
    driverPhone: '0912345678',
    driverName: 'Chủ xe CX-Test',
    plate: '93A-123.45',
    vehicleModel: 'Mitsubishi Xpander (Trắng)',
    seatsAvailable: 2,
    corridor: 'Tuyến QL13',
    lat: 11.5860,
    lng: 106.6264,
    speed: 75
  });

  assert(pingRes.proximityAlert != null, 'Radar kích hoạt cảnh báo khi xe cách trạm <= 3.5 km');
  assert(pingRes.proximityAlert.distanceKm <= 3.5, `Cự ly tiếp cận chính xác: ${pingRes.proximityAlert?.distanceKm} km`);
  assert(pingRes.proximityAlert.riderCount === 2, 'Cảnh báo đúng số lượng 2 khách cần đón');
  assert(pingRes.proximityAlert.fuelSurcharge === 300000, 'Cảnh báo đúng số tiền phụ xăng +300.000đ');
  assert(pingRes.proximityAlert.driverPayout === 270000, 'Cảnh báo đúng số tiền chủ xe nhận +270.000đ');
  assert(pingRes.proximityAlert.noSurge === true, 'Bất biến: Không tăng giá cao điểm');
  assert(pingRes.session.status === 'OFFERING', 'Trạng thái Taplo chuyển sang OFFERING (30s đếm ngược)');

  // 8.5 Test cơ chế Bỏ qua (Reject)
  const rejectRes = driverRejectOffer({
    tripId: 'TRIP-TEST-COCKPIT-1',
    intentId: checkinRes.intent.intentId
  });
  assert(rejectRes.success === true, 'Chủ xe bấm bỏ qua thành công');

  // Khách được hoàn trả lại hàng đợi ở trạng thái WAITING
  const afterRejectPass = getRiderPass(checkinRes.intent.intentId);
  assert(afterRejectPass.intent.status === 'WAITING', 'Khách được hoàn trả lại trạng thái WAITING sau khi bỏ qua');

  // 8.6 Chủ xe tiếp tục phát tín hiệu và Chấp nhận đón (Accept)
  telemetryPing({
    tripId: 'TRIP-TEST-COCKPIT-1',
    lat: 11.5860,
    lng: 106.6264,
    seatsAvailable: 2
  });

  const acceptRes = driverAcceptOffer({
    tripId: 'TRIP-TEST-COCKPIT-1',
    intentId: checkinRes.intent.intentId
  });
  assert(acceptRes.success === true, 'Chủ xe bấm ĐỒNG Ý ĐÓN 1-chạm thành công');
  assert(acceptRes.dockingTimeSeconds === 60, 'Kích hoạt hạn dừng sân trạm đúng 60 giây (Curbside Window)');

  // Kiểm tra màn hình khách cập nhật trạng thái ARRIVING và nhận thông tin xe
  const arrivingPass = getRiderPass(checkinRes.intent.intentId);
  assert(arrivingPass.intent.status === 'ARRIVING', 'Trạng thái thẻ khách chuyển sang ARRIVING');
  assert(arrivingPass.intent.carInfo?.plate === '93A-123.45', 'Khách thấy đúng biển số xe 93A-123.45 của Chủ xe');

  // 8.7 Bắt tay xác thực mã PIN 4 số tại sân cây xăng
  const wrongPinRes = driverVerifyPin({
    tripId: 'TRIP-TEST-COCKPIT-1',
    intentId: checkinRes.intent.intentId,
    pin: '0000'
  });
  assert(wrongPinRes.success === false, 'Từ chối mã PIN sai để bảo vệ an toàn');

  const correctPinRes = driverVerifyPin({
    tripId: 'TRIP-TEST-COCKPIT-1',
    intentId: checkinRes.intent.intentId,
    pin: checkinRes.intent.pin
  });
  assert(correctPinRes.success === true, 'Khớp mã PIN 4 số thành công');
  assert(correctPinRes.session.totalEarnings === 270000, 'Tự động ghi nhận số dư ví phụ xăng +270.000đ cho Chủ xe');
  assert(correctPinRes.session.status === 'ROLLING', 'Xe chuyển trạng thái ROLLING nhập lại Quốc lộ 13');
  assert(correctPinRes.session.seatsAvailable === 0, 'Cập nhật số ghế còn trống = 0 sau khi nhận đủ khách');

  resetAllStationData();

  // 8.8 Kiểm thử Mô hình Toán học Stanford Frenet Frame 1D & 3 Trạm Trả Lớn (1-Chạm)
  console.log('\n--- 8.8 Kiểm thử Stanford Frenet Frame 1D & 3 Trạm Trả Lớn (1-Chạm) ---');

  // A. Kiểm thử 3 Trạm Trả Lớn (Terminal Hubs)
  const airportHub = getVirtualHubById('hub_ql13_san_bay_tsn');
  assert(airportHub && airportHub.category === 'AIRPORT' && airportHub.isTerminal === true, 'Trạm Sân bay Tân Sơn Nhất được định danh chuẩn AIRPORT và isTerminal = true');

  const hangXanhHub = getVirtualHubById('hub_ql13_hang_xanh');
  assert(hangXanhHub && hangXanhHub.isTerminal === true, 'Trạm Ngã tư Hàng Xanh có isTerminal = true');

  const binhPhuocHub = getVirtualHubById('hub_ql13_nga4_binh_phuoc');
  assert(binhPhuocHub && binhPhuocHub.isTerminal === true, 'Trạm Ngã 4 Bình Phước có isTerminal = true');

  // B. Bảng cước đến Sân bay TSN và Ngã 4 Bình Phước
  const tariffBinhLongToTSN = getFixedSegmentTariff('hub_ql13_binh_long', 'hub_ql13_san_bay_tsn');
  assert(tariffBinhLongToTSN.pricePerSeat === 190000, 'Cước Bình Long ➔ Sân bay Tân Sơn Nhất chuẩn xác 190.000đ (bù xăng + BOT)');

  const tariffTanKhaiToTSN = getFixedSegmentTariff('hub_ql13_tan_khai', 'hub_ql13_san_bay_tsn');
  assert(tariffTanKhaiToTSN.pricePerSeat === 160000, 'Cước Tân Khai ➔ Sân bay Tân Sơn Nhất chuẩn xác 160.000đ');

  const tariffBinhLongToBP = getFixedSegmentTariff('hub_ql13_binh_long', 'hub_ql13_nga4_binh_phuoc');
  assert(tariffBinhLongToBP.pricePerSeat === 160000, 'Cước Bình Long ➔ Ngã 4 Bình Phước chuẩn xác 160.000đ');

  const tariffTanKhaiToBP = getFixedSegmentTariff('hub_ql13_tan_khai', 'hub_ql13_nga4_binh_phuoc');
  assert(tariffTanKhaiToBP.pricePerSeat === 130000, 'Cước Tân Khai ➔ Ngã 4 Bình Phước chuẩn xác 130.000đ');

  // C. Kiểm thử Chiếu Tọa độ Frenet Frame (2D -> 1D s, d)
  // Điểm GPS tại QL13 tiếp cận Tân Khai: (11.5860, 106.6264)
  const frenetRes = projectToCorridorFrenet(11.5860, 106.6264, 'Tuyến QL13');
  assert(frenetRes.isOnCorridor === true, 'Frenet Frame xác nhận xe đang chạy trên hành lang QL13 (isOnCorridor = true)');
  assert(frenetRes.d <= 85, `Độ lệch vuông góc tim đường d = ${frenetRes.d}m (nằm trong dung sai 85m)`);
  assert(frenetRes.s >= 35 && frenetRes.s <= 42, `Tọa độ tuyến tính s = ${frenetRes.s} km chuẩn xác quanh đoạn tiếp cận Tân Khai`);

  // D. Cửa sổ Radar Động học Kinematics: d_trigger = max(3.0, (v / 3.6) * 210 / 1000)
  const triggerMin = calculateKinematicTriggerDistance(20);
  assert(triggerMin === 3.0, 'Vận tốc chậm: Radar giữ ngưỡng tối thiểu 3.0 km');

  const triggerHighway = calculateKinematicTriggerDistance(78);
  assert(triggerHighway >= 4.5 && triggerHighway <= 4.6, `Vận tốc 78 km/h: Radar động học mở rộng lên ${triggerHighway} km (~210s TTA phản xạ an toàn)`);

  // E. MIT Interval Scheduling: Kiểm tra tính khả thi gối đầu tuyến tính
  // Xe đi từ Bình Long (s=24.5) về Sân bay TSN (s=142.5), khách đón tại Tân Khai (s=44.5) về Hàng Xanh (s=139.5) -> HỢP LỆ
  const feasibleMatch = isIntervalSchedulingFeasible(24.5, 142.5, 44.5, 139.5);
  assert(feasibleMatch === true, 'MIT Interval Scheduling: Khớp thành công chặng con Tân Khai ➔ Hàng Xanh lọt trong tuyến Bình Long ➔ Sân bay');

  // Khách ở sau lưng xe (Khách ở Tân Khai s=44.5 nhưng xe đã qua Chơn Thành s=56.5) -> TỪ CHỐI
  const infeasibleBehind = isIntervalSchedulingFeasible(56.5, 142.5, 44.5, 139.5);
  assert(infeasibleBehind === false, 'MIT Interval Scheduling: Từ chối yêu cầu ở sau lưng xe (khách s=44.5 < xe s=56.5)');

  // Khách đi ngược chiều về phía Bắc (s đón 100, s trả 40) trong khi xe đi về Nam -> TỪ CHỐI
  const infeasibleReverse = isIntervalSchedulingFeasible(24.5, 142.5, 100, 40);
  assert(infeasibleReverse === false, 'MIT Interval Scheduling: Từ chối yêu cầu đi ngược chiều');

  // --- 8.9 Kiểm thử Anti-Quishing & Khóa kép Geofence Station Check-in ---
  console.log('\n--- 8.9 Kiểm thử Anti-Quishing & Khóa kép Geofence Station Check-in ---');
  const tanKhaiHub = getVirtualHubById('hub_ql13_tan_khai');

  // Trường hợp 1: Người dùng đứng tại khuôn viên cây xăng (cách ~35m)
  const validCheckIn = riderCheckIn({
    hubId: 'hub_ql13_tan_khai',
    destinationHubId: 'hub_ql13_hang_xanh',
    seatsNeeded: 1,
    phone: '0988123456',
    clientLat: tanKhaiHub.lat + 0.0003,
    clientLng: tanKhaiHub.lng
  });
  assert(validCheckIn.intent.geofence !== null, 'Hệ thống đã đính kèm đối soát GPS Geofence');
  assert(validCheckIn.intent.geofence.verified === true, 'Xác thực Geofence thành công khi khách đứng trong bán kính trạm <= 400m');
  assert(validCheckIn.intent.geofence.distanceM <= 400, `Cự ly đối soát chuẩn xác (${validCheckIn.intent.geofence.distanceM}m <= 400m)`);

  // Trường hợp 2: Quét mã QR giả mạo từ xa (cách trạm ~5.5 km)
  const fakeCheckIn = riderCheckIn({
    hubId: 'hub_ql13_tan_khai',
    destinationHubId: 'hub_ql13_hang_xanh',
    seatsNeeded: 1,
    phone: '0988123456',
    clientLat: tanKhaiHub.lat + 0.05,
    clientLng: tanKhaiHub.lng
  });
  assert(fakeCheckIn.intent.geofence.verified === false, 'Phát hiện và cảnh báo quét QR ngoài bán kính an toàn trạm (> 400m)');
  assert(fakeCheckIn.intent.geofence.distanceM > 1000, `Khoảng cách vượt ngưỡng an toàn (${fakeCheckIn.intent.geofence.distanceM}m)`);

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
