/**
 * carmate - personaMemory.js
 *
 * Engine Học Thói Quen Cục Bộ (Zero-LLM, Edge Intelligence)
 * Kế thừa tinh thần MIT (Scoring toán học), Stanford (Zero cognitive burden), và Cursor (Predictive UX)
 *
 * "CÀNG DÙNG CÀNG HIỂU":
 * - Tự động ghi nhớ thói quen lộ trình, điểm đón, khung giờ của Chủ xe và Khách đi cùng.
 * - Tự động lưu hồ sơ xe & ảnh xe thật chính chủ để Chủ xe không phải chụp/tải lại ảnh mỗi chuyến.
 * - Dự đoán chuyến quen thuộc tiếp theo theo thời gian thực (Context-Aware).
 * - Định giá chia sẻ xăng hợp lý theo cự ly thực tế (Route Price Intelligence).
 */

import { ROUTE_BENCHMARKS, findLocationCoords, calculateDistanceKm } from '@carmate/shared';

const STORAGE_KEY = 'carmate_persona_memory_v1';

function isStorageAvailable() {
  return typeof localStorage !== 'undefined';
}

/**
 * Đọc toàn bộ bộ nhớ thói quen từ localStorage
 */
export function getPersonaMemory() {
  if (!isStorageAvailable()) {
    return { driver: { routes: [] }, passenger: { routes: [] } };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { driver: { routes: [] }, passenger: { routes: [] } };
    return JSON.parse(raw);
  } catch {
    return { driver: { routes: [] }, passenger: { routes: [] } };
  }
}

/**
 * Lưu bộ nhớ thói quen vào localStorage
 */
function savePersonaMemory(mem) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
  } catch (e) {
    console.warn('[personaMemory] Không thể lưu bộ nhớ thói quen:', e);
  }
}

/**
 * Ghi nhận chuyến đi thành công để học thói quen (Recency & Frequency scoring theo MIT Invariants)
 */
export function recordTripPattern(tripPayload) {
  if (!tripPayload || !tripPayload.from || !tripPayload.to) return;
  const mem = getPersonaMemory();
  const role = tripPayload.type === 'passenger_request' ? 'passenger' : 'driver';

  if (!mem[role]) mem[role] = { routes: [] };
  if (!Array.isArray(mem[role].routes)) mem[role].routes = [];

  const cleanFrom = tripPayload.from.trim();
  const cleanTo = tripPayload.to.trim();
  const now = Date.now();

  // Tìm lộ trình đã có trong lịch sử (không phân biệt hoa thường)
  const existingIdx = mem[role].routes.findIndex(
    (r) => r.from?.toLowerCase() === cleanFrom.toLowerCase() && r.to?.toLowerCase() === cleanTo.toLowerCase()
  );

  const routeItem = {
    from: cleanFrom,
    to: cleanTo,
    count: existingIdx !== -1 ? (mem[role].routes[existingIdx].count || 1) + 1 : 1,
    lastUsed: now,
    timeSlot: tripPayload.timeSlot || '07:00-09:00',
    exactTime: tripPayload.exactTime || '',
    price: tripPayload.basePricePerSeat || tripPayload.price || 150000,
    seats: tripPayload.availableSeats || tripPayload.seatsNeeded || tripPayload.seats || 1,
    waypointNote: tripPayload.waypointNote || '',
    vehicleCapacity: tripPayload.capacity || 5,
    carCategory: tripPayload.carCategory || 'family_car',
    carType: tripPayload.carType || 'Toyota Vios (Xe 5 chỗ)'
  };

  if (existingIdx !== -1) {
    mem[role].routes[existingIdx] = routeItem;
  } else {
    mem[role].routes.push(routeItem);
  }

  // MIT Recency-Frequency decay scoring
  mem[role].routes.sort((a, b) => {
    const ageA = (now - (a.lastUsed || 0)) / (86400000 * 7); // tuần
    const ageB = (now - (b.lastUsed || 0)) / (86400000 * 7);
    const scoreA = (a.count || 1) / (1 + ageA);
    const scoreB = (b.count || 1) / (1 + ageB);
    return scoreB - scoreA;
  });

  // Giới hạn 10 lộ trình quen thuộc nhất
  mem[role].routes = mem[role].routes.slice(0, 10);

  // Lưu hồ sơ xe và ảnh xe thật chính chủ nếu là Chủ xe
  if (role === 'driver') {
    const validPhotos = (tripPayload.carPhotos || []).filter(Boolean);
    mem.driver.carProfile = {
      vehicleCapacity: tripPayload.capacity || 5,
      carType: tripPayload.carType || 'Toyota Vios (Xe 5 chỗ)',
      carCategory: tripPayload.carCategory || 'family_car',
      // Chỉ lưu ảnh nếu Chủ xe có upload ảnh thật
      carPhotos: validPhotos.length >= 3 ? validPhotos : mem.driver.carProfile?.carPhotos || [],
      lastUpdated: now
    };

    // Lưu các tiện ích quen thuộc của Chủ xe
    mem.driver.habitualPerks = {
      perks: tripPayload.perks || []
    };
  } else {
    // Lưu tiện ích quen thuộc của hành khách
    mem.passenger.habitualPerks = {
      perks: tripPayload.perks || []
    };
  }

  savePersonaMemory(mem);
}

