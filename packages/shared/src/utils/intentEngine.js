/**
 * Bộ Hiểu Ý Định Bản Địa (Native Intent Engine — Zero-LLM, <1ms).
 *
 * Thay thế hoàn toàn chuỗi `prompt.includes('giá')` trong agent cũ bằng một
 * bộ phân loại có trọng số + trích xuất thực thể (slot filling) thật sự.
 *
 * Kiến trúc kinh điển của NLU trước kỷ nguyên LLM, nhưng vẫn là lựa chọn đúng ở đây:
 *  - Xác định (deterministic): cùng đầu vào luôn cho cùng đầu ra, kiểm thử được 100%.
 *  - Không ảo giác: không bao giờ bịa ra địa danh hay con số không có trong dữ liệu.
 *  - Chạy offline, 0đ, <1ms, không cần API key, không rò rỉ dữ liệu cá nhân ra ngoài.
 *
 * Phương pháp:
 *  1. Chuẩn hoá tiếng Việt (khử dấu, mở rộng viết tắt) — vietnameseText.js
 *  2. Chấm điểm ý định bằng từ khoá có trọng số + n-gram (naive-Bayes rút gọn)
 *  3. Trích xuất thực thể: điểm đi/đến (fuzzy khớp hub thật), thời gian, số ghế, tiện ích
 *  4. Trả kèm độ tin cậy (confidence) để tầng trên quyết định có cần hỏi lại không
 */

import { VIRTUAL_HUBS, ROUTE_BENCHMARKS } from '../constants/routes.js';
import { mapTimeToSlot } from '../constants/timeSlots.js';
import { PROVINCE_COORDINATES } from './geo.js';
import { expandColloquial, tokenize, similarity, findBestSpan, normalizeForMatch } from './vietnameseText.js';

// ── ĐỊNH NGHĨA Ý ĐỊNH & TỪ KHOÁ CÓ TRỌNG SỐ ──
// Trọng số phản ánh sức mạnh phân biệt của từ khoá:
//   3 = đặc trưng mạnh (gần như chỉ xuất hiện ở ý định này)
//   2 = đặc trưng vừa
//   1 = gợi ý yếu, cần kết hợp
export const INTENTS = Object.freeze({
  FIND_TRIP: 'find_trip',
  ASK_PRICE: 'ask_price',
  CHECK_TRUST: 'check_trust',
  POST_TRIP: 'post_trip',
  CANCEL_TRIP: 'cancel_trip',
  TRIP_STATUS: 'trip_status',
  ASK_POLICY: 'ask_policy',
  GREETING: 'greeting',
  UNKNOWN: 'unknown'
});

const INTENT_LEXICON = Object.freeze({
  [INTENTS.FIND_TRIP]: {
    3: ['tim xe', 'co xe nao', 'con ghe', 'con cho', 'di ghep', 'ghep xe', 'can di', 'xin chuyen', 'bat xe'],
    2: ['di tu', 've', 'den', 'chuyen', 'ghe trong', 'cho trong', 'xe di', 'ai di', 'tien duong', 'qua giang'],
    1: ['di', 'xe', 'ghe', 'cho', 'sang', 'xuong', 'len', 'mai', 'hom nay', 'chieu', 'sang som']
  },
  [INTENTS.ASK_PRICE]: {
    3: ['bao nhieu tien', 'gia bao nhieu', 'het bao nhieu', 'nhieu tien', 'chi phi', 'phu xang bao nhieu'],
    2: ['gia', 'tien', 'xang', 'cau duong', 'bot', 'phi', 'cuoc', 'dinh muc', 'tham khao'],
    1: ['bao nhieu', 're', 'dat', 'mac']
  },
  [INTENTS.CHECK_TRUST]: {
    3: ['co uy tin', 'co an toan', 'tin duoc', 'diem tin nhiem', 'ho so tai xe', 'co that khong'],
    2: ['uy tin', 'tin nhiem', 'an toan', 'trust', 'danh gia', 'review', 'cccd', 'gplx', 'xac thuc'],
    1: ['tin', 'that', 'lua', 'scam']
  },
  [INTENTS.POST_TRIP]: {
    3: ['dang chuyen', 'dang xe', 'toi co xe', 'minh co xe', 'du ghe', 'con ghe trong ban', 'nhan khach'],
    2: ['dang bai', 'cho khach', 'chay tuyen', 'xe toi', 'tai xe dang'],
    1: ['dang', 'nhan']
  },
  [INTENTS.CANCEL_TRIP]: {
    3: ['huy chuyen', 'huy ghe', 'khong di nua', 'bo chuyen', 'huy dat'],
    2: ['huy', 'doi lich', 'doi gio', 'khong di'],
    1: ['thoi']
  },
  [INTENTS.TRIP_STATUS]: {
    3: ['chuyen cua toi', 've toi dau', 'toi dau roi', 'xe toi chua', 'sap toi chua', 'bao lau nua'],
    2: ['trang thai', 'tinh hinh', 'da dat', 've toi', 'den chua', 'dang o dau'],
    1: ['dau', 'chua', 'sap']
  },
  [INTENTS.ASK_POLICY]: {
    3: ['co mat phi khong', 'co ton phi', 'quy dinh the nao', 'chinh sach', 'cach hoat dong', 'lam sao de'],
    2: ['phi san', 'chiet khau', 'hoa hong', 'quy dinh', 'huong dan', 'the nao', 'cach dung'],
    1: ['sao', 'gi', 'the']
  },
  [INTENTS.GREETING]: {
    3: ['xin chao', 'chao ban', 'alo', 'hello', 'hi ban'],
    2: ['chao', 'hi', 'hey'],
    1: []
  }
});

