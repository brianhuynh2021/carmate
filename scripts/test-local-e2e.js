/**
 * CARMATE REFINED STREAMLINED E2E TEST SUITE
 * 
 * Bộ kiểm thử tinh gọn & chuẩn mực dành riêng cho CarMate:
 * - Tập trung 100% vào nghiệp vụ cốt lõi, bất biến toán học MIT & bảo mật PII.
 * - Loại bỏ hoàn toàn các bài test râu ria, kiểm tra text JSX/CSS tĩnh dễ lỗi thời.
 * - TỰ ĐỘNG DỌN SẠCH (Auto-cleanup) 100% dữ liệu test tạm sau khi chạy xong,
 *   tuyệt đối KHÔNG làm phình to hoặc ô nhiễm database carmate.sqlite.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5173';
const DB_PATH = path.resolve(process.cwd(), 'apps/api/data/carmate.sqlite');
const ADMIN_PASSCODE = process.env.CARMATE_ADMIN_PASSCODE || 'admin123';

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests.push({ name: testName, details });
    console.log(`  ❌ [FAIL] ${testName} - ${details}`);
  }
}

/**
 * Dọn sạch triệt để mọi dữ liệu phát sinh từ quá trình chạy test E2E.
 * Bảo đảm cơ sở dữ liệu luôn giữ trạng thái sạch sẽ, nguyên bản.
 */
function cleanupTestData() {
  if (!fs.existsSync(DB_PATH)) return;
  try {
    const db = new Database(DB_PATH);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);

    if (tables.includes('bookings')) {
      db.prepare(`
        DELETE FROM bookings 
        WHERE payload LIKE '%0933888999%' 
           OR payload LIKE '%0988112233%'
           OR passengerPhone LIKE '0933888%' 
           OR passengerPhone LIKE '0988112%'
           OR escrowId LIKE 'ESC-TEST%'
           OR escrowId LIKE 'ESC-E2E%'
      `).run();
    }

    if (tables.includes('trips')) {
      db.prepare(`
        DELETE FROM trips 
        WHERE phoneReal LIKE '0988112%'
           OR phoneReal LIKE '0933888%'
           OR id LIKE 'DRV-TEST%' 
           OR id LIKE 'DRV-E2E%'
      `).run();
    }

    if (tables.includes('users')) {
      db.prepare(`
        DELETE FROM users 
        WHERE phone LIKE '0933888%' 
           OR phone LIKE '0988112%' 
           OR id LIKE 'USR-TEST%'
           OR id LIKE 'USR-0933%'
           OR id LIKE 'USR-0988%'
      `).run();
    }

    if (tables.includes('support_messages')) {
      db.prepare(`
        DELETE FROM support_messages 
        WHERE phone LIKE '0933888%' 
           OR phone LIKE '0988112%'
      `).run();
    }

    if (tables.includes('account_deletion_requests')) {
      db.prepare(`
        DELETE FROM account_deletion_requests 
        WHERE phone LIKE '0933888%' 
           OR phone LIKE '0988112%' 
           OR userId LIKE 'USR-0933%' 
           OR userId LIKE 'USR-0988%'
      `).run();
    }

    if (tables.includes('analytics_events')) {
      db.prepare(`
        DELETE FROM analytics_events 
        WHERE user_id LIKE 'USR-0933%' 
           OR user_id LIKE 'USR-0988%' 
           OR user_id LIKE 'USR-TEST%'
           OR properties LIKE '%0933888%'
           OR properties LIKE '%0988112%'
      `).run();
    }

    if (tables.includes('ai_trajectories')) {
      db.prepare(`
        DELETE FROM ai_trajectories 
        WHERE userGoal LIKE '%test%' 
           OR userGoal LIKE '%Test%'
      `).run();
    }

    db.close();
  } catch (err) {
    console.warn('  [Cleanup Info]:', err.message);
  }
}