/**
 * Trả về chuyến quen thuộc được dự đoán cao nhất cho vai trò hiện tại
 */
export function getTopPredictedTrip(role = 'driver') {
  const mem = getPersonaMemory();
  const roleMem = mem[role];
  if (!roleMem || !Array.isArray(roleMem.routes) || roleMem.routes.length === 0) {
    return null;
  }

  const topRoute = roleMem.routes[0];
  const carProfile = role === 'driver' ? roleMem.carProfile : null;
  const habitualPerks = roleMem.habitualPerks?.perks || [];

  return {
    ...topRoute,
    carProfile,
    habitualPerks,
    confidence: topRoute.count >= 3 ? 'high' : topRoute.count >= 2 ? 'medium' : 'low'
  };
}

/**
 * Dự đoán Lộ Trình Ma (Ghost Route - Phong cách Cursor Tab)
 * Kết hợp bộ nhớ lịch sử cá nhân (Recency/Frequency) với ngữ cảnh thời gian thực
 * (Thứ trong tuần + Khung giờ sáng/chiều) để đưa tải nhận thức của người dùng về 0.
 */
export function getContextualGhostRoute(role = 'passenger') {
  // 1. Nếu có trong lịch sử bộ nhớ cá nhân, ưu tiên số 1
  const remembered = getTopPredictedTrip(role);
  if (remembered) {
    return {
      ...remembered,
      isPersonalHistory: true,
      hintLabel: `${remembered.from} ➔ ${remembered.to}`
    };
  }

  // 2. Dự đoán thông minh bản địa theo thời gian thực (Zero-LLM Edge Intelligence)
  const now = new Date();
  const day = now.getDay(); // 0: Chủ Nhật, 1: Thứ 2, ..., 5: Thứ 6, 6: Thứ 7
  const hour = now.getHours();

  // Sáng thứ 2 hoặc các buổi sáng đi làm (05h - 10h): Hải Phòng / Quảng Ninh đi Hà Nội
  if (hour >= 5 && hour < 11) {
    return {
      from: 'Hải Phòng',
      to: 'Hà Nội',
      timeSlot: '07:00-09:00',
      exactTime: '07:30',
      price: 150000,
      seats: role === 'driver' ? 3 : 1,
      isPersonalHistory: false,
      confidence: 'high',
      reason: day === 1 ? 'Đầu tuần đi làm' : 'Đi làm sáng sớm',
      hintLabel: 'Hải Phòng ➔ Hà Nội (07:30)'
    };
  }

  // Chiều thứ 6 hoặc cuối tuần về quê (14h - 21h): Hà Nội về Hải Phòng hoặc Sài Gòn đi Vũng Tàu
  if ((day === 5 && hour >= 14) || day === 6) {
    return {
      from: 'Hà Nội',
      to: 'Hải Phòng',
      timeSlot: '17:00-19:00',
      exactTime: '17:30',
      price: 150000,
      seats: role === 'driver' ? 3 : 1,
      isPersonalHistory: false,
      confidence: 'high',
      reason: 'Cuối tuần về quê',
      hintLabel: 'Hà Nội ➔ Hải Phòng (17:30)'
    };
  }

  // Chiều Chủ Nhật (13h - 21h): Trở lại thủ đô / trung tâm
  if (day === 0 && hour >= 13) {
    return {
      from: 'Hải Phòng',
      to: 'Hà Nội',
      timeSlot: '17:00-19:00',
      exactTime: '17:00',
      price: 150000,
      seats: role === 'driver' ? 3 : 1,
      isPersonalHistory: false,
      confidence: 'high',
      reason: 'Trở lại thủ đô',
      hintLabel: 'Hải Phòng ➔ Hà Nội (17:00)'
    };
  }

  // Mặc định hành lang cao tốc huyết mạch
  return {
    from: 'Hà Nội',
    to: 'Hải Phòng',
    timeSlot: '07:00-09:00',
    exactTime: '08:00',
    price: 150000,
    seats: role === 'driver' ? 3 : 1,
    isPersonalHistory: false,
    confidence: 'medium',
    reason: 'Cao tốc HN - HP',
    hintLabel: 'Hà Nội ➔ Hải Phòng (08:00)'
  };
}

