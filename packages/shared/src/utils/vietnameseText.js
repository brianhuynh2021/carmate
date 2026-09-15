/**
 * Xử lý văn bản tiếng Việt bản địa (Zero-LLM, chạy <1ms trên client).
 *
 * Nền tảng cho toàn bộ tầng trí tuệ bản địa của CarMate: người dùng thực tế gõ
 * "bù đóp", "budop", "bu dop", "Bù Đốp" hay "nhiu tien z a" đều phải hiểu như nhau,
 * không cần round-trip máy chủ và không cần LLM.
 *
 * Thuật toán:
 * - Chuẩn hoá Unicode NFD + khử dấu thanh (diacritics folding).
 * - Khoảng cách Damerau-Levenshtein (có hoán vị kề) — bắt lỗi gõ nhanh "Đôngf Xoài".
 * - Độ tương đồng Dice trên bigram — bắt sai lệch cấu trúc từ dài.
 * - Chấm điểm lai: ưu tiên khớp tiền tố và khớp trọn từ, vì địa danh Việt Nam
 *   thường được gõ tắt phần đầu ("Bình Phước" -> "BP", "Sài Gòn" -> "SG").
 */

// ── BẢNG VIẾT TẮT & TIẾNG LÓNG BẢN ĐỊA ──
// Người dùng vùng QL13/QL14 gõ tắt rất nhiều. Đây là tri thức miền, không phải dữ liệu học máy.
const COLLOQUIAL_MAP = Object.freeze({
  sg: 'sai gon',
  tphcm: 'sai gon',
  hcm: 'sai gon',
  'tp hcm': 'sai gon',
  'tp.hcm': 'sai gon',
  saigon: 'sai gon',
  bp: 'binh phuoc',
  bd: 'binh duong',
  dx: 'dong xoai',
  ln: 'loc ninh',
  bdop: 'bu dop',
  budop: 'bu dop',
  tsn: 'san bay tan son nhat',
  sanbay: 'san bay',
  sb: 'san bay',
  hx: 'hang xanh',
  bxmd: 'ben xe mien dong',
  'bx mien dong': 'ben xe mien dong',
  cr: 'cho ray',
  hn: 'ha noi',
  hp: 'hai phong',
  vt: 'vung tau',
  pt: 'phan thiet',
  ndl: 'nga tu binh phuoc'
});

// Từ đệm tiếng Việt không mang thông tin — loại bỏ trước khi so khớp.
const STOP_WORDS = new Set([
  'a',
  'ai',
  'ah',
  'ak',
  'ạ',
  'the',
  'la',
  'co',
  'khong',
  'ko',
  'k',
  'oi',
  'vay',
  'v',
  'z',
  'zay',
  'the nao',
  'nhe',
  'nha',
  'di',
  'va',
  'voi',
  'cho',
  'minh',
  'em',
  'anh',
  'chi',
  'ban',
  'toi',
  'can',
  'muon',
  'tim',
  'hoi',
  'xin',
  'cam on',
  'oke',
  'ok',
  'dc',
  'duoc',
  'r',
  'roi',
  'nay',
  'do',
  'kia',
  'thi',
  'ma',
  'nhung',
  'hay'
]);

/**
 * Khử dấu tiếng Việt và chuẩn hoá về chữ thường không dấu.
 * "Bù Đốp" -> "bu dop" | "Đồng Xoài" -> "dong xoai"
 */
