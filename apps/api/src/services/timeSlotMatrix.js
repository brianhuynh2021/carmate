/**
 * =============================================================================
 * MA TRẬN KHE THỜI GIAN (TIME-SLOTTED CORRIDOR MATRIX)
 * =============================================================================
 * Tâm lý khách liên tỉnh khác hẳn khách Grab: họ cần BIẾT CHẮC khung giờ để sắp
 * xếp công việc cả ngày, không thể ngồi nhìn màn hình quay đều chờ tài xế bấm
 * nhận. Vì vậy màn hình kết quả không bao giờ được để trống — kể cả khi không có
 * chuyến nào đúng giờ khách muốn.
 *
 * Ba tầng kết quả, trả về ngay lập tức trong một lần gọi:
 *
 *   🟢 CONFIRMED  Chuyến đã có thật, còn ghế — đặt là đi, chắc chắn 100%
 *   🔵 FORMING    Có xe đang chạy trên hành lang phía trên trạm đón, ETA tính
 *                 bằng phân phối ngẫu nhiên — đặt chỗ ưu tiên, hệ thống tự khoá
 *   ⚪ SHADOW     Khe dự phòng suy ra từ mật độ lịch sử — ghi nhận nhu cầu để
 *                 engine gom khớp lệnh dựng chuyến mới
 *
 * Cửa sổ quét mặc định ±30 phút quanh giờ khách muốn (theo Stiglic et al. 2015:
 * nới lỏng thời gian quanh điểm hẹn là đòn bẩy mạnh nhất để tăng tỷ lệ ghép).
 * =============================================================================
 */

import {
  getVirtualHubById,
  describeHub,
  computeAssurance,
  getAssurancePromise,
  getFixedSegmentTariff,
  projectToCorridorFrenet,
  getStationStationKm,
  computeEtaDistribution,
  etaQuantileSeconds,
  parseTimeToMinutes,
  formatMinutesToTime
} from '@carmate/shared';
import { getTrips, getUserByPhone } from '../db/sqliteStore.js';
import { getActiveCockpitSessions, getStationQueue } from './stationQueueService.js';

export const MATRIX_CONFIG = Object.freeze({
  // Cửa sổ lân cận quanh giờ khách muốn (phút)
  NEIGHBOR_WINDOW_MINUTES: 30,
  // Bề rộng mỗi khe hiển thị (phút)
  SLOT_WIDTH_MINUTES: 30,
  // Số khe dự phòng tối đa sinh thêm khi thiếu kết quả thật
  MAX_SHADOW_SLOTS: 3,
  // Ngưỡng p80 để coi một xe đang chạy là "sẽ tới trạm trong tầm với"
  MAX_FORMING_P80_MINUTES: 120
});

/**
 * Che hai ký tự cuối biển số: "93A-285.41" -> "93A-285.xx".
 * Giữ đủ phần đầu để khách nhận diện xe từ xa trên quốc lộ, nhưng không phơi
 * trọn biển số ra danh sách công khai khi chưa chốt chuyến.
 */
function maskPlateTail(plate) {
  const raw = String(plate || '').trim();
  if (!raw) return null;
  if (raw.includes('xx') || raw.includes('XX')) return raw; // đã che sẵn
  return raw.replace(/[0-9]{2}$/, 'xx');
}

/** Nhận diện biển vàng dịch vụ (sê-ri E, F hoặc cờ dịch vụ) vs biển trắng gia đình */
function detectPlateType(plate, item = {}) {
  if (item.plateType === 'yellow' || item.plateType === 'white') return item.plateType;
  if (item.isServiceVehicle === true) return 'yellow';
  const str = String(plate || '').toUpperCase();
  if (/[0-9]{2}[EFG]/.test(str.replace(/[\s.-]/g, ''))) return 'yellow';
  return 'white';
}