/**
 * Lấy hồ sơ xe và ảnh thật đã xác thực của Chủ xe từ các lần đăng trước
 */
export function getLastUsedCarProfile() {
  const mem = getPersonaMemory();
  const car = mem.driver?.carProfile;
  if (!car) return null;
  const validPhotos = (car.carPhotos || []).filter(Boolean);
  return {
    vehicleCapacity: car.vehicleCapacity || 5,
    carType: car.carType || 'Toyota Vios (Xe 5 chỗ)',
    carCategory: car.carCategory || 'family_car',
    carPhotos: validPhotos,
    hasVerifiedPhotos: validPhotos.length >= 3
  };
}

/**
 * Lấy danh sách điểm đón quen thuộc (Waypoints) giữa 2 địa danh
 */
export function getFrequentWaypoints(from, to, role = 'driver') {
  const mem = getPersonaMemory();
  const routes = mem[role]?.routes || [];
  const cleanFrom = (from || '').toLowerCase().trim();
  const cleanTo = (to || '').toLowerCase().trim();

  const matched = routes.find((r) => r.from.toLowerCase().includes(cleanFrom) && r.to.toLowerCase().includes(cleanTo));

  return matched?.waypointNote || '';
}

/**
 * Định giá phụ xăng thông minh dựa trên cự ly km thực tế và phí cầu đường
 * Xử lý cục bộ 100% trong 0.1ms theo chuẩn toán học MIT Invariants
 */
export function getDynamicRoutePriceBenchmark(fromLocation, toLocation) {
  const cleanFrom = (fromLocation || '').toLowerCase().trim();
  const cleanTo = (toLocation || '').toLowerCase().trim();

  if (!cleanFrom || !cleanTo) {
    return {
      suggestedPrice: 150000,
      quickPresets: [100000, 140000, 150000, 200000],
      distanceKm: null,
      note: 'Mức phụ xăng phổ thông'
    };
  }

  // 1. Đối chiếu trực tiếp với kho benchmark tuyến chính thức
  for (const key of Object.keys(ROUTE_BENCHMARKS)) {
    const bm = ROUTE_BENCHMARKS[key];
    const kw = (bm.keyword || '').toLowerCase();
    if (
      cleanFrom.includes(kw) ||
      cleanTo.includes(kw) ||
      (bm.shortName && (cleanFrom.includes(bm.shortName.toLowerCase()) || cleanTo.includes(bm.shortName.toLowerCase())))
    ) {
      const rate = bm.suggestedRate || 150000;
      const step = rate >= 150000 ? 20000 : 10000;
      return {
        suggestedPrice: rate,
        quickPresets: [
          Math.max(bm.minSafePrice || 50000, rate - step * 2),
          Math.max(bm.minSafePrice || 50000, rate - step),
          rate,
          Math.min(bm.maxSafePrice || 350000, rate + step)
        ],
        distanceKm: bm.distanceKm,
        fuelCost: bm.fuelCost,
        botFee: bm.botFee,
        note: `Tuyến ~${bm.distanceKm}km (${bm.botFee ? 'đã gồm phí cầu đường' : 'tiêu chuẩn'})`
      };
    }
  }

  // 2. Tính toán theo tọa độ địa lý thực tế (Geo Haversine x Đường bộ 1.28)
  const c1 = findLocationCoords(cleanFrom);
  const c2 = findLocationCoords(cleanTo);

  if (c1 && c2) {
    const straightKm = calculateDistanceKm(c1.lat, c1.lng, c2.lat, c2.lng);
    const roadKm = Math.round(straightKm * 1.28); // Hệ số uốn lượn đường bộ Việt Nam

    let rate = 150000;
    let presets = [100000, 140000, 150000, 180000];

    if (roadKm <= 40) {
      // Tuyến ngắn nội vùng (VD: Biên Hòa - Sài Gòn, Dĩ An - Tân Bình ~25-35km)
      rate = 60000;
      presets = [50000, 60000, 70000, 80000];
    } else if (roadKm <= 80) {
      // Tuyến trung bình ngắn (VD: Thủ Dầu Một - Sài Gòn, Long An - Sài Gòn ~50-70km)
      rate = 90000;
      presets = [70000, 80000, 90000, 110000];
    } else if (roadKm <= 130) {
      // Tuyến trung bình (VD: Vũng Tàu - Sài Gòn, Tây Ninh - Sài Gòn ~90-120km)
      rate = 140000;
      presets = [110000, 130000, 140000, 160000];
    } else if (roadKm <= 180) {
      // Tuyến đường dài (VD: Bù Đốp - Sài Gòn, Đồng Xoài - Sài Gòn ~140-160km)
      rate = 160000;
      presets = [130000, 150000, 160000, 180000];
    } else if (roadKm <= 260) {
      // Tuyến liên tỉnh xa (VD: Phan Thiết - Sài Gòn, Đà Lạt - Sài Gòn ~200-250km)
      rate = 200000;
      presets = [160000, 180000, 200000, 240000];
    } else {
      // Tuyến rất xa (> 300km)
      rate = Math.round((roadKm * 900) / 10000) * 10000;
      presets = [rate - 30000, rate - 10000, rate, rate + 40000];
    }

    return {
      suggestedPrice: rate,
      quickPresets: presets,
      distanceKm: roadKm,
      note: `Cự ly ước tính ~${roadKm}km`
    };
  }

  // Fallback an toàn
  return {
    suggestedPrice: 150000,
    quickPresets: [100000, 140000, 150000, 200000],
    distanceKm: null,
    note: 'Định mức phụ xăng gợi ý'
  };
}

