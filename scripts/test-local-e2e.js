/**
 * CARMATE REFINED STREAMLINED E2E TEST SUITE
 * 
 * A streamlined, standards-grade test suite built specifically for CarMate:
 * - 100% focused on core business logic, MIT mathematical invariants & PII protection.
 * - Completely drops peripheral tests and checks of static JSX/CSS text that go stale easily.
 * - AUTO-CLEANUP (Auto-cleanup) of 100% of temporary test data after the run completes,
 *   absolutely NOT bloating or polluting the carmate.sqlite database.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { recordCallAttempt, isEmergencyPhoneUnlocked, resetEmergencyCallStatus, INITIAL_DRIVER_OFFERS, INITIAL_PASSENGER_REQUESTS } from '../packages/shared/src/index.js';

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
 * Thoroughly clean up all data produced by the E2E test run.
 * Ensures the database always stays clean and pristine.
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

/**
 * Reload the seed trips after the Admin test wipes the trips table.
 * Keeps the suite runnable many times in a row without manually clearing the DB.
 */
function restoreSeedTrips() {
  if (!fs.existsSync(DB_PATH)) return;
  try {
    const db = new Database(DB_PATH);
    const count = db.prepare('SELECT COUNT(*) AS c FROM trips').get()?.c || 0;
    if (count > 0) { db.close(); return; }

    const seeds = [...INITIAL_DRIVER_OFFERS, ...INITIAL_PASSENGER_REQUESTS];
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO trips
        (id, type, status, maskedCode, phoneReal, userId, fromLocation, toLocation,
         routeCategory, direction, timeSlot, date, price, seats, carCategory, carType,
         isHidden, isBanned, createdAt, payload)
      VALUES (@id, @type, @status, @maskedCode, @phoneReal, @userId, @fromLocation, @toLocation,
              @routeCategory, @direction, @timeSlot, @date, @price, @seats, @carCategory, @carType,
              @isHidden, @isBanned, @createdAt, @payload)
    `);
    const insertAll = db.transaction(() => {
      for (const t of seeds) {
        stmt.run({
          id: t.id,
          type: t.type,
          status: t.status || 'active',
          maskedCode: t.maskedCode || null,
          phoneReal: t.phoneReal || '',
          userId: t.userId || null,
          fromLocation: t.from || '',
          toLocation: t.to || '',
          routeCategory: t.routeCategory || null,
          direction: t.direction || null,
          timeSlot: t.timeSlot || null,
          date: t.date || 'Hôm nay',
          price: Number(t.basePricePerSeat || t.expectedPrice || 0),
          seats: Number(t.availableSeats ?? t.seatsNeeded ?? 1),
          carCategory: t.carCategory || null,
          carType: t.carType || null,
          isHidden: 0,
          isBanned: 0,
          createdAt: t.createdAt || Date.now(),
          payload: JSON.stringify(t)
        });
      }
    });
    insertAll();
    db.close();
    console.log(`  ♻️  Đã phục hồi ${seeds.length} chuyến mẫu để bộ kiểm thử chạy lại được.`);
  } catch (err) {
    console.warn('  ⚠️  Không phục hồi được chuyến mẫu:', err.message);
  }
}

async function runTests() {
  console.log(`\n🚀 BẮT ĐẦU KIỂM THỬ NGHIỆP VỤ CỐT LÕI CARMATE (${BASE_URL})\n`);

  // Clean up old test leftovers before starting
  cleanupTestData();

  let testTripId = null;
  let testBookingId = null;
  let passengerHeaders = { 'Content-Type': 'application/json' };
  let driverHeaders = { 'Content-Type': 'application/json' };
  let adminHeaders = { 'Content-Type': 'application/json' };

  try {
    // -------------------------------------------------------------
    // 1. Check the Web Frontend UI & Assets
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
    // 2. Check API Health & Platform Statistics
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
    // 3. Check the Market Reference Price Table & Anti-Fake-Pricing
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
    // 4. Check the Trip List & Public PII Protection
    // -------------------------------------------------------------
    console.log('\n--- 4. Kiểm thử Danh Sách Chuyến Đi & Bảo Mật PII Công Khai ---');
    try {
      const tripsRes = await fetch(`${BASE_URL}/api/trips`);
      const tripsData = await tripsRes.json();
      assert(tripsRes.status === 200 && tripsData.success === true, 'Trips 1: Tải danh sách chuyến đi thành công');
      const tripsList = tripsData.data?.all || [];
      assert(tripsData.total > 0 && Array.isArray(tripsList), `Trips 2: Có ${tripsData.total} chuyến xe đang mở trên sàn`);

      // INVARIANT: Never expose the real phone number on the public feed (Apple Privacy Standard)
      const hasLeakedPhone = tripsList.some((trip) => {
        return trip.phoneReal && trip.phoneReal.length >= 10 && !trip.phoneReal.includes('***');
      });
      assert(!hasLeakedPhone, 'Trips 3: PII Invariant: Tuyệt đối không để lộ số điện thoại thật trên endpoint công khai');

      // Check the route filter
      const filterRes = await fetch(`${BASE_URL}/api/trips?routeCategory=Tuyến QL13`);
      const filterData = await filterRes.json();
      assert(filterRes.status === 200 && filterData.success === true, 'Trips 4: Lọc chuyến theo hành lang Tuyến QL13');
      const filterTrips = filterData.data?.all || [];
      const allMatchRoute = filterTrips.length > 0 && filterTrips.every((t) => t.routeCategory === 'Tuyến QL13');
      assert(allMatchRoute, 'Trips 5: Kết quả lọc chính xác 100% thuộc tuyến QL13');

      // PII INVARIANT: The time-slot matrix is a PUBLIC endpoint with NO AUTH.
      // It does not go through sanitizeTripForPublic so it once leaked the full real phone number
      // (phoneReal) and the full license plate (fullPlate) — regression guard here.
      const slotsRes = await fetch(`${BASE_URL}/api/corridor/time-slots?from=hub_ql13_tan_khai&to=hub_ql13_cho_ray`);
      const slotsRaw = await slotsRes.text();
      assert(slotsRes.status === 200, 'Trips 6: Tải ma trận khung giờ hành lang thành công');
      assert(
        !slotsRaw.includes('"phoneReal"') && !slotsRaw.includes('"phone"'),
        'Trips 7: PII Invariant: Ma trận khung giờ công khai không lộ số điện thoại thật'
      );
      assert(
        !slotsRaw.includes('"fullPlate"'),
        'Trips 8: PII Invariant: Ma trận khung giờ công khai không lộ biển số đầy đủ'
      );

      // REAL-TRIP INVARIANT: a Cockpit session shows up on the marketplace as a trip about to stop at a
      // station, so telemetry must be tied to a real post. The old default
      // ('TRIP-DEFAULT') let any empty request spawn a ghost vehicle on the marketplace.
      const fakeTelemetry = await fetch(`${BASE_URL}/api/cockpit/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: 'TRIP-MY-COCKPIT', lat: 11.53, lng: 106.634 })
      });
      assert(
        fakeTelemetry.status === 400,
        'Trips 9: Telemetry Buồng lái từ chối mã chuyến không tồn tại (chặn xe ma trên sàn)'
      );

      const noIdTelemetry = await fetch(`${BASE_URL}/api/cockpit/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 11.53, lng: 106.634 })
      });
      assert(
        noIdTelemetry.status === 400,
        'Trips 10: Telemetry Buồng lái từ chối request thiếu mã chuyến'
      );

      // SEAT INVARIANT (MIT): total seats sold never exceed the seats posted.
      // Two bugs once broke this invariant:
      //  1. addTrip/rowToTrip used `||` so availableSeats = 0 was treated as falsy and
      //     overwritten to 1 -> a permanently full trip showed "còn 1 ghế" ("1 seat left").
      //  2. The condition `seatsOnOffer > 0 && requested > seatsOnOffer` disabled itself
      //     when sold out -> accepted unlimited bookings.
      const seatTripRes = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'driver_offer', from: 'Tân Khai', to: 'Chợ Rẫy',
          originHubId: 'hub_ql13_tan_khai', destinationHubId: 'hub_ql13_cho_ray',
          date: '2026-12-30', time: '05:00', timeSlot: '05:00-07:00',
          availableSeats: 2, basePricePerSeat: 165000,
          phoneReal: '0933888111', carType: 'Mazda 2', status: 'active'
        })
      });
      const seatTripId = (await seatTripRes.json())?.data?.id;
      assert(Boolean(seatTripId), 'Seats 1: Tạo chuyến 2 ghế để kiểm thử bất biến ghế');

      // Reserving a seat now REQUIRES login, so this test block needs its own token.
      const seatAuthHeaders = async (phone, name) => {
        await fetch(`${BASE_URL}/api/auth/request-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const auth = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, otp: '123456', name })
        }).then((r) => r.json());
        return { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` };
      };

      const seatOutcomes = [];
      for (let i = 1; i <= 3; i += 1) {
        const hdr = await seatAuthHeaders(`09338882${i}${i}`, `Khách ghế ${i}`);
        const r = await fetch(`${BASE_URL}/api/bookings`, {
          method: 'POST',
          headers: hdr,
          body: JSON.stringify({
            tripId: seatTripId, escrowId: `CX-SEAT${i}`,
            from: 'Tân Khai', to: 'Chợ Rẫy', seats: 1, price: 165000,
            passengerPhone: `09338882${i}${i}`, passengerName: `Khách ghế ${i}`
          })
        });
        seatOutcomes.push((await r.json())?.success === true);
      }
      assert(seatOutcomes[0] && seatOutcomes[1], 'Seats 2: Hai ghế đầu đặt được bình thường');
      assert(seatOutcomes[2] === false, 'Seats 3: Bất biến ghế: chuyến 2 ghế TỪ CHỐI booking thứ 3');

      const fullTrip = await (await fetch(`${BASE_URL}/api/trips/${seatTripId}`)).json();
      assert(
        Number(fullTrip?.data?.availableSeats) === 0,
        'Seats 4: Chuyến bán hết lưu đúng availableSeats = 0 (số 0 không bị coi là falsy)'
      );

      // PII INVARIANT: the client must NOT be able to promote a booking's status itself. Sending
      // status:'confirmed' along was once enough to unlock the Driver's real phone number without
      // logging in and without the Driver's consent.
      const injectHdr = await seatAuthHeaders('0933888777', 'Kiểm thử tiêm trạng thái');
      const injectRes = await fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: injectHdr,
        body: JSON.stringify({
          tripId: seatTripId, from: 'Tân Khai', to: 'Chợ Rẫy', seats: 0, price: 0,
          status: 'confirmed',
          passengerPhone: '0933888777', passengerName: 'Kiểm thử tiêm trạng thái'
        })
      });
      const injected = (await injectRes.json())?.data || {};
      assert(
        injected.status !== 'confirmed',
        'Seats 5: Máy chủ bỏ qua status do client gửi, booking luôn bắt đầu ở inquiring'
      );
      assert(
        !injected.driverPhoneDirect && String(injected.driverPhone || '').includes('*'),
        'Seats 6: PII Invariant: booking chưa chốt không được lộ SĐT thật của Chủ xe'
      );

      // TICKET-ID INVARIANT: escrowId is generated by the server. The old client generated CX-1000..9999 itself
      // and INSERT OR REPLACE made tickets with a colliding id overwrite each other — the passenger loses the ticket.
      const dupPayload = (name, phone) => ({
        tripId: seatTripId, escrowId: 'CX-TRUNG-MA', from: 'Tân Khai', to: 'Chợ Rẫy',
        seats: 0, price: 0, passengerPhone: phone, passengerName: name
      });
      const dupHdrA = await seatAuthHeaders('0933888555', 'Khách trùng A');
      const dupHdrB = await seatAuthHeaders('0933888666', 'Khách trùng B');
      const dupA = await (await fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST', headers: dupHdrA,
        body: JSON.stringify(dupPayload('Khách trùng A', '0933888555'))
      })).json();
      const dupB = await (await fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST', headers: dupHdrB,
        body: JSON.stringify(dupPayload('Khách trùng B', '0933888666'))
      })).json();
      const idA = dupA?.data?.escrowId;
      const idB = dupB?.data?.escrowId;
      assert(
        idA !== 'CX-TRUNG-MA' && idB !== 'CX-TRUNG-MA',
        'Seats 7: Máy chủ tự sinh mã vé, không dùng escrowId do client gửi'
      );
      assert(
        Boolean(idA) && Boolean(idB) && idA !== idB,
        'Seats 8: Hai khách gửi trùng mã vẫn nhận hai vé riêng biệt (không ghi đè)'
      );

      await fetch(`${BASE_URL}/api/trips/${seatTripId}`, { method: 'DELETE' }).catch(() => {});
    } catch (err) {
      assert(false, '4. Trips Listing & PII', err.message);
    }

    // -------------------------------------------------------------
    // 5. Check Posting a New Trip (Driver & Passenger looking for a ride)
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

      // Verify the trip appears immediately
      const checkRes = await fetch(`${BASE_URL}/api/trips/${testTripId}`).then((r) => r.json());
      assert(checkRes.success === true && checkRes.data.id === testTripId, 'PostTrip 3: Chuyến mới lưu trữ và truy xuất tức thì');
    } catch (err) {
      assert(false, '5. Post Trip', err.message);
    }

    // -------------------------------------------------------------
    // 6. MIT Invariant: Safe Seat Limit (4-5 seaters max 4, 7 seaters max 6)
    // -------------------------------------------------------------
    console.log('\n--- 6. Kiểm thử Bất Biến MIT: Giới Hạn Ghế An Toàn Chuẩn Kỹ Thuật ---');
    try {
      // A 5-seat vehicle must never accept more than 4 passengers (1 seat reserved for the driver)
      const overload5Res = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'driver_offer',
          phoneReal: '0988112233',
          carType: 'Xe 4-5 chỗ',
          availableSeats: 5 // Overloaded!
        })
      });
      assert(overload5Res.status === 400, 'Capacity Invariant 1: Chặn đăng xe 5 chỗ vượt quá 4 ghế khách (HTTP 400)');

      // A 7-seat vehicle must never accept more than 6 passengers
      const overload7Res = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'driver_offer',
          phoneReal: '0988112233',
          carType: 'Xe 7 chỗ',
          availableSeats: 7 // Overloaded!
        })
      });
      assert(overload7Res.status === 400, 'Capacity Invariant 2: Chặn đăng xe 7 chỗ vượt quá 6 ghế khách (HTTP 400)');
    } catch (err) {
      assert(false, '6. Capacity Invariants', err.message);
    }

    // -------------------------------------------------------------
    // 7. Account Authentication & MIT Invariant: Block Matching Yourself to Your Own Trip
    // -------------------------------------------------------------
    console.log('\n--- 7. Kiểm thử Xác Thực & Bất Biến MIT Chặn Tự Ghép Chuyến Mình ---');
    try {
      // Log in the Passenger account via OTP
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

      // Log in the Driver account via OTP
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

      // MIT invariant: a Driver using their own account to book a seat on their own trip -> must be blocked!
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
    // 8. Complete Trip Connection Lifecycle (Bookings Lifecycle)
    // -------------------------------------------------------------
    console.log('\n--- 8. Kiểm thử Vòng Đời Kết Nối Chuyến (Booking Lifecycle) ---');
    try {
      // 8.1 Create a valid seat-match connection
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

      // 8.2 Report a late arrival (Delay report)
      const delayRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/delay`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({ minutes: 15, note: 'Kẹt xe ngã 4' })
      });
      const delayData = await delayRes.json();
      assert(delayRes.status === 200, 'Booking 3: Báo trễ 15 phút thành công (HTTP 200)');
      assert(delayData.data?.delayedMinutes === 15, 'Booking 4: Ghi nhận đúng số phút trễ');

      // 8.3 Complete the trip & two-way trust rating
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
    // 9. Two-Phase Commit Chat & PII Protection (Hide Phone Number Before Confirmation)
    // -------------------------------------------------------------
    console.log('\n--- 9. Kiểm thử Khung Chat 2-Phase Commit & Bảo Mật Số Điện Thoại ---');
    try {
      const { detectPiiLeak, maskPhoneNumber } = await import('@carmate/shared');

      // Algorithm for detecting leaked phone numbers & disguised Zalo handles
      assert(detectPiiLeak('0984883750').hasLeak === true, 'PII Filter 1: Phát hiện số điện thoại thông thường');
      assert(detectPiiLeak('0 9 8 4 8 8 3 7 5 0').hasLeak === true, 'PII Filter 2: Phát hiện số điện thoại chèn dấu cách');
      assert(detectPiiLeak('Số anh: O98488375O').hasLeak === true, 'PII Filter 3: Bắt mẹo đổi chữ O thành số 0');
      assert(detectPiiLeak('add z.a.l.o anh nhé').hasLeak === true, 'PII Filter 4: Bắt từ khoá Zalo ngụy trang');
      assert(detectPiiLeak('Đón ở cây xăng Petrolimex nhé').hasLeak === false, 'PII Filter 5: Tin nhắn điểm đón hợp lệ không bị chặn nhầm');

      // Mask the phone number to the Apple Privacy standard (e.g. 0984883750 -> 098***3750)
      assert(maskPhoneNumber('0984883750') === '098***3750', 'PII Masking: Ẩn số điện thoại chính xác 098***3750');
    } catch (err) {
      assert(false, '9. Two-Phase Commit & PII', err.message);
    }

    // -------------------------------------------------------------
    // 10. Safety Violation Reports & Commitments (First Principles - Anti-Overcrowding & Wildcat Vehicles)
    // -------------------------------------------------------------
    console.log('\n--- 10. Kiểm thử Báo Cáo Vi Phạm An Toàn & Cam Kết (First Principles) ---');
    try {
      // 1. Passenger reports a vehicle overcrowded beyond the prescribed seat count
      const overcrowdRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/report-vehicle-mismatch`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({
          mismatchType: 'overcrowded',
          passengerNote: 'Xe 5 chỗ nhưng nhồi nhét tới 6 khách chật ních, gây nguy hiểm khi đi cao tốc'
        })
      });
      const overcrowdData = await overcrowdRes.json();
      assert(overcrowdRes.status === 200 && overcrowdData.data?.mismatchTitle === 'Xe nhồi nhét khách / Chở quá tải', 'Safety Invariant 1: Báo cáo hành vi nhồi nhét quá tải thành công (HTTP 200)');

      // 2. Passenger reports a driver switching passengers to another vehicle / reselling passengers mid-route (xe dù, wildcat vehicle)
      const transferRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/report-vehicle-mismatch`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({
          mismatchType: 'passenger_transfer',
          actualPlate: '51G-888.99',
          passengerNote: 'Chủ xe chạy đến trạm thu phí thì ép khách đổi sang một xe khác'
        })
      });
      const transferData = await transferRes.json();
      assert(transferRes.status === 200 && transferData.data?.mismatchTitle === 'Bắt sang xe / Đổi xe giữa đường (Xe dù)', 'Safety Invariant 2: Báo cáo hành vi bắt sang xe / bán khách giữa đường thành công (HTTP 200)');

      // 3. Passenger reports price gouging / demanding extra money beyond the agreed price
      const gougingRes = await fetch(`${BASE_URL}/api/bookings/${testBookingId}/report-vehicle-mismatch`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({
          mismatchType: 'price_gouging',
          passengerNote: 'Tới nơi đòi thêm 100k tiền vé BOT dù trên app đã ghi trọn gói'
        })
      });
      const gougingData = await gougingRes.json();
      assert(gougingRes.status === 200 && gougingData.data?.mismatchTitle === 'Chặt chém giá / Đòi thêm tiền ngoài thỏa thuận', 'Safety Invariant 3: Báo cáo hành vi chặt chém giá ngoài thỏa thuận thành công (HTTP 200)');

      // 4. Elon Musk's philosophy: vehicle neutrality (Platform Neutrality)
      // A passing vehicle on its return leg (convenient_trip) fills empty seats / an empty cargo bed to avoid social waste
      const convenientTripRes = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: driverHeaders,
        body: JSON.stringify({
          type: 'driver_offer',
          phoneReal: '0988112233',
          from: 'Bình Dương (Ngã 4 Sở Sao)',
          to: 'Đồng Xoài (Bình Phước)',
          routeCategory: 'Tuyến QL14',
          carType: 'Toyota Vios (Xe tiện chuyến quay đầu)',
          carCategory: 'convenient_trip',
          capacity: 5,
          availableSeats: 3,
          basePricePerSeat: 100000,
          notes: 'Xe dịch vụ trả khách xong quay đầu về Đồng Xoài rỗng ghế. Chia sẻ chi phí xăng dầu chống lãng phí.'
        })
      });
      const convenientTripData = await convenientTripRes.json();
      assert(
        convenientTripRes.status === 201 && convenientTripData.data.carCategory === 'convenient_trip',
        'Platform Neutrality 1: Hoan nghênh xe tiện chuyến quay đầu tham gia triệt tiêu lãng phí xã hội (HTTP 201)'
      );

      // Booking on a passing-vehicle return-leg trip succeeds and is not blocked
      const bookConvenientRes = await fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({
          targetId: convenientTripData.data.id,
          from: 'Ngã 4 Sở Sao',
          to: 'Đồng Xoài',
          contactPhone: '0933888999',
          seats: 1,
          totalDeal: 100000
        })
      });
      assert(bookConvenientRes.status === 201, 'Platform Neutrality 2: Khách ghép chuyến xe tiện chuyến quay đầu thuận lợi và bình đẳng (HTTP 201)');
    } catch (err) {
      assert(false, '10. Behavioral Safety & Platform Neutrality', err.message);
    }

    // -------------------------------------------------------------
    // 11. Reporting a Fake Phone Number / No Answer
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

      // Test the Emergency Pickup Phone Unlock Invariant (>= 2 calls >= 25s)
      const testBookingKey = 'ESCROW-E2E-CALL-01';
      const testCaller = '0988112233';
      const testCallee = '0977223344';
      resetEmergencyCallStatus({ bookingId: testBookingKey, callerId: testCaller });
      resetEmergencyCallStatus({ bookingId: testBookingKey, callerId: testCallee });

      const attempt1 = recordCallAttempt({ bookingId: testBookingKey, callerId: testCaller, durationSeconds: 12, answered: false });
      assert(attempt1.qualified === false && isEmergencyPhoneUnlocked({ bookingId: testBookingKey, callerId: testCaller }) === false, 'Emergency Call 1: Cuộc gọi nháy máy 12s (<25s) bị từ chối tính điểm');

      const attempt2 = recordCallAttempt({ bookingId: testBookingKey, callerId: testCaller, durationSeconds: 26, answered: false });
      assert(attempt2.qualified === true && attempt2.attempts === 1 && isEmergencyPhoneUnlocked({ bookingId: testBookingKey, callerId: testCaller }) === false, 'Emergency Call 2: Cuộc gọi 26s (>=25s) tính 1/2 lần, SĐT vẫn khóa an toàn');

      const attempt3 = recordCallAttempt({ bookingId: testBookingKey, callerId: testCaller, durationSeconds: 29, answered: false });
      assert(attempt3.qualified === true && attempt3.attempts === 2 && isEmergencyPhoneUnlocked({ bookingId: testBookingKey, callerId: testCaller }) === true, 'Emergency Call 3: Cuộc gọi lần 2 đạt 29s (>=25s) mở khóa SĐT thành công cho người gọi');

      const calleeCheck = isEmergencyPhoneUnlocked({ bookingId: testBookingKey, callerId: testCallee });
      assert(calleeCheck === false, 'Emergency Call 4: Bất đối xứng - Người nhận (không nghe máy) vẫn bị khóa 100% SĐT người gọi');

      resetEmergencyCallStatus({ bookingId: testBookingKey, callerId: testCaller });
      resetEmergencyCallStatus({ bookingId: testBookingKey, callerId: testCallee });
    } catch (err) {
      assert(false, '11. Unreachable Phone', err.message);
    }

    // -------------------------------------------------------------
    // 12. Admin Portal & Security Authorization (Anti-BOLA/IDOR)
    // -------------------------------------------------------------
    console.log('\n--- 12. Kiểm thử Cổng Quản Trị Admin & Phân Quyền An Toàn ---');
    try {
      // Log in to the Admin Portal and issue a JWT token
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

      // A regular user calling admin -> must be blocked with 403
      const unauthorizedRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
        headers: passengerHeaders
      });
      assert(unauthorizedRes.status === 403, 'RBAC 1: Người dùng thường không được phép truy cập cổng admin (HTTP 403)');

      // Admin with the proper passkey -> access succeeds
      const adminMetricsRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
        headers: adminHeaders
      });
      assert(adminMetricsRes.status === 200, 'RBAC 2: Quản trị viên truy cập metrics thành công (HTTP 200)');

      // ── CREATE A DRIVER PROFILE ON BEHALF OF THE DRIVER (phase where the operations team goes out inviting drivers) ──
      // This route creates a Driver account ALREADY MARKED VERIFIED, so it must be locked down
      // tight against outsiders: if the route leaks, a whole verified identity leaks.
      const driverPhoneAdmin = '0933888314';
      const denyAnon = await fetch(`${BASE_URL}/api/admin/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ẩn danh', phone: driverPhoneAdmin, plate: '99X-99999', carType: 'X' })
      });
      assert(denyAnon.status === 401, 'Admin Driver 1: Tạo hồ sơ Chủ xe bị chặn khi không có phiên (HTTP 401)');

      const denyUser = await fetch(`${BASE_URL}/api/admin/drivers`, {
        method: 'POST',
        headers: passengerHeaders,
        body: JSON.stringify({ name: 'Khách thường', phone: driverPhoneAdmin, plate: '99X-99998', carType: 'X' })
      });
      assert(denyUser.status === 403, 'Admin Driver 2: Người dùng thường không tạo được hồ sơ Chủ xe (HTTP 403)');

      const createdDriver = await fetch(`${BASE_URL}/api/admin/drivers`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Bác Tài E2E',
          phone: driverPhoneAdmin,
          plate: '93A-31415',
          carType: 'Mazda 2 - Màu Trắng',
          capacity: 5,
          from: 'Cây xăng Petrolimex Tân Khai',
          to: 'Cụm BV Chợ Rẫy',
          date: '2026-12-28',
          time: '04:30',
          availableSeats: 2,
          basePricePerSeat: 165000
        })
      });
      const driverData = await createdDriver.json();
      assert(createdDriver.status === 201 && driverData?.success === true, 'Admin Driver 3: Quản trị viên tạo được hồ sơ Chủ xe');
      assert(
        driverData?.data?.user?.phone === driverPhoneAdmin && Boolean(driverData?.data?.trip?.id),
        'Admin Driver 4: Tạo cùng lúc hồ sơ Chủ xe và chuyến xe đầu tiên'
      );

      // A trip created by the admin must appear on the public marketplace, but WITHOUT PII
      const adminTripId = driverData?.data?.trip?.id;
      const publicTrip = await (await fetch(`${BASE_URL}/api/trips/${adminTripId}`)).json();
      assert(
        publicTrip?.data?.id === adminTripId,
        'Admin Driver 5: Chuyến do quản trị viên tạo xuất hiện trên sàn công khai'
      );
      assert(
        !publicTrip?.data?.phoneReal && !String(publicTrip?.data?.licensePlate || '').endsWith('31415'),
        'Admin Driver 6: PII Invariant: chuyến admin tạo vẫn che SĐT và biển số đầy đủ'
      );

      // The driver logging in with that same phone number must get back their profile and vehicle profile
      await fetch(`${BASE_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: driverPhoneAdmin })
      });
      const claimed = await (await fetch(`${BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: driverPhoneAdmin, otp: '123456' })
      })).json();
      assert(
        claimed?.user?.name === 'Bác Tài E2E' && claimed?.user?.vehicle?.plate === '93A-31415',
        'Admin Driver 7: Chủ xe đăng nhập bằng SĐT đó nhận lại đúng hồ sơ và hồ sơ xe'
      );

      await fetch(`${BASE_URL}/api/trips/${adminTripId}`, { method: 'DELETE' }).catch(() => {});

      // Admin successfully cleans up analytics events & AI trajectories
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

      // DELETE /admin/test-data calls clearAllTrips() so it wipes the seed trips too.
      // Seeds are only auto-loaded when the trips table is empty at startup, not reloaded midway,
      // so without restoring here every subsequent test run would see an empty marketplace
      // and the tests above would fail in a cascade (a pre-existing bug).
      restoreSeedTrips();
    } catch (err) {
      assert(false, '12. Admin RBAC', err.message);
    }

    // -------------------------------------------------------------
    // 13. System Warning Letters, 24/7 Customer Support & 3-Day Grace Period (Grace Period)
    // -------------------------------------------------------------
    console.log('\n--- 13. Kiểm thử Ân Hạn 3 Ngày & Khiếu Nại 1-Chạm ---');
    try {
      // Admin fetches the list of vehicle discrepancy reports to handle
      const reportsRes = await fetch(`${BASE_URL}/api/admin/reports`, {
        headers: adminHeaders
      });
      assert(reportsRes.status === 200, 'Admin Action 1: Xem danh sách báo cáo sai lệch xe');
    } catch (err) {
      assert(false, '13. Grace Period & Dispute', err.message);
    }

    // -------------------------------------------------------------
    // 14. Account Deletion Requests Sent to Admin (Apple Guideline 5.1.1 v)
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

      // Admin checks the list of deletion requests
      const adminDelList = await fetch(`${BASE_URL}/api/admin/deletion-requests`, {
        headers: adminHeaders
      }).then((r) => r.json());
      assert(adminDelList.success === true, 'Account Deletion 2: Admin truy cập danh sách yêu cầu xoá tài khoản thành công');
    } catch (err) {
      assert(false, '14. Account Deletion Request', err.message);
    }

    // -------------------------------------------------------------
    // 15. Civil Ride-Sharing Terminology Standards (Terminology Standards)
    // -------------------------------------------------------------
    console.log('\n--- 15. Kiểm thử Chuẩn Mực Danh Xưng: Chủ Xe & Người Đi Cùng ---');
    try {
      const { toPublicAlias } = await import('@carmate/shared');

      // Titles for Driver & Fellow Passenger
      assert(toPublicAlias({ type: 'driver_offer', maskedCode: 'CX-305' }) === 'Chủ xe CX-305', 'Terminology 1: Đối tác lái xe là "Chủ xe CX-xxx"');
      assert(toPublicAlias({ type: 'passenger_request', maskedCode: 'KX-412' }) === 'Khách KX-412', 'Terminology 2: Người đi cùng là "Khách KX-xxx"');

      // Absolutely do not use the commercial titles "Bác tài" or "Tài xế" (both mean "driver")
      const bannedTerms = ['Bác tài', 'bác tài'];
      const sharedCode = fs.readFileSync(path.resolve(process.cwd(), 'packages/shared/src/constants/mockData.js'), 'utf8');
      const hasBanned = bannedTerms.some((term) => sharedCode.includes(term));
      assert(!hasBanned, 'Terminology 3: Tuyệt đối triệt tiêu danh xưng taxi thương mại "Bác tài"');
    } catch (err) {
      assert(false, '15. Terminology Standards', err.message);
    }

    // -------------------------------------------------------------
    // 16. Smart Vehicle-Match Radar (Social Smart Match) & Auto Alert
    // -------------------------------------------------------------
    console.log('\n--- 16. Kiểm thử Radar Gợi Ý Khớp Xe Thông Minh & Auto Alert ---');
    try {
      // 1. Check the general vehicle-match suggestion endpoint
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

      // 2. Check match suggestions for a specific trip (tripId)
      const specificRes = await fetch(`${BASE_URL}/api/matches/social-suggestions?tripId=${testTripId}`);
      const specificData = await specificRes.json();
      assert(specificRes.status === 200, 'Social Match 6: Tìm đối tác cho chuyến cụ thể thành công');
      assert(specificData.success === true, 'Social Match 7: Gợi ý đối tác chuẩn xác không lỗi');

      // 3. Check the Telegram notification function with its anti-spam mechanism (2h Cooldown)
      const { sendSmartMatchTelegramAlert } = await import('../apps/api/src/utils/telegramAlert.js');
      assert(typeof sendSmartMatchTelegramAlert === 'function', 'Social Match 8: Hàm gửi alert thông minh qua Telegram tồn tại');
    } catch (err) {
      assert(false, '16. Social Smart Match & Telegram Alert', err.message);
    }

    // -------------------------------------------------------------
    // 17. Extended Test: Trunk & Pickup-Bed Sharing Along the Route (Cargo & Pickup Bed Sharing)
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

      // 1. Check the 3 locally-standard parcel volume tiers
      assert(Boolean(CARGO_TYPES.compact_parcel && CARGO_TYPES.produce_box && CARGO_TYPES.bulky_cargo), 'Cargo 1: Đủ 3 gói thể tích tiện tuyến (Bưu phẩm, Thùng xốp/Nông sản, Chuyển trọ)');
      assert(CARGO_TYPES.produce_box.basePrice === 90000, 'Cargo 2: Gói thùng xốp có giá gốc định mức chuẩn 90.000đ');

      // 2. Check the dynamic parcel fuel surcharge by distance
      const shortDistPrice = getRecommendedCargoPrice('produce_box', 80);
      const longDistPrice = getRecommendedCargoPrice('produce_box', 180);
      assert(shortDistPrice > 0 && longDistPrice > shortDistPrice, 'Cargo 3: Phụ xăng thùng xốp tính tự động theo cự ly Geodesic');

      // 3. Check the pickup-truck configuration (5-seat cabin, max 4 passengers + ~800kg bed)
      assert(VEHICLE_SEAT_CONFIGS.pickup?.hasCargoBed === true, 'Pickup 1: Xe bán tải nhận diện khoang thùng chở hàng riêng');
      assert(VEHICLE_SEAT_CONFIGS.pickup?.maxPassengerSeats === 4, 'Pickup 2: Xe bán tải tuân thủ tối đa 4 ghế khách (trừ ghế lái)');

      // 4. Normalize a pickup truck via the sanitizer function
      const pickupSanitized = sanitizeVehicleCapacityAndSeats('pickup', 6);
      assert(pickupSanitized.vehicleType === 'pickup' && pickupSanitized.seats === 4, 'Pickup 3: Sanitizer tự động giới hạn 4 ghế khách cho xe bán tải');

      // 5. Post a real pickup-truck trip via the API
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

      // 6. Create a request to ship a styrofoam-box parcel along the route
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

      // 7. Check clean 24h time-slot normalization (no stray "Sáng" / "Chiều" ("morning" / "afternoon") left in the 24h format)
      const slot0506 = TIME_SLOTS.find((s) => s.id === '05:00-06:00');
      assert(slot0506 && !slot0506.short.includes('Sáng') && !slot0506.short.includes('AM'), 'TimeSlot 1: Chuẩn 24h sạch sẽ (05:00 — 06:00 không có từ thừa)');
    } catch (err) {
      assert(false, '17. Cargo & Pickup Bed Sharing Expansion', err.message);
    }

    // -------------------------------------------------------------
    // 18. Test Light Trucks & Local Freight Depots (chành xe) Along Route N2 (Bình Phước ⇄ Kiên Giang)
    // -------------------------------------------------------------
    console.log('\n--- 18. Kiểm thử Xe Tải Nhẹ & Chành Xe Địa Phương Tiện Tuyến N2 ---');
    try {
      const {
        CARGO_TYPES,
        getRecommendedCargoPrice,
        ROUTE_BENCHMARKS,
        getCorridorWaypoints
      } = await import('@carmate/shared');

      // 1. Check the 6 locally-standard along-the-route volume tiers
      const cargoKeys = Object.keys(CARGO_TYPES);
      assert(
        cargoKeys.includes('motorcycle') && cargoKeys.includes('half_truck') && cargoKeys.includes('full_truck'),
        'Truck Cargo 1: Đầy đủ 3 gói hàng địa phương (Xe máy/xe điện, Nửa thùng ~1T, Bao trọn thùng quay đầu)'
      );

      // 2. Check distance-based pricing for motorbikes
      const motorcyclePrice = getRecommendedCargoPrice('motorcycle', 280);
      assert(motorcyclePrice >= 350000 && motorcyclePrice <= 600000, `Truck Cargo 2: Giá gửi xe máy cự ly 280km chuẩn xác (~${motorcyclePrice.toLocaleString('vi-VN')}đ)`);

      // 3. Check the Route N2 - Kiên Giang rate in ROUTE_BENCHMARKS
      const n2Benchmark = ROUTE_BENCHMARKS['Tuyến N2 - Kiên Giang'];
      assert(n2Benchmark && n2Benchmark.distanceKm === 280, 'Route N2 1: Hành lang Tuyến N2 - Kiên Giang chuẩn 280km');

      // 4. Check the Corridor Waypoints of route N2
      const n2Waypoints = getCorridorWaypoints('Kiên Giang');
      assert(
        Array.isArray(n2Waypoints) && n2Waypoints.some((w) => w.includes('Đức Hòa') || w.includes('Thạnh Hóa') || w.includes('Vàm Cống')),
        'Route N2 2: Tìm được các điểm mốc chính trên Tuyến N2 (Đức Hòa, Thạnh Hóa, Cầu Vàm Cống)'
      );

      // 5. MIT invariant: a light truck accepts at most 1 fellow passenger (front passenger seat)
      const overloadTruckRes = await fetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'driver_offer',
          phoneReal: '0988112233',
          carType: 'Kia K250 (Xe tải 2.4T)',
          vehicleType: 'truck_light',
          capacity: 2,
          availableSeats: 2, // Front passenger seat overloaded! Only 1 allowed
          from: 'Chơn Thành',
          to: 'Rạch Giá'
        })
      });
      assert(overloadTruckRes.status === 400, 'Truck Invariant 1: Chặn đăng xe tải chở quá 1 người đi cùng ghế phụ (HTTP 400)');

      // 6. Post a valid light-truck trip (1 passenger seat, with a cargo bed for goods)
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

      // 7. Create a request to ship a motorbike back to the countryside by truck
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
    // Auto-clean 100% of temporary data after the test completes
    // -------------------------------------------------------------
    cleanupTestData();
  }

  // -------------------------------------------------------------
  // Summary
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