// Tiện ích / ràng buộc chuyến đi — trích xuất dưới dạng slot boolean.
const PERK_PATTERNS = Object.freeze({
  noSmoking: ['khong thuoc', 'khong hut thuoc', 'khong khoi thuoc', 'ko thuoc', 'khong mui thuoc'],
  requiresFamilyCar: ['xe gia dinh', 'bien trang', 'xe nha', 'xe ca nhan', 'khong phai taxi', 'khong dich vu'],
  hasLuggage: ['hanh ly', 'vali', 'do dac', 'thung hang', 'nhieu do', 'cong kenh', 'xe may'],
  withChild: ['tre em', 'em be', 'con nho', 'tre nho', 'be gai', 'be trai', 'ghe tre em'],
  withElder: ['nguoi gia', 'ong ba', 'bo me', 'cu gia', 'nguoi lon tuoi'],
  withPet: ['thu cung', 'cho meo', 'con cho', 'con meo', 'pet'],
  needAirport: ['san bay', 'tan son nhat', 'tsn', 'bay chuyen', 'chuyen bay', 'check in'],
  needHospital: ['benh vien', 'cho ray', 'kham benh', 'di vien', 'tai kham']
});

// Biểu thức thời gian tương đối tiếng Việt.
const RELATIVE_DAY_PATTERNS = Object.freeze([
  { keys: ['hom nay', 'bua nay', 'nay'], offsetDays: 0 },
  { keys: ['mai', 'ngay mai', 'sang mai', 'bua sau'], offsetDays: 1 },
  { keys: ['mot', 'ngay mot', 'ngay kia'], offsetDays: 2 }
]);

// Buổi trong ngày -> khung giờ chuẩn của hệ thống (TIME_SLOTS).
const DAYPART_TO_SLOT = Object.freeze([
  { keys: ['rang sang', 'sang som lam', 'khuya'], slot: '03:00-05:00' },
  { keys: ['sang som', 'som'], slot: '05:00-07:00' },
  { keys: ['sang'], slot: '07:00-09:00' },
  { keys: ['giua buoi'], slot: '09:00-11:00' },
  { keys: ['trua'], slot: '11:00-13:00' },
  { keys: ['dau gio chieu', 'chieu'], slot: '13:00-15:00' },
  { keys: ['cuoi chieu', 'tan tam'], slot: '15:00-17:00' },
  { keys: ['toi'], slot: '17:00-19:00' },
  { keys: ['dem'], slot: '19:00-21:00' }
]);

// Đại từ, từ đệm và động từ thông dụng tiếng Việt trùng âm với thành tố địa danh
// (mình/Minh Hưng, vậy/Vàm Cống, bạn/Bàu Bàng, chở/Chợ Rẫy, tiền/Tiền Giang).
//
// Chúng KHÔNG bị cấm tuyệt đối — "Bình Long", "Tân Khai", "Hàng Xanh" đều hợp lệ.
// Quy tắc: một cụm chỉ gồm toàn từ trong danh sách này thì không đủ tư cách làm
// bằng chứng địa danh, TRỪ KHI nó khớp trọn vẹn tên (xem isTrustworthyPlaceMatch).
const WEAK_PLACE_TOKENS = new Set([
  'minh',
  'ban',
  'vay',
  'nay',
  'kia',
  'cho',
  'chi',
  'anh',
  'chu',
  'bac',
  'dua',
  'gium',
  'giup',
  'dang',
  'dinh',
  'tien',
  'tinh',
  'hang',
  'hanh',
  'thanh',
  'binh',
  'long',
  'nam',
  'bay',
  'sang',
  'trung',
  'tan',
  'moi',
  'gia',
  'nha',
  'xe',
  'can',
  'con',
  'hoa',
  'loc',
  'phu',
  'my',
  'an'
]);

/**
 * Quyết định một lần khớp có đủ tư cách làm bằng chứng địa danh hay không.
 *
 * Thay cho việc chỉ so một con số ngưỡng, hàm xét CHẤT LƯỢNG bằng chứng:
 *  - Khớp trọn vẹn tên (mọi từ của alias đều có mặt) -> luôn tin cậy,
 *    kể cả khi tên gồm toàn từ "yếu" ("Hàng Xanh", "Bình Long", "Tân Khai").
 *  - Khớp một phần tên -> chỉ tin khi cụm KHÔNG phải toàn từ đệm
 *    ("minh" trong "Minh Hưng" bị loại; "xoai" trong "Đồng Xoài" được giữ).
 */