/** Lấy mốc phút trong ngày từ chuỗi "HH:MM" hoặc khe "HH:MM-HH:MM". */
function slotStartMinutes(timeSlot) {
  if (!timeSlot || timeSlot === 'all') return null;
  const head = String(timeSlot).split('-')[0].trim();
  // parseTimeToMinutes mặc định trả 06:15 cho chuỗi không đọc được, nên phải tự
  // kiểm định dạng HH:MM trước. Thiếu bước này thì nhãn chữ tự do ("sáng sớm")
  // sẽ bị hiển thị thành giờ khởi hành "06:15" y như thật.
  if (!/^\d{1,2}:\d{2}$/.test(head)) return null;
  const parsed = parseTimeToMinutes(head);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Khoảng cách vòng tròn giữa 2 mốc phút trong ngày (xử lý qua nửa đêm). */
function circularDistanceMinutes(a, b) {
  const raw = Math.abs(a - b);
  return Math.min(raw, 1440 - raw);
}

/**
 * Từ điển địa danh → cọc số km trên hành lang QL13.
 *
 * Chuyến xe lưu điểm đi/đến bằng chữ người dùng tự gõ ("Bù Đốp (Cây xăng
 * Petrolimex 17, QL13)", "Sài Gòn (Ngã tư Hàng Xanh)"), không phải mã trạm. Dò
 * theo tên trạm đầy đủ gần như không bao giờ khớp, nên phải dò theo địa danh.
 *
 * Xếp từ dài đến ngắn khi tra, để "ngã 4 bình phước" không bị "bình phước" nuốt mất.
 */
const CORRIDOR_PLACE_GAZETTEER = Object.freeze([
  { s: -20, names: ['bù đốp', 'bu dop'] },
  { s: 0, names: ['lộc ninh', 'loc ninh'] },
  { s: 24.5, names: ['bình long', 'binh long', 'an lộc', 'an loc'] },
  { s: 44.5, names: ['tân khai', 'tan khai', 'hớn quản', 'hon quan'] },
  { s: 51.5, names: ['minh hưng', 'minh hung'] },
  { s: 56.5, names: ['chơn thành', 'chon thanh'] },
  { s: 70, names: ['đồng xoài', 'dong xoai'] },
  { s: 84.5, names: ['bàu bàng', 'bau bang', 'mỹ phước', 'my phuoc'] },
  { s: 107, names: ['sở sao', 'so sao', 'đại nam', 'dai nam', 'thủ dầu một', 'thu dau mot'] },
  { s: 122, names: ['vsip', 'aeon', 'canary'] },
  { s: 126, names: ['lái thiêu', 'lai thieu', 'thuận an', 'thuan an'] },
  { s: 132.5, names: ['ngã 4 bình phước', 'nga 4 binh phuoc', 'ngã tư bình phước'] },
  { s: 134.5, names: ['vạn phúc', 'van phuc'] },
  { s: 137.5, names: ['bình triệu', 'binh trieu', 'miền đông', 'mien dong', 'thủ đức', 'thu duc'] },
  { s: 139.5, names: ['hàng xanh', 'hang xanh', 'bình thạnh', 'binh thanh'] },
  { s: 142.5, names: ['tân sơn nhất', 'tan son nhat', 'tsn', 'tân bình', 'tan binh', 'phạm văn đồng'] },
  // "Sài Gòn" chung chung: quy về Hàng Xanh, cửa ngõ QL13 vào thành phố
  { s: 139.5, names: ['sài gòn', 'sai gon', 'tp.hcm', 'tphcm', 'quận 1', 'quan 1', 'cống quỳnh'] }
]);

/** Dò một chuỗi địa danh tự do về cọc số km, ưu tiên tên dài (cụ thể) nhất. */
function matchPlaceToCorridorKm(raw) {
  const text = String(raw || '').toLowerCase();
  if (!text) return null;

  let bestS = null;
  let bestLen = 0;
  for (const entry of CORRIDOR_PLACE_GAZETTEER) {
    for (const name of entry.names) {
      if (name.length > bestLen && text.includes(name)) {
        bestLen = name.length;
        bestS = entry.s;
      }
    }
  }
  return bestS;
}

/**
 * Chuyến có thực sự phục vụ được chặng khách cần không?
 *
 * Bản ghi chuyến chỉ lưu `from`/`to` dạng chữ tự do ("Bù Đốp (Cây xăng
 * Petrolimex 17, QL13)"), không có mã trạm. Không đối chiếu gì thì một chuyến
 * Lộc Ninh → Tân Sơn Nhất vẫn hiện ra như "🟢 chắc chắn 100%" cho người tìm
 * chặng Bàu Bàng → Hàng Xanh — sai lệch nguy hiểm vì nó đứng ở tầng đáng tin nhất.
 *
 * Cách đối chiếu: quy cả hai đầu chuyến về cọc số s bằng từ điển địa danh, kiểm
 * tra CHIỀU ĐI khớp nhau trước, rồi mới xét chặng khách có nằm gọn trong chặng xe.
 */
function tripServesSegment(trip, originS, destS) {
  if (originS == null || destS == null) return true;

  const fromS = matchPlaceToCorridorKm(trip.from || trip.fromLocation);
  const toS = matchPlaceToCorridorKm(trip.to || trip.toLocation);

  // Không nhận ra đầu nào trên hành lang này (ví dụ chuyến Vũng Tàu, Phan Thiết):
  // KHÔNG được hiển thị ở tầng "🟢 chắc chắn 100%". Thà thiếu một kết quả còn hơn
  // mời khách lên nhầm chuyến — tầng SHADOW vẫn luôn lấp chỗ trống phía dưới.
  if (fromS == null && toS == null) return false;

  // Dung sai 8km: đầu chuyến ghi tên một địa danh gần trạm chứ không đúng trạm
  const TOLERANCE_KM = 8;

  // CHIỀU ĐI phải khớp trước tiên. Xét theo min/max là bỏ qua chiều: một chuyến
  // Bù Đốp → Sài Gòn sẽ hiện ra cho người tìm chặng Sài Gòn → Bàu Bàng, tức là
  // mời khách lên một chiếc xe chạy ngược hướng họ cần đi.
  const rideSouthbound = destS > originS;

  if (fromS != null && toS != null) {
    if (fromS === toS) return false;
    const tripSouthbound = toS > fromS;
    if (tripSouthbound !== rideSouthbound) return false;

    // Cùng chiều rồi thì chặng khách phải nằm gọn trong chặng xe
    const tripMin = Math.min(fromS, toS);
    const tripMax = Math.max(fromS, toS);
    return (
      Math.min(originS, destS) >= tripMin - TOLERANCE_KM &&
      Math.max(originS, destS) <= tripMax + TOLERANCE_KM
    );
  }

  // Chỉ dò được điểm xuất phát: khách phải lên xe ở phía sau điểm đó theo đúng chiều
  if (fromS != null) {
    return rideSouthbound ? originS >= fromS - TOLERANCE_KM : originS <= fromS + TOLERANCE_KM;
  }
  // Chỉ dò được điểm đến: khách phải xuống trước điểm đó theo đúng chiều
  return rideSouthbound ? destS <= toS + TOLERANCE_KM : destS >= toS - TOLERANCE_KM;
}

/**
 * TẦNG 1 — CHUYẾN ĐÃ CÓ THẬT (🟢 CONFIRMED)
 * Đọc từ sàn chuyến đang mở, lọc theo hành lang, chặng và cửa sổ thời gian.
 */
/**
 * Đọc lịch sử thật của chủ xe để dựng chỉ số an tâm.
 * Không có hồ sơ thì trả về null — KHÔNG bịa ra "100% đúng giờ" cho người lạ.
 */
function loadDriverHistory(trip) {
  const phone = trip?.phoneReal || trip?.driverPhone;
  if (!phone) return null;
  const user = getUserByPhone(String(phone).replace(/\D/g, ''));
  if (!user) return null;
  return {
    trustScore: Number(user.trustScore ?? 100),
    completedTrips: Number(user.completedTrips ?? trip.completedCount ?? 0),
    lateReports: Number(user.lateReports ?? 0)
  };
}

function collectConfirmedTrips({ corridor, desiredMinutes, windowMinutes, seatsNeeded, originS, destS, backupCount = 0 }) {
  const trips = getTrips({ type: 'drivers', includeHidden: false });

  // Bản ghi chuyến dùng `availableSeats` (số ghế còn trống thực tế), còn `capacity`
  // là sức chứa tổng của xe. Tra nhầm sang `seats` sẽ ra undefined và lọc rớt sạch
  // mọi chuyến thật — im lặng và rất khó phát hiện.
  const seatsOf = (t) => Number(t.availableSeats ?? t.seats ?? t.capacity ?? 0);

  return trips
    .filter((t) => {
      if (seatsOf(t) < seatsNeeded) return false;
      if (t.status && t.status !== 'active') return false;
      if (!tripServesSegment(t, originS, destS)) return false;
      if (corridor && t.routeCategory && !String(t.routeCategory).includes(corridor.replace('Tuyến ', ''))) {
        // Không khớp hành lang thì bỏ, nhưng chuyến thiếu routeCategory vẫn giữ
        // để không đánh rơi dữ liệu cũ chưa gắn nhãn tuyến.
        if (t.routeCategory) return false;
      }
      if (desiredMinutes == null) return true;

      const tripMinutes = slotStartMinutes(t.timeSlot || t.time);
      if (tripMinutes == null) return true;
      return circularDistanceMinutes(tripMinutes, desiredMinutes) <= windowMinutes;
    })
    .map((t) => {
      const tripMinutes = slotStartMinutes(t.timeSlot || t.time);
      const history = loadDriverHistory(t);
      const assurance = computeAssurance({
        baseCertainty: 1,
        trustScore: history?.trustScore ?? Number(t.rating ? t.rating * 20 : 90),
        completedTrips: history?.completedTrips ?? Number(t.completedCount || 0),
        lateReports: history?.lateReports ?? 0,
        backupCount
      });
      const label = tripMinutes != null ? formatMinutesToTime(tripMinutes) : t.timeSlot || t.time || '';
      const plateType = detectPlateType(t.plateMask || t.plate || t.licensePlate, t);
      const isService = plateType === 'yellow' || Boolean(t.isServiceVehicle);
      return {
        tier: 'CONFIRMED',
        assurance,
        promise: getAssurancePromise(assurance, label),
        badge: isService ? '🚕' : '🟢',
        tripId: t.id,
        id: t.id,
        departureLabel: tripMinutes != null ? formatMinutesToTime(tripMinutes) : t.timeSlot || t.time || '',
        departureMinutes: tripMinutes,
        departureDate: t.date || null,
        seatsAvailable: seatsOf(t),
        totalSeats: Number(t.capacity || t.seats || 4),
        driverName: t.publicName || t.authorName || t.driverName || (isService ? 'Chủ xe dịch vụ' : 'Chủ xe'),
        vehicleModel: t.carType || t.carCategory || '',
        // Biển số che 2 số cuối: đủ để khách nhận ra xe giữa dòng QL13, nhưng
        // không lộ trọn biển ra màn hình công khai trước khi chốt chuyến.
        plateMasked: maskPlateTail(t.plateMask || t.plate || t.licensePlate),
        fullPlate: t.plate || t.licensePlate || null,
        phone: t.phoneReal || t.phone || t.contactPhone || null,
        carPhotoUrl: t.carPhotoUrl || (Array.isArray(t.photos) ? t.photos[0] : null) || null,
        amenities: t.amenities || ['Không khói thuốc', 'Cốp rộng', 'Xe êm'],
        fromLocation: t.from || '',
        toLocation: t.to || '',
        plateType,
        isServiceVehicle: isService,
        charterPrice: t.charterPrice || null,
        serviceNote: t.serviceNote || (isService ? 'Xe dịch vụ tiện chuyến chiều về · Nhận đón tận ngõ' : null),
        pricePerSeat: t.basePricePerSeat || t.pricePerSeat || t.price || null,
        certainty: 1.0,
        action: 'CONFIRM_NOW',
        actionLabel: isService ? 'Giữ chỗ xe dịch vụ' : 'Xác nhận đi ngay',
        note: isService ? 'Xe dịch vụ tiện chuyến chiều về' : 'Đã chắc chắn 100%'
      };
    })
    .sort((a, b) => {
      if (desiredMinutes == null) return 0;
      const da = a.departureMinutes == null ? 999 : circularDistanceMinutes(a.departureMinutes, desiredMinutes);
      const db = b.departureMinutes == null ? 999 : circularDistanceMinutes(b.departureMinutes, desiredMinutes);
      return da - db;
    });
}

/**
 * TẦNG 2 — XE ĐANG CHẠY TRÊN HÀNH LANG (🔵 FORMING)
 *
 * Đây là tầng mà nhà xe truyền thống không thể có: hệ thống nhìn thấy xe đang
 * lăn bánh ở đâu trên trục 1D và tính bằng phân phối ngẫu nhiên xem nó sẽ tới
 * trạm đón lúc mấy giờ. Không phải lời hứa suông "chút nữa tới".
 */
function collectFormingTrips({ originHubId, seatsNeeded, nowMs, backupCount = 0 }) {
  const hubS = getStationStationKm(originHubId);
  if (hubS == null) return [];

  const sessions = getActiveCockpitSessions();
  const out = [];

  for (const session of sessions) {
    if (session.isBanned) continue;
    if (Number(session.seatsAvailable || 0) < seatsNeeded) continue;
    if (session.lat == null || session.lng == null) continue;

    const frenet = projectToCorridorFrenet(session.lat, session.lng, session.corridor);
    if (!frenet.isOnCorridor) continue;
    // Xe phải còn ở TRƯỚC trạm đón mới có chuyện sắp ghé qua
    if (frenet.s >= hubS) continue;

    const distribution = computeEtaDistribution({
      currentS: frenet.s,
      targetS: hubS,
      currentSpeedKmh: session.speed,
      nowMs
    });
    if (!distribution.valid) continue;

    const p80Seconds = etaQuantileSeconds(distribution, 0.8);
    if (p80Seconds == null || p80Seconds > MATRIX_CONFIG.MAX_FORMING_P80_MINUTES * 60) continue;

    const arriveMs = nowMs + p80Seconds * 1000;
    const arriveDate = new Date(arriveMs);

    const assurance = computeAssurance({
      // Xe đang lăn bánh thật nhưng chưa chốt lệnh: nền thấp hơn chuyến đã xác nhận
      baseCertainty: 0.8,
      trustScore: 90,
      completedTrips: 0,
      lateReports: 0,
      backupCount
    });

    const plateType = detectPlateType(session.plate, session);
    const isService = plateType === 'yellow' || Boolean(session.isServiceVehicle);

    out.push({
      tier: 'FORMING',
      badge: isService ? '🚕' : '🔵',
      assurance,
      tripId: session.tripId,
      id: session.tripId,
      departureLabel: `${String(arriveDate.getHours()).padStart(2, '0')}:${String(arriveDate.getMinutes()).padStart(2, '0')}`,
      departureMinutes: arriveDate.getHours() * 60 + arriveDate.getMinutes(),
      departureDate: arriveDate.toISOString().slice(0, 10),
      etaMs: arriveMs,
      // Bất định còn lại, để giao diện nói thật với khách thay vì giả vờ chắc chắn
      etaSigmaMinutes: Math.round(distribution.sigmaSeconds / 60),
      seatsAvailable: Number(session.seatsAvailable || 0),
      totalSeats: Number(session.capacity || 4),
      driverName: session.driverName || (isService ? 'Chủ xe dịch vụ' : 'Chủ xe'),
      vehicleModel: session.vehicleModel || '',
      plateMasked: maskPlateTail(session.plate),
      fullPlate: session.plate || null,
      phone: session.driverPhone || null,
      amenities: ['Không khói thuốc', 'Cốp rộng', 'Xe êm'],
      plateType,
      isServiceVehicle: isService,
      charterPrice: session.charterPrice || null,
      serviceNote: session.serviceNote || (isService ? 'Xe dịch vụ tiện chuyến chiều về' : null),
      distanceKm: distribution.distanceKm,
      fromLabel: frenet.closestNode?.name || '',
      certainty: 0.8,
      action: 'RESERVE_PRIORITY',
      actionLabel: isService ? 'Giữ chỗ xe dịch vụ' : 'Đặt chỗ ưu tiên',
      note: isService
        ? `Xe dịch vụ đang cách ${distribution.distanceKm}km, đón tận ngõ`
        : `Đang cách ${distribution.distanceKm}km, hệ thống tự khoá chỗ khi xe tới gần`
    });
  }

  return out.sort((a, b) => a.etaMs - b.etaMs);
}

/**
 * TẦNG 3 — KHE DỰ PHÒNG (⚪ SHADOW)
 *
 * Khi hai tầng trên không lấp đủ, sinh các khe kế tiếp để màn hình không bao giờ
 * trống. Đặt chỗ ở đây là một Ý ĐỊNH: nó chảy vào engine gom khớp lệnh, và chính
 * mật độ ý định này là thứ kéo chủ xe mở chuyến mới.
 */
function buildShadowSlots({ desiredMinutes, existingSlots, nowMs }) {
  const out = [];
  const now = new Date(nowMs);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const base = desiredMinutes != null ? desiredMinutes : nowMinutes;

  const taken = new Set(
    existingSlots
      .map((s) => s.departureMinutes)
      .filter((m) => m != null)
      .map((m) => Math.floor(m / MATRIX_CONFIG.SLOT_WIDTH_MINUTES))
  );

  for (let i = 1; out.length < MATRIX_CONFIG.MAX_SHADOW_SLOTS && i <= 6; i++) {
    const slotMinutes = (base + i * MATRIX_CONFIG.SLOT_WIDTH_MINUTES) % 1440;
    const bucket = Math.floor(slotMinutes / MATRIX_CONFIG.SLOT_WIDTH_MINUTES);
    if (taken.has(bucket)) continue;
    taken.add(bucket);

    out.push({
      tier: 'SHADOW',
      badge: '⚪',
      assurance: computeAssurance({ baseCertainty: 0.35, trustScore: 0, backupCount: 0 }),
      tripId: null,
      departureLabel: formatMinutesToTime(slotMinutes),
      departureMinutes: slotMinutes,
      seatsAvailable: null,
      certainty: 0.35,
      action: 'CREATE_INTENT',
      actionLabel: 'Đăng ký khung giờ này',
      note: 'Chuyến dự phòng — hệ thống gom nhu cầu và ghép xe cho khung này'
    });
  }

  return out;
}

/**
 * ĐIỂM VÀO CHÍNH — DỰNG MA TRẬN KẾT QUẢ.
 *
 * @param {object} params
 * @param {string} params.originHubId - Trạm đón
 * @param {string} params.destinationHubId - Trạm trả
 * @param {string} [params.timeSlot] - Khung giờ khách muốn ("08:00" hoặc "07:00-09:00")
 * @param {number} [params.seatsNeeded] - Số ghế cần
 * @param {string} [params.corridor] - Hành lang
 * @returns {object} Ma trận 3 tầng + thông tin giá
 */
export function buildTimeSlotMatrix({
  originHubId,
  destinationHubId,
  timeSlot = null,
  seatsNeeded = 1,
  corridor = 'Tuyến QL13',
  nowMs = Date.now()
} = {}) {
  const originHub = getVirtualHubById(originHubId);
  const destHub = getVirtualHubById(destinationHubId);

  if (!originHub || !destHub) {
    return {
      success: false,
      error: 'Trạm đón hoặc trạm trả không hợp lệ'
    };
  }

  const cleanSeats = Math.max(1, Math.min(4, Number(seatsNeeded) || 1));
  const desiredMinutes = slotStartMinutes(timeSlot);
  const windowMinutes = MATRIX_CONFIG.NEIGHBOR_WINDOW_MINUTES;

  const originS = getStationStationKm(originHub.id);
  const destS = getStationStationKm(destHub.id);

  // Đếm xe dự phòng THẬT trên hành lang: số xe đang lăn bánh còn đủ ghế. Đây là
  // điều kiện bắt buộc để một khe được gắn nhãn "Chuyến đảm bảo" — không có xe
  // đỡ phía sau thì không được phép hứa chắc với khách.
  const backupCount = getActiveCockpitSessions().filter(
    (s) => !s.isBanned && Number(s.seatsAvailable || 0) >= cleanSeats
  ).length;

  const confirmed = collectConfirmedTrips({
    corridor,
    desiredMinutes,
    windowMinutes,
    seatsNeeded: cleanSeats,
    originS,
    destS,
    backupCount
  });

  const forming = collectFormingTrips({
    originHubId: originHub.id,
    seatsNeeded: cleanSeats,
    nowMs,
    // Xe dự phòng cho một khe FORMING là các xe KHÁC, trừ chính nó ra
    backupCount: Math.max(0, backupCount - 1)
  });

  const realSlots = [...confirmed, ...forming];
  const shadow = buildShadowSlots({ desiredMinutes, existingSlots: realSlots, nowMs });

  // Giá tính sẵn để giao diện không phải gọi thêm lượt nào
  let tariff = null;
  try {
    tariff = getFixedSegmentTariff(originHub.id, destHub.id, corridor);
  } catch {
    tariff = null;
  }

  const queue = getStationQueue(originHub.id);

  return {
    success: true,
    // Trả về mô tả "nhân bản hoá": mốc nhận diện, tiện ích, lời dặn an toàn —
    // thứ khách thật sự cần khi phải đứng đợi ven quốc lộ lúc 4 giờ sáng.
    origin: describeHub(originHub),
    destination: describeHub(destHub),
    corridor,
    seatsNeeded: cleanSeats,
    desiredTimeLabel: desiredMinutes != null ? formatMinutesToTime(desiredMinutes) : null,
    windowMinutes,
    tariff: tariff
      ? { pricePerSeat: tariff.pricePerSeat, distanceKm: tariff.distanceKm, total: tariff.pricePerSeat * cleanSeats }
      : null,
    station: {
      waitingCount: queue.waitingCount,
      estimatedWaitMinutes: queue.estimatedWaitMinutes
    },
    backupCount,
    slots: [...confirmed, ...forming, ...shadow],
    counts: {
      confirmed: confirmed.length,
      forming: forming.length,
      shadow: shadow.length,
      total: confirmed.length + forming.length + shadow.length
    },
    // Màn hình không bao giờ được trống — bất biến của toàn bộ thiết kế này
    isEmpty: false
  };
}

/**
 * =============================================================================
 * LỊCH CHẠY TOÀN TUYẾN (CORRIDOR TIMELINE)
 * =============================================================================
 * Trả về MỌI chuyến trong ngày trên một chặng, nhóm theo buổi — không lọc theo
 * khung giờ khách chọn.
 *
 * Vì sao cần: khách chọn một khung hẹp mà không thấy xe sẽ không muốn bấm back
 * ra đổi từng giờ để dò. Họ cần nhìn toàn cảnh một lần: hôm nay và ngày mai
 * trên tuyến này có những chuyến nào.
 *
 * NGƯỠNG HIỂN THỊ: màn này chỉ có giá trị khi tuyến đã có đủ xe. Bày ra một
 * trang "lịch chạy toàn tuyến" mà chỉ có 2-3 dòng thì phơi bày sự trống trải,
 * phản tác dụng hơn hẳn một ô gom nhu cầu. Nên hàm trả về cờ `isDense` để giao
 * diện tự quyết định, thay vì hard-code ở tầng UI.
 */
export const TIMELINE_CONFIG = Object.freeze({
  // Dưới ngưỡng này thì chưa đáng mở màn lịch chạy — hiện form gom nhu cầu
  MIN_TRIPS_FOR_TIMELINE: 5,
  // Nhóm hiển thị theo buổi, khớp với DEPARTURE_WINDOWS của chip khởi hành
  PERIODS: [
    { id: 'early_morning', label: 'Sáng sớm', fromHour: 4, toHour: 8 },
    { id: 'morning', label: 'Buổi sáng', fromHour: 8, toHour: 11 },
    { id: 'noon', label: 'Buổi trưa', fromHour: 11, toHour: 14 },
    { id: 'afternoon', label: 'Buổi chiều', fromHour: 14, toHour: 18 },
    { id: 'evening', label: 'Buổi tối', fromHour: 18, toHour: 22 },
    { id: 'late_night', label: 'Đêm khuya', fromHour: 22, toHour: 28 }
  ]
});

/**
 * Dựng lịch chạy toàn tuyến cho một chặng.
 *
 * @param {object} params - Giống buildTimeSlotMatrix nhưng KHÔNG có timeSlot
 * @returns {object} { success, periods, totalTrips, isDense, origin, destination }
 */
export function buildCorridorTimeline({
  originHubId,
  destinationHubId,
  seatsNeeded = 1,
  corridor = 'Tuyến QL13',
  nowMs = Date.now()
} = {}) {
  const originHub = getVirtualHubById(originHubId);
  const destHub = getVirtualHubById(destinationHubId);
  if (!originHub || !destHub) {
    return { success: false, error: 'Trạm đón hoặc trạm trả không hợp lệ' };
  }

  const cleanSeats = Math.max(1, Math.min(4, Number(seatsNeeded) || 1));
  const originS = getStationStationKm(originHub.id);
  const destS = getStationStationKm(destHub.id);

  const backupCount = getActiveCockpitSessions().filter(
    (s) => !s.isBanned && Number(s.seatsAvailable || 0) >= cleanSeats
  ).length;

  // desiredMinutes = null nghĩa là KHÔNG lọc theo giờ: lấy hết trong ngày
  const confirmed = collectConfirmedTrips({
    corridor,
    desiredMinutes: null,
    windowMinutes: 0,
    seatsNeeded: cleanSeats,
    originS,
    destS,
    backupCount
  });

  const forming = collectFormingTrips({
    originHubId: originHub.id,
    seatsNeeded: cleanSeats,
    nowMs,
    backupCount: Math.max(0, backupCount - 1)
  });

  const all = [...confirmed, ...forming].sort(
    (a, b) => (a.departureMinutes ?? 9999) - (b.departureMinutes ?? 9999)
  );

  // Nhóm theo buổi; buổi nào không có chuyến vẫn giữ lại để khách thấy rõ
  // khoảng trống và biết nên đăng nhu cầu vào đâu.
  const periods = TIMELINE_CONFIG.PERIODS.map((p) => {
    const trips = all.filter((t) => {
      const m = t.departureMinutes;
      if (m == null) return false;
      const startM = p.fromHour * 60;
      const endM = p.toHour * 60;
      // Buổi đêm vắt qua nửa đêm (22h-4h)
      return p.toHour > 24 ? m >= startM || m < endM - 1440 : m >= startM && m < endM;
    });
    return {
      id: p.id,
      label: p.label,
      hint: `${p.fromHour % 24}h-${p.toHour % 24}h`,
      fromHour: p.fromHour,
      trips,
      count: trips.length
    };
  });

  let tariff = null;
  try {
    tariff = getFixedSegmentTariff(originHub.id, destHub.id, corridor);
  } catch {
    tariff = null;
  }

  return {
    success: true,
    origin: describeHub(originHub),
    destination: describeHub(destHub),
    corridor,
    seatsNeeded: cleanSeats,
    periods,
    totalTrips: all.length,
    // Cờ quyết định giao diện hiện màn lịch hay ô gom nhu cầu
    isDense: all.length >= TIMELINE_CONFIG.MIN_TRIPS_FOR_TIMELINE,
    minTripsForTimeline: TIMELINE_CONFIG.MIN_TRIPS_FOR_TIMELINE,
    tariff: tariff ? { pricePerSeat: tariff.pricePerSeat, distanceKm: tariff.distanceKm } : null
  };
}