export function foldDiacritics(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu thanh + dấu mũ
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Chuẩn hoá chuỗi để so khớp: khử dấu, gộp khoảng trắng, bỏ ký tự đặc biệt.
 */
export function normalizeForMatch(str) {
  if (!str || typeof str !== 'string') return '';
  return foldDiacritics(str)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mở rộng viết tắt/tiếng lóng bản địa về dạng đầy đủ.
 * "đi sg" -> "di sai gon" | "bp" -> "binh phuoc"
 */
// Bộ nhớ đệm chuẩn hoá: tên hub và tỉnh được chuẩn hoá lặp đi lặp lại hàng nghìn
// lần trong một lượt dò địa danh. Giới hạn kích thước để không rò rỉ bộ nhớ khi
// người dùng gõ vô số câu khác nhau.
const EXPAND_CACHE = new Map();
const EXPAND_CACHE_LIMIT = 2000;

export function expandColloquial(str) {
  if (typeof str === 'string') {
    const hit = EXPAND_CACHE.get(str);
    if (hit !== undefined) return hit;
  }

  const result = computeExpandColloquial(str);

  if (typeof str === 'string' && str.length <= 200) {
    if (EXPAND_CACHE.size >= EXPAND_CACHE_LIMIT) EXPAND_CACHE.clear();
    EXPAND_CACHE.set(str, result);
  }
  return result;
}

function computeExpandColloquial(str) {
  const normalized = normalizeForMatch(str);
  if (!normalized) return '';

  // Khớp cụm nhiều từ trước (dài ưu tiên), tránh "tp hcm" bị cắt thành "tp" + "hcm".
  let result = normalized;
  const multiWordKeys = Object.keys(COLLOQUIAL_MAP)
    .filter((k) => k.includes(' '))
    .sort((a, b) => b.length - a.length);
  for (const key of multiWordKeys) {
    const safe = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\b${safe}\\b`, 'g'), COLLOQUIAL_MAP[key]);
  }

  return result
    .split(' ')
    .map((token) => COLLOQUIAL_MAP[token] || token)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tách token có nghĩa: đã khử dấu, mở rộng viết tắt, loại từ đệm.
 */
export function tokenize(str, { keepStopWords = false } = {}) {
  const expanded = expandColloquial(str);
  if (!expanded) return [];
  const tokens = expanded.split(' ').filter(Boolean);
  if (keepStopWords) return tokens;
  const meaningful = tokens.filter((t) => !STOP_WORDS.has(t));
  // Nếu lọc sạch hết (câu toàn từ đệm) thì trả lại nguyên bản để không mất tín hiệu.
  return meaningful.length > 0 ? meaningful : tokens;
}

/**
 * Khoảng cách Damerau-Levenshtein (có tính hoán vị hai ký tự kề nhau).
 * Gõ nhanh trên điện thoại rất hay đảo ký tự: "Đôngf" / "Xoaì" / "hnag xanh".
 * Dùng quy hoạch động 3 hàng cuộn -> bộ nhớ O(min(m,n)), tốc độ <1ms cho chuỗi địa danh.
 */
export function damerauLevenshtein(a, b, maxDistance = Infinity) {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  // Cắt sớm khi chênh lệch độ dài đã vượt ngưỡng — tiết kiệm phần lớn phép tính.
  if (Math.abs(s.length - t.length) > maxDistance) return maxDistance + 1;

  let prevPrev = null;
  let prev = new Array(t.length + 1);
  let curr = new Array(t.length + 1);

  for (let j = 0; j <= t.length; j++) prev[j] = j;

  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];

    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let value = Math.min(
        curr[j - 1] + 1, // chèn
        prev[j] + 1, // xoá
        prev[j - 1] + cost // thay thế
      );

      // Hoán vị hai ký tự kề (transposition)
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        value = Math.min(value, prevPrev[j - 2] + 1);
      }

      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }

    if (rowMin > maxDistance) return maxDistance + 1;

    prevPrev = prev;
    prev = curr;
    curr = new Array(t.length + 1);
  }

  return prev[t.length];
}

/**
 * Độ tương đồng Sørensen-Dice trên bigram ký tự (0..1).
 * Bổ trợ cho Levenshtein: bắt tốt trường hợp đảo trật tự từ
 * ("xoai dong" vs "dong xoai") mà khoảng cách sửa lỗi đánh giá thấp.
 */
export function diceCoefficient(a, b) {
  const s = normalizeForMatch(a).replace(/\s/g, '');
  const t = normalizeForMatch(b).replace(/\s/g, '');
  if (!s.length || !t.length) return 0;
  if (s === t) return 1;
  if (s.length < 2 || t.length < 2) return s === t ? 1 : 0;

  const bigrams = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < t.length - 1; i++) {
    const bg = t.slice(i, i + 2);
    const count = bigrams.get(bg) || 0;
    if (count > 0) {
      bigrams.set(bg, count - 1);
      intersection++;
    }
  }

  return (2 * intersection) / (s.length - 1 + (t.length - 1));
}

/**
 * Kiểm tra nhanh hai chuỗi có đủ ký tự chung để đáng chấm điểm hay không.
 * Dùng bitmask 26 chữ cái — một phép AND thay cho toàn bộ bảng quy hoạch động.
 */
function shareEnoughCharacters(a, b) {
  const maskOf = (str) => {
    let mask = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i) - 97; // 'a'
      if (code >= 0 && code < 26) mask |= 1 << code;
    }
    return mask;
  };

  const maskA = maskOf(a);
  const maskB = maskOf(b);
  const shared = maskA & maskB;
  if (shared === 0) return false;

  // Đếm số chữ cái khác nhau dùng chung (popcount).
  let common = 0;
  let bits = shared;
  while (bits) {
    bits &= bits - 1;
    common++;
  }

  let distinctA = 0;
  bits = maskA;
  while (bits) {
    bits &= bits - 1;
    distinctA++;
  }

  // Chuỗi ngắn phải dùng chung phần lớn bộ chữ cái của nó với chuỗi kia.
  return common >= Math.min(3, distinctA) && common / Math.max(1, distinctA) >= 0.5;
}

/**
 * Nhận diện đúng một phép đảo hai ký tự kề nhau. Đây là lỗi gõ điện thoại
 * phổ biến, nhưng hẹp hơn nhiều so với việc hạ ngưỡng fuzzy cho mọi chuỗi.
 */
function isSingleAdjacentTransposition(a, b) {
  if (a.length !== b.length || a.length < 2) return false;

  const mismatches = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) mismatches.push(i);
    if (mismatches.length > 2) return false;
  }

  if (mismatches.length !== 2 || mismatches[1] !== mismatches[0] + 1) return false;
  const [first, second] = mismatches;
  return a[first] === b[second] && a[second] === b[first];
}

/**
 * Điểm tương đồng lai giữa hai chuỗi (0..1), tối ưu riêng cho địa danh Việt Nam.
 *
 * Trọng số theo thứ tự ưu tiên thực tế:
 *  1.00 — trùng khít sau chuẩn hoá
 *  0.95 — chứa trọn cụm (khớp substring theo ranh giới từ)
 *  0.90 — khớp tiền tố các từ ("bd" ~ "bu dop", "dx" ~ "dong xoai")
 *  còn lại — kết hợp Levenshtein chuẩn hoá và Dice
 */
export function similarity(a, b, { preNormalized = false } = {}) {
  // `preNormalized` dành cho vòng lặp nóng (dò địa danh): người gọi đã chuẩn hoá
  // sẵn cả hai vế, nên bỏ qua bước mở rộng viết tắt vốn chiếm phần lớn thời gian
  // khi hàm này được gọi hàng trăm lần cho một câu.
  const s = preNormalized ? a : expandColloquial(a);
  const t = preNormalized ? b : expandColloquial(b);
  if (!s || !t) return 0;
  if (s === t) return 1;

  const shorter = s.length <= t.length ? s : t;
  const longer = s.length <= t.length ? t : s;
  const shorterWords = shorter.split(' ').filter(Boolean);
  const longerWords = longer.split(' ').filter(Boolean);

  // Chặn khớp rác: một mẩu rất ngắn nằm lọt trong một tên rất dài KHÔNG phải là khớp.
  // "z" nằm trong "vinh long z..."; "a" nằm trong "an loc" — phải loại bỏ triệt để,
  // nếu không bộ trích xuất sẽ bịa ra địa danh không hề có trong câu người dùng.
  const coverage = shorter.length / longer.length;
  const tooShortToTrust = shorter.length < 4 && shorterWords.length === 1;
  const tooDilute = coverage < 0.34;

  // Khớp trọn cụm theo ranh giới từ.
  //
  // Ràng buộc then chốt: khớp bộ phận phải phủ được PHẦN LỚN SỐ TỪ của tên đầy đủ.
  // Một từ đơn lọt trong tên hai từ ("tiền" trong "Tiền Giang", "định" trong "Nam Định")
  // là bằng chứng quá yếu — chính là chỗ engine từng bịa ra địa danh từ từ đệm.
  const boundary = (hay, needle) => new RegExp(`(?:^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(hay);
  const wordCoverage = shorterWords.length / longerWords.length;
  const enoughWords = longerWords.length === 1 || wordCoverage >= 0.5;
  if (!tooShortToTrust && !tooDilute && enoughWords && (boundary(s, t) || boundary(t, s))) {
    // Phủ trọn vẹn thì khớp tuyệt đối hơn là phủ một phần.
    return wordCoverage === 1 ? 0.95 : 0.88;
  }

  // Khớp tiền tố: "dong x" ~ "dong xoai" — vẫn phải chiếm tỷ trọng đáng kể.
  if (shorter.length >= 4 && !tooDilute && longer.startsWith(shorter)) return 0.92;

  // Khớp chữ cái đầu các từ: "dx" ~ "dong xoai".
  // Chỉ chấp nhận khi số chữ cái khớp đúng số từ của tên đầy đủ (>=2 từ),
  // tránh "a" hay "z" khớp bừa với mọi tên.
  if (shorterWords.length === 1 && shorter.length >= 2 && longerWords.length >= 2) {
    const initials = longerWords.map((w) => w[0]).join('');
    if (initials === shorter) return 0.9;
  }

  // Mẩu quá ngắn / quá loãng so với ứng viên: coi như không khớp.
  if (tooShortToTrust || tooDilute) return 0;

  // Cửa ải rẻ trước phép đắt: nếu hai chuỗi không dùng chung đủ ký tự thì
  // Levenshtein/Dice chắc chắn cho điểm thấp. Kiểm tra này O(n) và loại bỏ
  // phần lớn cặp không liên quan trước khi chạy quy hoạch động O(n·m).
  if (!shareEnoughCharacters(s, t)) return 0;

  // Một phép đảo hai ký tự kề trong toàn bộ địa danh vẫn là bằng chứng mạnh.
  // Chỉ chạy sau cửa ải ký tự rẻ để không làm chậm vòng lặp dò hàng trăm hub.
  if (isSingleAdjacentTransposition(s, t)) return 0.9;

  const maxLen = Math.max(s.length, t.length);
  const dist = damerauLevenshtein(s, t, Math.ceil(maxLen * 0.5));
  const levScore = dist > maxLen ? 0 : 1 - dist / maxLen;
  const diceScore = diceCoefficient(s, t);

  // Dice ổn định hơn với chuỗi dài, Levenshtein nhạy hơn với lỗi gõ ngắn.
  return Math.max(levScore * 0.55 + diceScore * 0.45, diceScore * 0.85);
}

/**
 * Tìm ứng viên khớp nhất trong danh sách.
 *
 * @param {string} query Chuỗi người dùng nhập
 * @param {Array} candidates Danh sách ứng viên
 * @param {object} options
 * @param {(c:any)=>string|string[]} options.getText Trích chuỗi (hoặc nhiều bí danh) từ ứng viên
 * @param {number} options.threshold Ngưỡng chấp nhận (mặc định 0.62)
 * @param {number} options.limit Số kết quả trả về
 * @returns {Array<{item:any, score:number, matchedText:string}>} Sắp giảm dần theo điểm
 */
export function fuzzyFind(query, candidates = [], options = {}) {
  const { getText = (c) => String(c), threshold = 0.62, limit = 5 } = options;
  const q = expandColloquial(query);
  if (!q || !Array.isArray(candidates) || candidates.length === 0) return [];

  const scored = [];
  for (const item of candidates) {
    const raw = getText(item);
    const texts = Array.isArray(raw) ? raw.filter(Boolean) : [raw].filter(Boolean);
    let best = 0;
    let bestText = '';
    for (const text of texts) {
      const score = similarity(q, text);
      if (score > best) {
        best = score;
        bestText = String(text);
      }
    }
    if (best >= threshold) {
      scored.push({ item, score: best, matchedText: bestText });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Quét toàn câu để tìm cụm con khớp nhất với một ứng viên.
 * Dùng khi địa danh nằm lẫn trong câu dài: "mai mình đi từ bù đốp xuống hàng xanh nhé".
 *
 * Trượt cửa sổ 1..4 từ (độ dài phổ biến của địa danh Việt Nam).
 */
export function findBestSpan(sentence, candidateText, { threshold = 0.72, tokens: presetTokens, anchorIndices } = {}) {
  // `tokens` cho phép người gọi băm câu MỘT LẦN rồi dùng lại cho hàng chục ứng viên.
  // Không có nó, việc dò địa danh phải tokenize lại cùng một câu ~50 lần và
  // chi phí đội lên gần 10ms/câu — quá ngưỡng <1ms của trí tuệ bản địa.
  const tokens = presetTokens || tokenize(sentence, { keepStopWords: true });
  if (tokens.length === 0) return null;

  const candidate = expandColloquial(candidateText);
  if (!candidate) return null;

  let best = null;
  const maxWindow = Math.min(4, tokens.length);
  const candLength = candidate.length;
  // Khi tầng gọi đã biết các vị trí chia sẻ token với ứng viên, mọi cửa sổ
  // không chứa một trong các vị trí đó chắc chắn không thể là lỗi gõ hợp lệ.
  // Giảm mạnh số lần chạy similarity (Damerau-Levenshtein + Dice) trong câu dài.
  const anchorPrefix = Array.isArray(anchorIndices) && anchorIndices.length > 0 ? new Int32Array(tokens.length + 1) : null;
  if (anchorPrefix) {
    for (const index of anchorIndices) {
      if (index >= 0 && index < tokens.length) anchorPrefix[index + 1] = 1;
    }
    for (let index = 1; index < anchorPrefix.length; index++) anchorPrefix[index] += anchorPrefix[index - 1];
  }

  // Lọc rẻ trước khi chấm điểm đắt: điểm tương đồng bị chặn trên bởi tỷ lệ độ dài
  // hai chuỗi, nên cụm quá ngắn hoặc quá dài so với ứng viên không thể vượt ngưỡng.
  // Bỏ qua chúng giúp tránh hàng nghìn lần chuẩn hoá + Levenshtein vô ích.
  const minLength = Math.floor(candLength * threshold * 0.6);
  const maxLength = Math.ceil(candLength / (threshold * 0.6));

  // Quét từ cụm NGẮN đến DÀI: địa danh là cụm gọn nhất khớp được.
  // Quét ngược lại sẽ nuốt kèm giới từ ("đi từ bù đốp" thay vì "bù đốp").
  for (let size = 1; size <= maxWindow; size++) {
    for (let i = 0; i + size <= tokens.length; i++) {
      if (anchorPrefix && anchorPrefix[i + size] === anchorPrefix[i]) continue;
      const span = tokens.slice(i, i + size).join(' ');
      if (span.length < minLength || span.length > maxLength) continue;

      // Cả `span` (từ tokenize) lẫn `candidate` đều đã qua expandColloquial.
      const score = similarity(span, candidate, { preNormalized: true });
      // Dùng ">" nên cụm ngắn hơn thắng khi điểm ngang nhau.
      if (score >= threshold && (!best || score > best.score)) {
        best = { span, score, startIndex: i, endIndex: i + size };
      }
    }
  }

  return best;
}