function isTrustworthyPlaceMatch(spanText, aliasText) {
  // Cả hai vế đã được chuẩn hoá bởi người gọi — không chuẩn hoá lại trong vòng nóng.
  const spanTokens = String(spanText || '').split(' ').filter(Boolean);
  const aliasTokens = String(aliasText || '').split(' ').filter(Boolean);
  if (spanTokens.length === 0 || aliasTokens.length === 0) return false;

  const coversWholeAlias = spanTokens.length >= aliasTokens.length;
  if (coversWholeAlias) return true;

  // Khớp bán phần: phải có ít nhất một từ mang thông tin thật.
  return spanTokens.some((t) => !WEAK_PLACE_TOKENS.has(t));
}

// Tiền tố chỉ LOẠI địa điểm, không phải tên riêng. Người dùng hầu như luôn bỏ qua
// chúng khi nói: "đi Bù Đốp" chứ không ai nói "đi Chợ Tân Tiến (Bù Đốp)".
const HUB_TYPE_PREFIX = /^(?:nga\s*\d+|nga\s*(?:ba|tu)|kcn|tthc|cho|cau|cong\s*chao|vong\s*xoay|cua\s*khau|cay\s*xang(?:\s+petrolimex)?|tp\.?|tx\.?|huyen|thi\s*xa|cum\s*bv|bv|bx|vincom|aeon\s*mall)\s+/i;

function stripHubTypePrefix(value) {
  return normalizeForMatch(value).replace(HUB_TYPE_PREFIX, '').trim();
}

/**
 * Sinh tập bí danh cho một hub từ dữ liệu tên có sẵn.
 *
 * Tên hub trong hệ thống mang nhiều nhiễu cấu trúc:
 *   'Chợ Tân Tiến (Bù Đốp)'      -> còn cần: 'Bù Đốp', 'Tân Tiến'
 *   'Cụm BV Chợ Rẫy / BV ĐH Y Dược' -> còn cần: 'Chợ Rẫy'
 *   'Ngã 4 Hàng Xanh'             -> còn cần: 'Hàng Xanh'
 *
 * Bóc các lớp nhiễu này ra thành bí danh riêng, nếu không người dùng gõ đúng tên
 * thật của địa danh vẫn bị bỏ sót vì tỷ lệ phủ từ quá thấp.
 */
function buildHubAliases(hub) {
  const seeds = [hub.shortName, hub.name].filter(Boolean);
  const primary = new Set(seeds); // tên gọi thật của điểm đón
  const regional = new Set(); // chú thích vùng trong ngoặc

  for (const seed of seeds) {
    // Nội dung trong ngoặc thường chỉ là VÙNG chứa điểm đón, không phải tên nó:
    // 'Cửa khẩu Hoa Lư (Lộc Ninh)' -> "Lộc Ninh" là huyện, không phải tên cửa khẩu.
    // Nhiều hub cùng nằm trong một huyện nên alias loại này phải xếp hạng thấp hơn,
    // nếu không "đi Lộc Ninh" sẽ khớp nhầm sang Cửa khẩu Hoa Lư.
    for (const m of seed.matchAll(/\(([^)]+)\)/g)) {
      const inner = m[1].trim();
      if (inner) regional.add(stripHubTypePrefix(inner));
    }

    // Phần trước ngoặc, và các biến thể ngăn bởi "/", đều là tên gọi chính thức.
    const beforeParen = seed.replace(/\s*\([^)]*\)/g, '').trim();
    for (const part of [beforeParen, ...beforeParen.split('/')]) {
      const clean = part.trim();
      if (!clean) continue;
      primary.add(clean);
      const stripped = stripHubTypePrefix(clean);
      if (stripped) primary.add(stripped);
    }
  }

  const longEnough = (a) => a && normalizeForMatch(a).replace(/\s/g, '').length >= 4;
  const primaryList = [...primary].filter(longEnough);
  // Alias vùng chỉ giữ khi không trùng alias chính.
  const regionalList = [...regional].filter((a) => longEnough(a) && !primary.has(a));

  return { primary: primaryList, regional: regionalList };
}

// ── CHỈ MỤC ĐỊA DANH (dựng một lần, tra cứu O(1)) ──
//
// Không dựng lại danh sách ứng viên cho mỗi câu: tốn ~90ms/câu và vi phạm
// yêu cầu "trí tuệ bản địa <1ms" của AGENTS.md. Thay vào đó dựng sẵn một lần
// khi module được nạp, kèm chỉ mục đảo ngược token -> ứng viên.
let placeIndexCache = null;

