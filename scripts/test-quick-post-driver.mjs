import assert from 'node:assert/strict';
import { createTrip, getTrip, deleteTripHandler } from '../apps/api/src/controllers/tripController.js';
import { createIntent, deleteTrip, initDB, addBooking } from '../apps/api/src/db/sqliteStore.js';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function run() {
  console.log('\n🧪 KIỂM THỬ LUỒNG CHỦ XE ĐĂNG CHUYẾN 15-20S & QUẢN LÝ CHUYẾN (ACTIVE TRIP)');
  await initDB();

  // 1. Validate that the departure time must be >= now + 30 minutes (for trips today)
  console.log('\n── 1. VALIDATION THỜI GIAN KHỞI HÀNH ──');
  const now = new Date();
  const pastHour = String(Math.max(0, now.getHours() - 1)).padStart(2, '0');
  const pastTime = `${pastHour}:00`;

  const reqPast = {
    body: {
      type: 'driver_offer',
      from: 'Cây xăng Petrolimex Tân Khai',
      to: 'Cụm BV Chợ Rẫy',
      date: 'Hôm nay',
      time: pastTime,
      availableSeats: 2,
      basePricePerSeat: 165000,
      phoneReal: '0984568421',
      carType: 'Mitsubishi Xpander'
    },
    user: { id: 'USR-TEST-01', phone: '0984568421', name: 'Chủ xe A' }
  };
  const resPast = mockRes();
  await createTrip(reqPast, resPast);

  if (resPast.statusCode !== 400) {
    console.error('Lỗi nhận được:', resPast.body);
  }
  assert.equal(resPast.statusCode, 400, 'Chuyến giờ trong quá khứ hoặc < 30p phải bị chặn với mã 400');
  assert.ok(resPast.body?.error?.includes('phải cách thời điểm hiện tại ít nhất 30 phút'), 'Báo lỗi đúng chuẩn');
  console.log('✅ Chặn giờ khởi hành trong quá khứ hoặc < 30 phút: ĐẠT');

  // 2. Create a valid trip at 07:00 tomorrow
  console.log('\n── 2. TẠO CHUYẾN HỢP LỆ (NGÀY MAI) & WAITLIST MATCHER ──');
  // Pre-seed 1 waiting passenger intent at Tân Khai Station tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().split('T')[0];

  await createIntent({
    userId: 'USR-PASSENGER-01',
    role: 'passenger',
    originHubId: 'hub_ql13_tan_khai',
    originName: 'Cây xăng Tân Khai',
    destinationHubId: 'hub_ql13_cho_ray',
    destinationName: 'BV Chợ Rẫy',
    corridor: 'Tuyến QL13',
    date: tomorrowIso,
    timeSlot: '07:00',
    seats: 1,
    phone: '0912345678',
    contactName: 'Khách Nguyễn Văn B'
  });

  const reqValid = {
    body: {
      type: 'driver_offer',
      from: 'Cây xăng Petrolimex Tân Khai',
      to: 'Cụm BV Chợ Rẫy',
      date: tomorrowIso,
      time: '07:00',
      timeSlot: '07:00-09:00',
      availableSeats: 2,
      basePricePerSeat: 165000,
      phoneReal: '0984568421',
      carType: 'Mitsubishi Xpander',
      licensePlate: '93A-568.42'
    },
    user: { id: 'USR-TEST-01', phone: '0984568421', name: 'Chủ xe A' }
  };
  const resValid = mockRes();
  await createTrip(reqValid, resValid);

  assert.equal(resValid.statusCode, 201, 'Đăng chuyến hợp lệ trả về mã 201');
  assert.ok(resValid.body?.data?.id, 'Tạo thành công ID chuyến xe');
  const createdTripId = resValid.body.data.id;
  console.log(`✅ Đăng chuyến thành công với ID #${createdTripId}: ĐẠT`);

  // 3. Check that a double-booking for the same driver on the same day is blocked
  console.log('\n── 3. CHỐNG TRÙNG LỊCH CÙNG CHỦ XE ──');
  const reqDuplicate = {
    body: {
      type: 'driver_offer',
      from: 'Cây xăng Petrolimex Tân Khai',
      to: 'Cụm BV Chợ Rẫy',
      date: tomorrowIso,
      time: '07:15', // 15 minutes off from the 07:00 trip just created
      timeSlot: '07:00-09:00',
      availableSeats: 2,
      basePricePerSeat: 165000,
      phoneReal: '0984568421',
      carType: 'Mitsubishi Xpander'
    },
    user: { id: 'USR-TEST-01', phone: '0984568421', name: 'Chủ xe A' }
  };
  const resDuplicate = mockRes();
  await createTrip(reqDuplicate, resDuplicate);

  assert.equal(resDuplicate.statusCode, 400, 'Đăng chuyến trùng lịch phải bị chặn với mã 400');
  assert.ok(resDuplicate.body?.error?.includes('đã có chuyến xe'), 'Báo lỗi trùng lịch chính xác');
  console.log('✅ Chặn trùng lịch cùng chủ xe trong vòng 60 phút: ĐẠT');

  // 4. Check loading the Seat Manifest for the Driver
  console.log('\n── 4. NẠP SEAT MANIFEST CHO CHỦ XE (GET TRIP) ──');
  const reqOwner = {
    params: { id: createdTripId },
    user: { id: 'USR-TEST-01', phone: '0984568421' }
  };
  const resOwner = mockRes();
  getTrip(reqOwner, resOwner);

  assert.equal(resOwner.statusCode, 200);
  assert.ok(Array.isArray(resOwner.body?.data?.manifest), 'Chủ xe xem được mảng manifest hành khách');
  assert.equal(resOwner.body?.data?.bookedSeatsCount, 0, 'Chuyến mới tạo có 0 khách đặt');
  console.log('✅ Chủ xe sở hữu chuyến xem được manifest hành khách: ĐẠT');

  // An unrelated passenger views the trip
  const reqStranger = {
    params: { id: createdTripId },
    user: { id: 'USR-STRANGER-99', phone: '0900000000' }
  };
  const resStranger = mockRes();
  getTrip(reqStranger, resStranger);

  assert.equal(resStranger.statusCode, 200);
  assert.equal(resStranger.body?.data?.phoneReal, undefined, 'Khách lạ không xem được SĐT thật của chủ xe (Bảo vệ PII)');
  assert.equal(resStranger.body?.data?.manifest, undefined, 'Khách lạ không xem được danh sách manifest hành khách khác');
  console.log('✅ Khách lạ xem feed bị ẩn PII và không thấy manifest: ĐẠT');

  // 5. Check cancelling a trip when passengers have booked (Project 4 & Project 6)
  console.log('\n── 5. HỦY CHUYẾN CÓ KHÁCH (TIME-DECAY PENALTY & STANDBY BUFFER) ──');
  const _bookingData = await addBooking({
    tripId: createdTripId,
    passengerName: 'Nguyễn Văn Khách',
    passengerPhone: '0912345678',
    from: 'Cây xăng Tân Khai',
    to: 'BV Chợ Rẫy',
    seats: 1,
    date: tomorrowIso,
    status: 'confirmed'
  });

  const reqCancel = {
    params: { id: createdTripId },
    body: { reason: 'Xe bị hỏng đột xuất' },
    user: { id: 'USR-TEST-01', phone: '0984568421' }
  };
  const resCancel = mockRes();
  await deleteTripHandler(reqCancel, resCancel);

  assert.equal(resCancel.statusCode, 200, 'Hủy chuyến thành công');
  assert.equal(resCancel.body?.data?.activeBookingsSalvaged, 1, 'Đã kích hoạt bảo vệ cho 1 hành khách');
  console.log('✅ Hủy chuyến khi có khách: Tự động kích hoạt Time-Decay Penalty & Standby Rescue Buffer: ĐẠT');

  // Clean up the test trip
  await deleteTrip(createdTripId);
  console.log('\n🎉 TẤT CẢ CÁC KIỂM THỬ LUỒNG CHỦ XE ĐĂNG CHUYẾN ĐỀU ĐẠT 100%!\n');
}

run().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
