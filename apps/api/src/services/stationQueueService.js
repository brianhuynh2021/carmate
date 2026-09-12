import {
  VIRTUAL_HUBS,
  getVirtualHubById,
  getFixedSegmentTariff,
  DRIVER_STATION_PAYOUT_RATIO,
  projectToCorridorFrenet,
  calculateKinematicTriggerDistance,
  isIntervalSchedulingFeasible,
  getStationStationKm,
  computeEtaDistribution,
  probabilityArrivalWithin,
  etaQuantileSeconds,
  probabilityOfLateness
} from '@carmate/shared';

// BỘ NHỚ LƯU TRỮ TRẠNG THÁI TRẠM ẢO & COCKPIT TẠI RAM (IN-MEMORY DISTRIBUTED ENGINE)
const stationQueues = new Map(); // stationId -> Array<RiderIntent>
const cockpitSessions = new Map(); // tripId -> CockpitSession

/**
 * THAM SỐ CHỐT T-30 (LEAD-TIME TRIGGER)
 *
 * Điều kiện ban đầu đặt ra là P(25 <= T_arrive <= 35) >= 0.90. Khi đo trên
 * phân phối thực của hành lang QL13 thì điều kiện đó KHÔNG BAO GIỜ thỏa: cửa
 * sổ 10 phút chỉ rộng khoảng 2*sigma ngay cả ở cự ly lý tưởng 28km (mu=27.6,
 * sigma=4.8), nên xác suất cực đại chỉ đạt ~0.65. Giữ nguyên ngưỡng 0.90 đồng
 * nghĩa T-30 vĩnh viễn im lặng — tức là tái lập đúng lỗi mà nó sinh ra để sửa.
 *
 * Bản chất điều kiện cần kiểm tra không phải "xe rơi trúng khe 25-35 phút" mà
 * là "khách CHẮC CHẮN còn đủ thời gian ra trạm, và không phải ra quá sớm":
 *
 *   1. P(T_arrive >= 20 phút) >= 0.85   — gần như chắc chắn còn kịp đi ra trạm
 *   2. p80 <= 45 phút                    — không bắt khách đứng đợi quá lâu
 *
 * Điều kiện (1) mới là cam kết với khách. Hai sai lầm ở đây bất đối xứng: bắn
 * sớm thì khách đợi thêm vài phút, bắn muộn thì khách lỡ xe — nên ngưỡng được
 * đặt lệch hẳn về phía an toàn.
 */
export const T30_CONFIG = Object.freeze({
  // Sàn thời gian khách cần để ra tới trạm
  MIN_LEAD_SECONDS: 20 * 60,
  // Độ tin cậy khách còn kịp ra trạm
  CONFIDENCE_THRESHOLD: 0.85,
  // Trần thời gian chờ theo phân vị p80: quá mốc này là bắt khách đợi vô lý
  MAX_P80_SECONDS: 45 * 60,
  // Khách có 10 phút để bấm "Tôi đang ra trạm", quá hạn thì giải phóng chỗ
  HANDSHAKE_GRACE_MS: 10 * 60 * 1000,
  // Nhắc lần 2 sau 5 phút nếu vẫn im lặng
  REMINDER_AFTER_MS: 5 * 60 * 1000
});

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
 * 8. HỦY LỆNH / THẺ LÊN XE MIỄN PHẠT (GRACE CANCEL)
 */
export function cancelRiderIntent(intentId, reason = 'CANCEL_DRIVER_LATE') {
  for (const [, queue] of stationQueues.entries()) {
    const intent = queue.find((i) => i.intentId === intentId);
    if (intent) {
      intent.status = 'CANCELLED';
      intent.cancelReason = reason;
      intent.cancelledAt = new Date().toISOString();
      return { success: true, intent };
    }
  }
  return { success: false, error: 'Không tìm thấy yêu cầu' };
}

/**
 * 9. LẤY DANH SÁCH PHIÊN COCKPIT ĐANG HOẠT ĐỘNG (SHADOW FLEET DISCOVERY)
 */
export function getActiveCockpitSessions() {
  return Array.from(cockpitSessions.values());
}

/**
 * 10. DỌN SẠCH DỮ LIỆU ĐỂ KIỂM THỬ (TEST SUITE CLEANUP)
 */