function buildPlaceIndex() {
  //  1. Hub ảo thật (điểm đón/trả cụ thể) — ưu tiên cao nhất vì đặt chuyến được ngay.
  const hubCandidates = VIRTUAL_HUBS.map((h) => ({
    kind: 'hub',
    id: h.id,
    name: h.shortName || h.name,
    corridor: h.corridor,
    // Bỏ `landmark`: mô tả dài dòng gây khớp nhiễu, không phải tên gọi người dùng dùng.
    ...buildHubAliases(h)
  }));

  //  2. Tỉnh/thành hành chính — bắt các câu nói ở mức thô ("đi Sài Gòn", "về Bình Phước").
  // Alias phải đủ dài (>= 4 ký tự sau khi khử dấu): các khoá viết tắt ("tg", "bd",
  // "tp hcm") bị loại ở đây và được xử lý an toàn hơn qua COLLOQUIAL_MAP — nếu để lọt,
  // từ đệm tiếng Việt sẽ khớp mờ thành tên tỉnh và làm engine bịa địa danh.
  const provinceCandidates = Object.entries(PROVINCE_COORDINATES)
    .map(([key, val]) => ({
      kind: 'province',
      id: `province_${normalizeForMatch(key).replace(/\s/g, '_')}`,
      name: val.name,
      corridor: null,
      primary: [key, val.name].filter((a) => a && normalizeForMatch(a).replace(/\s/g, '').length >= 4),
      regional: []
    }))
    .filter((c) => c.primary.length > 0);

  const all = [...hubCandidates, ...provinceCandidates];

  // Chỉ mục đảo ngược ở mức BÍ DANH, không phải mức ứng viên.
  //
  // Một hub có thể có 5-6 bí danh; nếu chỉ lọc ở mức ứng viên thì vẫn phải chấm
  // điểm toàn bộ bí danh của nó. Lập chỉ mục từng bí danh giúp chỉ so đúng
  // những bí danh thật sự chia sẻ từ với câu người dùng.
  //
  // Mỗi mục đã tiền tính dạng chuẩn hoá và số từ, tránh băm lại khi chạy.
  const byToken = new Map();
  const byAlias = new Map();
  const addKey = (key, entry) => {
    if (!key) return;
    let bucket = byToken.get(key);
    if (!bucket) {
      bucket = new Set();
      byToken.set(key, bucket);
    }
    bucket.add(entry);
  };
  const addAlias = (key, entry) => {
    let bucket = byAlias.get(key);
    if (!bucket) {
      bucket = new Set();
      byAlias.set(key, bucket);
    }
    bucket.add(entry);
  };

  for (const cand of all) {
    const groups = [
      { list: cand.primary || [], isRegional: false },
      { list: cand.regional || [], isRegional: true }
    ];
    for (const { list, isRegional } of groups) {
      for (const alias of list) {
        const normalized = normalizeForMatch(alias);
        const tokens = normalized.split(' ').filter(Boolean);
        if (tokens.length === 0) continue;

        const entry = { candidate: cand, alias, normalized, tokens, tokenSet: new Set(tokens), isRegional };
        addAlias(normalized, entry);
        for (const token of tokens) {
          addKey(token, entry);
          // Tiền tố 4 ký tự bắt trường hợp gõ thiếu/sai đuôi ("hnag" ~ "hang").
          // Dùng 3 ký tự thì các đầu từ phổ biến ("tan", "gia", "cho", "long")
          // kéo theo hàng chục hub không liên quan và bóp nghẹt hiệu năng.
          if (token.length >= 5) addKey(token.slice(0, 4), entry);
        }
      }
    }
  }

  return { all, byToken, byAlias };
}

/**
 * Thu hẹp tập BÍ DANH cần chấm điểm bằng chỉ mục đảo ngược.
 * Chỉ giữ bí danh có ít nhất một từ (hoặc tiền tố 3 ký tự) trùng với câu người dùng.
 */
function selectAliasEntries(normalizedText) {
  if (!placeIndexCache) placeIndexCache = buildPlaceIndex();
  const { byToken } = placeIndexCache;

  const tokens = normalizedText.split(' ').filter(Boolean);
  // Khi câu đã có một token đặc trưng ("xoai", "budop"...), các từ rất
  // phổ biến như "xe", "gia", "di" chỉ kéo theo hàng trăm hub không liên
  // quan. Với câu chỉ gồm tên ngắn toàn từ yếu ("Bình Long") vẫn giữ chúng
  // để không làm mất địa danh hợp lệ.
  const hasSpecificToken = tokens.some((token) => token.length >= 3 && !WEAK_PLACE_TOKENS.has(token));
  const selected = new Set();

  for (const token of tokens) {
    if (hasSpecificToken && WEAK_PLACE_TOKENS.has(token)) continue;
    for (const entry of byToken.get(token) || []) selected.add(entry);
    if (token.length >= 5) {
      for (const entry of byToken.get(token.slice(0, 4)) || []) selected.add(entry);
    }
  }

  return [...selected];
}

/** Đếm số lần xuất hiện cụm từ khoá trong câu đã chuẩn hoá. */
function countPhrase(haystack, phrase) {
  if (!phrase) return 0;
  // `haystack` và `phrase` đều đã chuẩn hoá: chỉ còn chữ/số cách bởi một space.
  // Dò ranh giới trực tiếp tránh dựng RegExp + mảng match cho từng từ khoá trong
  // đường nóng của intent/perk/time. Đây là phần được gọi hàng trăm lần mỗi câu.
  let hits = 0;
  let start = 0;
  while (start < haystack.length) {
    const index = haystack.indexOf(phrase, start);
    if (index === -1) break;

    const end = index + phrase.length;
    const startsAtBoundary = index === 0 || haystack.charCodeAt(index - 1) === 32;
    const endsAtBoundary = end === haystack.length || haystack.charCodeAt(end) === 32;
    if (startsAtBoundary && endsAtBoundary) hits++;

    // `phrase` luôn không rỗng; nhảy hết cụm vừa xét để không đếm trùng.
    start = end;
  }
  return hits;
}

/**
 * Chấm điểm toàn bộ ý định và trả về bảng xếp hạng.
 * Điểm được chuẩn hoá theo softmax rút gọn để có "confidence" so sánh được.
 */