/**
 * Tính toán chuyến về (Khứ hồi) thông minh theo quy chuẩn thời gian di chuyển
 */
export function computePredictedReturnTrip(tripPayload) {
  if (!tripPayload) return null;

  const from = tripPayload.to || '';
  const to = tripPayload.from || '';
  const departureSlot = tripPayload.timeSlot || '07:00-09:00';

  // Dự đoán khung giờ về hợp lý
  let returnSlot = '17:00-19:00';
  let returnExactTime = '';

  if (departureSlot.startsWith('03:00') || departureSlot.startsWith('05:00') || departureSlot.startsWith('07:00')) {
    // Đi sáng sớm (05h - 08h) -> Khám bệnh, công tác, xong việc về chiều tối (16h - 18h)
    returnSlot = '17:00-19:00';
    returnExactTime = '17:30';
  } else if (
    departureSlot.startsWith('09:00') ||
    departureSlot.startsWith('11:00') ||
    departureSlot.startsWith('13:00')
  ) {
    // Đi trưa chiều -> Về tối muộn hoặc sáng hôm sau
    returnSlot = '19:00-21:00';
    returnExactTime = '19:30';
  } else {
    // Đi tối đêm -> Về sáng hôm sau
    returnSlot = '07:00-09:00';
    returnExactTime = '07:30';
  }

  return {
    from,
    to,
    timeSlot: returnSlot,
    exactTime: returnExactTime,
    scheduleDay: 'Hôm nay',
    seats:
      tripPayload.availableSeats ||
      tripPayload.seatsNeeded ||
      tripPayload.seats ||
      (tripPayload.type === 'passenger_request' ? 1 : 3),
    price: tripPayload.basePricePerSeat || tripPayload.price || 150000,
    capacity: tripPayload.capacity || 5,
    carType: tripPayload.carType || 'Toyota Vios (Xe 5 chỗ)',
    carCategory: tripPayload.carCategory || 'family_car',
    carPhotos: tripPayload.carPhotos || [],
    hasCarPhotos: Boolean(tripPayload.hasCarPhotos),
    phoneReal: tripPayload.phoneReal || ''
  };
}

/**
 * Xoá sạch bộ nhớ thói quen (Dùng cho kiểm thử hoặc tuỳ chọn riêng tư)
 */
export function clearPersonaMemory() {
  if (!isStorageAvailable()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[personaMemory] Lỗi khi xoá bộ nhớ thói quen:', e);
  }
}