export function resetAllStationData() {
  stationQueues.clear();
  cockpitSessions.clear();
}


/**
 * =============================================================================
 * 11. CHỐT T-30: HỘI TỤ KHÔNG - THỜI GIAN (SPACE-TIME RENDEZVOUS)
 * =============================================================================
 * Quét mọi cặp (xe đang chạy, khách đang đợi) trên hành lang và trả về những
 * cặp đã thoả điều kiện xác suất để bắn thông báo "xe còn 30 phút nữa tới".
 *
 * Hàm này THUẦN TÍNH TOÁN + đánh dấu trạng thái trong RAM; việc gửi thông báo
 * do scheduler đảm nhiệm. Tách như vậy để kiểm thử được mà không cần mạng.
 *
 * @returns {Array} Danh sách { rider, session, distribution, probability, etaMs }
 */
export function evaluateT30Triggers(nowMs = Date.now()) {
  const triggers = [];
  const sessions = Array.from(cockpitSessions.values()).filter(
    (s) => !s.isBanned && s.seatsAvailable > 0 && s.lat != null && s.lng != null
  );

  if (sessions.length === 0) return triggers;

  for (const [hubId, queue] of stationQueues.entries()) {
    const hubS = getStationStationKm(hubId);
    if (hubS == null) continue;

    for (const rider of queue) {
      // Chỉ xét khách còn đang chờ và CHƯA từng nhận báo T-30
      if (rider.status !== 'WAITING' && rider.status !== 'OFFERED') continue;
      if (rider.t30NotifiedAt) continue;
      if (rider.seatsNeeded == null) continue;

      let best = null;

      for (const session of sessions) {
        if (session.seatsAvailable < rider.seatsNeeded) continue;

        const frenet = projectToCorridorFrenet(session.lat, session.lng, session.corridor);
        if (!frenet.isOnCorridor) continue;

        // Xe phải còn ở TRƯỚC trạm mới có chuyện "sắp tới đón"
        if (frenet.s >= hubS) continue;

        // Kiểm tra gối đầu tuyến tính: xe có thực sự đi qua đích của khách không
        const destS = getStationStationKm(rider.destinationHubId);
        if (destS != null && !isIntervalSchedulingFeasible(frenet.s, destS, hubS, destS)) continue;

        const distribution = computeEtaDistribution({
          currentS: frenet.s,
          targetS: hubS,
          currentSpeedKmh: session.speed,
          nowMs,
          dwellStopsAhead: countDwellStopsBetween(frenet.s, hubS, session.tripId)
        });

        // Điều kiện 1: xác suất khách CÒN KỊP ra trạm.
        // P(T_arrive >= 20 phút) = 1 - P(T_arrive < 20 phút)
        const probabilityStillHasTime =
          1 - probabilityArrivalWithin(distribution, 0, T30_CONFIG.MIN_LEAD_SECONDS);

        // Điều kiện 2: không bắt khách ra trạm đợi quá lâu (xét theo p80, không theo mu)
        const p80 = etaQuantileSeconds(distribution, 0.8) ?? Infinity;

        if (
          probabilityStillHasTime >= T30_CONFIG.CONFIDENCE_THRESHOLD &&
          p80 <= T30_CONFIG.MAX_P80_SECONDS
        ) {
          // Nhiều xe cùng thoả: chọn xe tới SỚM NHẤT theo p80, vì đó là xe khách
          // thực sự sẽ lên. Chọn theo xác suất cao nhất sẽ ưu tiên nhầm xe ở xa.
          if (!best || p80 < best.p80) {
            best = { session, distribution, probability: probabilityStillHasTime, p80 };
          }
        }
      }

      if (best) {
        triggers.push({
          rider,
          hubId,
          attempt: rider.t30Attempt || 1,
          session: best.session,
          distribution: best.distribution,
          probability: Number(best.probability.toFixed(3)),
          etaMs: best.distribution.etaMs,
          safeEtaMs: nowMs + (etaQuantileSeconds(best.distribution, 0.8) || 0) * 1000
        });
      }
    }
  }

  return triggers;
}

/**
 * Đếm số trạm mà xe còn phải dừng đón trước khi tới mốc đích.
 * Mỗi lần dừng cộng 60 giây dwell vào ETA — bỏ qua thì ETA lạc quan giả.
 */
