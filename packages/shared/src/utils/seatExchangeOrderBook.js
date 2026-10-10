/**
 * seatExchangeOrderBook.js
 *
 * EMPTY-SEAT TRADING EXCHANGE MODEL (SEAT EXCHANGE)
 * Two-Sided Order Book (Limit Order Book - LOB) & Continuous Order Matching (Continuous Double Auction - CDA)
 * Combines the Continuous Spot Market mechanism (24/7) with a Dynamic Sliding TTL window.
 *
 * Theoretical foundation:
 * 1. Order-matching space of Time-Interval Algebra (Interval Matching):
 *    Station_D = Station_P && [t_D - dt, t_D + dt] ∩ [t_P - dt, t_P + dt] != ∅ && Seats >= 1
 * 2. Continuous CDA matching in O(1) / O(log N) as soon as an order is thrown onto the exchange.
 * 3. Two-Phase Transition:
 *    - Phase 1: Book before 21:30 (premium peace-of-mind ticket) -> Confirmation deadline 21:30 the evening before.
 *    - Phase 2: Book after 21:30 or on the same day (immediate / Last-minute Spot) -> TTL = T_pickup - 45 minutes.
 * 4. Tiered Expectation & Event-Driven architecture "place the order and forget it".
 */

/**
 * 1. TIME-INTERVAL ALGEBRA (INTERVAL ARITHMETIC)
 */

import { parseTimeToMinutes, formatMinutesToTime } from './asymmetricMoralHazard.js';

const minutesToTimeString = formatMinutesToTime;

/**
 * Build the time interval [t - delta, t + delta]
 */
export function buildInterval(centerMinutes, deltaMinutes = 10) {
  const c = Number(centerMinutes);
  const d = Math.max(0, Number(deltaMinutes) || 10);
  return [Math.max(0, c - d), Math.min(1439, c + d)];
}

/**
 * Check the intersection of 2 time intervals [s1, e1] and [s2, e2]
 * Returns the intersection interval if any, or null if empty
 */
function checkIntervalIntersection(intervalA, intervalB) {
  if (!intervalA || !intervalB || intervalA.length < 2 || intervalB.length < 2) {
    return null;
  }
  const maxStart = Math.max(intervalA[0], intervalB[0]);
  const minEnd = Math.min(intervalA[1], intervalB[1]);

  if (maxStart <= minEnd) {
    return [maxStart, minEnd]; // Non-empty intersection
  }
  return null; // No intersection
}

/**
 * Compute the optimal pickup time (Rendezvous Time) at the midpoint of the intersection interval
 */
function calculateRendezvousTime(intervalA, intervalB) {
  const intersection = checkIntervalIntersection(intervalA, intervalB);
  if (!intersection) return null;
  return Math.round((intersection[0] + intersection[1]) / 2);
}

/**
 * 2. UNIFIED TTL EQUATION
 *
 * Following the mathematical works:
 * - Online Bipartite Matching with Deadlines (Karp, Vazirani & Vazirani, 1990)
 * - Perishable Asset Revenue Management
 * - Optimal Stopping & Switching Costs
 *
 * Every order obeys exactly ONE SINGLE FORMULA:
 * TTL = min(T_sleep, T_pickup - delta t_switch)
 *
 * Where:
 * - T_pickup: The time the vehicle picks up the passenger at the station.
 * - delta t_switch: Safe time buffer to switch to a coach/intercity bus (45 minutes).
 * - T_sleep: Biological curfew (21:30 the evening before — only triggered when booking before 21:30
 *   for early-morning trips the next day). All other cases (same day or booking after 21:30): T_sleep = Infinity.
 */
