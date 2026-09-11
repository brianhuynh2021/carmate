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
 * 2. PHƯƠNG TRÌNH TTL HỢP NHẤT (UNIFIED TTL EQUATION)
 *
 * Theo các công trình toán học:
 * - Online Bipartite Matching with Deadlines (Karp, Vazirani & Vazirani, 1990)
 * - Perishable Asset Revenue Management
 * - Optimal Stopping & Switching Costs
 *
 * Mọi lệnh chỉ tuân theo đúng MỘT CÔNG THỨC DUY NHẤT:
 * TTL = min(T_sleep, T_pickup - delta t_switch)
 *
 * Trong đó:
 * - T_pickup: Thời điểm xe đón khách tại trạm.
 * - delta t_switch: Khoảng đệm thời gian an toàn để chuyển sang xe khách/xe đò (45 phút).
 * - T_sleep: Giờ giới nghiêm sinh học (21:30 tối hôm trước — chỉ kích hoạt khi đặt trước 21:30
 *   cho các chuyến sáng sớm hôm sau). Các trường hợp còn lại (trong ngày hoặc đặt sau 21:30): T_sleep = Infinity.
 */
export function calculateUnifiedOrderTTL({
  orderCreatedAt = Date.now(),
  targetPickupMinutes = 375, // 06:15
  pickupDate = null, // 'YYYY-MM-DD'
  switchBufferMinutes = 45, // delta t_switch = 45 phút
  sleepCutoffHourMinute = '21:30' // T_sleep
} = {}) {
  const createdDate = new Date(orderCreatedAt);

  // Xác định ngày đón khách
  let pickupDateObj;
  if (pickupDate && typeof pickupDate === 'string' && pickupDate.includes('-')) {
    const [y, m, d] = pickupDate.split('-').map((v) => parseInt(v, 10));
    pickupDateObj = new Date(y, m - 1, d);
  } else {
    pickupDateObj = new Date(createdDate);
  }

  // Thời điểm đón khách chính xác T_pickup (timestamp)
  const pickupTimestamp = new Date(pickupDateObj).setHours(
    Math.floor(targetPickupMinutes / 60),
    targetPickupMinutes % 60,
    0,
    0
  );

  // 1. T_switch = T_pickup - delta t_switch (trừ 45 phút)
  const switchTimestamp = pickupTimestamp - switchBufferMinutes * 60 * 1000;

  // 2. T_sleep: Giờ giới nghiêm sinh học lúc 21:30 tối đêm hôm trước ngày đón
  const createdDayStart = new Date(createdDate).setHours(0, 0, 0, 0);
  const pickupDayStart = new Date(pickupDateObj).setHours(0, 0, 0, 0);
  const isFutureDay = pickupDayStart > createdDayStart;

  let sleepTimestamp = Infinity;
  if (isFutureDay) {
    const sleepCutoffParts = sleepCutoffHourMinute.split(':').map((v) => parseInt(v, 10));
    const nightBeforePickup = new Date(pickupDayStart - 24 * 3600 * 1000);
    nightBeforePickup.setHours(sleepCutoffParts[0] || 21, sleepCutoffParts[1] || 30, 0, 0);
    const cutoffMs = nightBeforePickup.getTime();

    // Nếu lúc đặt lệnh chưa qua 21:30 đêm trước
    if (orderCreatedAt < cutoffMs) {
      sleepTimestamp = cutoffMs;
    }
  }

  // 3. TTL = min(T_sleep, T_switch)
  const ttlTimestamp = Math.min(sleepTimestamp, switchTimestamp);
  const isSleepCutoff = ttlTimestamp === sleepTimestamp;

  const ttlDate = new Date(ttlTimestamp);
  const ttlTimeString = `${String(ttlDate.getHours()).padStart(2, '0')}:${String(ttlDate.getMinutes()).padStart(2, '0')}`;

  const userNotice = isSleepCutoff
    ? `Hạn chót bảo vệ giấc ngủ lúc ${ttlTimeString} tối để bạn yên tâm nghỉ ngơi. Nếu chưa có xe, lệnh sẽ tự hủy để bạn chuẩn bị phương án sáng mai.`
    : `Hạn chót chuyển đổi an toàn lúc ${ttlTimeString} (trước giờ khởi hành 45 phút) để bạn kịp vẫy xe khách hoặc đón xe buýt dọc tuyến.`;

  return {
    ttlTimestamp,
    ttlTimeString,
    isSleepCutoff,
    sleepTimestamp: sleepTimestamp === Infinity ? null : sleepTimestamp,
    switchTimestamp,
    userNotice
  };
}

// Export alias tương thích
export const calculateOrderTTL = calculateUnifiedOrderTTL;

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
  cutoffTimeStr = ''
} = {}) {
  const targetTime = order.targetTime || 'chuyến đi';
  const station = order.stationName || 'trạm đón';
  const timeLabel = cutoffTimeStr || order.ttlTimeString || 'hạn chót';
  const isSleep = order.isSleepCutoff;

  return {
    event: 'OrderExpiredEvent',
    orderId: order.id,
    title: isSleep
      ? `Thông báo chốt sổ an tâm lúc ${timeLabel}`
      : `Lệnh ghép chuyến đã tự động đóng lúc ${timeLabel}`,
    body: isSleep
      ? `Đến ${timeLabel} tối chưa có xe nào cùng khung giờ với bạn cho chuyến ${targetTime} tại ${station}. Lệnh đã đóng để bạn yên tâm nghỉ ngơi. Bạn chủ động chuẩn bị phương án xe khách liên tỉnh sáng mai nhé!`
      : `Đã đến hạn chót ${timeLabel} (trước giờ đi 45 phút) nhưng chưa có ghế trống phù hợp với chuyến ${targetTime}. Lệnh đã hủy tự động để bạn kịp bắt xe khách hoặc buýt dọc tuyến QL13.`,
    lifebuoyRecommendation: 'Phao cứu sinh: Tuyến xe khách liên tỉnh QL13 (Chơn Thành - Sài Gòn) hoặc Buýt 15 xuất phát ngay cổng trạm (chuyến kế tiếp cách 15 phút).'
  };
}