export function classifyIntent(rawText, { route: precomputedRoute } = {}) {
  const text = expandColloquial(rawText);
  if (!text) {
    return { intent: INTENTS.UNKNOWN, confidence: 0, scores: {}, ranked: [] };
  }

  const scores = {};
  for (const [intent, lexicon] of Object.entries(INTENT_LEXICON)) {
    let score = 0;
    for (const [weightStr, phrases] of Object.entries(lexicon)) {
      const weight = Number(weightStr);
      for (const phrase of phrases) {
        const hits = countPhrase(text, phrase);
        if (hits > 0) {
          // Lần xuất hiện đầu tính đủ trọng số, các lần sau giảm dần (bão hoà).
          score += weight * (1 + Math.log(hits));
        }
      }
    }
    scores[intent] = score;
  }

  // Tín hiệu cấu trúc: có cặp điểm đi–đến là dấu hiệu rất mạnh của FIND_TRIP.
  // Nhận lại kết quả đã tính từ parseUserMessage để không dò địa danh hai lần.
  const route = precomputedRoute || extractRoute(rawText);
  if (route.from && route.to) {
    scores[INTENTS.FIND_TRIP] += 4;
  } else if (route.from || route.to) {
    scores[INTENTS.FIND_TRIP] += 1.5;
  }

  // Có số tiền trong câu -> nghiêng về hỏi giá.
  if (/\b\d{2,3}\s*(?:k|nghin|ngan|trieu|d|dong)\b/.test(text)) {
    scores[INTENTS.ASK_PRICE] += 2;
  }

  const ranked = Object.entries(scores)
    .map(([intent, score]) => ({ intent, score }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const runnerUp = ranked[1];

  if (!top || top.score <= 0) {
    return { intent: INTENTS.UNKNOWN, confidence: 0, scores, ranked };
  }

  // Confidence = độ vượt trội của ý định đầu so với ý định nhì, chuẩn hoá 0..1.
  const margin = top.score - (runnerUp?.score || 0);
  const confidence = Math.min(1, (top.score / (top.score + 3)) * 0.6 + (margin / (margin + 2)) * 0.4);

  return { intent: top.intent, confidence: Number(confidence.toFixed(3)), scores, ranked };
}

/**
 * Trích xuất điểm đi / điểm đến bằng fuzzy matching trên danh sách hub THẬT.
 * Không bao giờ sinh ra địa danh không tồn tại trong hệ thống.
 */
export function extractRoute(rawText) {
  const text = expandColloquial(rawText);
  if (!text) return { from: null, to: null, fromHub: null, toHub: null };

  // Chỉ chấm điểm những BÍ DANH có từ thật sự xuất hiện trong câu.
  // Quét toàn bộ ~1.400 bí danh cho mỗi câu tốn ~90ms — vi phạm yêu cầu
  // Cursor Ambient (<1ms). Chỉ mục đảo ngược thu hẹp còn vài bí danh.
  const aliasEntries = selectAliasEntries(text);
  // Băm câu MỘT LẦN và dùng lại cho mọi bí danh (xem findBestSpan).
  const sentenceTokens = tokenize(text, { keepStopWords: true });
  const { byAlias, byToken } = placeIndexCache;

  // Đa số địa danh được gõ đúng. Quét các n-gram của câu một lần rồi tra Map
  // để tìm tất cả bí danh khớp trọn; không lặp lại so sánh từng alias với toàn
  // bộ câu. Fuzzy chỉ còn là nhánh hẹp cho lỗi gõ như "hnag xanh".
  const exactStarts = new Map();
  const maxAliasWords = Math.min(4, sentenceTokens.length);
  for (let size = 1; size <= maxAliasWords; size++) {
    for (let start = 0; start + size <= sentenceTokens.length; start++) {
      const entries = byAlias.get(sentenceTokens.slice(start, start + size).join(' '));
      if (!entries) continue;
      for (const entry of entries) exactStarts.set(entry, start);
    }
  }

  // Chỉ chạy fuzzy khi có dấu hiệu lỗi gõ cạnh một token địa danh hợp lệ.
  // Điều kiện sẽ được xét THEO TỪNG alias ở bên dưới; nếu áp dụng toàn câu,
  // một từ thường như "không" cạnh một địa danh tình cờ sẽ kích hoạt quét mờ
  // cho mọi alias không liên quan.
  const tokenIsIndexed = (token) =>
    Boolean(byToken.get(token)) || (token.length >= 5 && Boolean(byToken.get(token.slice(0, 4))));

  // Tìm mọi hub xuất hiện trong câu, kèm vị trí để suy ra chiều đi.
  //
  // Nguyên tắc bất biến: THÀ BỎ SÓT CÒN HƠN BỊA RA.
  // Một địa danh chỉ được công nhận khi cụm trong câu khớp rất cao (>= 0.88) và
  // bản thân cụm đó đủ dài (>= 3 ký tự) — chặn việc từ đệm như "a", "z", "vay"
  // bị gán nhầm thành hub. Đây là ranh giới an toàn cốt lõi của toàn bộ engine.
  const HUB_MATCH_THRESHOLD = 0.88;
  // Tên tỉnh ngắn và phổ biến hơn nhiều so với tên hub, nên đòi hỏi khớp gần như
  // tuyệt đối để không nuốt nhầm từ đệm ("mình" ~ "Bình ...", "vậy" ~ "Vĩnh ...").
  const PROVINCE_MATCH_THRESHOLD = 0.95;
  // Bí danh vùng (chú thích huyện trong ngoặc) bị phạt điểm: nhiều hub chia sẻ cùng
  // một vùng, nên hub mang đúng tên người dùng gọi phải luôn thắng.
  const REGIONAL_PENALTY = 0.08;

  const bestByCandidate = new Map();
  for (const entry of aliasEntries) {
    const cand = entry.candidate;
    const threshold = cand.kind === 'province' ? PROVINCE_MATCH_THRESHOLD : HUB_MATCH_THRESHOLD;

    const exactStart = exactStarts.get(entry);
    const anchorIndices = [];
    for (let index = 0; index < sentenceTokens.length; index++) {
      if (entry.tokenSet.has(sentenceTokens[index])) anchorIndices.push(index);
    }
    const hasAdjacentTypoSignal = anchorIndices.some((index) => {
      const previous = sentenceTokens[index - 1] || '';
      const next = sentenceTokens[index + 1] || '';
      return [previous, next].some(
        (token) => token.length >= 3 && !WEAK_PLACE_TOKENS.has(token) && !tokenIsIndexed(token)
      );
    });
    const span =
      exactStart !== undefined
        ? {
            span: entry.normalized,
            score: 0.95,
            startIndex: exactStart,
            endIndex: exactStart + entry.tokens.length
          }
        : hasAdjacentTypoSignal
          ? findBestSpan(text, entry.normalized, { threshold, tokens: sentenceTokens, anchorIndices })
          : null;
    if (!span) continue;
    if (span.span.replace(/\s/g, '').length < 3) continue;
    // Xét chất lượng bằng chứng, không chỉ điểm số: loại các cụm toàn từ đệm
    // khớp bán phần tên hub, nhưng vẫn giữ tên thật gồm từ thông dụng.
    if (!isTrustworthyPlaceMatch(span.span, entry.normalized)) continue;

    const effective = span.score - (entry.isRegional ? REGIONAL_PENALTY : 0);
    const current = bestByCandidate.get(cand);
    if (!current || effective > current.score) {
      bestByCandidate.set(cand, { ...cand, position: span.startIndex, score: effective, span: span.span });
    }
  }

  const found = [...bestByCandidate.values()];

  if (found.length === 0) {
    return { from: null, to: null, fromHub: null, toHub: null, candidates: [] };
  }

  // Khử trùng: mỗi vị trí trong câu chỉ gán cho một địa danh duy nhất.
  // Hub cụ thể thắng tỉnh/thành khi điểm ngang nhau ("Hàng Xanh" > "TP.HCM"),
  // vì hub đặt chuyến được ngay còn tỉnh thì chưa.
  const kindRank = (k) => (k === 'hub' ? 1 : 0);
  found.sort((a, b) => b.score - a.score || kindRank(b.kind) - kindRank(a.kind) || a.position - b.position);
  const claimed = new Set();
  const unique = [];
  for (const f of found) {
    if (claimed.has(f.position)) continue;
    claimed.add(f.position);
    unique.push(f);
  }
  unique.sort((a, b) => a.position - b.position);

  // Suy chiều bằng giới từ: "từ X ... đến/về/xuống/ra Y"
  const tokens = sentenceTokens;
  const FROM_MARKERS = new Set(['tu', 'o', 'tai', 'xuat phat']);
  const TO_MARKERS = new Set(['den', 've', 'toi', 'xuong', 'len', 'ra', 'vao', 'sang', 'di']);

  let fromEntry = null;
  let toEntry = null;

  for (const entry of unique) {
    const prevToken = tokens[entry.position - 1];
    const prev2Token = tokens[entry.position - 2];
    if (prevToken && FROM_MARKERS.has(prevToken)) {
      if (!fromEntry) fromEntry = entry;
    } else if (
      (prevToken && TO_MARKERS.has(prevToken)) ||
      (prev2Token && TO_MARKERS.has(prev2Token) && FROM_MARKERS.has(prevToken) === false)
    ) {
      if (!toEntry) toEntry = entry;
    }
  }

  // Không có giới từ rõ ràng: theo quy ước thứ tự xuất hiện (đi trước = điểm đón).
  if (!fromEntry && !toEntry) {
    fromEntry = unique[0] || null;
    toEntry = unique[1] || null;
  } else if (fromEntry && !toEntry) {
    toEntry = unique.find((e) => e !== fromEntry) || null;
  } else if (!fromEntry && toEntry) {
    fromEntry = unique.find((e) => e !== toEntry) || null;
  }

  return {
    from: fromEntry?.name || null,
    to: toEntry?.name || null,
    // Giữ cụm người dùng đã gõ để lớp tìm kiếm đối chiếu với dữ liệu chuyến.
    // Tên hiển thị của hub thường dài hơn (ví dụ "Chợ Tân Tiến (Bù Đốp)")
    // nên không phù hợp để dùng làm từ khoá lọc tuyệt đối.
    fromMatch: fromEntry?.span || null,
    toMatch: toEntry?.span || null,
    fromHub: fromEntry
      ? { id: fromEntry.id, name: fromEntry.name, corridor: fromEntry.corridor, kind: fromEntry.kind }
      : null,
    toHub: toEntry ? { id: toEntry.id, name: toEntry.name, corridor: toEntry.corridor, kind: toEntry.kind } : null,
    candidates: unique.map((u) => ({ id: u.id, name: u.name, kind: u.kind, score: Number(u.score.toFixed(3)) }))
  };
}

/**
 * Trích xuất thời gian: ngày tương đối + khung giờ chuẩn hệ thống.
 * Hỗ trợ "mai 7h", "chiều nay", "sáng sớm mai", "17h30", "5 giờ chiều".
 */
export function extractTime(rawText, now = new Date()) {
  const text = expandColloquial(rawText);
  if (!text) return { date: null, timeSlot: null, explicitHour: null };

  // 1. Ngày tương đối
  let offsetDays = null;
  for (const pattern of RELATIVE_DAY_PATTERNS) {
    for (const key of pattern.keys) {
      if (countPhrase(text, key) > 0) {
        offsetDays = pattern.offsetDays;
        break;
      }
    }
    if (offsetDays !== null) break;
  }

  // 2. Ngày tuyệt đối dạng "25/12" hoặc "25-12-2026".
  // Đọc từ chuỗi GỐC: chuẩn hoá đã xoá dấu "/" và "-" nên "25/12" biến thành "25 12".
  let absoluteDate = null;
  const rawForDate = String(rawText || '');
  const slashDate = rawForDate.match(/\b(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?\b/);
  if (slashDate) {
    const day = Number(slashDate[1]);
    const month = Number(slashDate[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const requestedYear = slashDate[3]
        ? Number(slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3])
        : null;
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const createValidCalendarDate = (year) => {
        const candidate = new Date(year, month - 1, day);
        return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day
          ? candidate
          : null;
      };

      if (requestedYear !== null) {
        absoluteDate = createValidCalendarDate(requestedYear);
      } else {
        // Ngày không nêu năm nghĩa là lần xuất hiện hợp lệ gần nhất trong tương lai.
        // Vòng lặp cũng xử lý 29/02 khi năm hiện tại hoặc năm sau không nhuận.
        for (let year = now.getFullYear(); year <= now.getFullYear() + 4; year++) {
          const candidate = createValidCalendarDate(year);
          if (candidate && candidate >= todayStart) {
            absoluteDate = candidate;
            break;
          }
        }
      }
    }
  }

  // 3. Giờ cụ thể: "7h", "17h30", "5 gio", "7 giờ sáng"
  let explicitHour = null;
  let explicitMinute = 0;
  const hourMatch = text.match(/\b(\d{1,2})\s*(?:h|gio|g)\s*(\d{1,2})?\b/);
  if (hourMatch) {
    explicitHour = Number(hourMatch[1]);
    explicitMinute = hourMatch[2] ? Number(hourMatch[2]) : 0;
    // "5 giờ chiều" -> 17h. Chỉ quy đổi khi giờ <= 12 và có từ chỉ buổi chiều/tối.
    if (explicitHour <= 12 && /\b(chieu|toi|dem)\b/.test(text)) {
      if (explicitHour < 12) explicitHour += 12;
    }
    if (explicitHour > 23 || explicitMinute > 59) {
      explicitHour = null;
      explicitMinute = 0;
    }
  }

  // 4. Buổi trong ngày -> khung giờ
  let timeSlot = null;
  if (explicitHour !== null) {
    // Luôn trả đúng ID trong TIME_SLOTS; không tự ghép khoảng giờ không tồn tại.
    timeSlot = mapTimeToSlot(`${String(explicitHour).padStart(2, '0')}:${String(explicitMinute).padStart(2, '0')}`);
  } else {
    // Ưu tiên cụm dài hơn ("sang som" trước "sang").
    const sorted = DAYPART_TO_SLOT.flatMap((d) => d.keys.map((k) => ({ key: k, slot: d.slot }))).sort(
      (a, b) => b.key.length - a.key.length
    );
    for (const { key, slot } of sorted) {
      if (countPhrase(text, key) > 0) {
        timeSlot = slot;
        break;
      }
    }
  }

  let date = absoluteDate;
  if (!date && offsetDays !== null) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  }

  return {
    date: date ? toIsoDate(date) : null,
    timeSlot,
    explicitHour,
    explicitMinute: explicitHour !== null ? explicitMinute : null,
    isRelative: offsetDays !== null
  };
}

function toIsoDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Trích xuất số ghế cần đặt. Hỗ trợ cả chữ số và chữ viết.
 * "2 ghế", "hai người", "đi 3 đứa", "một mình"
 */
export function extractSeats(rawText) {
  const text = expandColloquial(rawText);
  if (!text) return 1;

  if (/\b(mot minh|di le|1 minh|don than)\b/.test(text)) return 1;

  const WORD_NUMBERS = { mot: 1, hai: 2, ba: 3, bon: 4, nam: 5, sau: 6, bay: 7 };

  // Số đứng cạnh danh từ chỉ người/ghế.
  const digitMatch = text.match(/\b(\d{1,2})\s*(?:ghe|cho|nguoi|khach|dua|ban|me con|anh em)\b/);
  if (digitMatch) {
    const n = Number(digitMatch[1]);
    if (n >= 1 && n <= 7) return n;
  }

  for (const [word, value] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\s*(?:ghe|cho|nguoi|khach|dua)\\b`).test(text)) {
      return value;
    }
  }

  // "2 vé", "đặt 2"
  const loose = text.match(/\b(?:dat|can|muon|lay|book)\s*(\d{1,2})\b/);
  if (loose) {
    const n = Number(loose[1]);
    if (n >= 1 && n <= 7) return n;
  }

  return 1;
}

/** Trích xuất ngân sách tối đa: "dưới 150k", "khoảng 200 nghìn", "tầm 150000". */
export function extractBudget(rawText) {
  const text = expandColloquial(rawText);
  if (!text) return null;

  const m = text.match(/\b(\d{1,3}(?:[.,]\d{3})*|\d{1,4})\s*(k|nghin|ngan|trieu|d|dong)?\b/g);
  if (!m) return null;

  for (const raw of m) {
    const numPart = raw.replace(/[^\d]/g, '');
    if (!numPart) continue;
    let value = Number(numPart);
    if (/trieu/.test(raw)) value *= 1_000_000;
    else if (/k|nghin|ngan/.test(raw)) value *= 1000;

    // Chỉ chấp nhận mức tiền hợp lý cho một ghế đi ghép (20k – 2 triệu).
    if (value >= 20_000 && value <= 2_000_000) return value;
  }
  return null;
}

/** Trích xuất các tiện ích / ràng buộc dưới dạng cờ boolean. */
export function extractPerks(rawText) {
  const text = expandColloquial(rawText);
  const perks = {};
  if (!text) return perks;

  for (const [perk, patterns] of Object.entries(PERK_PATTERNS)) {
    for (const p of patterns) {
      if (countPhrase(text, p) > 0) {
        perks[perk] = true;
        break;
      }
    }
  }
  return perks;
}

/**
 * Hàm tổng hợp: phân tích trọn vẹn một câu tiếng Việt thành cấu trúc máy hiểu được.
 * Đây là điểm vào duy nhất mà tầng agent nên gọi.
 *
 * @returns {{
 *   intent: string, confidence: number, needsClarification: boolean,
 *   slots: object, raw: string, engine: string
 * }}
 */
export function parseUserMessage(rawText, { now = new Date() } = {}) {
  const raw = String(rawText || '').trim();
  const route = extractRoute(raw);
  const classification = classifyIntent(raw, { route });
  const time = extractTime(raw, now);
  const seats = extractSeats(raw);
  const budget = extractBudget(raw);
  const perks = extractPerks(raw);

  const slots = {
    from: route.from,
    to: route.to,
    fromMatch: route.fromMatch,
    toMatch: route.toMatch,
    fromHub: route.fromHub,
    toHub: route.toHub,
    date: time.date,
    timeSlot: time.timeSlot,
    explicitHour: time.explicitHour,
    seats,
    maxPrice: budget,
    ...perks
  };

  // Cần hỏi lại khi: không rõ ý định, hoặc muốn tìm chuyến mà thiếu cả điểm đi lẫn đến.
  const missingRoute = classification.intent === INTENTS.FIND_TRIP && !route.from && !route.to;
  const needsClarification = classification.confidence < 0.45 || missingRoute;

  return {
    intent: classification.intent,
    confidence: classification.confidence,
    needsClarification,
    missingSlots: buildMissingSlots(classification.intent, slots),
    slots,
    candidates: route.candidates || [],
    raw,
    engine: 'native-intent-engine-v1'
  };
}

function buildMissingSlots(intent, slots) {
  const missing = [];
  if (intent === INTENTS.FIND_TRIP) {
    if (!slots.from) missing.push('from');
    if (!slots.to) missing.push('to');
    if (!slots.date && !slots.timeSlot) missing.push('when');
  }
  if (intent === INTENTS.ASK_PRICE && !slots.from && !slots.to) {
    missing.push('route');
  }
  return missing;
}

/**
 * Gợi ý tuyến tham chiếu gần nhất khi người dùng nói địa danh ngoài mạng lưới hub.
 * Trả về tuyến trong ROUTE_BENCHMARKS khớp nhất, kèm điểm tương đồng.
 */
export function suggestBenchmarkRoute(rawText) {
  const text = expandColloquial(rawText);
  if (!text) return null;

  let best = null;
  for (const [key, bench] of Object.entries(ROUTE_BENCHMARKS)) {
    const labels = [key, bench.route, bench.shortName, bench.corridor].filter(Boolean);
    for (const label of labels) {
      const score = similarity(text, label);
      const spanHit = findBestSpan(text, label, { threshold: 0.78 });
      const effective = Math.max(score, spanHit ? spanHit.score : 0);
      if (effective >= 0.7 && (!best || effective > best.score)) {
        best = { key, benchmark: bench, score: Number(effective.toFixed(3)) };
      }
    }
  }
  return best;
}

/** Tiện ích cho tầng UI: chuẩn hoá chuỗi tìm kiếm người dùng gõ vào ô search. */
export function normalizeSearchQuery(rawText) {
  return normalizeForMatch(expandColloquial(rawText));
}