export function calculateUnifiedOrderTTL({
  orderCreatedAt = Date.now(),
  targetPickupMinutes = 375, // 06:15
  pickupDate = null, // 'YYYY-MM-DD'
  switchBufferMinutes = 45, // delta t_switch = 45 minutes
  sleepCutoffHourMinute = '21:30' // T_sleep
} = {}) {
  const createdDate = new Date(orderCreatedAt);

  // Determine the pickup date
  let pickupDateObj;
  if (pickupDate && typeof pickupDate === 'string' && pickupDate.includes('-')) {
    const [y, m, d] = pickupDate.split('-').map((v) => parseInt(v, 10));
    pickupDateObj = new Date(y, m - 1, d);
  } else {
    pickupDateObj = new Date(createdDate);
  }

  // Exact pickup time T_pickup (timestamp)
  const pickupTimestamp = new Date(pickupDateObj).setHours(
    Math.floor(targetPickupMinutes / 60),
    targetPickupMinutes % 60,
    0,
    0
  );

  // 1. T_switch = T_pickup - delta t_switch (minus 45 minutes)
  const switchTimestamp = pickupTimestamp - switchBufferMinutes * 60 * 1000;

  // 2. T_sleep: biological curfew at 21:30 on the night before the pickup day
  const createdDayStart = new Date(createdDate).setHours(0, 0, 0, 0);
  const pickupDayStart = new Date(pickupDateObj).setHours(0, 0, 0, 0);
  const isFutureDay = pickupDayStart > createdDayStart;

  let sleepTimestamp = Infinity;
  if (isFutureDay) {
    const sleepCutoffParts = sleepCutoffHourMinute.split(':').map((v) => parseInt(v, 10));
    const nightBeforePickup = new Date(pickupDayStart - 24 * 3600 * 1000);
    nightBeforePickup.setHours(sleepCutoffParts[0] || 21, sleepCutoffParts[1] || 30, 0, 0);
    const cutoffMs = nightBeforePickup.getTime();

    // If the order was placed before 21:30 the night before
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

/**
 * 3. CONTINUOUS ORDER-MATCHING ENGINE (CONTINUOUS DOUBLE AUCTION - CDA MATCHING ENGINE)
 *
 * Instant O(1) matching via pickup-station Buckets & O(M) time-interval intersection.
 * @param {object} incomingOrder - New order entering the exchange (Ask or Bid)
 * @param {Array} orderBook - List of orders currently OPEN on the exchange
 * @returns {object} Matching result
 */
export function matchOrderContinuous(incomingOrder, orderBook = []) {
  if (!incomingOrder) return { matched: false, incomingOrder };

  const isBid = incomingOrder.orderType === 'BID'; // Passenger buys a seat
  const oppositeType = isBid ? 'ASK' : 'BID'; // Counterparty (driver selling a seat or passenger buying)

  // Normalize the time interval of the new order
  const incomingTargetMins = incomingOrder.targetTimeMinutes ?? parseTimeToMinutes(incomingOrder.targetTime);
  const incomingDelta = Number(incomingOrder.deltaMinutes) || 10;
  const incomingInterval = incomingOrder.timeInterval || buildInterval(incomingTargetMins, incomingDelta);
  const incomingSeats = Number(incomingOrder.seats || incomingOrder.seatsNeeded || 1);

  // Filter OPEN counter-orders on the same corridor, direction and pickup station
  const candidates = orderBook.filter((order) => {
    if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED') return false;
    if (order.orderType !== oppositeType) return false;

    // 1. Same travel date (if a date is declared)
    if (incomingOrder.date && order.date && incomingOrder.date !== order.date) {
      return false;
    }

    // 2. Same corridor travel direction
    if (incomingOrder.direction && order.direction && incomingOrder.direction !== order.direction) {
      return false;
    }

    // 3. Station matching (Station Matching) or same corridor along the QL13 axis
    const sameStation =
      (incomingOrder.stationId && order.stationId && incomingOrder.stationId === order.stationId) ||
      (incomingOrder.stationName && order.stationName && incomingOrder.stationName.trim().toLowerCase() === order.stationName.trim().toLowerCase()) ||
      (!incomingOrder.stationId && !order.stationId); // Fallback if no station is assigned yet

    if (!sameStation) return false;

    // 4. Check seat capacity
    if (isBid) {
      // Passenger buys a seat: the driver's vehicle must still have enough seats for what the passenger needs
      const available = Number(order.remainingSeats ?? order.availableSeats ?? order.seats ?? 1);
      if (available < incomingSeats) return false;
    } else {
      // Driver sells a seat: the seats the driver offers must be >= the seats the passenger needs
      const needed = Number(order.seatsNeeded ?? order.seats ?? 1);
      const incomingAvailable = Number(incomingOrder.remainingSeats ?? incomingOrder.availableSeats ?? incomingSeats);
      if (incomingAvailable < needed) return false;
    }

    // 5. Check Time Interval Intersection: [t_D ± dt] ∩ [t_P ± dt] ≠ ∅
    const orderTargetMins = order.targetTimeMinutes ?? parseTimeToMinutes(order.targetTime);
    const orderDelta = Number(order.deltaMinutes) || 10;
    const orderInterval = order.timeInterval || buildInterval(orderTargetMins, orderDelta);

    const intersection = checkIntervalIntersection(incomingInterval, orderInterval);
    return intersection !== null;
  });

  if (candidates.length === 0) {
    // No counterparty satisfies the conditions -> the order stays in the order book with status OPEN
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

  // Sort the candidate counterparties by best fit:
  // 1. Highest trust score
  // 2. Closest time distance (|t_incoming - t_order|)
  // 3. FIFO (orders thrown onto the exchange earlier take priority)
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

  // Compute the actual pickup time at the midpoint of the intersection
  const rendezvousMinutes = calculateRendezvousTime(incomingInterval, bestInterval);
  const rendezvousTimeStr = minutesToTimeString(rendezvousMinutes);

  // Clearly determine the roles of Driver (Ask) and Passenger (Bid)
  const askOrder = isBid ? bestMatch : incomingOrder;
  const bidOrder = isBid ? incomingOrder : bestMatch;

  const seatsTraded = Number(bidOrder.seatsNeeded ?? bidOrder.seats ?? 1);
  const currentAskSeats = Number(askOrder.remainingSeats ?? askOrder.availableSeats ?? askOrder.seats ?? 3);
  const newRemainingSeats = Math.max(0, currentAskSeats - seatsTraded);

  // Generate a random 4-digit PIN code
  const pinCode = Math.floor(1000 + Math.random() * 9000).toString();

  // Update order status
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

  // Build the Event-Driven notification messages
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
 * 5. EVENT-DRIVEN NOTIFICATION EVENT TEMPLATES
 */

function buildOrderMatchedNotification({
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
      title: 'Yêu cầu đi cùng của bạn đã KHỚP THÀNH CÔNG 🎉',
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
