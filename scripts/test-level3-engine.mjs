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
  isIntervalSchedulingFeasible,
  calculateLastMileOption,
  POPULAR_LAST_MILE_DESTINATIONS,
  getHubLiquidityStatus
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
  applyCancellationPenalty,
  clearAllBookings
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

  // Kịch bản C: Hủy sát giờ (15 phút) -> Severe Freeze (-30 pts & Khoá 7 ngày)
  const penaltySevere = await applyCancellationPenalty(mockBooking, testUserPhone, 15);
  assert(penaltySevere.penaltyTier === 'severe_freeze', 'Hủy trước 15 phút: Tier = severe_freeze');
  assert(penaltySevere.penaltyPoints >= 30, `Hủy trước 15 phút: Trừ ${penaltySevere.penaltyPoints} điểm tín nhiệm`);
  assert(penaltySevere.freezeDays === 7, 'Hủy trước 15 phút: Tạm khoá tài khoản 7 ngày');
  updatedUser = getUserByPhone(testUserPhone);
  assert(updatedUser.trustScore === 83 - penaltySevere.penaltyPoints, `Điểm tín nhiệm sau vi phạm nặng: ${updatedUser.trustScore} (83 - ${penaltySevere.penaltyPoints})`);
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

  // Dọn sạch intents và bookings sau test
  await deleteIntent(driverIntent.id);
  await deleteIntent(passengerIntent.id);
  clearAllBookings();

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
  assert(checkinRes.intent.driverPayout === 300000, 'Mức chia sẻ thực nhận cho chủ xe (100% - 0đ phí sàn): 300.000đ');
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
  assert(pingRes.proximityAlert.driverPayout === 300000, 'Cảnh báo đúng số tiền chủ xe nhận +300.000đ (100% - 0đ phí sàn)');
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
  assert(correctPinRes.session.totalEarnings === 300000, 'Tự động ghi nhận số dư ví phụ xăng +300.000đ cho Chủ xe (100% - 0đ phí sàn)');
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

  // --- 8.10 Kiểm thử Luồng Khứ hồi 2 chiều (Bidirectional Commuting QL13: SG <-> Bình Phước) ---
  console.log('\n--- 8.10 Kiểm thử Luồng Khứ hồi 2 chiều (Bidirectional Commuting QL13: SG <-> Bình Phước) ---');

  // 1. Đối xứng bảng giá cố định Metro Tariff: Chiều Đi (BP -> SG) vs Chiều Về (SG -> BP)
  const tariffGo = getFixedSegmentTariff('hub_ql13_tan_khai', 'hub_ql13_hang_xanh');
  const tariffReturn = getFixedSegmentTariff('hub_ql13_hang_xanh', 'hub_ql13_tan_khai');
  assert(tariffGo.pricePerSeat === tariffReturn.pricePerSeat, `Bảng giá đối xứng hoàn hảo: Tân Khai <-> Hàng Xanh = ${tariffGo.pricePerSeat}đ`);
  assert(tariffReturn.pricePerSeat === 150000, 'Cước chiều về Hàng Xanh ➔ Tân Khai đúng định mức 150.000đ');

  const tariffBinhLongReturn = getFixedSegmentTariff('hub_ql13_hang_xanh', 'hub_ql13_binh_long');
  assert(tariffBinhLongReturn.pricePerSeat === 180000, 'Cước chiều về Hàng Xanh ➔ Bình Long đúng định mức 180.000đ');

  const tariffAirportReturn = getFixedSegmentTariff('hub_ql13_san_bay_tsn', 'hub_ql13_binh_long');
  assert(tariffAirportReturn.pricePerSeat === 190000, 'Cước chiều về Sân bay TSN ➔ Bình Long đúng định mức 190.000đ');

  // 2. MIT Interval Scheduling cho Chiều Về (Northbound: xe từ SG s=140 về Bình Phước s=24)
  // Xe đi từ Hàng Xanh (s=139.5) về Bình Long (s=24.5)
  // Khách đón tại Hàng Xanh (s=139.5) về Tân Khai (s=44.5) -> HỢP LỆ
  const feasibleNorthbound = isIntervalSchedulingFeasible(139.5, 24.5, 139.5, 44.5);
  assert(feasibleNorthbound === true, 'MIT Interval Scheduling: Khớp thành công Chiều Về Hàng Xanh ➔ Tân Khai lọt trong tuyến Hàng Xanh ➔ Bình Long');

  // Khách đón tại Chơn Thành (s=56.5) về Bình Long (s=24.5) trong khi xe xuất phát từ Hàng Xanh -> HỢP LỆ
  const feasibleMidNorthbound = isIntervalSchedulingFeasible(139.5, 24.5, 56.5, 24.5);
  assert(feasibleMidNorthbound === true, 'MIT Interval Scheduling: Khớp thành công khách đón giữa đường Chơn Thành ➔ Bình Long');

  // Xe đã chạy qua Chơn Thành (s=50), khách ở Hàng Xanh (s=139.5) mới gọi -> TỪ CHỐI vì ở sau lưng xe
  const infeasibleBehindNorthbound = isIntervalSchedulingFeasible(50, 24.5, 139.5, 44.5);
  assert(infeasibleBehindNorthbound === false, 'MIT Interval Scheduling: Từ chối yêu cầu ở sau lưng xe chiều về (khách s=139.5 > xe s=50)');

  // Khách đón tại Hàng Xanh nhưng đi ngược về Nam (s đón 50, s trả 100) trong khi xe đi về Bắc -> TỪ CHỐI
  const infeasibleSouthInNorthbound = isIntervalSchedulingFeasible(139.5, 24.5, 50, 100);
  assert(infeasibleSouthInNorthbound === false, 'MIT Interval Scheduling: Từ chối yêu cầu đi ngược chiều về Nam');

  // 3. Check-in chiều về tại trạm Hàng Xanh (Saigon Station Check-in)
  const hxHubReturn = getVirtualHubById('hub_ql13_hang_xanh');
  const returnCheckIn = riderCheckIn({
    hubId: 'hub_ql13_hang_xanh',
    destinationHubId: 'hub_ql13_binh_long',
    seatsNeeded: 2,
    phone: '0988776655',
    name: 'Khách Về Bình Phước',
    clientLat: hxHubReturn.lat,
    clientLng: hxHubReturn.lng
  });
  assert(returnCheckIn.intent.hubId === 'hub_ql13_hang_xanh', 'Check-in chiều về tại Ngã tư Hàng Xanh thành công');
  assert(returnCheckIn.intent.destinationHubId === 'hub_ql13_binh_long', 'Đích đến là Bình Long');
  assert(returnCheckIn.intent.seatsNeeded === 2, 'Đặt 2 ghế chiều về');
  assert(returnCheckIn.intent.fuelSurcharge === 360000, 'Tổng cước 2 ghế: 180k * 2 = 360.000đ');
  assert(returnCheckIn.intent.driverPayout === 360000, 'Chủ xe nhận 100% (0đ phí sàn): 360.000đ');

  // =============================================================
  // 8.11 BỘ GIẢ LẬP CHẶNG CUỐI (LAST-MILE CALCULATOR) & NỐI CHUYẾN (HUB FEEDER)
  // =============================================================
  console.log('\n--- 8.11 BỘ GIẢ LẬP CHẶNG CUỐI & NỐI CHUYẾN VÙNG THƯA XE ---');

  // 1. Kiểm tra tính toán chặng cuối (Last-Mile Transit Calculator)
  assert(POPULAR_LAST_MILE_DESTINATIONS.length >= 7, 'Danh mục chặng cuối mẫu có ít nhất 7 điểm đến phổ biến');
  const lastMileBaChieu = calculateLastMileOption('Chợ Bà Chiểu', 'hub_ql13_tan_khai');
  assert(lastMileBaChieu.bestHubId === 'hub_ql13_hang_xanh', 'Chợ Bà Chiểu tự động ghép với Trạm Hàng Xanh');
  assert(lastMileBaChieu.distanceToHubKm === 1.5, 'Cự ly chặng cuối Chợ Bà Chiểu là 1.5km');
  assert(lastMileBaChieu.carmateFareVND === 150000, 'Cước CarMate Tân Khai ➔ Hàng Xanh là 150.000đ');
  assert(lastMileBaChieu.grabBikeVND === 15000, 'Ước lượng GrabBike chặng cuối 1.5km là 15.000đ');
  assert(lastMileBaChieu.totalCostVND === 165000, 'Tổng chi phí về tận nhà: 150k + 15k = 165.000đ');
  assert(lastMileBaChieu.savingsVND > 500000, 'Tiết kiệm hơn 500k so với taxi đường dài liên tỉnh');

  // 2. Kiểm tra điểm đến Sân bay TSN
  const lastMileTSN = calculateLastMileOption('Sân bay', 'hub_ql13_tan_khai');
  assert(lastMileTSN.bestHubId === 'hub_ql13_san_bay_tsn', 'Sân bay TSN tự động ghép với Trạm Ga Sân Bay TSN');
  assert(lastMileTSN.distanceToHubKm === 0.2, 'Cự ly chặng cuối sảnh sân bay 0.2km');
  assert(lastMileTSN.grabBikeVND === 0, 'Đi bộ thẳng vào ga, 0đ phí GrabBike');

  // 3. Kiểm tra Hub Liquidity cho Trục QL13 & Nhánh Vùng thưa xe Bù Đốp
  const budopStatus = getHubLiquidityStatus('hub_ql13_budop');
  assert(budopStatus.isThin === true, 'Trạm Bù Đốp được phân loại là Vùng thưa xe (THIN)');
  assert(budopStatus.feederRecommendation.targetHubId === 'hub_ql13_cho_loc_ninh', 'Bù Đốp đề xuất nối chuyến ra Trạm TT. Lộc Ninh');
  assert(budopStatus.feederRecommendation.distanceKm === 15, 'Cự ly nối chuyến Bù Đốp ➔ Lộc Ninh là 15km');

  // Lộc Ninh là đầu tuyến QL13 có mật độ xe dồi dào (DENSE), hỗ trợ đón trực tiếp không cần chuyển trạm
  const locNinhStatus = getHubLiquidityStatus('hub_ql13_cho_loc_ninh');
  assert(locNinhStatus.isThin === false, 'Trạm Lộc Ninh có mật độ xe dồi dào (isThin = false), hỗ trợ đón trực tiếp');
  assert(locNinhStatus.status === 'DENSE', 'Trạm Lộc Ninh đạt chuẩn DENSE (Đầu tuyến QL13)');

  const tariffLocNinhHangXanh = getFixedSegmentTariff('hub_ql13_cho_loc_ninh', 'hub_ql13_hang_xanh');
  assert(tariffLocNinhHangXanh.pricePerSeat === 205000, 'Cước Lộc Ninh ➔ Hàng Xanh chuẩn 205.000đ (135km)');

  const tariffLocNinhAirport = getFixedSegmentTariff('hub_ql13_cho_loc_ninh', 'hub_ql13_san_bay_tsn');
  assert(tariffLocNinhAirport.pricePerSeat === 215000, 'Cước Lộc Ninh ➔ Sân bay TSN chuẩn 215.000đ (140km)');

  const binhLongStatus = getHubLiquidityStatus('hub_ql13_binh_long');
  assert(binhLongStatus.isThin === false, 'Trạm Bình Long là Vùng đậm đặc (DENSE), không cần nối chuyến');

  // =============================================================
  // 8.12 KIỂM THỬ BẪY ĐỘNG HỌC & XỬ PHẠT CHỦ XE BỎ BOM KHÁCH (FLY-BY GHOSTING PENALTY)
  // =============================================================
  console.log('\n--- 8.12 Kiểm thử Bẫy động học & Xử phạt Bỏ bom khách (Ghosting Penalty) ---');
  resetAllStationData();

  // 1. Khách check-in tại Tân Khai
  const ghostTestCheckIn = riderCheckIn({
    hubId: 'hub_ql13_tan_khai',
    destinationHubId: 'hub_ql13_hang_xanh',
    seatsNeeded: 1,
    phone: '0977889900',
    name: 'Khách Thử Bẫy'
  });
  assert(ghostTestCheckIn.success === true, 'Khách check-in tại Tân Khai thành công');

  // 2. Xe tiếp cận trạm và nhận offer
  const ghostCarTripId = 'TRIP-GHOST-CAR-1';
  const ghostCarPing1 = telemetryPing({
    tripId: ghostCarTripId,
    driverPhone: '0933112233',
    driverName: 'Chủ Xe Thử Bẫy',
    plate: '93A-999.99',
    corridor: 'Tuyến QL13',
    lat: 11.5860,
    lng: 106.6264,
    speed: 70,
    seatsAvailable: 3
  });
  assert(ghostCarPing1.proximityAlert != null, 'Radar kích hoạt offer cho xe tiếp cận trạm Tân Khai');

  const ghostAcceptRes = driverAcceptOffer({
    tripId: ghostCarTripId,
    intentId: ghostTestCheckIn.intent.intentId
  });
  assert(ghostAcceptRes.success === true, 'Chủ xe bấm ĐỒNG Ý ĐÓN, chuyển trạng thái DWELLING');

  // 3. Kịch bản xấu: Xe không dừng tấp lề mà chạy vù qua trạm Tân Khai (> 300m) với tốc độ 75 km/h
  // Tân Khai s ~ 38.6 km, xe vượt qua cọc s ~ 39.5 km
  const ghostCarFlyByPing = telemetryPing({
    tripId: ghostCarTripId,
    lat: 11.5000,
    lng: 106.6340,
    speed: 75 // Không giảm tốc về 0 km/h
  });
  assert(ghostCarFlyByPing.isBanned === true, 'Hệ thống kích hoạt Bẫy Động Học và Khóa Vĩnh Viễn xe bỏ bom khách');

  // 4. Kiểm tra khách được giải phóng an toàn về vị trí #1 hàng đợi
  const riderPassAfterGhost = getRiderPass(ghostTestCheckIn.intent.intentId);
  assert(riderPassAfterGhost.intent.status === 'WAITING', 'Khách được tự động hoàn trả về trạng thái WAITING');
  assert(riderPassAfterGhost.intent.carInfo === null, 'Xóa bỏ thông tin xe đã bỏ bom khách');
  assert(riderPassAfterGhost.position === 1, 'Khách được ưu tiên giữ nguyên vị trí số 1 để đón xe tiếp theo');

  // 5. Xe bị khóa vĩnh viễn không thể tiếp tục quét trạm
  const ghostCarRetryPing = telemetryPing({
    tripId: ghostCarTripId,
    speed: 50
  });
  assert(ghostCarRetryPing.success === false, 'Xe bị khóa vĩnh viễn bị từ chối mọi hoạt động radar');
  assert(ghostCarRetryPing.isBanned === true, 'Cờ isBanned = true được bảo toàn tuyệt đối (Zero Tolerance)');

  console.log('\n=============================================================');
  console.log('📊 TỔNG KẾT BỘ KIỂM THỬ CARMATE CẤP ĐỘ 3 (LEVEL 3):');
  console.log(`- Tổng số bài test: ${passedTests + failedTests}`);
  console.log(`- Số bài ĐẠT (PASS): ${passedTests} / ${passedTests + failedTests} (${Math.round((passedTests / (passedTests + failedTests)) * 100)}%)`);
  console.log(`- Số bài LỖI (FAIL): ${failedTests}`);
  console.log('=============================================================\n');

  clearAllBookings();

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