function countDwellStopsBetween(fromS, toS, tripId) {
  let count = 0;
  for (const [hubId, queue] of stationQueues.entries()) {
    const s = getStationStationKm(hubId);
    if (s == null || s <= fromS || s >= toS) continue;
    // Chỉ tính trạm mà chính xe này đã nhận khách
    if (queue.some((r) => r.status === 'ARRIVING' && r.matchedTripId === tripId)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Đánh dấu đã bắn T-30 cho một khách (scheduler gọi sau khi gửi thành công).
 * Mốc `t30DeadlineAt` là hạn chót khách phải bấm xác nhận ra trạm.
 */
export function markT30Notified(intentId, { etaMs, safeEtaMs, tripId, nowMs = Date.now() } = {}) {
  for (const queue of stationQueues.values()) {
    const rider = queue.find((i) => i.intentId === intentId);
    if (rider) {
      rider.t30NotifiedAt = nowMs;
      rider.t30DeadlineAt = nowMs + T30_CONFIG.HANDSHAKE_GRACE_MS;
      rider.t30ReminderAt = null;
      rider.expectedArrivalMs = etaMs || null;
      rider.safeArrivalMs = safeEtaMs || null;
      rider.t30TripId = tripId || null;
      return { success: true, rider };
    }
  }
  return { success: false };
}

/**
 * =============================================================================
 * 12. BẮT TAY XÁC NHẬN RA TRẠM (HANDSHAKE CHECK-IN)
 * =============================================================================
 * Khách bấm "Tôi đang ra trạm". Đây là mấu chốt biến cam kết một chiều thành
 * cam kết hai chiều: chủ xe chỉ dừng khi biết chắc có người đang đứng đợi, còn
 * khách giữ được chỗ. Không bấm trong 10 phút thì chỗ được trả lại cho người khác.
 */
export function riderConfirmOnTheWay({ intentId, clientLat = null, clientLng = null }) {
  for (const [hubId, queue] of stationQueues.entries()) {
    const rider = queue.find((i) => i.intentId === intentId);
    if (!rider) continue;

    if (rider.status === 'CANCELLED' || rider.status === 'COMPLETED') {
      return { success: false, error: 'Yêu cầu này đã kết thúc, không thể xác nhận.' };
    }

    rider.handshakeConfirmedAt = Date.now();
    rider.handshakeStatus = 'ON_THE_WAY';

    // Nếu khách gửi kèm toạ độ, tính luôn cự ly tới trạm để chủ xe biết
    const hub = getVirtualHubById(hubId);
    if (clientLat != null && clientLng != null && hub?.lat != null) {
      const distKm = calculateDistanceKm(clientLat, clientLng, hub.lat, hub.lng);
      rider.handshakeDistanceM = Math.round(distKm * 1000);
    }

    return {
      success: true,
      message: 'Đã ghi nhận. Chủ xe sẽ được báo là bạn đang ra trạm.',
      intentId: rider.intentId,
      hubId,
      handshakeStatus: rider.handshakeStatus,
      matchedTripId: rider.t30TripId || rider.matchedTripId || null,
      distanceToHubM: rider.handshakeDistanceM ?? null
    };
  }

  return { success: false, error: 'Không tìm thấy yêu cầu' };
}

/**
 * Quét các khách đã nhận T-30 nhưng chưa bấm xác nhận.
 * Trả về hai nhóm: cần nhắc lần 2, và đã quá hạn cần giải phóng chỗ.
 *
 * Giải phóng KHÔNG phải là huỷ chuyến: khách vẫn ở trong hàng đợi với trạng thái
 * WAITING, chỉ mất quyền ưu tiên với chiếc xe đang tới. Phạt nhẹ và có thể phục hồi.
 */
export function sweepHandshakeDeadlines(nowMs = Date.now()) {
  const needReminder = [];
  const expired = [];

  for (const [hubId, queue] of stationQueues.entries()) {
    for (const rider of queue) {
      if (!rider.t30NotifiedAt) continue;
      if (rider.handshakeStatus === 'ON_THE_WAY') continue;
      if (rider.status === 'CANCELLED' || rider.status === 'BOARDED') continue;

      // Quá hạn 10 phút -> thu hồi quyền ưu tiên
      if (rider.t30DeadlineAt && nowMs >= rider.t30DeadlineAt) {
        if (rider.status === 'OFFERED') {
          rider.status = 'WAITING';
          rider.lockExpiresAt = null;
          rider.matchedTripId = null;
        }
        rider.handshakeStatus = 'NO_RESPONSE';
        rider.seatReleasedAt = nowMs;
        // Cho phép chốt T-30 chạy lại với chuyến sau.
        // Tăng số lượt để khoá chống trùng của thông báo khác đi ở lần bắn sau:
        // giữ nguyên khoá cũ thì thông báo mới bị nuốt như bản trùng, và khách
        // rơi vào vòng lặp vĩnh viễn không bao giờ nhận được báo nào nữa.
        rider.t30Attempt = (rider.t30Attempt || 1) + 1;
        rider.t30NotifiedAt = null;
        rider.t30DeadlineAt = null;
        expired.push({ rider, hubId });
        continue;
      }

      // Nhắc lần 2 sau 5 phút im lặng
      if (!rider.t30ReminderAt && nowMs - rider.t30NotifiedAt >= T30_CONFIG.REMINDER_AFTER_MS) {
        rider.t30ReminderAt = nowMs;
        needReminder.push({ rider, hubId });
      }
    }
  }

  return { needReminder, expired };
}

/**
 * =============================================================================
 * 13. RADAR TRỄ HẸN THỜI GIAN THỰC (IN-TRANSIT LATENESS RADAR)
 * =============================================================================
 * Với khách đã được ghép (ARRIVING) và đã có mốc giờ cam kết, tính xác suất xe
 * trễ hẹn. Đây là đầu vào cho quyết định hoán đổi chuyến Shadow — không đợi tới
 * lúc xe đã trễ thật mới xoay xở, mà hành động khi xác suất trễ vượt ngưỡng.
 */
export function evaluateLatenessRisk(nowMs = Date.now(), toleranceSeconds = 300) {
  const atRisk = [];

  for (const [hubId, queue] of stationQueues.entries()) {
    const hubS = getStationStationKm(hubId);
    if (hubS == null) continue;

    for (const rider of queue) {
      const committedAt = rider.safeArrivalMs || rider.expectedArrivalMs;
      if (!committedAt) continue;
      if (rider.status === 'BOARDED' || rider.status === 'CANCELLED') continue;

      const tripId = rider.t30TripId || rider.matchedTripId;
      if (!tripId) continue;

      const session = cockpitSessions.get(tripId);
      if (!session) continue;
      if (session.lat == null || session.lng == null) continue;

      const frenet = projectToCorridorFrenet(session.lat, session.lng, session.corridor);
      // Mất tín hiệu hoặc xe lệch khỏi hành lang: hình chiếu rơi về mốc 0 và sinh
      // ra kết luận "trễ 100%" cho một chủ xe hoàn toàn bình thường. Không đủ dữ
      // liệu thì im lặng, tuyệt đối không được cướp khách của người ta.
      if (!frenet.isOnCorridor) continue;
      // Xe đã đi qua trạm rồi thì bài toán không còn là trễ hẹn nữa
      if (frenet.s >= hubS) continue;

      const distribution = computeEtaDistribution({
        currentS: frenet.s,
        targetS: hubS,
        currentSpeedKmh: session.speed,
        nowMs
      });

      const lateness = probabilityOfLateness(distribution, committedAt, toleranceSeconds, nowMs);

      if (lateness.probability >= 0.6 || lateness.expectedDelaySeconds > toleranceSeconds) {
        atRisk.push({
          rider,
          hubId,
          session,
          distribution,
          lateness,
          committedAt
        });
      }
    }
  }

  return atRisk;
}

/**
 * Ghi nhận việc đã hoán đổi khách sang chuyến Shadow.
 * Mốc giờ cam kết được GIỮ NGUYÊN — đó chính là điểm của cơ chế này: khách
 * không phải chịu hậu quả của sự cố mà họ không gây ra.
 */
export function applyShadowSwap({ intentId, newTripId, newEtaMs = null }) {
  for (const queue of stationQueues.values()) {
    const rider = queue.find((i) => i.intentId === intentId);
    if (!rider) continue;

    const previousTripId = rider.t30TripId || rider.matchedTripId;
    const shadowSession = cockpitSessions.get(newTripId);
    if (!shadowSession) {
      return { success: false, error: 'Không tìm thấy phiên của xe hỗ trợ' };
    }

    // Đang hoán đổi về đúng xe cũ thì không có gì để làm — trả ngay, nếu không
    // đoạn dưới sẽ trừ ghế thêm một lần nữa của chính chiếc xe đang giữ khách.
    if (previousTripId === newTripId) {
      return { success: true, rider, previousTripId, newTripId, carInfo: rider.carInfo, noop: true };
    }

    // Trả lại ghế cho xe cũ.
    // Điều kiện phải là "xe cũ CÓ ĐANG GIỮ GHẾ hay không", chứ không phải trạng
    // thái ARRIVING: chính hàm này đặt rider về OFFERED sau mỗi lần hoán đổi, nên
    // lần swap thứ hai trở đi sẽ không bao giờ hoàn ghế và đội xe bị rút cạn dần.
    if (previousTripId && rider.seatHeldByTripId === previousTripId) {
      const oldSession = cockpitSessions.get(previousTripId);
      if (oldSession) {
        oldSession.seatsAvailable += rider.seatsNeeded;
        if (oldSession.status === 'DWELLING' && oldSession.dockingIntentId === intentId) {
          oldSession.status = 'ACTIVE_SCANNING';
          oldSession.dockingIntentId = null;
          oldSession.dockingStationId = null;
          oldSession.dockingExpiresAt = null;
        }
      }
    }

    rider.matchedTripId = newTripId;
    rider.t30TripId = newTripId;
    rider.status = 'OFFERED';
    rider.lockExpiresAt = Date.now() + 120000; // Xe hỗ trợ có 2 phút để tiếp nhận
    rider.shadowSwapAt = Date.now();
    rider.shadowSwappedFrom = previousTripId || null;
    rider.swapCount = (rider.swapCount || 0) + 1;
    if (newEtaMs) rider.expectedArrivalMs = newEtaMs;
    rider.carInfo = {
      plate: shadowSession.plate,
      vehicleModel: shadowSession.vehicleModel,
      driverName: shadowSession.driverName,
      driverPhone: shadowSession.driverPhone
    };

    shadowSession.seatsAvailable = Math.max(0, shadowSession.seatsAvailable - rider.seatsNeeded);
    // Ghi rõ xe nào đang thực sự giữ ghế của khách, để lần hoàn ghế sau chính xác
    rider.seatHeldByTripId = newTripId;

    return {
      success: true,
      rider,
      previousTripId,
      newTripId,
      carInfo: rider.carInfo
    };
  }

  return { success: false, error: 'Không tìm thấy yêu cầu' };
}

/**
 * Tìm chuyến Shadow tốt nhất cho một khách đang có nguy cơ bị trễ.
 *
 * Điều kiện: cùng hành lang, còn đủ ghế, đang ở TRƯỚC trạm đón, và quan trọng
 * nhất — ETA của nó phải kịp mốc đã cam kết. Một xe chạy sau nhưng thông thoáng
 * vẫn có thể tới sớm hơn xe chính đang mắc kẹt.
 */
export function findShadowCandidate({ hubId, seatsNeeded, committedAtMs, excludeTripId, nowMs = Date.now() }) {
  const hubS = getStationStationKm(hubId);
  if (hubS == null) return null;

  let best = null;

  for (const session of cockpitSessions.values()) {
    if (session.tripId === excludeTripId) continue;
    if (session.isBanned) continue;
    if (session.seatsAvailable < seatsNeeded) continue;
    if (session.lat == null || session.lng == null) continue;

    const frenet = projectToCorridorFrenet(session.lat, session.lng, session.corridor);
    if (!frenet.isOnCorridor || frenet.s >= hubS) continue;

    const distribution = computeEtaDistribution({
      currentS: frenet.s,
      targetS: hubS,
      currentSpeedKmh: session.speed,
      nowMs
    });

    const lateness = probabilityOfLateness(distribution, committedAtMs, 300, nowMs);

    // Chỉ nhận xe có xác suất trễ dưới 35% — đổi sang một xe cũng sắp trễ
    // thì chỉ làm khách hoang mang thêm mà không giải quyết được gì.
    if (lateness.probability > 0.35) continue;

    if (!best || lateness.probability < best.lateness.probability) {
      best = { session, distribution, lateness };
    }
  }

  return best;
}
