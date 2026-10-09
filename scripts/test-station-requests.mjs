import assert from 'node:assert';
import { initDB, getRawDB, addStationRequest, getStationRequests, updateStationRequestStatus } from '../apps/api/src/db/sqliteStore.js';
import { findNearestVirtualHub, calculateDistanceKm } from '@carmate/shared';

async function runTests() {
  console.log('🧪 Bắt đầu kiểm thử Station Request Pool & Snap-to-Station...');

  // 1. Initialize the DB
  await initDB();
  const db = getRawDB();
  assert.ok(db, 'SQLite Database phải sẵn sàng');
  console.log('✅ 1. Database SQLite khởi tạo thành công');

  // Delete old test proposals
  db.prepare("DELETE FROM station_requests WHERE stationName LIKE 'Test%' OR normalizedName LIKE '%dong tam%'").run();

  // 2. Add a proposal to open a new station
  const req1 = await addStationRequest({
    stationName: 'Ngã ba Đồng Tâm (Bình Long)',
    note: 'Có bãi đất trống ngoài làn xe ô tô, cách ngã 3 khoảng 50m',
    lat: 11.6500,
    lng: 106.6100,
    userPhone: '0988112233'
  });

  assert.ok(req1.id.startsWith('STR-'), 'ID đề xuất phải có tiền tố STR-');
  assert.strictEqual(req1.requestCount, 1, 'Lần đề xuất đầu tiên phải có requestCount = 1');
  assert.strictEqual(req1.status, 'pending', 'Trạng thái ban đầu phải là pending');
  assert.strictEqual(req1.userPhone, '0988112233', 'Số điện thoại phải được làm sạch');
  console.log('✅ 2. Tạo đề xuất mở trạm mới thành công (requestCount = 1)');

  // 3. Grouping when someone else proposes the same location (name typed without diacritics / variants)
  const req2 = await addStationRequest({
    stationName: 'Nga ba Dong Tam (Binh Long)',
    note: 'Đông công nhân chờ xe mỗi sáng',
    userPhone: '0912345678'
  });

  assert.strictEqual(req2.id, req1.id, 'Phải tự động gom vào cùng 1 trạm đề xuất (Idempotent Grouping)');
  assert.strictEqual(req2.requestCount, 2, 'Số lượt yêu cầu phải tăng lên 2');
  console.log('✅ 3. Tự động gom nhóm các đề xuất cùng điểm thành công (requestCount = 2)');

  // 4. Check the survey activation threshold (>= 50 proposals)
  const stmt = db.prepare('UPDATE station_requests SET requestCount = 49 WHERE id = ?');
  stmt.run(req1.id);

  const req50 = await addStationRequest({
    stationName: 'Ngã ba Đồng Tâm (Bình Long)',
    note: 'Góp thêm 1 phiếu',
    userPhone: '0977889900'
  });

  assert.strictEqual(req50.requestCount, 50, 'Số lượt yêu cầu phải đạt 50');
  assert.strictEqual(req50.status, 'threshold_met', 'Trạng thái phải tự động chuyển sang threshold_met khi đạt 50 đề xuất');
  console.log('✅ 4. Tự động chuyển trạng thái threshold_met khi đạt đủ 50 đề xuất');

  // 5. Get the list of proposals sorted by hotness
  const list = getStationRequests();
  assert.ok(Array.isArray(list), 'getStationRequests phải trả về danh sách');
  const found = list.find((item) => item.id === req1.id);
  assert.ok(found, 'Phải tìm thấy trạm đề xuất vừa tạo trong danh sách');
  assert.strictEqual(found.requestCount, 50, 'Số lượt đề xuất hiển thị chính xác');
  console.log(`✅ 5. Lấy danh sách đề xuất thành công (tìm thấy trạm có ${found.requestCount} lượt)`);

  // 6. Update proposal status (admin field survey)
  const updated = await updateStationRequestStatus(req1.id, 'surveying', 'Đang cử đội ngũ đi khảo sát bãi đỗ an toàn ngoài hành lang');
  assert.strictEqual(updated.status, 'surveying', 'Trạng thái phải là surveying');
  console.log('✅ 6. Admin cập nhật trạng thái khảo sát thành công');

  // 7. Test Snap-to-Station Mathematics (Geodesic Nearest Hub)
  // Simulated coordinates of a user standing near the Petrolimex Tân Khai gas station: (lat: 11.5622, lng: 106.6341)
  const riderLat = 11.5622;
  const riderLng = 106.6341;
  const nearest = findNearestVirtualHub(riderLat, riderLng, 'Tuyến QL13');

  assert.ok(nearest, 'Phải tìm thấy trạm gần nhất');
  assert.strictEqual(nearest.id, 'hub_ql13_tan_khai', 'Trạm gần nhất phải là hub_ql13_tan_khai (Petrolimex Tân Khai)');
  
  const distKm = calculateDistanceKm(riderLat, riderLng, nearest.lat, nearest.lng);
  const distMeters = Math.round(distKm * 1000);
  assert.ok(distMeters < 500, `Khoảng cách phải dưới 500m (thực tế: ${distMeters}m)`);
  console.log(`✅ 7. Snap-to-Station chuẩn xác: Kéo về ${nearest.name} (cách ${distMeters}m)`);

  // 8. Test a farther station: Passenger standing at Bến Cát (lat: 11.1500, lng: 106.6000)
  const bcNearest = findNearestVirtualHub(11.1500, 106.6000, 'Tuyến QL13');
  assert.ok(bcNearest, 'Phải tìm thấy trạm gần Bến Cát');
  console.log(`✅ 8. Khách ở khu vực khác kéo về trạm: ${bcNearest.name} (${bcNearest.distanceKm} km)`);

  // 9. Test the REST API endpoints (Express app router)
  const express = (await import('express')).default;
  const apiRouter = (await import('../apps/api/src/routes/api.js')).default;
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 9a. Test POST /api/station-requests succeeds
    const postRes = await fetch(`${baseUrl}/station-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationName: 'Test Ngã ba Tân Hiệp',
        note: 'Cây xăng PVOIL đối diện',
        userPhone: '0901234567'
      })
    });
    const postData = await postRes.json();
    assert.strictEqual(postRes.status, 201, 'POST /station-requests phải trả về 201');
    assert.strictEqual(postData.success, true);
    assert.strictEqual(postData.request.requestCount, 1);
    assert.strictEqual(postData.threshold, 50);
    console.log('✅ 9. REST API POST /api/station-requests thành công 201');

    // 9b. Test POST /api/station-requests with a station name that is too short (< 2 characters)
    const errRes = await fetch(`${baseUrl}/station-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stationName: 'A' })
    });
    const errData = await errRes.json();
    assert.strictEqual(errRes.status, 400, 'POST thiếu tên hợp lệ phải trả về 400');
    assert.strictEqual(errData.success, false);
    console.log('✅ 10. REST API validation tên trạm đề xuất (< 2 ký tự) chặn 400 thành công');

    // 9c. Test GET /api/station-requests
    const getRes = await fetch(`${baseUrl}/station-requests`);
    const getData = await getRes.json();
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getData.success, true);
    assert.ok(getData.requests.some(r => r.id === postData.request.id), 'Phải có trạm vừa tạo trong danh sách');
    console.log('✅ 11. REST API GET /api/station-requests trả về danh sách 200 OK');
  } finally {
    server.close();
  }

  // Clean up test data
  db.prepare("DELETE FROM station_requests WHERE stationName LIKE 'Test%' OR normalizedName LIKE '%dong tam%' OR normalizedName LIKE '%tan hiep%'").run();
  console.log('\n🎉 TẤT CẢ 11 BÀI KIỂM THỬ STATION REQUEST POOL & SNAP-TO-STATION ĐỀU ĐẠT 100%!\n');
}

runTests().catch((err) => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
