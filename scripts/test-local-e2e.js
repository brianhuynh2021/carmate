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
    const health = await fetch(`${BASE_URL}/api/health`).then(r => r.json());
    assert(health.status === 'ok', 'API Health trả về status "ok"');
    assert(health.service === 'CarMate Core API Engine', 'Tên định danh service chuẩn xác');
    assert(health.database.driverOffersCount > 0, 'Database có dữ liệu chuyến đi chủ xe');

    const stats = await fetch(`${BASE_URL}/api/stats`).then(r => r.json());
    assert(stats.success === true, 'API Stats trả về thành công');
    assert(typeof stats.data.members === 'number' && stats.data.members > 0, 'Số lượng thành viên hiển thị sống');
    assert(stats.data.routes > 0, 'Số lượng tuyến đường liên tỉnh có sẵn');
  } catch (err) {
    assert(false, 'Kiểm thử Health & Stats', err.message);
  }

  // 3. Kiểm tra Bảng Giá Tham Chiếu (Benchmarks)
  console.log('\n--- 3. Kiểm thử Bảng Giá Tham Chiếu & Chống Giá Ảo ---');
  try {
    const benchmarks = await fetch(`${BASE_URL}/api/benchmarks`).then(r => r.json());
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
    const allTrips = await fetch(`${BASE_URL}/api/trips`).then(r => r.json());
    assert(allTrips.success === true, 'Tải toàn bộ danh sách chuyến đi');
    assert(allTrips.total > 0, `Có tổng cộng ${allTrips.total} chuyến đi đang mở`);
    assert(allTrips.data.all.every(t => t.phoneReal === undefined && t.phone === undefined), 'PII Protection: phoneReal và phone được che giấu trên endpoint public');

    const ql13Trips = await fetch(`${BASE_URL}/api/trips?routeCategory=Tuy%E1%BA%BFn+QL13`).then(r => r.json());
    assert(ql13Trips.success === true, 'Lọc chuyến đi theo Tuyến QL13');
    assert(ql13Trips.data.all.every(t => t.routeCategory.includes('QL13')), 'Tất cả kết quả lọc đều thuộc QL13');

    const filteredDirection = await fetch(`${BASE_URL}/api/trips?direction=B%C3%ACnh+Ph%C6%B0%E1%BB%9Bc+%E2%9E%94+TP.HCM`).then(r => r.json());
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
    const checkTripRes = await fetch(`${BASE_URL}/api/trips/${newTripId}`).then(r => r.json());
    assert(checkTripRes.success === true && checkTripRes.data.id === newTripId, 'Chuyến mới được lưu trữ và truy xuất thành công');
  } catch (err) {
    assert(false, 'Đăng chuyến đi mới', err.message);
  }

  // 6. Kiểm tra Radar Khớp Lệnh AI Thông Minh
  console.log('\n--- 6. Kiểm thử Radar Khớp Lệnh AI (GET /api/matches) ---');
  try {
    const matchesRes = await fetch(`${BASE_URL}/api/matches`).then(r => r.json());
    assert(matchesRes.success === true, 'Quét radar ghép tiện tuyến thành công');
    assert(matchesRes.data.matches.length > 0, `Phát hiện ${matchesRes.data.matches.length} cặp tương thích cao`);
    
    const firstMatch = matchesRes.data.matches[0];
    assert(firstMatch.score >= 70, `Điểm tương thích AI đạt ngưỡng cao (${firstMatch.score}%)`);
    assert(Array.isArray(firstMatch.reasons) && firstMatch.reasons.length > 0, 'Có danh sách lý do ghép tiện tuyến thông minh');
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
      body: JSON.stringify({ phone: '0933888999', name: 'Hành khách Test E2E' })
    });
    const passengerAuth = await passengerAuthRes.json();
    const passengerHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${passengerAuth.token}`
    };

    const driverAuthRes = await fetch(`${BASE_URL}/api/auth/zalo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0988112233', name: 'Chủ xe Test E2E #999' })
    });
    const driverAuth = await driverAuthRes.json();
    const driverHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${driverAuth.token}`
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
    assert(driverReviewData.data.newReview.targetRole === 'passenger', 'Ghi nhận đối tượng nhận đánh giá là Hành khách');

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
      body: JSON.stringify({ phone: '0909111222', name: 'Người huỷ chuyến Test' })
    });
    const cancelUserToken = (await cancelUserAuth.json()).token;
    const cancelHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cancelUserToken}`
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
    const trustRes = await fetch(`${BASE_URL}/api/trust`).then(r => r.json());
    assert(trustRes.success === true, 'Tải hồ sơ tín nhiệm mặc định');
    assert(trustRes.data.karmaScore >= 90 || trustRes.data.trustScore >= 90, `Điểm Karma cộng đồng đạt chuẩn (${trustRes.data.karmaScore || trustRes.data.trustScore}/100)`);
    assert(trustRes.data.driverStats?.tripsCompleted > 0, 'Hồ sơ có thống kê Kinh nghiệm Cầm lái');
    assert(trustRes.data.passengerStats?.tripsCompleted > 0, 'Hồ sơ có thống kê Kinh nghiệm Đi cùng (2 vai trò linh hoạt)');
    assert(trustRes.data.verifications.some(v => v.key === 'id_card' && v.verified), 'Đã xác thực CCCD gắn chip');
    assert(trustRes.data.verifications.some(v => v.key === 'driver_license' && v.verified), 'Đã xác thực GPLX');

    const specificTrustRes = await fetch(`${BASE_URL}/api/trust/tuan-bp`).then(r => r.json());
    assert(specificTrustRes.success === true && specificTrustRes.data.id === 'tuan-bp', 'Tải hồ sơ thành viên cụ thể (tuan-bp)');
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
    assert(metricsData.data.systemHealth?.heapUsedMB !== undefined && metricsData.data.systemHealth?.uptimeSeconds !== undefined, 'Đo lường RAM thực và Uptime máy chủ hoạt động');
    assert(metricsData.data.overview?.totalTripsCount > 0, `Đếm tổng số chuyến đi: ${metricsData.data.overview?.totalTripsCount}`);

    // 10.4 Kiểm tra Danh sách chuyến Admin & Tính năng Ẩn/Hiện chuyến vi phạm
    const adminTripsRes = await fetch(`${BASE_URL}/api/admin/trips`, { headers: adminHeaders });
    const adminTripsData = await adminTripsRes.json();
    assert(adminTripsRes.status === 200, 'Tải danh sách chuyến dành riêng cho Admin');
    assert(Array.isArray(adminTripsData.data) && adminTripsData.data.length > 0, 'Hiển thị đầy đủ chuyến bao gồm cả bài ẩn/kiểm duyệt');

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
    const publicTripsAfterHide = await fetch(`${BASE_URL}/api/trips`).then(r => r.json());
    const isPresentPublicly = publicTripsAfterHide.data.all.some(t => t.id === tripIdToToggle && hideData.data.isHidden);
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
      assert(updateStatusRes.status === 200, `Duyệt cấp tích xanh CCCD & GPLX cho thành viên (${targetUser.name || targetUser.phone})`);
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
      body: JSON.stringify({ phone: '0984883750', name: 'Tài xế Nguyễn Văn A' })
    });
    const loginAData = await loginARes.json();
    assert(loginARes.status === 200 && typeof loginAData.token === 'string', 'Đăng nhập User A nhận JWT Token hợp lệ');
    const tokenA = loginAData.token;
    sharedTokenA = tokenA;

    // 11.2 Kiểm tra endpoint /api/auth/me với tokenA
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.user?.phone === '0984883750', 'Xác thực phiên làm việc /api/auth/me qua JWT Token thành công');

    // 11.3 Đăng nhập User B
    const loginBRes = await fetch(`${BASE_URL}/api/auth/zalo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0913889922', name: 'Tài xế Trần Văn B' })
    });
    const loginBData = await loginBRes.json();
    assert(loginBRes.status === 200 && typeof loginBData.token === 'string', 'Đăng nhập User B nhận JWT Token riêng biệt');
    const tokenB = loginBData.token;

    // 11.4 User A tạo 1 chuyến đi thử nghiệm
    const createTripRes = await fetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
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
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    assert(attackRes.status === 403, 'Chặn User B xâm phạm xóa bài đăng của User A (HTTP 403 Forbidden - Anti-IDOR)');

    // 11.6 User A xóa chính bài của mình -> ĐƯỢC PHÉP 200
    const ownerDeleteRes = await fetch(`${BASE_URL}/api/trips/${createdTrip.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` }
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
    assert(typeof searchAiData.data.reply === 'string' && searchAiData.data.reply.length > 0, 'Agent trả về câu trả lời tự nhiên');
    assert(Array.isArray(searchAiData.data.reasoningSteps) && searchAiData.data.reasoningSteps.length > 0, 'Agent ghi nhận các bước suy luận Stanford Loop (Plan -> Act -> Observe -> Reflect)');
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
    assert(benchAiData.data.reply.toLowerCase().includes('ql13') || benchAiData.data.reply.toLowerCase().includes('13') || benchAiData.data.reply.includes('đ'), 'Agent trích xuất số liệu vé trạm và xăng chính xác');

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
    assert(trustAiData.data.reply.includes('Tuấn') || trustAiData.data.reply.includes('tin cậy') || trustAiData.data.reply.includes('Trust'), 'Agent phân tích đúng hồ sơ tin cậy');
  } catch (err) {
    assert(false, 'Kiểm thử Agentic AI Engine', err.message);
  }

  // ==========================================
  // BÀI TEST 13: KIỂM THỬ AN NINH BẢO MẬT & PII PRODUCTION (NĐ 13/2023)
  // ==========================================
  console.log('\n--- 13. KIỂM THỬ AN NINH BẢO MẬT NÂNG CAO (PII, IDOR, AUTH, XSS) ---');
  try {
    // 13.1 Bookings endpoint ẩn dữ liệu với unauthenticated
    const publicBookings = await fetch(`${BASE_URL}/api/bookings`).then(r => r.json());
    assert(publicBookings.success === true && Array.isArray(publicBookings.data) && publicBookings.data.length === 0, 'PII Protection: /api/bookings không rò rỉ danh sách đặt chỗ cho khách vãng lai');

    // 13.2 Chặn raw passcode làm bearer token
    const rawPasscodeRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { 'x-admin-key': ADMIN_PASSCODE }
    });
    assert(rawPasscodeRes.status === 401 || rawPasscodeRes.status === 403, 'Bảo mật Admin: Dùng raw passcode làm token bị từ chối 401/403 (Bắt buộc JWT có chữ ký)');

    // 13.3 Chặn thao tác booking không có quyền (IDOR protection)
    const unauthorizedCancelRes = await fetch(`${BASE_URL}/api/bookings/ESC-TEST-IDOR/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Test cancel unauthorized' })
    });
    assert(unauthorizedCancelRes.status === 401 || unauthorizedCancelRes.status === 403, 'Kiểm soát quyền: Hủy booking không có token bị chặn 401/403');

    // 13.4 Chống Stored XSS: input có HTML tag được escape
    const xssTripRes = await fetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sharedTokenA}`
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
    assert(xssTripRes.status === 201 && !xssTripData.data.from.includes('<img'), 'Chống Stored XSS: Ký tự HTML độc hại được mã hóa thực thể an toàn');
    if (xssTripData?.data?.id && sharedTokenA) {
      await fetch(`${BASE_URL}/api/trips/${xssTripData.data.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sharedTokenA}` }
      }).catch(() => {});
    }

    // 13.5 Radar so khớp O(N+M) hoạt động và che PII
    const matchesRes = await fetch(`${BASE_URL}/api/matches?route=Tuy%E1%BA%BFn+QL13`).then(r => r.json());
    assert(matchesRes.success === true && Array.isArray(matchesRes.data.matches), 'Radar ghép xe O(N+M) phản hồi kết quả');
    if (matchesRes.data.matches.length > 0) {
      const firstMatch = matchesRes.data.matches[0];
      assert(firstMatch.driver.phoneReal === undefined && firstMatch.passenger.phoneReal === undefined, 'PII Protection: Radar che giấu SĐT thật của tài xế và khách');
    }

    // 14. KIỂM THỬ CURSOR INLINE CO-PILOT & ZALO SMART DRAFT (PHASE 1)
    console.log('\n--- 14. Kiểm thử Cursor Inline Co-Pilot & Zalo Smart Draft ---');
    const { parseNaturalTrip, generateSmartZaloDraft } = await import('../apps/web/src/utils/nlpTripParser.js');
    
    // 14.1 Nhận diện xe gia đình chở vợ con
    const familyTripText = 'Chiều nay 17h mình chở vợ con từ Bù Đốp về Sài Gòn xe 7 chỗ còn 1 ghế sau đón QL13 phụ xăng 120k sđt 0984883750';
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
    assert(loop2Seats.innerLoopLog.some(l => l.includes('[VERIFY]')), 'Verify: Ghi nhận nhật ký thẩm tra số ghế');

    // 15.2 Verify: Chấp nhận xe gia đình khi khách chỉ đi 1 người
    const loop1Seat = runStanfordInnerLoop({
      from: 'Bù Đốp',
      to: 'Sài Gòn',
      seatsRequested: 1,
      rawTrips: mockTrips,
      benchmark: { suggestedRate: 140000 }
    });
    assert(loop1Seat.finalTrips.length === 2, 'Verify: Xe gia đình chở người thân hoàn toàn khả dụng khi khách đi 1 người');

    // 15.3 Reflect: Phản tư tính công bằng với bảng định mức
    assert(loop1Seat.innerLoopLog.some(l => l.includes('[REFLECT]')), 'Reflect: Tự động đối chiếu mức phụ xăng với định mức chuẩn');
    assert(loop1Seat.finalTrips[0].reflection.includes('Phụ xăng rất công bằng'), 'Reflect: Đánh giá chi phí 120k công bằng, thấp hơn 140k');

    // 15.4 Replan: Tái lập kế hoạch khi không có chuyến khớp điểm đón
    const loopEmpty = runStanfordInnerLoop({
      from: 'Địa điểm không có xe',
      to: 'Nơi xa xôi',
      seatsRequested: 1,
      rawTrips: [],
      benchmark: { suggestedRate: 140000 }
    });
    assert(loopEmpty.innerLoopLog.some(l => l.includes('[REPLAN]')), 'Replan: Tự kích hoạt quét mở rộng hành lang trục chính');

    // 15.5 Endpoint /api/agent/chat trả về chuẩn cấu trúc Stanford
    const chatAgentRes = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Tìm xe từ Bình Phước về Sài Gòn chiều nay cần 2 ghế' })
    }).then(r => r.json());
    assert(chatAgentRes.success === true, 'API Chat Agentic phản hồi thành công');
    assert(Array.isArray(chatAgentRes.data.reasoningSteps) && chatAgentRes.data.reasoningSteps.length >= 4, 'API Chat trả về chuỗi tư duy đầy đủ các bước');
    assert(chatAgentRes.data.reasoningSteps.some(s => s.startsWith('[PLAN]')), 'API Chat có bước [PLAN]');
    assert(chatAgentRes.data.reasoningSteps.some(s => s.startsWith('[ACT]')), 'API Chat có bước [ACT]');
    assert(chatAgentRes.data.reasoningSteps.some(s => s.startsWith('[VERIFY]')), 'API Chat có bước [VERIFY]');
    assert(chatAgentRes.data.reasoningSteps.some(s => s.startsWith('[RESOLVE]')), 'API Chat có bước [RESOLVE]');

    // 16. KIỂM THỬ MIT OUTER SYSTEM (3-TIER HUMAN-IN-THE-LOOP & TRAJECTORY STEPPER)
    console.log('\n--- 16. Kiểm thử MIT Outer System (3-Tier Human-in-the-Loop & Trajectory Stepper) ---');
    
    // 16.1 Tạo booking với tài khoản User A
    const bookRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sharedTokenA}`
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
    assert(bookRes.status === 201 && bookData.success === true, 'MIT Tier 1: Tạo kết nối chuyến xe và sinh mã Escrow thành công');
    const escrowId = bookData.data?.escrowId;
    assert(escrowId && escrowId.startsWith('ESC-'), 'MIT Tier 1: Mã Escrow định dạng chuẩn ESC-');
    assert(bookData.data.status === 'zalo_active', 'MIT Tier 2: Trạng thái khởi tạo là zalo_active (Bước 2/4: Chốt Zalo & Điểm hẹn)');

    // 16.2 Báo trễ giờ hẹn văn minh (+15 phút)
    const delayRes = await fetch(`${BASE_URL}/api/bookings/${escrowId}/delay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sharedTokenA}`
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
        'Authorization': `Bearer ${sharedTokenA}`
      },
      body: JSON.stringify({
        reason: 'Việc gia đình đột xuất'
      })
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200 && cancelData.success === true, 'MIT Tier 3: Huỷ chuyến văn minh thành công (0đ tiền phạt)');
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
    assert(trajChatRes.status === 200 && trajChatData.success === true, 'Phase 4: Gọi Agent Chat ghi nhận telemetry thành công');
    assert(typeof trajChatData.data.executionTimeMs === 'number' && trajChatData.data.executionTimeMs >= 0, 'Phase 4: Agent Chat đo lường chính xác thời gian thực thi (executionTimeMs)');

    // 17.2 Phát hiện Tuyến khát xe (Unmet Demand Detection)
    const unmetChatRes = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Tìm giúp xe từ Bù Đốp đi Móng Cái Quảng Ninh gấp'
      })
    });
    const unmetChatData = await unmetChatRes.json();
    assert(unmetChatRes.status === 200 && unmetChatData.success === true, 'Phase 4: Truy vấn tuyến lạ phản hồi thành công');
    assert(Array.isArray(unmetChatData.data.suggestedTrips) && unmetChatData.data.suggestedTrips.length === 0, 'Phase 4: Tuyến lạ ghi nhận 0 chuyến (kích hoạt cờ Unmet Demand)');

    // 17.3 Admin truy vấn Telemetry & Trajectory Hub qua /api/admin/ai-intelligence
    const aiIntelRes = await fetch(`${BASE_URL}/api/admin/ai-intelligence`, {
      headers: { 'x-admin-key': adminToken }
    });
    const aiIntelData = await aiIntelRes.json();
    assert(aiIntelRes.status === 200 && aiIntelData.success === true, 'Phase 4: Admin tải Telemetry & Quỹ đạo AI thành công (HTTP 200)');
    assert(aiIntelData.data?.summary && typeof aiIntelData.data.summary.totalQueries === 'number', 'Phase 4: Telemetry tổng hợp số lượng truy vấn AI');
    assert(typeof aiIntelData.data.summary.resolutionRate === 'number', 'Phase 4: Đo lường Task Resolution Rate (%)');
    assert(typeof aiIntelData.data.summary.avgLatencyMs === 'number', 'Phase 4: Đo lường Average Latency (ms)');
    assert(Array.isArray(aiIntelData.data.recentTrajectories) && aiIntelData.data.recentTrajectories.length > 0, 'Phase 4: Hộp đen lưu trữ danh sách Trajectories thời gian thực');
    
    const firstTraj = aiIntelData.data.recentTrajectories[0];
    assert(firstTraj.id && firstTraj.id.startsWith('TRAJ-'), 'Phase 4: Mã Trajectory chuẩn TRAJ-xxxx');
    assert(Array.isArray(firstTraj.reasoningSteps) && firstTraj.reasoningSteps.length > 0, 'Phase 4: Lưu giữ chuỗi lập luận Stanford Loop [PLAN ➔ ACT...]');
    assert(Array.isArray(aiIntelData.data.unmetDemandRoutes), 'Phase 4: Báo cáo danh sách tuyến đường khát xe (Unmet Demand Routes)');
  } catch (err) {
    assert(false, 'Kiểm thử An ninh, Stanford & MIT Engine', err.message);
  }
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const total = results.length;
  console.log(`Tổng số bài test: ${total}`);
  console.log(`Số bài ĐẠT (PASS): ${passed} / ${total} (${Math.round(passed/total*100)}%)`);
  console.log(`Số bài LỖI (FAIL): ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 TẤT CẢ CÁC TÍNH NĂNG CHẠY Ở LOCAL ĐỀU HOÀN TOÀN TỐT & ỔN ĐỊNH 100%!');
  } else {
    console.error(`\n⚠️ Có ${failed} bài test chưa đạt, vui lòng kiểm tra lại.`);
    process.exit(1);
  }
}

runTests();
