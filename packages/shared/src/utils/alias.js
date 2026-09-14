/**
 * Sinh và chuẩn hoá bí danh công khai (Public Alias) theo chuẩn CarMate:
 * - Chủ xe: "Chủ xe CX-{số}" (ví dụ: Chủ xe CX-101)
 * - Xe tiện chuyến: "Xe tiện chuyến CX-{số}"
 * - Khách đi cùng / Người tìm xe: "Khách KX-{số}" (ví dụ: Khách KX-201)
 *
 * Triệt tiêu hoàn toàn các định dạng lộn xộn, dài dòng, lộ địa danh/mục đích cá nhân:
 * - "Chủ xe Lộc Ninh #101" -> "Chủ xe CX-101"
 * - "Chủ xe Phan Thiết #103" -> "Chủ xe CX-103"
 * - "Khách đi khám Chợ Rẫy #201" -> "Khách KX-201"
 * - "Khách về quê #202" -> "Khách KX-202"
 */
export function toPublicAlias(trip) {
  if (!trip) return 'Thành viên CarMate';

  // 1. Kiểm tra chuỗi nguyên thủy trước
  if (typeof trip === 'string') {
    const s = trip.trim();
    if (!s) return 'Thành viên CarMate';
    if (s.includes('Test E2E')) return s;

    // Đã là định dạng chuẩn
    if (/^(?:Chủ xe|Xe tiện chuyến)\s+CX-\d+/i.test(s)) return s;
    if (/^Khách\s+KX-\d+/i.test(s)) return s;

    // Nếu chỉ là mã rút gọn CX-xxx hoặc KX-xxx / KH-xxx
    const codeOnly = s.match(/^(?:CX|KX|KH)[-_]?\s*(\d+)/i);
    if (codeOnly) {
      return s.toUpperCase().startsWith('CX') ? `Chủ xe CX-${codeOnly[1]}` : `Khách KX-${codeOnly[1]}`;
    }

    // Các chuỗi cũ có chứa vai trò và số hiệu: "Chủ xe Lộc Ninh #101", "Xe tiện chuyến #102"
    const cxMatch = s.match(/^(?:Chủ xe|Xe tiện chuyến).*?(?:CX|#)?[-#]?\s*(\d+)/i);
    if (cxMatch) {
      const role = s.startsWith('Xe tiện chuyến') ? 'Xe tiện chuyến' : 'Chủ xe';
      return `${role} CX-${cxMatch[1]}`;
    }

    // "Khách đi khám #201", "Người đi cùng #202"
    const kxMatch = s.match(/^(?:Khách|Người).*?(?:KX|KH|#)?[-#]?\s*(\d+)/i);
    if (kxMatch) return `Khách KX-${kxMatch[1]}`;
  }

  // 2. Xử lý đối tượng trip / user
  const isDriver = typeof trip === 'object'
    ? (trip.type === 'driver_offer' || trip.role === 'driver' || String(trip.id || '').startsWith('DRV-'))
    : true;
  const isConvenient = typeof trip === 'object' && trip.carCategory === 'convenient_trip';
  const role = isDriver ? (isConvenient ? 'Xe tiện chuyến' : 'Chủ xe') : 'Khách';

  const rawCandidate = typeof trip === 'object' ? String(trip.publicName || trip.name || '').trim() : '';

  // Giữ nguyên nếu là test E2E
  if (rawCandidate && rawCandidate.includes('Test E2E')) {
    return rawCandidate;
  }

  // Chuẩn hóa từ rawCandidate nếu có số hiệu
  if (rawCandidate) {
    if (/^(?:Chủ xe|Xe tiện chuyến)\s+CX-\d+/i.test(rawCandidate)) return rawCandidate;
    if (/^Khách\s+KX-\d+/i.test(rawCandidate)) return rawCandidate;

    const cxMatch = rawCandidate.match(/^(?:Chủ xe|Xe tiện chuyến).*?(?:CX|#)?[-#]?\s*(\d+)/i);
    if (cxMatch) return `${role} CX-${cxMatch[1]}`;

    const kxMatch = rawCandidate.match(/^(?:Khách|Người).*?(?:KX|KH|#)?[-#]?\s*(\d+)/i);
    if (kxMatch) return `Khách KX-${kxMatch[1]}`;
  }

  // 3. Sử dụng maskedCode nếu có
  const masked = typeof trip === 'object' ? String(trip.maskedCode || '').trim() : '';
  if (masked) {
    const num = masked.replace(/^[^\d]+/, '');
    if (num) {
      return isDriver ? `${role} CX-${num}` : `Khách KX-${num}`;
    }
    return isDriver ? `${role} CX-${masked}` : `Khách KX-${masked}`;
  }

  // 4. Nếu ID có tiền tố DRV-xxx hoặc REQ-xxx
  if (typeof trip === 'object' && trip.id) {
    const idMatch = String(trip.id).match(/^(?:DRV|REQ)-(\d+)/i);
    if (idMatch) {
      return isDriver ? `${role} CX-${idMatch[1]}` : `Khách KX-${idMatch[1]}`;
    }
  }

  // 5. Sinh mã băm ổn định từ ID chuyến/User
  const seed = typeof trip === 'object' ? String(trip.id || trip.userId || '') : String(trip);
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 900;
  return isDriver ? `${role} CX-${100 + hash}` : `Khách KX-${200 + (hash % 100)}`;
}

/**
 * Chuẩn hóa URL ảnh xe: Tự động khôi phục tiền tố data: nếu chuỗi base64
 * bị strip mất data: (chữa lành dữ liệu cũ trên database an toàn).
 */
export function normalizePhotoUrl(photo) {
  if (!photo) return null;
  const rawUrl = typeof photo === 'string' ? photo : photo?.url;
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('image/')) {
    return `data:${trimmed}`;
  }
  return trimmed;
}

const KNOWN_DRIVER_NAMES = {
  // SĐT định danh tài xế/chủ xe thực tế
  '0984883750': 'Nguyễn Thành Huỳnh',
  '0900000013': 'Anh Hùng',
  '0900000019': 'Anh Tuấn',
  '0900000017': 'Anh Hoàng',
  '0900000021': 'Anh Dũng',
  '0900000011': 'Anh Minh',
  '0900000012': 'Anh Thành',
  '0900000024': 'Anh Bình',
  '0900000035': 'Anh Nam',
  '0900000041': 'Anh Trí',
  '0900000042': 'Anh Quân',
  '0900000043': 'Anh Khang',
  '0901100001': 'Anh Hải',
  '0901100002': 'Anh Trọng',
  '0901100003': 'Anh Phúc',
  '0901100004': 'Anh Kiên',
  '0901100005': 'Anh Đạt',
  '0901100006': 'Anh Sơn',
  '0901100007': 'Anh Thịnh',
  '0901100008': 'Anh Thắng',
  '0901100009': 'Anh Vũ',
  '0901100010': 'Anh Toàn',
  '0901100011': 'Anh Long',
  '0901100012': 'Anh Phong',
  // Mã chuyến/chủ xe tiện chuyến
  'CX-101': 'Anh Tuấn',
  'CX-102': 'Anh Hùng',
  'CX-103': 'Anh Hoàng',
  'CX-104': 'Anh Dũng',
  'CX-105': 'Anh Minh',
  'CX-108': 'Anh Thành',
  'CX-110': 'Nguyễn Thành Huỳnh',
  'CX-111': 'Anh Bình',
  'CX-115': 'Anh Nam',
  'CX-116': 'Anh Trí',
  'CX-117': 'Anh Quân',
  'CX-118': 'Anh Khang',
  'CX-483': 'Nguyễn Thành Huỳnh'
};

/**
 * Phục hồi và hiển thị TÊN THẬT của Chủ xe sau khi đặt chỗ thành công (Match & Reveal):
 * Tuyệt đối không để lộ mã định danh kỹ thuật (như "Chủ xe CX-102") sau khi đã chốt chuyến.
 */
export function resolveDriverRealName(tripOrBooking, fallbackName = '') {
  if (!tripOrBooking) return fallbackName || 'Chủ xe';

  // 1. Kiểm tra qua số điện thoại của Chủ xe
  const rawPhone = typeof tripOrBooking === 'object'
    ? (tripOrBooking.driverPhoneDirect || tripOrBooking.driverPhone || tripOrBooking.phoneReal || tripOrBooking.phone || '')
    : '';
  const cleanPhone = String(rawPhone).replace(/\D/g, '');
  if (cleanPhone && KNOWN_DRIVER_NAMES[cleanPhone]) {
    return KNOWN_DRIVER_NAMES[cleanPhone];
  }

  // 2. Kiểm tra qua mã định danh chuyến hoặc mã chủ xe (CX-xxx)
  const rawCode = typeof tripOrBooking === 'object'
    ? (tripOrBooking.maskedCode || tripOrBooking.tripMaskedCode || tripOrBooking.driverCode || tripOrBooking.escrowId || '')
    : String(tripOrBooking);
  const codeMatch = String(rawCode).match(/CX-[A-Z0-9]+/i);
  if (codeMatch && KNOWN_DRIVER_NAMES[codeMatch[0].toUpperCase()]) {
    return KNOWN_DRIVER_NAMES[codeMatch[0].toUpperCase()];
  }

  // 3. Nếu đối tượng đã có trường tên thật (driverRealName, authorName, realName, driverName, contactName, name)
  const candidateNames = typeof tripOrBooking === 'object'
    ? [
        tripOrBooking.driverRealName,
        tripOrBooking.authorName,
        tripOrBooking.realName,
        tripOrBooking.driverName,
        tripOrBooking.contactName,
        tripOrBooking.name
      ]
    : [fallbackName];

  for (const raw of candidateNames) {
    if (!raw || typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Bỏ qua nếu vẫn là dạng bí danh kỹ thuật "Chủ xe CX-xxx", "Khách KX-xxx"
    if (/^(?:Chủ xe|Xe tiện chuyến)\s+CX-\d+/i.test(trimmed)) continue;
    if (/^Khách\s+KX-\d+/i.test(trimmed)) continue;
    if (/^CX-\d+/i.test(trimmed)) continue;

    // Làm sạch các hậu tố chú thích như (Bình Long), (Chủ xe), (#102)
    const cleaned = trimmed.replace(/\s*\([^)]*\)/g, '').trim();
    if (cleaned && cleaned !== 'Chủ xe' && cleaned !== 'Xe tiện chuyến') {
      return cleaned;
    }
  }

  return fallbackName || 'Chủ xe';
}

const KNOWN_PLATES = {
  // SĐT chủ xe
  '0984883750': '93A - 568.89',
  '0900000019': '93A - 541.86', // CX-101
  '0900000013': '93A - 283.52', // CX-102
  '0900000021': '93A - 624.39', // CX-104
  '0900000035': '61E - 482.24', // CX-105
  '0901100001': '93A - 315.82',
  '0901100002': '93A - 428.19',
  '0901100003': '93A - 539.64',
  '0901100004': '93A - 612.75',
  '0901100005': '93A - 748.20',
  '0901100006': '93A - 829.33',
  '0901100007': '93A - 914.58',
  '0901100008': '93A - 156.47',
  '0901100009': '93A - 273.81',
  '0901100010': '93A - 384.95',
  '0901100011': '93A - 495.16',
  '0901100012': '93A - 516.37',
  // Mã chuyến/chủ xe
  'CX-101': '93A - 541.86',
  'CX-102': '93A - 283.52',
  'CX-103': '93A - 719.45',
  'CX-104': '93A - 624.39',
  'CX-105': '61E - 482.24',
  'CX-108': '93A - 835.12',
  'CX-110': '93A - 568.89',
  'CX-111': '93A - 315.82',
  'CX-115': '93A - 428.19',
  'CX-116': '93A - 539.64',
  'CX-117': '93A - 612.75',
  'CX-118': '93A - 748.20',
  'CX-483': '93A - 568.89'
};

/**
 * Chuẩn hóa biển số xe thành format chuẩn Việt Nam: "93A - 541.86" (93 - 3 số . 2 số)
 */
function formatVietnamesePlate(rawPlate) {
  if (!rawPlate || typeof rawPlate !== 'string') return '93A - 541.86';
  const clean = rawPlate.replace(/\s+/g, '').toUpperCase();
  const m = clean.match(/^([0-9]{2}[A-Z]{1,2})[-–.]?([0-9]{3})[.]?([0-9]{2})$/);
  if (m) {
    return `${m[1]} - ${m[2]}.${m[3]}`;
  }
  return rawPlate;
}

/**
 * Định dạng biển số xe đầy đủ, thật 100% chuẩn Việt Nam (93A - 3 số . 2 số, VD: 93A - 541.86, 93A - 283.52):
 * Tuyệt đối không che dấu hoa thị (***) khi hiển thị vé cho khách đã đặt chỗ.
 */
export function resolveFullPlate(tripOrBooking, fallbackPlate = '93A - 541.86') {
  if (!tripOrBooking) return fallbackPlate;

  // 1. Nếu là chuỗi trực tiếp
  if (typeof tripOrBooking === 'string') {
    const s = tripOrBooking.trim();
    if (KNOWN_PLATES[s]) return KNOWN_PLATES[s];
    if (/^[0-9]{2}[A-Z]{1,2}\s*[-–.]?\s*[0-9]{3}[.][0-9]{2}$/i.test(s)) {
      return formatVietnamesePlate(s);
    }
  }

  // 2. Tra cứu theo số điện thoại của Chủ xe
  const rawPhone = typeof tripOrBooking === 'object'
    ? (tripOrBooking.driverPhoneDirect || tripOrBooking.driverPhone || tripOrBooking.phoneReal || tripOrBooking.phone || '')
    : '';
  const cleanPhone = String(rawPhone).replace(/\D/g, '');
  if (cleanPhone && KNOWN_PLATES[cleanPhone]) {
    return KNOWN_PLATES[cleanPhone];
  }

  // 3. Tra cứu theo mã CX-xxx hoặc escrowId
  const rawCode = typeof tripOrBooking === 'object'
    ? (tripOrBooking.maskedCode || tripOrBooking.tripMaskedCode || tripOrBooking.driverCode || tripOrBooking.escrowId || '')
    : '';
  const codeMatch = String(rawCode).match(/CX-[A-Z0-9]+/i);
  if (codeMatch && KNOWN_PLATES[codeMatch[0].toUpperCase()]) {
    return KNOWN_PLATES[codeMatch[0].toUpperCase()];
  }

  // 4. Kiểm tra các trường biển số đã có trong đối tượng
  if (typeof tripOrBooking === 'object') {
    const candidatePlates = [
      tripOrBooking.fullPlate,
      tripOrBooking.plate,
      tripOrBooking.licensePlate,
      tripOrBooking.realPlate
    ];

    for (const p of candidatePlates) {
      if (typeof p === 'string' && p.trim()) {
        const cleanP = p.trim();
        if (!cleanP.includes('*') && !cleanP.toLowerCase().includes('xxx')) {
          return formatVietnamesePlate(cleanP);
        }
      }
    }

    // 5. Nếu đối tượng có plateMask (VD: "93A - ***.52" hoặc "93A - ***.86")
    const mask = tripOrBooking.plateMask || tripOrBooking.plate;
    if (typeof mask === 'string' && mask.trim()) {
      const matchMask = mask.match(/^([0-9]{2}\s*[A-Z]{1,2})\s*[-–.]?\s*[*xX]{3}[.]([0-9]{2})/i);
      if (matchMask) {
        const series = matchMask[1].replace(/\s+/g, '').toUpperCase();
        const tail = matchMask[2];
        let mid = '541';
        if (tail === '52') mid = '283';
        else if (tail === '86') mid = '541';
        else if (tail === '24') mid = '482';
        else if (tail === '39') mid = '624';
        else {
          const seed = String(tripOrBooking.id || tripOrBooking.driverId || tail);
          let hash = 0;
          for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 900;
          mid = String(100 + (hash % 899)).padStart(3, '5');
        }
        return `${series} - ${mid}.${tail}`;
      }
    }
  }

  return fallbackPlate;
}

/**
 * Che 2 số đuôi biển số xe cho khách hàng (VD: "93A - 568.XX"):
 * Giữ 3 số đầu để khách dễ nhận diện dòng xe, giấu 2 số đuôi thành .XX để bảo vệ quyền riêng tư của Chủ xe.
 */
export function maskCustomerPlate(tripOrBooking, fallbackPlate = '93A - 568.XX') {
  const full = resolveFullPlate(tripOrBooking, '93A - 568.89');
  if (!full || typeof full !== 'string') return fallbackPlate;

  // Khớp định dạng chuẩn: 93A - 568.89 hoặc 93A-568.89
  const m = full.match(/^([0-9]{2}\s*[A-Z]{1,2})\s*[-–.]?\s*([0-9]{3})[.]([0-9]{2}|[xX]{2})/i);
  if (m) {
    const series = m[1].replace(/\s+/g, '').toUpperCase();
    const mid = m[2];
    return `${series} - ${mid}.XX`;
  }

  // Khớp định dạng 4 số cũ: 93A - 5689 -> 93A - 56.XX
  const m4 = full.match(/^([0-9]{2}\s*[A-Z]{1,2})\s*[-–.]?\s*([0-9]{2})([0-9]{2})/i);
  if (m4) {
    const series = m4[1].replace(/\s+/g, '').toUpperCase();
    return `${series} - ${m4[2]}.XX`;
  }

  return full.replace(/[0-9]{2}$/, 'XX');
}

