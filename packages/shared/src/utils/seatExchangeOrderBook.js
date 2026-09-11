/**
 * seatExchangeOrderBook.js
 *
 * MÔ HÌNH SÀN GIAO DỊCH GHẾ TRỐNG (SEAT EXCHANGE)
 * Sổ Lệnh Hai Chiều (Limit Order Book - LOB) & Khớp Lệnh Liên Tục (Continuous Double Auction - CDA)
 * Kết hợp Cơ Chế Thị Trường Giao Ngay (Continuous Spot Market 24/7) và Cửa Sổ Trượt Dynamic Sliding TTL.
 *
 * Nền tảng lý thuyết:
 * 1. Không gian khớp lệnh Đại số Khoảng thời gian (Interval Matching):
 *    Station_D = Station_P && [t_D - dt, t_D + dt] ∩ [t_P - dt, t_P + dt] != ∅ && Seats >= 1
 * 2. Khớp liên tục CDA O(1) / O(log N) ngay khi lệnh ném vào sàn.
 * 3. Chuyển dịch Hai Pha:
 *    - Pha 1: Đặt trước 21:30 (Vé an tâm cao cấp) -> Hạn chốt 21:30 tối hôm trước.
 *    - Pha 2: Đặt sau 21:30 hoặc trong ngày (Giao ngay / Last-minute Spot) -> TTL = T_pickup - 45 phút.
 * 4. Phân tầng kỳ vọng (Tiered Expectation) & Kiến trúc Event-Driven "Đặt lệnh xong quên đi".
 */

/**
 * 1. ĐẠI SỐ KHOẢNG THỜI GIAN (INTERVAL ARITHMETIC)
 */

import { parseTimeToMinutes, formatMinutesToTime } from './asymmetricMoralHazard.js';

export const minutesToTimeString = formatMinutesToTime;

/**
 * Tạo khoảng thời gian [t - delta, t + delta]
 */
export function buildInterval(centerMinutes, deltaMinutes = 10) {
  const c = Number(centerMinutes);
  const d = Math.max(0, Number(deltaMinutes) || 10);
  return [Math.max(0, c - d), Math.min(1439, c + d)];
}

/**
 * Kiểm tra giao thoa giữa 2 khoảng thời gian [s1, e1] và [s2, e2]
 * Trả về khoảng giao thoa nếu có, hoặc null nếu rỗng
 */
export function checkIntervalIntersection(intervalA, intervalB) {
  if (!intervalA || !intervalB || intervalA.length < 2 || intervalB.length < 2) {
    return null;
  }
  const maxStart = Math.max(intervalA[0], intervalB[0]);
  const minEnd = Math.min(intervalA[1], intervalB[1]);

  if (maxStart <= minEnd) {
    return [maxStart, minEnd]; // Giao thoa khác rỗng
  }
  return null; // Không giao nhau
}

/**
 * Tính thời điểm đón tối ưu (Rendezvous Time) tại điểm giữa khoảng giao thoa
 */
export function calculateRendezvousTime(intervalA, intervalB) {
  const intersection = checkIntervalIntersection(intervalA, intervalB);
  if (!intersection) return null;
  return Math.round((intersection[0] + intersection[1]) / 2);
}

/**
 * 2. CÔNG THỨC TÍNH TTL ĐỘNG & PHÂN TẦNG KỲ VỌNG (DYNAMIC SLIDING TTL & TIERED EXPECTATION)
 *
 * - Đặt trước 21:30 của đêm hôm trước: TTL cố định 21:30 đêm đó. Tier: 'SAFE_ADVANCE'
 * - Đặt sau 21:30 hoặc đặt trong cùng ngày: TTL trượt = T_pickup - 45 phút. Tier: 'LAST_MINUTE_TAKER'
 */
