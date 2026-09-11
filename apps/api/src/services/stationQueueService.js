import {
  VIRTUAL_HUBS,
  getVirtualHubById,
  getFixedSegmentTariff,
  DRIVER_STATION_PAYOUT_RATIO,
  projectToCorridorFrenet,
  calculateKinematicTriggerDistance,
  isIntervalSchedulingFeasible,
  getStationStationKm
} from '@carmate/shared';
import { isDriverDailyTripCapped, DRIVER_DAILY_CAP_NOTICE } from '../db/sqliteStore.js';

// BỘ NHỚ LƯU TRỮ TRẠNG THÁI TRẠM ẢO & COCKPIT TẠI RAM (IN-MEMORY DISTRIBUTED ENGINE)
const stationQueues = new Map(); // stationId -> Array<RiderIntent>
const cockpitSessions = new Map(); // tripId -> CockpitSession

/**
 * Tính cự ly Geodesic Haversine giữa 2 toạ độ GPS (km)
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 999;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Sinh mã PIN 4 chữ số ngẫu nhiên cho khách đọc khi lên xe
 */
function generate4DigitPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * 1. HÀNH KHÁCH CHECK-IN TẠI TRẠM ẢO (R1 CHECK-IN)
 */
export function riderCheckIn({
  hubId,
  destinationHubId = 'hub_ql13_hang_xanh',
  seatsNeeded = 1,
  phone = '',
  name = 'Người đi cùng',
  clientLat = null,
  clientLng = null
}) {
  const originHub = getVirtualHubById(hubId) || {
    id: hubId,
    name: 'Cây xăng Petrolimex Tân Khai',
    shortName: 'Petrolimex Tân Khai',
    corridor: 'Tuyến QL13'
  };

  const destHub = getVirtualHubById(destinationHubId) || {
    id: destinationHubId,
    name: 'Ngã tư Hàng Xanh (Bình Thạnh - TP.HCM)',
    shortName: 'Ngã 4 Hàng Xanh',
    corridor: 'Tuyến QL13'
  };

  // Khóa kép tọa độ GPS (Anti-Quishing Layer 2 Geofence)
  let geofence = null;
  if (clientLat != null && clientLng != null && originHub.lat != null && originHub.lng != null) {
    const distKm = calculateDistanceKm(clientLat, clientLng, originHub.lat, originHub.lng);
    const distM = Math.round(distKm * 1000);
    geofence = {
      verified: distM <= 400, // Dung sai an toàn 400m cho khuôn viên cây xăng lớn / TTHC
      distanceM: distM,
      clientLat,
      clientLng
    };
  }

  const cleanSeats = Math.max(1, Math.min(4, Number(seatsNeeded) || 1));
  const tariff = getFixedSegmentTariff(originHub.id, destHub.id);
  const ratePerSeat = tariff.pricePerSeat;
  const totalSurcharge = ratePerSeat * cleanSeats;
  const driverPayout = Math.round(totalSurcharge * DRIVER_STATION_PAYOUT_RATIO);

  const intentId = `ST-RIDER-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
  const pin = generate4DigitPin();

  const intent = {
    intentId,
    hubId: originHub.id,
    hubName: originHub.name,
    hubShortName: originHub.shortName || originHub.name,
    destinationHubId: destHub.id,
    destinationName: destHub.name,
    destinationShortName: destHub.shortName || destHub.name,
    seatsNeeded: cleanSeats,
    phone: phone.trim() || '0987654321',
    name: name.trim() || 'Khách đi cùng',
    checkinTime: Date.now(),
    status: 'WAITING', // 'WAITING' | 'OFFERED' | 'ARRIVING' | 'BOARDED' | 'COMPLETED' | 'CANCELLED'
    pin,
    matchedTripId: null,
    lockExpiresAt: null,
    fuelSurcharge: totalSurcharge,
    driverPayout,
    ratePerSeat,
    noSurge: true,
    carInfo: null,
    geofence
  };

  if (!stationQueues.has(originHub.id)) {
    stationQueues.set(originHub.id, []);
  }
  stationQueues.get(originHub.id).push(intent);

  return {
    success: true,
    intent
  };
}

/**
 * 2. LẤY DANH SÁCH & TRẠNG THÁI HÀNG ĐỢI TẠI TRẠM
 */
export function getStationQueue(hubId) {
  const queue = stationQueues.get(hubId) || [];
  // Dọn dẹp các khóa mềm đã hết hạn
  const now = Date.now();
  for (const item of queue) {
    if (item.status === 'OFFERED' && item.lockExpiresAt && item.lockExpiresAt < now) {
      item.status = 'WAITING';
      item.lockExpiresAt = null;
      item.matchedTripId = null;
    }
  }

  const waitingRiders = queue.filter((i) => i.status === 'WAITING' || i.status === 'OFFERED');
  const estimatedWaitMinutes = Math.max(3, waitingRiders.length * 4);

  return {
    success: true,
    hubId,
    waitingCount: waitingRiders.length,
    estimatedWaitMinutes,
    queue: waitingRiders.map((r, idx) => ({
      intentId: r.intentId,
      position: idx + 1,
      destinationShortName: r.destinationShortName,
      seatsNeeded: r.seatsNeeded,
      status: r.status
    }))
  };
}

/**
 * 3. HÀNH KHÁCH TRA CỨU THẺ LÊN XE THỜI GIAN THỰC (R2 BOARDING PASS LIVE)
 */
export function getRiderPass(intentId) {
  for (const [, queue] of stationQueues.entries()) {
    const intent = queue.find((i) => i.intentId === intentId);
    if (intent) {
      // Dọn khóa nếu quá hạn
      if (intent.status === 'OFFERED' && intent.lockExpiresAt && intent.lockExpiresAt < Date.now()) {
        intent.status = 'WAITING';
        intent.lockExpiresAt = null;
        intent.matchedTripId = null;
      }

      const activeQueue = queue.filter((i) => i.status === 'WAITING' || i.status === 'OFFERED');
      const position = activeQueue.findIndex((i) => i.intentId === intentId) + 1;

      return {
        success: true,
        intent,
        position: position > 0 ? position : 1
      };
    }
  }

  return {
    success: false,
    error: 'Không tìm thấy thẻ lên xe hoặc yêu cầu đã kết thúc'
  };
}

/**
 * 4. CHỦ XE CẬP NHẬT TELEMETRY (PING 3S) & RADAR CẢNH BÁO TIẾP CẬN 3.5KM
 */
export function telemetryPing({
  tripId = 'TRIP-DEFAULT',
  driverPhone = '0912345678',
  driverName = 'Chủ xe CarMate',
  plate = '93A-123.45',
  vehicleModel = 'Mitsubishi Xpander (Trắng)',
  seatsAvailable = 2,
  corridor = 'Tuyến QL13',
  lat,
  lng,
  speed = 78,
  heading = 180
}) {
  let session = cockpitSessions.get(tripId);
  if (!session) {
    session = {
      tripId,
      driverPhone,
      driverName,
      plate,
      vehicleModel,
      seatsAvailable: Number(seatsAvailable) || 2,
      corridor,
      lat: lat ?? 11.5300,
      lng: lng ?? 106.6340,
      speed: Number(speed) || 78,
      heading: Number(heading) || 180,
      status: 'ACTIVE_SCANNING', // 'ACTIVE_SCANNING' | 'OFFERING' | 'DWELLING' | 'ROLLING' | 'COMPLETED'
      activeOffer: null,
      dockingExpiresAt: null,
      boardedPassengers: [],
      totalEarnings: 0,
      lastPing: Date.now()
    };
    cockpitSessions.set(tripId, session);
  } else {
    session.driverPhone = driverPhone || session.driverPhone;
    session.driverName = driverName || session.driverName;
    session.plate = plate || session.plate;
    session.vehicleModel = vehicleModel || session.vehicleModel;
    if (seatsAvailable != null) session.seatsAvailable = Number(seatsAvailable);
    if (lat != null) session.lat = lat;
    if (lng != null) session.lng = lng;
    if (speed != null) session.speed = speed;
    session.lastPing = Date.now();
  }

  if (session.isBanned) {
    return {
      success: false,
      isBanned: true,
      error: session.banReason || '⛔ TÀI KHOẢN ĐÃ BỊ KHÓA VĨNH VIỄN DO VI PHẠM AN TOÀN ĐÓN KHÁCH.'
    };
  }

  // Khóa cứng kỹ thuật: Tối đa 2 lượt/ngày (Anti-Commercial Capping - NĐ 10/2020/NĐ-CP)
  if (session.driverPhone && isDriverDailyTripCapped(session.driverPhone)) {
    return {
      success: false,
      isDailyCapped: true,
      error: DRIVER_DAILY_CAP_NOTICE
    };
  }

  // Bẫy vi phạm bỏ bom khách (Fly-By Ghosting Penalty): Xe vượt quá trạm > 300m với tốc độ cao không giảm tốc
  if (session.status === 'DWELLING' && session.dockingStationId) {
    const dockingHub = getVirtualHubById(session.dockingStationId);
    if (dockingHub) {
      const frenet = projectToCorridorFrenet(session.lat, session.lng, corridor);
      const hubS = getStationStationKm(session.dockingStationId);
      const hasOvershot = hubS != null && frenet.s != null && (frenet.s - hubS) > 0.3;
      const distDirect = calculateDistanceKm(session.lat, session.lng, dockingHub.lat, dockingHub.lng);

      if ((hasOvershot || distDirect > 0.5) && session.speed > 35) {
        const queue = stationQueues.get(session.dockingStationId) || [];
        const rider = queue.find((i) => i.intentId === session.dockingIntentId);
        if (rider && rider.status === 'ARRIVING') {
          rider.status = 'WAITING';
          rider.carInfo = null;
          rider.lockExpiresAt = null;
          rider.matchedTripId = null;
          const idx = queue.indexOf(rider);
          if (idx > 0) {
            queue.splice(idx, 1);
            queue.unshift(rider);
          }
        }
        session.status = 'BANNED';
        session.isBanned = true;
        session.banReason = 'FLY_BY_GHOSTING: Xe vượt quá trạm > 300m với tốc độ cao không giảm tốc đón khách theo cam kết';
        return {
          success: false,
          isBanned: true,
          error: '⛔ TÀI KHOẢN ĐÃ BỊ KHÓA VĨNH VIỄN: Vi phạm nghiêm trọng không đón khách đã nhận tại trạm.',
          session: {
            tripId: session.tripId,
            status: 'BANNED',
            isBanned: true
          }
        };
      }
    }
  }

  // Tự động giải phóng nếu offer đã quá hạn 30s
  const now = Date.now();
  if (session.activeOffer && session.activeOffer.expiresAt < now) {
    const expiredIntentId = session.activeOffer.intentId;
    const hubId = session.activeOffer.stationId;
    const queue = stationQueues.get(hubId) || [];
    const item = queue.find((i) => i.intentId === expiredIntentId);
    if (item && item.status === 'OFFERED') {
      item.status = 'WAITING';
      item.lockExpiresAt = null;
      item.matchedTripId = null;
    }
    session.activeOffer = null;
    if (session.status === 'OFFERING') {
      session.status = 'ACTIVE_SCANNING';
    }
  }

  // Nếu đang ở trạng thái ACTIVE_SCANNING và còn ghế trống -> Quét các trạm trên hành lang
  let proximityAlert = null;
  if (session.status === 'ACTIVE_SCANNING' && session.seatsAvailable > 0 && !session.activeOffer) {
    // 1. Stanford Frenet Frame Projection: Chiếu tọa độ ô tô vào tim đường QL13
    const frenet = projectToCorridorFrenet(session.lat, session.lng, corridor);
    session.frenet = frenet;

    // 2. Cửa sổ Radar Động học (Kinematic Trigger): Tự động tính ngưỡng theo vận tốc (v * 210s)
    const triggerDistanceKm = calculateKinematicTriggerDistance(session.speed, 210);

    const corridorHubs = VIRTUAL_HUBS.filter(
      (h) => h.corridor === corridor || (corridor.includes('QL13') && h.corridor.includes('QL13'))
    );

    for (const hub of corridorHubs) {
      const dist = calculateDistanceKm(session.lat, session.lng, hub.lat, hub.lng);
      // Kích hoạt radar khi cự ly <= triggerDistanceKm (và xe đang chạy tiến về phía trạm)
      if (dist <= triggerDistanceKm && dist >= 0.05) {
        const queue = stationQueues.get(hub.id) || [];
        const eligibleRider = queue.find((r) => {
          if (r.status !== 'WAITING' || r.seatsNeeded > session.seatsAvailable) return false;
          // 3. MIT Interval Scheduling: Kiểm tra gối đầu tuyến tính
          const hubS = getStationStationKm(hub.id);
          const destS = getStationStationKm(r.destinationHubId);
          if (hubS != null && destS != null && frenet.s != null) {
            return isIntervalSchedulingFeasible(frenet.s, destS, hubS, destS);
          }
          return true;
        });

        if (eligibleRider) {
          // Khóa mềm nguyên tử (Atomic Soft-Lock 35s)
          eligibleRider.status = 'OFFERED';
          eligibleRider.lockExpiresAt = now + 35000;
          eligibleRider.matchedTripId = session.tripId;

          const offer = {
            intentId: eligibleRider.intentId,
            stationId: hub.id,
            stationName: hub.name,
            stationShortName: hub.shortName || hub.name,
            distanceKm: dist,
            frenetS: frenet.s,
            crossTrackMeters: frenet.d,
            triggerDistanceKm,
            ttaSeconds: Math.round((dist / Math.max(30, session.speed)) * 3600),
            riderCount: eligibleRider.seatsNeeded,
            destinationName: eligibleRider.destinationShortName || eligibleRider.destinationName,
            destinationHubId: eligibleRider.destinationHubId,
            fuelSurcharge: eligibleRider.fuelSurcharge,
            driverPayout: eligibleRider.driverPayout || Math.round(eligibleRider.fuelSurcharge * DRIVER_STATION_PAYOUT_RATIO),
            noSurge: true,
            expiresAt: now + 30000 // Chủ xe có 30 giây để bấm
          };

          session.activeOffer = offer;
          session.status = 'OFFERING';
          proximityAlert = offer;
          break;
        }
      }
    }
  }

  return {
    success: true,
    session: {
      tripId: session.tripId,
      status: session.status,
      seatsAvailable: session.seatsAvailable,
      speed: session.speed,
      activeOffer: session.activeOffer,
      totalEarnings: session.totalEarnings,
      boardedCount: session.boardedPassengers.length
    },
    proximityAlert
  };
}

/**
 * 5. CHỦ XE BẤM [ĐỒNG Ý ĐÓN] (D2 ACCEPT)
 */
export function driverAcceptOffer({ tripId, intentId }) {
  const session = cockpitSessions.get(tripId);
  if (!session) {
    return { success: false, error: 'Không tìm thấy phiên làm việc của chủ xe' };
  }

  if (!session.activeOffer || session.activeOffer.intentId !== intentId) {
    return { success: false, error: 'Yêu cầu đón khách đã hết hạn hoặc không tồn tại' };
  }

  const hubId = session.activeOffer.stationId;
  const queue = stationQueues.get(hubId) || [];
  const rider = queue.find((i) => i.intentId === intentId);

  if (!rider) {
    return { success: false, error: 'Hành khách không còn trong hàng đợi' };
  }

  // Khóa cứng kỹ thuật: Tối đa 2 lượt/ngày (Anti-Commercial Capping - NĐ 10/2020/NĐ-CP)
  if (session.driverPhone && isDriverDailyTripCapped(session.driverPhone)) {
    return {
      success: false,
      isDailyCapped: true,
      error: DRIVER_DAILY_CAP_NOTICE
    };
  }

  // Chuyển trạng thái hành khách sang ARRIVING (Xe đang tấp lề)
  rider.status = 'ARRIVING';
  rider.carInfo = {
    plate: session.plate,
    vehicleModel: session.vehicleModel,
    driverName: session.driverName,
    driverPhone: session.driverPhone
  };

  // Chuyển trạng thái chủ xe sang DWELLING (Hạn dừng tại trạm 60 giây)
  session.status = 'DWELLING';
  session.dockingStationId = hubId;
  session.dockingIntentId = intentId;
  session.dockingExpiresAt = Date.now() + 60000;
  session.activeOffer = null;

  return {
    success: true,
    message: 'Đã chấp nhận đón khách. Vui lòng xi-nhan tấp vào sân cây xăng.',
    dockingTimeSeconds: 60,
    rider: {
      intentId: rider.intentId,
      name: rider.name,
      seatsNeeded: rider.seatsNeeded,
      destinationName: rider.destinationShortName || rider.destinationName,
      fuelSurcharge: rider.fuelSurcharge
      // BẢO MẬT BẮT TAY 2 CHIỀU: Tuyệt đối KHÔNG trả về rider.pin cho chủ xe!
      // Mã PIN 4 số là bằng chứng xác thực (Proof of Possession) chỉ hiển thị trên vé của khách.
      // Khách phải đọc bằng miệng cho chủ xe khi mở cửa bước lên xe.
    }
  };
}

/**
 * 6. CHỦ XE BẤM [BỎ QUA] (D2 REJECT)
 */
export function driverRejectOffer({ tripId, intentId }) {
  const session = cockpitSessions.get(tripId);
  if (session && session.activeOffer && session.activeOffer.intentId === intentId) {
    const hubId = session.activeOffer.stationId;
    const queue = stationQueues.get(hubId) || [];
    const rider = queue.find((i) => i.intentId === intentId);
    if (rider && rider.status === 'OFFERED') {
      rider.status = 'WAITING';
      rider.lockExpiresAt = null;
      rider.matchedTripId = null;
    }
    session.activeOffer = null;
    session.status = 'ACTIVE_SCANNING';
  }

  return {
    success: true,
    message: 'Đã bỏ qua yêu cầu đón khách.'
  };
}

/**
 * 7. BẮT TAY XÁC THỰC MÃ PIN 4 SỐ (D3 DOCKING HANDSHAKE)
 */
export function driverVerifyPin({ tripId, intentId, pin }) {
  const session = cockpitSessions.get(tripId);
  if (!session) {
    return { success: false, error: 'Không tìm thấy phiên làm việc của chủ xe' };
  }

  const cleanPin = String(pin || '').trim();

  // Tìm intent trong tất cả các trạm
  let matchedRider = null;
  for (const queue of stationQueues.values()) {
    const r = queue.find((i) => i.intentId === intentId || (i.status === 'ARRIVING' && i.matchedTripId === tripId));
    if (r) {
      matchedRider = r;
      break;
    }
  }

  if (!matchedRider) {
    return { success: false, error: 'Không tìm thấy thông tin khách cần đón tại trạm này' };
  }

  if (matchedRider.pin !== cleanPin) {
    return {
      success: false,
      error: `Mã PIN không đúng (bạn nhập: ${cleanPin}). Vui lòng hỏi khách mã 4 số trên màn hình điện thoại.`
    };
  }

  // Khớp thành công!
  matchedRider.status = 'BOARDED';
  const payoutAmount =
    matchedRider.driverPayout || Math.round(matchedRider.fuelSurcharge * DRIVER_STATION_PAYOUT_RATIO);

  session.boardedPassengers.push({
    intentId: matchedRider.intentId,
    name: matchedRider.name,
    seatsNeeded: matchedRider.seatsNeeded,
    fuelSurcharge: matchedRider.fuelSurcharge,
    driverPayout: payoutAmount,
    boardedAt: Date.now()
  });

  session.seatsAvailable = Math.max(0, session.seatsAvailable - matchedRider.seatsNeeded);
  session.totalEarnings += payoutAmount;
  session.status = 'ROLLING'; // Nhập lại Quốc lộ 13

  return {
    success: true,
    message: 'Khớp mã thành công! Mời khách thắt dây an toàn và tiếp tục hành trình.',
    rider: {
      intentId: matchedRider.intentId,
      name: matchedRider.name,
      status: matchedRider.status,
      fuelSurcharge: matchedRider.fuelSurcharge,
      driverPayout: payoutAmount
    },
    session: {
      seatsAvailable: session.seatsAvailable,
      totalEarnings: session.totalEarnings,
      status: session.status
    }
  };
}

/**
 * 8. DỌN SẠCH DỮ LIỆU ĐỂ KIỂM THỬ (TEST SUITE CLEANUP)
 */
export function resetAllStationData() {
  stationQueues.clear();
  cockpitSessions.clear();
}