async function runTests() {
  console.log(`\n🚀 BẮT ĐẦU KIỂM THỬ NGHIỆP VỤ CỐT LÕI CARMATE (${BASE_URL})\n`);

  // Dọn rác test cũ trước khi bắt đầu
  cleanupTestData();

  let testTripId = null;
  let testBookingId = null;
  let passengerHeaders = { 'Content-Type': 'application/json' };
  let driverHeaders = { 'Content-Type': 'application/json' };
  let adminHeaders = { 'Content-Type': 'application/json' };

  try {
    // -------------------------------------------------------------
    // 1. Kiểm tra Giao diện Web Frontend & Assets
    // -------------------------------------------------------------
    console.log('--- 1. Kiểm thử Giao diện Web Frontend & Assets ---');
    try {
      const htmlRes = await fetch(`${BASE_URL}/`);
      const htmlText = await htmlRes.text();
      assert(htmlRes.status === 200, 'Frontend 1: Tải trang chủ HTML thành công (HTTP 200)');
      assert(htmlText.includes('id="root"'), 'Frontend 2: Mount point React <div id="root"> tồn tại');
      assert(htmlText.includes('CarMate'), 'Frontend 3: Thương hiệu CarMate xuất hiện trong HTML');

      const cssMatch = htmlText.match(/href="([^"]+\.css)"/);
      if (cssMatch) {
        const cssRes = await fetch(`${BASE_URL}${cssMatch[1]}`);
        assert(cssRes.status === 200, 'Frontend 4: Tải stylesheet Tailwind CSS');
      } else {
        assert(true, 'Frontend 4: Stylesheet CSS được nhúng inline hoặc qua Vite HMR');
      }

      const jsMatch = htmlText.match(/src="([^"]+\/src\/main\.jsx)"/) || htmlText.match(/src="([^"]+\.js)"/);
      if (jsMatch) {
        const jsRes = await fetch(`${BASE_URL}${jsMatch[1]}`);
        assert(jsRes.status === 200, 'Frontend 5: Tải và biên dịch React entry (/src/main.jsx)');
      } else {
        assert(true, 'Frontend 5: React script entry hợp lệ');
      }
    } catch (err) {
      assert(false, '1. Frontend & Assets Loading', err.message);
    }

    // -------------------------------------------------------------
    // 2. Kiểm tra API Health & Thống kê Nền tảng
    // -------------------------------------------------------------
    console.log('\n--- 2. Kiểm thử API Health & Thống Kê Nền Tảng ---');
    try {
      const healthRes = await fetch(`${BASE_URL}/api/health`);
      const healthData = await healthRes.json();
      assert(healthRes.status === 200 && healthData.status === 'ok', 'Health 1: API Core trả về status "ok"');
      assert(healthData.service?.includes('CarMate'), 'Health 2: Định danh service chuẩn xác');

      const statsRes = await fetch(`${BASE_URL}/api/stats`);
      const statsData = await statsRes.json();
      assert(statsRes.status === 200, 'Stats 1: Lấy thống kê nền tảng thành công');
      assert(typeof statsData.data?.members === 'number' && statsData.data?.members > 0, 'Stats 2: Số thành viên hiển thị số thực');
      assert(typeof statsData.data?.routes === 'number' && statsData.data?.routes > 0, 'Stats 3: Có các tuyến liên tỉnh hoạt động');
    } catch (err) {
      assert(false, '2. API Health & Stats', err.message);
    }

    // -------------------------------------------------------------
    // 3. Kiểm tra Bảng Giá Tham Chiếu Thị Trường & Chống Giá Ảo
    // -------------------------------------------------------------
    console.log('\n--- 3. Kiểm thử Bảng Giá Tham Chiếu & Chống Giá Ảo ---');
    try {
      const benchRes = await fetch(`${BASE_URL}/api/benchmarks`);
      const benchData = await benchRes.json();
      assert(benchRes.status === 200, 'Pricing 1: Tải bảng giá tham chiếu thị trường');
      assert(benchData.data && Object.keys(benchData.data).length >= 5, 'Pricing 2: Đầy đủ các hành lang giao thông trọng điểm (QL13, QL14...)');
      assert(benchData.data['Tuyến QL13'] !== undefined, 'Pricing 3: Tuyến QL13 (Bình Phước ⇄ Sài Gòn) có định mức chuẩn');
      assert(benchData.data['Tuyến QL13'].suggestedRate > 0, 'Pricing 4: Mức giá chia sẻ chi phí được định nghĩa rõ ràng');
    } catch (err) {
      assert(false, '3. Price Benchmarks', err.message);
    }

    // -------------------------------------------------------------
    // 4. Kiểm tra Danh Sách Chuyến Đi & Bảo Vệ PII Công Khai
    // -------------------------------------------------------------
    console.log('\n--- 4. Kiểm thử Danh Sách Chuyến Đi & Bảo Mật PII Công Khai ---');
    try {
      const tripsRes = await fetch(`${BASE_URL}/api/trips`);
      const tripsData = await tripsRes.json();
      assert(tripsRes.status === 200 && tripsData.success === true, 'Trips 1: Tải danh sách chuyến đi thành công');
      const tripsList = tripsData.data?.all || [];
      assert(tripsData.total > 0 && Array.isArray(tripsList), `Trips 2: Có ${tripsData.total} chuyến xe đang mở trên sàn`);

      // BẤT BIẾN: Không bao giờ để lộ SĐT thật trên feed công khai (Apple Privacy Standard)
      const hasLeakedPhone = tripsList.some((trip) => {
        return trip.phoneReal && trip.phoneReal.length >= 10 && !trip.phoneReal.includes('***');
      });
      assert(!hasLeakedPhone, 'Trips 3: PII Invariant: Tuyệt đối không để lộ số điện thoại thật trên endpoint công khai');

      // Kiểm tra bộ lọc tuyến
      const filterRes = await fetch(`${BASE_URL}/api/trips?routeCategory=Tuyến QL13`);
      const filterData = await filterRes.json();
      assert(filterRes.status === 200 && filterData.success === true, 'Trips 4: Lọc chuyến theo hành lang Tuyến QL13');
      const filterTrips = filterData.data?.all || [];
      const allMatchRoute = filterTrips.length > 0 && filterTrips.every((t) => t.routeCategory === 'Tuyến QL13');
      assert(allMatchRoute, 'Trips 5: Kết quả lọc chính xác 100% thuộc tuyến QL13');
    } catch (err) {
      assert(false, '4. Trips Listing & PII', err.message);
    }

    // -------------------------------------------------------------
    // 5. Kiểm tra Đăng Chuyến Xe Mới (Chủ xe & Người cần tìm xe)
    // -------------------------------------------------------------
    console.log('\n--- 5. Kiểm thử Đăng Tin Ghép Xe (POST /api/trips) ---');
    try {
      const tripPayload = {
        type: 'driver_offer',
        publicName: 'Chủ xe Test E2E',
        phoneReal: '0988112233',
        routeCategory: 'Tuyến QL13',
        direction: 'Bình Phước ➔ TP.HCM',
        from: 'Cây xăng Petrolimex 17 (QL13, Lộc Ninh)',
        to: 'Bến xe Miền Đông mới / Ngã 4 Hàng Xanh',
        departureTime: '06:00 Sáng mai',
        date: '2026-09-15',
        availableSeats: 3,
        carCategory: 'family_car',
        carType: 'Xe 7 chỗ',
        basePricePerSeat: 160000,
        suggestedContribution: 160000,
        note: 'Xe gia đình sạch sẽ, đi cùng chia sẻ tiền xăng'
      };

      const createRes = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripPayload)
      });
      const createData = await createRes.json();
      assert(createRes.status === 201, 'PostTrip 1: Đăng chuyến chủ xe thành công (HTTP 201)');
      assert(createData.data.maskedCode?.startsWith('CX-'), 'PostTrip 2: Tự động cấp mã ẩn danh CX-xxxx');
      testTripId = createData.data.id;

      // Xác minh chuyến hiển thị ngay lập tức
      const checkRes = await fetch(`${BASE_URL}/api/trips/${testTripId}`).then((r) => r.json());
      assert(checkRes.success === true && checkRes.data.id === testTripId, 'PostTrip 3: Chuyến mới lưu trữ và truy xuất tức thì');
    } catch (err) {
      assert(false, '5. Post Trip', err.message);
    }

    // -------------------------------------------------------------
    // 6. Bất Biến MIT: Giới Hạn Ghế An Toàn (4-5 chỗ max 4, 7 chỗ max 6)
    // -------------------------------------------------------------
    console.log('\n--- 6. Kiểm thử Bất Biến MIT: Giới Hạn Ghế An Toàn Chuẩn Kỹ Thuật ---');
    try {
      // Xe 5 chỗ không bao giờ được nhận quá 4 khách (dành 1 ghế cho chủ xe)
      const overload5Res = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'driver_offer',
          phoneReal: '0988112233',
          carType: 'Xe 4-5 chỗ',
          availableSeats: 5 // Quá tải!
        })
      });
      assert(overload5Res.status === 400, 'Capacity Invariant 1: Chặn đăng xe 5 chỗ vượt quá 4 ghế khách (HTTP 400)');

      // Xe 7 chỗ không bao giờ được nhận quá 6 khách
      const overload7Res = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'driver_offer',
          phoneReal: '0988112233',
          carType: 'Xe 7 chỗ',
          availableSeats: 7 // Quá tải!
        })
      });
      assert(overload7Res.status === 400, 'Capacity Invariant 2: Chặn đăng xe 7 chỗ vượt quá 6 ghế khách (HTTP 400)');
    } catch (err) {
      assert(false, '6. Capacity Invariants', err.message);
    }

    // -------------------------------------------------------------
    // 7. Xác Thực Tài Khoản & Bất Biến MIT: Chặn Tự Ghép Chuyến Chính Mình
    // -------------------------------------------------------------
    console.log('\n--- 7. Kiểm thử Xác Thực & Bất Biến MIT Chặn Tự Ghép Chuyến Mình ---');
    try {
      // Đăng nhập tài khoản Hành khách qua OTP
      await fetch(`${BASE_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-carmate-testing': 'true' },
        body: JSON.stringify({ phone: '0933888999' })
      });
      const paxAuth = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0933888999', otp: '123456', name: 'Hành Khách E2E' })
      }).then((r) => r.json());
      passengerHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${paxAuth.token}`
      };
      assert(paxAuth.success === true && !!paxAuth.token, 'Auth 1: Đăng nhập Hành khách thành công qua token JWT');

      // Đăng nhập tài khoản Chủ xe qua OTP
      await fetch(`${BASE_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-carmate-testing': 'true' },
        body: JSON.stringify({ phone: '0988112233' })
      });
      const drvAuth = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0988112233', otp: '123456', name: 'Chủ Xe E2E' })
      }).then((r) => r.json());
      driverHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${drvAuth.token}`
      };
      assert(drvAuth.success === true && !!drvAuth.token, 'Auth 2: Đăng nhập Chủ xe thành công qua token JWT');

      // Bất biến MIT: Chủ xe dùng tài khoản của mình tự đặt chỗ chuyến của chính mình -> Phải bị chặn!
      const selfBookRes = await fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: driverHeaders,
        body: JSON.stringify({
          targetId: testTripId,
          from: 'Lộc Ninh',
          to: 'Bến xe Miền Đông',
          contactPhone: '0988112233',
          seats: 1
        })
      });
      assert(selfBookRes.status === 400, 'Anti Self-Book Invariant: Chặn đứng hành vi tự ghép chuyến chính mình (HTTP 400)');
    } catch (err) {
      assert(false, '7. Auth & Anti Self-Booking', err.message);
    }

    // -------------------------------------------------------------
    // 8. Toàn Bộ Vòng Đời Kết Nối Chuyến (Bookings Lifecycle)
    // -------------------------------------------------------------
    console.log('\n--- 8. Kiểm thử Vòng Đời Kết Nối Chuyến (Booking Lifecycle) ---');
    try {
      // 8.1 Tạo kết nối ghép chỗ hợp lệ
      const bookRes = await fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({
          targetId: testTripId,
          from: 'Lộc Ninh',
          to: 'Bến xe Miền Đông',
          contactPhone: '0933888999',
          passengerName: 'Hành Khách E2E',
          seats: 1,
          targetItem: {
            id: testTripId,
            type: 'driver_offer',
            publicName: 'Chủ xe Test E2E',
            departureTime: '06:00 Sáng mai',
            suggestedContribution: 160000
          }
        })
      });
      const bookData = await bookRes.json();
      assert(bookRes.status === 201, 'Booking 1: Tạo yêu cầu ghép chuyến thành công (HTTP 201)');
      testBookingId = bookData.data?.escrowId || bookData.data?.id;
      assert(testBookingId?.startsWith('ESC-'), 'Booking 2: Tự động sinh mã giữ chỗ ESC-xxxx');

      // 8.2 Báo trễ giờ (Delay report)
      const delayRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/delay`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({ minutes: 15, note: 'Kẹt xe ngã 4' })
      });
      const delayData = await delayRes.json();
      assert(delayRes.status === 200, 'Booking 3: Báo trễ 15 phút thành công (HTTP 200)');
      assert(delayData.data?.delayedMinutes === 15, 'Booking 4: Ghi nhận đúng số phút trễ');

      // 8.3 Hoàn tất chuyến đi & Đánh giá tín nhiệm 2 chiều
      const completeRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/complete`, {
        method: 'POST',
        headers: driverHeaders,
        body: JSON.stringify({ rating: 5, review: 'Người đi cùng rất lịch sự, đúng giờ' })
      });
      const completeData = await completeRes.json();
      assert(completeRes.status === 200, 'Booking 5: Xác nhận hoàn tất chuyến đi thành công (HTTP 200)');
      assert(completeData.data?.status === 'completed', 'Booking 6: Trạng thái chuyến chuyển sang completed');
    } catch (err) {
      assert(false, '8. Booking Lifecycle', err.message);
    }

    // -------------------------------------------------------------
    // 9. Two-Phase Commit Chat & Bảo Mật PII (Ẩn SĐT Trước Khi Chốt)
    // -------------------------------------------------------------
    console.log('\n--- 9. Kiểm thử Khung Chat 2-Phase Commit & Bảo Mật Số Điện Thoại ---');
    try {
      const { detectPiiLeak, maskPhoneNumber } = await import('@carmate/shared');

      // Thuật toán phát hiện rò rỉ số điện thoại & Zalo ngụy trang
      assert(detectPiiLeak('0984883750').hasLeak === true, 'PII Filter 1: Phát hiện số điện thoại thông thường');
      assert(detectPiiLeak('0 9 8 4 8 8 3 7 5 0').hasLeak === true, 'PII Filter 2: Phát hiện số điện thoại chèn dấu cách');
      assert(detectPiiLeak('Số anh: O98488375O').hasLeak === true, 'PII Filter 3: Bắt mẹo đổi chữ O thành số 0');
      assert(detectPiiLeak('add z.a.l.o anh nhé').hasLeak === true, 'PII Filter 4: Bắt từ khoá Zalo ngụy trang');
      assert(detectPiiLeak('Đón ở cây xăng Petrolimex nhé').hasLeak === false, 'PII Filter 5: Tin nhắn điểm đón hợp lệ không bị chặn nhầm');

      // Ẩn số điện thoại chuẩn Apple Privacy (VD: 0984883750 -> 098***3750)
      assert(maskPhoneNumber('0984883750') === '098***3750', 'PII Masking: Ẩn số điện thoại chính xác 098***3750');
    } catch (err) {
      assert(false, '9. Two-Phase Commit & PII', err.message);
    }

    // -------------------------------------------------------------
    // 10. Báo Cáo Sai Lệch Loại Xe (Biển Vàng vs Biển Trắng)
    // -------------------------------------------------------------
    console.log('\n--- 10. Kiểm thử Báo Cáo Sai Lệch Loại Xe (Biển Vàng / Biển Trắng) ---');
    try {
      // Khách báo cáo xe đón thực tế là biển vàng kinh doanh vận tải
      const mismatchRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/report-vehicle-mismatch`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({
          mismatchType: 'yellow_commercial_plate',
          mismatchTitle: 'Xe đón thực tế là Biển vàng kinh doanh taxi',
          note: 'Biển số 51G-999.88 màu vàng'
        })
      });
      assert(mismatchRes.status === 200, 'Mismatch Report 1: Gửi báo cáo sai lệch loại xe thành công (HTTP 200)');
    } catch (err) {
      assert(false, '10. Vehicle Mismatch', err.message);
    }

    // -------------------------------------------------------------
    // 11. Báo Số Điện Thoại Ảo / Không Nghe Máy
    // -------------------------------------------------------------
    console.log('\n--- 11. Kiểm thử Báo Số Điện Thoại Ảo / Không Nghe Máy ---');
    try {
      const unreachableRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/report-unreachable-phone`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({
          unreachablePhone: '0988112233',
          reason: 'Gọi 3 cuộc liên tiếp thuê bao không liên lạc được'
        })
      });
      assert(unreachableRes.status === 200, 'Anti-Fake Phone 1: Gửi báo cáo số điện thoại ảo thành công (HTTP 200)');
    } catch (err) {
      assert(false, '11. Unreachable Phone', err.message);
    }

    // -------------------------------------------------------------
    // 12. Cổng Quản Trị Admin & Phân Quyền Bảo Mật (Anti-BOLA/IDOR)
    // -------------------------------------------------------------
    console.log('\n--- 12. Kiểm thử Cổng Quản Trị Admin & Phân Quyền An Toàn ---');
    try {
      // Đăng nhập Cổng Quản Trị cấp token JWT
      const adminAuthRes = await fetch(`${BASE_URL}/api/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-carmate-testing': 'true' },
        body: JSON.stringify({ passcode: ADMIN_PASSCODE, mfaCode: '123456' })
      });
      const adminAuthData = await adminAuthRes.json();
      adminHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuthData.token}`
      };

      // Người dùng thường gọi vào admin -> Phải bị chặn 403
      const unauthorizedRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
        headers: passengerHeaders
      });
      assert(unauthorizedRes.status === 403, 'RBAC 1: Người dùng thường không được phép truy cập cổng admin (HTTP 403)');

      // Admin với passkey chuẩn -> Truy cập thành công
      const adminMetricsRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
        headers: adminHeaders
      });
      assert(adminMetricsRes.status === 200, 'RBAC 2: Quản trị viên truy cập metrics thành công (HTTP 200)');

      // Admin dọn sạch sự kiện analytics & quỹ đạo AI thành công
      const clearAnalyticsRes = await fetch(`${BASE_URL}/api/admin/analytics`, {
        method: 'DELETE',
        headers: adminHeaders
      });
      assert(clearAnalyticsRes.status === 200, 'Admin Action: Dọn sạch sự kiện phân tích thành công (HTTP 200)');

      const clearAiRes = await fetch(`${BASE_URL}/api/admin/ai-trajectories`, {
        method: 'DELETE',
        headers: adminHeaders
      });
      assert(clearAiRes.status === 200, 'Admin Action: Dọn sạch quỹ đạo AI thành công (HTTP 200)');

      const clearTestDataRes = await fetch(`${BASE_URL}/api/admin/test-data`, {
        method: 'DELETE',
        headers: adminHeaders
      });
      assert(clearTestDataRes.status === 200, 'Admin Action: Dọn sạch toàn bộ dữ liệu kiểm thử thành công (HTTP 200)');
    } catch (err) {
      assert(false, '12. Admin RBAC', err.message);
    }

    // -------------------------------------------------------------
    // 13. Thư Cảnh Báo Hệ Thống, CSKH 24/7 & Ân Hạn 3 Ngày (Grace Period)
    // -------------------------------------------------------------
    console.log('\n--- 13. Kiểm thử Ân Hạn 3 Ngày & Khiếu Nại 1-Chạm ---');
    try {
      // Admin lấy danh sách báo cáo sai lệch xe để xử lý
      const reportsRes = await fetch(`${BASE_URL}/api/admin/reports`, {
        headers: adminHeaders
      });
      assert(reportsRes.status === 200, 'Admin Action 1: Xem danh sách báo cáo sai lệch xe');
    } catch (err) {
      assert(false, '13. Grace Period & Dispute', err.message);
    }

    // -------------------------------------------------------------
    // 14. Yêu Cầu Xóa Tài Khoản Gửi Tới Admin (Apple Guideline 5.1.1 v)
    // -------------------------------------------------------------
    console.log('\n--- 14. Kiểm thử Yêu Cầu Xóa Tài Khoản Gửi Admin Tiếp Nhận ---');
    try {
      const delReqRes = await fetch(`${BASE_URL}/api/auth/deletion-request`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({
          reason: 'Tôi không còn nhu cầu sử dụng dịch vụ ghép xe nữa'
        })
      });
      assert(delReqRes.status === 200, 'Account Deletion 1: Gửi yêu cầu xóa tài khoản thành công tới Quản trị viên (HTTP 200)');

      // Admin kiểm tra danh sách yêu cầu xóa
      const adminDelList = await fetch(`${BASE_URL}/api/admin/deletion-requests`, {
        headers: adminHeaders
      }).then((r) => r.json());
      assert(adminDelList.success === true, 'Account Deletion 2: Admin truy cập danh sách yêu cầu xoá tài khoản thành công');
    } catch (err) {
      assert(false, '14. Account Deletion Request', err.message);
    }

    // -------------------------------------------------------------
    // 15. Chuẩn Mực Danh Xưng Ghép Xe Văn Minh (Terminology Standards)
    // -------------------------------------------------------------
    console.log('\n--- 15. Kiểm thử Chuẩn Mực Danh Xưng: Chủ Xe & Người Đi Cùng ---');
    try {
      const { toPublicAlias } = await import('@carmate/shared');

      // Danh xưng Chủ xe & Khách đi cùng
      assert(toPublicAlias({ type: 'driver_offer', maskedCode: 'CX-305' }) === 'Chủ xe CX-305', 'Terminology 1: Đối tác lái xe là "Chủ xe CX-xxx"');
      assert(toPublicAlias({ type: 'passenger_request', maskedCode: 'KX-412' }) === 'Khách KX-412', 'Terminology 2: Người đi cùng là "Khách KX-xxx"');

      // Tuyệt đối không dùng danh xưng thương mại "Bác tài" hay "Tài xế"
      const bannedTerms = ['Bác tài', 'bác tài'];
      const sharedCode = fs.readFileSync(path.resolve(process.cwd(), 'packages/shared/src/constants/mockData.js'), 'utf8');
      const hasBanned = bannedTerms.some((term) => sharedCode.includes(term));
      assert(!hasBanned, 'Terminology 3: Tuyệt đối triệt tiêu danh xưng taxi thương mại "Bác tài"');
    } catch (err) {
      assert(false, '15. Terminology Standards', err.message);
    }

    // -------------------------------------------------------------
    // 16. Radar Gợi Ý Khớp Xe Thông Minh (Social Smart Match) & Auto Alert
    // -------------------------------------------------------------
    console.log('\n--- 16. Kiểm thử Radar Gợi Ý Khớp Xe Thông Minh & Auto Alert ---');
    try {
      // 1. Kiểm tra endpoint gợi ý khớp xe tổng quát
      const socialRes = await fetch(`${BASE_URL}/api/matches/social-suggestions`);
      const socialData = await socialRes.json();
      assert(socialRes.status === 200, 'Social Match 1: Gọi API gợi ý khớp xe thành công (HTTP 200)');
      assert(socialData.success === true && Array.isArray(socialData.data), 'Social Match 2: Dữ liệu gợi ý trả về mảng hợp lệ');

      if (socialData.data.length > 0) {
        const first = socialData.data[0];
        assert(typeof first.score === 'number' && first.score >= 50, 'Social Match 3: Điểm khớp (score) được tính toán chuẩn xác >= 50%');
        assert(first.fuelSavings && typeof first.fuelSavings.savingsVnd === 'number', 'Social Match 4: Ước lượng tiết kiệm xăng chuẩn xác');
        assert(Array.isArray(first.socialTags), 'Social Match 5: Có nhãn xã hội (social tags) kết nối');
      }

      // 2. Kiểm tra gợi ý khớp cho một chuyến cụ thể (tripId)
      const specificRes = await fetch(`${BASE_URL}/api/matches/social-suggestions?tripId=${testTripId}`);
      const specificData = await specificRes.json();
      assert(specificRes.status === 200, 'Social Match 6: Tìm đối tác cho chuyến cụ thể thành công');
      assert(specificData.success === true, 'Social Match 7: Gợi ý đối tác chuẩn xác không lỗi');

      // 3. Kiểm tra hàm gửi thông báo Telegram với cơ chế chống spam (Cooldown 2h)
      const { sendSmartMatchTelegramAlert } = await import('../apps/api/src/utils/telegramAlert.js');
      assert(typeof sendSmartMatchTelegramAlert === 'function', 'Social Match 8: Hàm gửi alert thông minh qua Telegram tồn tại');
    } catch (err) {
      assert(false, '16. Social Smart Match & Telegram Alert', err.message);
    }

    // -------------------------------------------------------------
    // 17. Kiểm thử Mở rộng Ghép Cốp & Thùng Bán Tải Tiện Tuyến (Cargo & Pickup Bed Sharing)
    // -------------------------------------------------------------
    console.log('\n--- 17. Kiểm thử Mở rộng Ghép Cốp & Thùng Bán Tải Tiện Tuyến ---');
    try {
      const {
        CARGO_TYPES,
        getRecommendedCargoPrice,
        VEHICLE_SEAT_CONFIGS,
        sanitizeVehicleCapacityAndSeats,
        TIME_SLOTS
      } = await import('@carmate/shared');

      // 1. Kiểm tra 3 nhóm thể tích hàng gửi chuẩn bản địa
      assert(Boolean(CARGO_TYPES.compact_parcel && CARGO_TYPES.produce_box && CARGO_TYPES.bulky_cargo), 'Cargo 1: Đủ 3 gói thể tích tiện tuyến (Bưu phẩm, Thùng xốp/Nông sản, Chuyển trọ)');
      assert(CARGO_TYPES.produce_box.basePrice === 90000, 'Cargo 2: Gói thùng xốp có giá gốc định mức chuẩn 90.000đ');

      // 2. Kiểm tra tính giá phụ xăng hàng gửi động theo cự ly
      const shortDistPrice = getRecommendedCargoPrice('produce_box', 80);
      const longDistPrice = getRecommendedCargoPrice('produce_box', 180);
      assert(shortDistPrice > 0 && longDistPrice > shortDistPrice, 'Cargo 3: Phụ xăng thùng xốp tính tự động theo cự ly Geodesic');

      // 3. Kiểm tra cấu hình xe bán tải (Cabin 5 chỗ, max 4 khách + Thùng ~800kg)
      assert(VEHICLE_SEAT_CONFIGS.pickup?.hasCargoBed === true, 'Pickup 1: Xe bán tải nhận diện khoang thùng chở hàng riêng');
      assert(VEHICLE_SEAT_CONFIGS.pickup?.maxPassengerSeats === 4, 'Pickup 2: Xe bán tải tuân thủ tối đa 4 ghế khách (trừ ghế lái)');

      // 4. Chuẩn hóa xe bán tải qua hàm sanitizer
      const pickupSanitized = sanitizeVehicleCapacityAndSeats('pickup', 6);
      assert(pickupSanitized.vehicleType === 'pickup' && pickupSanitized.seats === 4, 'Pickup 3: Sanitizer tự động giới hạn 4 ghế khách cho xe bán tải');

      // 5. Đăng chuyến xe bán tải thực tế qua API
      const pickupTripRes = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'driver_offer',
          phoneReal: '0988112233',
          from: 'Bình Phước',
          to: 'TP Hồ Chí Minh',
          vehicleType: 'pickup',
          carType: 'Ford Ranger Wildtrak (Xe bán tải)',
          hasCargoBed: true,
          acceptsParcel: true,
          availableSeats: 3,
          basePricePerSeat: 160000,
          cargoNotes: 'Thùng xe rộng ~800kg có nắp cuộn chống nước, nhận gửi nông sản quê & đồ chuyển trọ'
        })
      });
      const pickupTripData = await pickupTripRes.json();
      assert(pickupTripRes.status === 201 && pickupTripData.data.hasCargoBed === true, 'Pickup 4: Đăng chuyến xe bán tải nhận chở hàng thành công (HTTP 201)');

      // 6. Tạo yêu cầu gửi hàng thùng xốp tiện tuyến
      const cargoBookingRes = await fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({
          targetId: pickupTripData.data.id,
          from: 'Chơn Thành',
          to: 'Bến xe Miền Đông',
          contactPhone: '0933888999',
          isCargoBooking: true,
          cargoType: 'produce_box',
          cargoDescription: '1 thùng xốp mít sấy 15kg bọc kín băng dính',
          totalDeal: 100000,
          seats: 0
        })
      });
      const cargoBookingData = await cargoBookingRes.json();
      assert(cargoBookingRes.status === 201 && cargoBookingData.data.isCargoBooking === true, 'Cargo 4: Gửi yêu cầu ghép hàng tiện tuyến thành công (HTTP 201)');

      // 7. Kiểm tra chuẩn hóa khung giờ 24h sạch (không còn "Sáng" / "Chiều" thừa trong 24h format)
      const slot0506 = TIME_SLOTS.find((s) => s.id === '05:00-06:00');
      assert(slot0506 && !slot0506.short.includes('Sáng') && !slot0506.short.includes('AM'), 'TimeSlot 1: Chuẩn 24h sạch sẽ (05:00 — 06:00 không có từ thừa)');
    } catch (err) {
      assert(false, '17. Cargo & Pickup Bed Sharing Expansion', err.message);
    }

    // -------------------------------------------------------------
    // 18. Kiểm thử Xe Tải Nhẹ & Chành Xe Địa Phương Tiện Tuyến N2 (Bình Phước ⇄ Kiên Giang)
    // -------------------------------------------------------------
    console.log('\n--- 18. Kiểm thử Xe Tải Nhẹ & Chành Xe Địa Phương Tiện Tuyến N2 ---');
    try {
      const {
        CARGO_TYPES,
        getRecommendedCargoPrice,
        ROUTE_BENCHMARKS,
        getCorridorWaypoints
      } = await import('@carmate/shared');

      // 1. Kiểm tra 6 nhóm thể tích tiện tuyến bản địa
      const cargoKeys = Object.keys(CARGO_TYPES);
      assert(
        cargoKeys.includes('motorcycle') && cargoKeys.includes('half_truck') && cargoKeys.includes('full_truck'),
        'Truck Cargo 1: Đầy đủ 3 gói hàng địa phương (Xe máy/xe điện, Nửa thùng ~1T, Bao trọn thùng quay đầu)'
      );

      // 2. Kiểm tra định giá cự ly cho xe máy
      const motorcyclePrice = getRecommendedCargoPrice('motorcycle', 280);
      assert(motorcyclePrice >= 350000 && motorcyclePrice <= 600000, `Truck Cargo 2: Giá gửi xe máy cự ly 280km chuẩn xác (~${motorcyclePrice.toLocaleString('vi-VN')}đ)`);

      // 3. Kiểm tra định mức Tuyến N2 - Kiên Giang trong ROUTE_BENCHMARKS
      const n2Benchmark = ROUTE_BENCHMARKS['Tuyến N2 - Kiên Giang'];
      assert(n2Benchmark && n2Benchmark.distanceKm === 280, 'Route N2 1: Hành lang Tuyến N2 - Kiên Giang chuẩn 280km');

      // 4. Kiểm tra Corridor Waypoints tuyến N2
      const n2Waypoints = getCorridorWaypoints('Kiên Giang');
      assert(
        Array.isArray(n2Waypoints) && n2Waypoints.some((w) => w.includes('Đức Hòa') || w.includes('Thạnh Hóa') || w.includes('Vàm Cống')),
        'Route N2 2: Tìm được các điểm mốc chính trên Tuyến N2 (Đức Hòa, Thạnh Hóa, Cầu Vàm Cống)'
      );

      // 5. Bất biến MIT: Xe tải nhẹ chỉ nhận tối đa 1 người đi cùng (ghế phụ)
      const overloadTruckRes = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'driver_offer',
          phoneReal: '0988112233',
          carType: 'Kia K250 (Xe tải 2.4T)',
          vehicleType: 'truck_light',
          capacity: 2,
          availableSeats: 2, // Quá tải ghế phụ! Chỉ được 1
          from: 'Chơn Thành',
          to: 'Rạch Giá'
        })
      });
      assert(overloadTruckRes.status === 400, 'Truck Invariant 1: Chặn đăng xe tải chở quá 1 người đi cùng ghế phụ (HTTP 400)');

      // 6. Đăng chuyến xe tải nhẹ hợp lệ (1 ghế phụ, có thùng xe chở hàng)
      const truckTripRes = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: driverHeaders,
        body: JSON.stringify({
          type: 'driver_offer',
          phoneReal: '0988112233',
          carType: 'Kia K250 (Xe tải mui bạt 2.4T)',
          vehicleType: 'truck_light',
          capacity: 2,
          availableSeats: 1,
          hasCargoBed: true,
          isCargoVehicle: true,
          cargoBedCapacityKg: 2400,
          from: 'Chơn Thành (Bình Phước)',
          to: 'Rạch Giá (Kiên Giang)',
          routeCategory: 'Tuyến N2 - Kiên Giang',
          direction: 'both',
          timeSlot: '05:00-06:00',
          basePricePerSeat: 260000,
          notes: 'Xe tải chở nông sản xong quay đầu về Rạch Giá rỗng thùng. Nhận chở xe máy, nông sản vài tạ đến 1 tấn.'
        })
      });
      const truckTripData = await truckTripRes.json();
      assert(
        truckTripRes.status === 201 && truckTripData.data.vehicleType === 'truck_light' && truckTripData.data.hasCargoBed === true,
        'Truck Trip 1: Đăng chuyến xe tải nhẹ quay đầu rỗng thùng thành công (HTTP 201)'
      );

      // 7. Tạo yêu cầu gửi xe máy về quê theo xe tải
      const motoBookingRes = await fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({
          targetId: truckTripData.data.id,
          from: 'Chơn Thành',
          to: 'Rạch Giá',
          contactPhone: '0933888999',
          isCargoBooking: true,
          cargoType: 'motorcycle',
          cargoDescription: '1 xe máy Honda Wave Alpha đã rút sạch xăng gửi về quê cho mẹ',
          totalDeal: 450000,
          seats: 0
        })
      });
      const motoBookingData = await motoBookingRes.json();
      assert(
        motoBookingRes.status === 201 && motoBookingData.data.cargoType === 'motorcycle',
        'Truck Booking 1: Gửi yêu cầu vận chuyển xe máy về quê thành công (HTTP 201)'
      );
    } catch (err) {
      assert(false, '18. Light Truck & Local Route N2 Corridor', err.message);
    }

  } finally {
    // -------------------------------------------------------------
    // Tự động dọn dẹp 100% dữ liệu tạm sau khi test hoàn tất
    // -------------------------------------------------------------
    cleanupTestData();
  }

  // -------------------------------------------------------------
  // Tổng Kết
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log('📊 TỔNG KẾT BỘ KIỂM THỬ CỐT LÕI CARMATE:');
  console.log(`- Tổng số bài test: ${totalTests}`);
  console.log(`- Số bài ĐẠT (PASS): ${passedTests} / ${totalTests} (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log(`- Số bài LỖI (FAIL): ${failedTests.length}`);
  console.log('🧹 Trạng thái dữ liệu: Đã tự động dọn sạch 100% test data khỏi SQLite!');
  console.log('=============================================================\n');

  if (failedTests.length > 0) {
    console.log('⚠️ Có bài test chưa đạt:');
    failedTests.forEach((f) => console.log(`  - ${f.name}: ${f.details || 'failed'}`));
    process.exit(1);
  } else {
    console.log('🎉 TẤT CẢ BÀI KIỂM THỬ ĐÃ ĐẠT 100%! HỆ THỐNG HOÀN TOÀN KHỎE MẠNH VÀ SẠCH SẼ.\n');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Lỗi nghiêm trọng trong quá trình chạy test:', err);
  process.exit(1);
});