export function calculateOrderTTL({
  orderCreatedAt = Date.now(),
  targetPickupMinutes = 375, // 06:15
  pickupDate = null // 'YYYY-MM-DD'
} = {}) {
  const createdDate = new Date(orderCreatedAt);
  const targetDate = pickupDate ? new Date(`${pickupDate}T00:00:00`) : new Date(orderCreatedAt);

  // Tính số ngày chênh lệch giữa ngày đặt lệnh và ngày đi
  const diffDays = Math.round((targetDate.setHours(0,0,0,0) - new Date(createdDate).setHours(0,0,0,0)) / (24 * 3600 * 1000));
  const createdMinutes = createdDate.getHours() * 60 + createdDate.getMinutes();

  // Mốc 21:30 tối = 21 * 60 + 30 = 1290 phút
  const NIGHT_CUTOFF_MINUTES = 21 * 60 + 30; // 1290
  const isAdvanceBeforeNight = diffDays >= 1 && createdMinutes < NIGHT_CUTOFF_MINUTES;

  if (isAdvanceBeforeNight) {
    // Đặt trước 21:30 đêm trước: TTL là 21:30 đêm hôm trước ngày đi
    const cutoffTimestamp = new Date(createdDate).setHours(21, 30, 0, 0);
    return {
      tier: 'SAFE_ADVANCE',
      tierLabel: 'Vé an tâm cao cấp',
      ttlMinutes: NIGHT_CUTOFF_MINUTES,
      ttlTimeString: '21:30',
      ttlTimestamp: cutoffTimestamp,
      dynamicSliding: false,
      userMessage: 'Hệ thống đang tìm xe đối ứng cho bạn. Cam kết chốt kết quả trước 21:30 tối nay để bạn hoàn toàn yên tâm nghỉ ngơi.'
    };
  }

  // Đặt sau 21:30 hoặc đặt trong ngày đi -> Thị trường giao ngay (Spot Market)
  // Dynamic Sliding TTL = T_pickup - 45 phút
  const slidingTTLMinutes = Math.max(0, targetPickupMinutes - 45);
  const slidingTTLString = minutesToTimeString(slidingTTLMinutes);

  // Thời điểm timestamp hết hạn
  const ttlTime = new Date(pickupDate ? `${pickupDate}T00:00:00` : orderCreatedAt);
  ttlTime.setHours(Math.floor(slidingTTLMinutes / 60), slidingTTLMinutes % 60, 0, 0);

  return {
    tier: 'LAST_MINUTE_TAKER',
    tierLabel: 'Lệnh vớt / Giao ngay 24/7',
    ttlMinutes: slidingTTLMinutes,
    ttlTimeString: slidingTTLString,
    ttlTimestamp: ttlTime.getTime(),
    dynamicSliding: true,
    userMessage: `Bạn đang đặt chuyến vào khung giờ muộn (Giao ngay 24/7). Hệ thống đang treo lệnh tìm xe trống trên trục QL13. Lệnh sẽ tự động hủy lúc ${slidingTTLString} nếu không có xe nhận.`
  };
}

/**
 * 3. MÁY CHỦ KHỚP LỆNH LIÊN TỤC (CONTINUOUS DOUBLE AUCTION - CDA MATCHING ENGINE)
 *
 * Thuật toán khớp tức thì O(1) qua Bucket trạm đón & O(M) giao thoa khoảng thời gian.
 * @param {object} incomingOrder - Lệnh mới vào sàn (Ask hoặc Bid)
 * @param {Array} orderBook - Danh sách các lệnh đang OPEN trên sàn
 * @returns {object} Kết quả khớp lệnh
 */
export function matchOrderContinuous(incomingOrder, orderBook = []) {
  if (!incomingOrder) return { matched: false, incomingOrder };

  const isBid = incomingOrder.orderType === 'BID'; // Khách mua ghế
  const oppositeType = isBid ? 'ASK' : 'BID'; // Phía đối ứng (Chủ xe bán ghế hoặc Khách mua)

  // Chuẩn hóa khoảng thời gian của lệnh mới
  const incomingTargetMins = incomingOrder.targetTimeMinutes ?? parseTimeToMinutes(incomingOrder.targetTime);
  const incomingDelta = Number(incomingOrder.deltaMinutes) || 10;
  const incomingInterval = incomingOrder.timeInterval || buildInterval(incomingTargetMins, incomingDelta);
  const incomingSeats = Number(incomingOrder.seats || incomingOrder.seatsNeeded || 1);

  // Lọc các lệnh đối ứng đang OPEN trên cùng hành lang, chiều đi và trạm đón
  const candidates = orderBook.filter((order) => {
    if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED') return false;
    if (order.orderType !== oppositeType) return false;

    // 1. Cùng ngày di chuyển (nếu có khai báo ngày)
    if (incomingOrder.date && order.date && incomingOrder.date !== order.date) {
      return false;
    }

    // 2. Cùng chiều hành lang di chuyển
    if (incomingOrder.direction && order.direction && incomingOrder.direction !== order.direction) {
      return false;
    }

    // 3. Khớp trạm đón (Station Matching) hoặc cùng hành lang trục QL13
    const sameStation =
      (incomingOrder.stationId && order.stationId && incomingOrder.stationId === order.stationId) ||
      (incomingOrder.stationName && order.stationName && incomingOrder.stationName.trim().toLowerCase() === order.stationName.trim().toLowerCase()) ||
      (!incomingOrder.stationId && !order.stationId); // Fallback nếu chưa gán trạm

    if (!sameStation) return false;

    // 4. Kiểm tra sức chứa ghế
    if (isBid) {
      // Khách mua ghế: Xe chủ xe phải còn đủ số ghế khách cần
      const available = Number(order.remainingSeats ?? order.availableSeats ?? order.seats ?? 1);
      if (available < incomingSeats) return false;
    } else {
      // Chủ xe bán ghế: Ghế chủ xe cung cấp phải >= số ghế khách cần
      const needed = Number(order.seatsNeeded ?? order.seats ?? 1);
      const incomingAvailable = Number(incomingOrder.remainingSeats ?? incomingOrder.availableSeats ?? incomingSeats);
      if (incomingAvailable < needed) return false;
    }

    // 5. Kiểm tra Giao thoa Khoảng thời gian: [t_D ± dt] ∩ [t_P ± dt] ≠ ∅
    const orderTargetMins = order.targetTimeMinutes ?? parseTimeToMinutes(order.targetTime);
    const orderDelta = Number(order.deltaMinutes) || 10;
    const orderInterval = order.timeInterval || buildInterval(orderTargetMins, orderDelta);

    const intersection = checkIntervalIntersection(incomingInterval, orderInterval);
    return intersection !== null;
  });

  if (candidates.length === 0) {
    // Không có đối ứng thỏa mãn -> Lệnh nằm lại sổ lệnh ở trạng thái OPEN
    return {
      matched: false,
      incomingOrder: {
        ...incomingOrder,
        targetTimeMinutes: incomingTargetMins,
        timeInterval: incomingInterval,
        status: 'OPEN'
      }
    };
  }

  // Sắp xếp các ứng viên đối ứng tối ưu nhất:
  // 1. Điểm tín nhiệm cao nhất
  // 2. Khoảng cách thời gian gần nhất (|t_incoming - t_order|)
  // 3. FIFO (ưu tiên lệnh ném vào sàn trước)
  candidates.sort((a, b) => {
    const trustDiff = Number(b.trustScore || 98) - Number(a.trustScore || 98);
    if (trustDiff !== 0) return trustDiff;

    const aMins = a.targetTimeMinutes ?? parseTimeToMinutes(a.targetTime);
    const bMins = b.targetTimeMinutes ?? parseTimeToMinutes(b.targetTime);
    const deltaA = Math.abs(aMins - incomingTargetMins);
    const deltaB = Math.abs(bMins - incomingTargetMins);
    if (deltaA !== deltaB) return deltaA - deltaB;

    return Number(a.createdAt || 0) - Number(b.createdAt || 0);
  });

  const bestMatch = candidates[0];
  const bestTargetMins = bestMatch.targetTimeMinutes ?? parseTimeToMinutes(bestMatch.targetTime);
  const bestInterval = bestMatch.timeInterval || buildInterval(bestTargetMins, Number(bestMatch.deltaMinutes) || 10);

  // Tính toán thời điểm đón thực tế tại điểm giữa giao thoa
  const rendezvousMinutes = calculateRendezvousTime(incomingInterval, bestInterval);
  const rendezvousTimeStr = minutesToTimeString(rendezvousMinutes);

  // Xác định rõ vai trò Chủ xe (Ask) và Khách (Bid)
  const askOrder = isBid ? bestMatch : incomingOrder;
  const bidOrder = isBid ? incomingOrder : bestMatch;

  const seatsTraded = Number(bidOrder.seatsNeeded ?? bidOrder.seats ?? 1);
  const currentAskSeats = Number(askOrder.remainingSeats ?? askOrder.availableSeats ?? askOrder.seats ?? 3);
  const newRemainingSeats = Math.max(0, currentAskSeats - seatsTraded);

  // Sinh mã PIN ngẫu nhiên 4 chữ số
  const pinCode = Math.floor(1000 + Math.random() * 9000).toString();

  // Cập nhật trạng thái lệnh
  const updatedBid = {
    ...bidOrder,
    status: 'FILLED',
    matchedWithOrderId: askOrder.id,
    rendezvousTime: rendezvousTimeStr,
    rendezvousMinutes,
    pinCode,
    matchedAt: Date.now()
  };

  const updatedAsk = {
    ...askOrder,
    remainingSeats: newRemainingSeats,
    status: newRemainingSeats === 0 ? 'FILLED' : 'PARTIALLY_FILLED',
    matchedWithOrderId: bidOrder.id,
    rendezvousTime: rendezvousTimeStr,
    rendezvousMinutes,
    pinCode,
    matchedAt: Date.now()
  };

  // Tạo các bản tin thông báo Event-Driven
  const notifications = {
    passenger: buildOrderMatchedNotification({
      role: 'passenger',
      vehicleModel: askOrder.vehicleModel || 'Ô tô tiện chuyến',
      plate: askOrder.plate || 'Chủ xe thân thiện',
      rendezvousTime: rendezvousTimeStr,
      stationName: bidOrder.stationName || 'Trạm đón QL13',
      pinCode,
      seats: seatsTraded
    }),
    driver: buildOrderMatchedNotification({
      role: 'driver',
      passengerName: bidOrder.contactName || 'Người đi cùng',
      rendezvousTime: rendezvousTimeStr,
      stationName: askOrder.stationName || 'Trạm đón QL13',
      remainingSeats: newRemainingSeats,
      seats: seatsTraded
    })
  };

  return {
    matched: true,
    bidOrder: updatedBid,
    askOrder: updatedAsk,
    rendezvousTime: rendezvousTimeStr,
    rendezvousMinutes,
    pinCode,
    seatsTraded,
    remainingSeats: newRemainingSeats,
    notifications
  };
}

/**
 * 4. THUẬT TOÁN QUÉT HẾT HẠN THEO CỬA SỔ TRƯỢT (EVALUATE SLIDING TTL EXPIRATIONS)
 * Quét các lệnh OPEN trên sàn. Lệnh nào quá TTL sẽ tự động chuyển sang EXPIRED.
 */
export function evaluateOrderBookExpirations(orderBook = [], { currentTimestamp = Date.now() } = {}) {
  const expiredOrders = [];
  const activeOrders = [];

  for (const order of orderBook) {
    if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED') {
      activeOrders.push(order);
      continue;
    }

    const orderTTL = order.ttlTimestamp || calculateOrderTTL({
      orderCreatedAt: order.createdAt || currentTimestamp,
      targetPickupMinutes: order.targetTimeMinutes ?? parseTimeToMinutes(order.targetTime),
      pickupDate: order.date
    }).ttlTimestamp;

    if (currentTimestamp >= orderTTL) {
      // Đã chạm hoặc vượt mốc TTL -> Hết hạn
      const notification = buildOrderExpiredNotification({
        order,
        cutoffTimeStr: order.ttlTimeString || minutesToTimeString(Math.floor((orderTTL % (24 * 3600 * 1000)) / (60 * 1000)))
      });

      expiredOrders.push({
        ...order,
        status: 'EXPIRED',
        expiredAt: currentTimestamp,
        notification
      });
    } else {
      activeOrders.push(order);
    }
  }

  return {
    expiredOrders,
    activeOrders,
    totalExpired: expiredOrders.length
  };
}

/**
 * 5. MẪU SỰ KIỆN EVENT-DRIVEN NOTIFICATIONS
 */

export function buildOrderMatchedNotification({
  role = 'passenger',
  vehicleModel = 'Xpander',
  plate = '93A-541.86',
  rendezvousTime = '05:15',
  stationName = 'Cây xăng Tân Khai',
  pinCode = '8842',
  passengerName = 'Người đi cùng',
  remainingSeats = 1,
  seats = 1
} = {}) {
  if (role === 'passenger') {
    return {
      event: 'OrderMatchedEvent',
      recipientRole: 'passenger',
      title: 'Lệnh đi nhờ của bạn đã KHỚP THÀNH CÔNG 🎉',
      body: `Xe ${vehicleModel} (${plate}) sẽ đón bạn lúc ${rendezvousTime} tại ${stationName}. Mã PIN: ${pinCode}. Bạn nhớ có mặt đúng giờ nhé!`,
      payload: { vehicleModel, plate, rendezvousTime, stationName, pinCode, seats }
    };
  }

  return {
    event: 'OrderMatchedEvent',
    recipientRole: 'driver',
    title: 'Đã khớp thêm 1 khách cho chuyến sáng mai 🚗',
    body: `Người đi cùng: ${passengerName}. Giờ đón: ${rendezvousTime} tại ${stationName}. Còn trống: ${remainingSeats} ghế.`,
    payload: { passengerName, rendezvousTime, stationName, remainingSeats, seats }
  };
}

export function buildOrderExpiredNotification({
  order = {},
  cutoffTimeStr = '21:30'
} = {}) {
  const isAdvance = order.orderTier === 'SAFE_ADVANCE' || !order.orderTier;
  const targetTime = order.targetTime || 'sáng mai';
  const station = order.stationName || 'trạm đón';

  if (isAdvance) {
    return {
      event: 'OrderExpiredEvent',
      orderId: order.id,
      title: 'Thông báo kết quả ghép chuyến lúc 21:30',
      body: `Đến 21:30 chưa có xe nào cùng khung giờ với bạn cho chuyến ${targetTime} tại ${station}. Lệnh đã đóng để bạn yên tâm nghỉ ngơi. Bạn chủ động chuẩn bị phương án xe khách liên tỉnh sáng mai nhé!`,
      lifebuoyRecommendation: 'Gợi ý: Tuyến xe khách Chơn Thành - Sài Gòn hoặc Buýt 15 xuất phát chuyến đầu lúc 04:45 và 05:00 ngay cổng trạm.'
    };
  }

  return {
    event: 'OrderExpiredEvent',
    orderId: order.id,
    title: `Lệnh giao ngay đã tự động đóng lúc ${cutoffTimeStr}`,
    body: `Đã đến hạn chót ${cutoffTimeStr} nhưng chưa có ghế trống phù hợp với chuyến ${targetTime}. Lệnh đã hủy tự động để bạn kịp bắt xe khách hoặc buýt dọc tuyến QL13.`,
    lifebuoyRecommendation: 'Gợi ý: Ra cổng trạm vẫy xe khách liên tỉnh tuyến QL13 (chuyến kế tiếp cách 15 phút).'
  };
}
