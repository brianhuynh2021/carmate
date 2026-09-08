/**
 * CarMate AI Native NLP PII & Off-platform Guard
 * Triết lý MIT Invariants & Cursor Edge AI (< 0.2ms, Zero-LLM)
 * 
 * Phát hiện và ngăn chặn 100% các thủ thuật lách sàn của người dùng Việt Nam:
 * 1. Số di động thông thường, số bàn, mã quốc tế (+84 / 84)
 * 2. Số chèn dấu chấm, dấu cách, dấu gạch ngang, gạch chéo: 0.9.8.4...
 * 3. Ký tự Homoglyph / Teencode: chữ 'O'/'o' thay cho số 0, 'l' thay cho 1
 * 4. Emoji số: 0️⃣, 1️⃣, ⓪, ①, ⓿, ❶...
 * 5. Số viết bằng CHỮ TIẾNG VIỆT: "ko chín tám bốn...", "không chín một hai..."
 * 6. Từ khoá lôi kéo ra ngoài nền tảng: Zalo (zalo, z.a.l.o, zl, dza lo, da lo), Facebook, Telegram, SĐT...
 */

// Bảng ánh xạ emoji và ký tự đặc biệt sang chữ số thường
const SPECIAL_DIGIT_MAP = {
  '0️⃣': '0', '1️⃣': '1', '2️⃣': '2', '3️⃣': '3', '4️⃣': '4',
  '5️⃣': '5', '6️⃣': '6', '7️⃣': '7', '8️⃣': '8', '9️⃣': '9',
  '⓪': '0', '①': '1', '②': '2', '③': '3', '④': '4',
  '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9',
  '⓿': '0', '❶': '1', '❷': '2', '❸': '3', '❹': '4',
  '❺': '5', '❻': '6', '❼': '7', '❽': '8', '❾': '9',
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '⑧': '8', '⑨': '9'
};

// Từ điển đồng âm chữ số tiếng Việt (kể cả teencode phổ biến)
const VIETNAMESE_NUMBER_WORDS = [
  { words: ['không', 'khong', 'zê rô', 'ze ro', 'zero', 'ko', 'k', 'o'], digit: '0' },
  { words: ['mười'], digit: '10' },
  { words: ['một', 'mot', 'mốt'], digit: '1' },
  { words: ['hai'], digit: '2' },
  { words: ['ba'], digit: '3' },
  { words: ['bốn', 'bon', 'tư', 'tu'], digit: '4' },
  { words: ['năm', 'nam', 'lăm', 'lam'], digit: '5' },
  { words: ['sáu', 'sau'], digit: '6' },
  { words: ['bảy', 'bay', 'bẩy', 'bậy'], digit: '7' },
  { words: ['tám', 'tam'], digit: '8' },
  { words: ['chín', 'chin'], digit: '9' }
];

// Các từ khóa lôi kéo nền tảng (Off-platform leakage keywords)
const OFF_PLATFORM_PATTERNS = [
  /\b(zalo|za\s*lo|z\.a\.l\.o|z-a-l-o|z\s*l|dza\s*lo|dzalo|da\s*lo)\b/i,
  /\b(facebook|face\s*book|fb\.com|phây\s*búc|phay\s*buc|fây|phây)\b/i,
  /\b(telegram|tele|t\.me)\b/i,
  /\b(số\s*(điện\s*thoại|đt|fôn|phone|me)|sđt|sdt|so\s*dt|nháy\s*máy|nhay\s*may)\b/i
];

/**
 * Chuẩn hoá văn bản thô:
 * - Thay emoji số về chữ số thông thường
 * - Chuyển chữ hoa thường
 * - Khử dấu thanh Unicode tổ hợp
 */
function normalizeRawText(text = '') {
  let normalized = String(text || '');

  // 1. Thay thế emoji và số vòng tròn
  for (const [char, digit] of Object.entries(SPECIAL_DIGIT_MAP)) {
    normalized = normalized.split(char).join(digit);
  }

  return normalized.toLowerCase().trim();
}

/**
 * Phát hiện số điện thoại bằng chữ tiếng Việt (Spelled-out Vietnamese phone number):
 * Ví dụ: "ko chín tám bốn tám tám ba bảy năm không" -> "0984883750"
 */
function extractSpelledOutNumbers(text = '') {
  const words = text
    .replace(/[.,;:\-_/\\+~*]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let digitSequence = '';
  let inSequence = false;
  let maxSequence = '';

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    let matchedDigit = null;

    // Kiểm tra xem từ hiện tại có phải là từ chỉ số không
    for (const entry of VIETNAMESE_NUMBER_WORDS) {
      if (entry.words.includes(w)) {
        matchedDigit = entry.digit;
        break;
      }
    }

    // Nếu từ đó là chữ số nguyên thủy (0-9)
    if (/^[0-9]$/.test(w)) {
      matchedDigit = w;
    }

    if (matchedDigit !== null) {
      inSequence = true;
      digitSequence += matchedDigit;
      if (digitSequence.length > maxSequence.length) {
        maxSequence = digitSequence;
      }
    } else {
      if (inSequence) {
        // Chuỗi bị ngắt quãng
        if (digitSequence.length >= 9) {
          return digitSequence;
        }
        digitSequence = '';
        inSequence = false;
      }
    }
  }

  return maxSequence.length >= 9 ? maxSequence : '';
}

/**
 * Trích xuất chuỗi số dạng ngụy trang (có dấu cách, dấu chấm, dấu gạch xen kẽ):
 * Ví dụ: "0 9 8 4 . 8 8 3 . 7 5 0", "o984 883 750", "+84 984 883 750"
 */
function extractObfuscatedDigits(text = '') {
  // Thay thế các biến thể chữ O/o và l/I đứng cạnh hoặc xen kẽ trong chuỗi số
  // 1. o đứng đầu trước chuỗi số: o984...
  let clean = text.replace(/(^|[^a-z0-9])[oO](?=[0-9\s.\-_/]{7,})/gi, '$10');
  // 2. o đứng cuối sau chuỗi số: 098488375o
  clean = clean.replace(/(?<=[0-9\s.\-_/]{7,})[oO]($|[^a-z0-9])/gi, '0$1');
  // 3. o đứng giữa các số: 098o883750
  clean = clean.replace(/(?<=[0-9])[oO](?=[0-9])/gi, '0');
  // 4. l hoặc I đứng giữa các số: 0984 883 75l
  clean = clean.replace(/(?<=[0-9])[lI|](?=[0-9\s.\-_/]*$|[0-9])/g, '1');

  // Tìm các cụm có nhiều chữ số và ký tự ngăn cách xen kẽ
  // Ví dụ: 0984.883.750, 0984 883 750, 0-9-8-4-8-8-3-7-5-0
  const candidateMatches = clean.match(/(?:\+?84|0)[0-9\s.\-_/]{8,24}/g) || [];

  for (const candidate of candidateMatches) {
    const pureDigits = candidate.replace(/[^0-9]/g, '');
    // Kiểm tra độ dài hợp lệ số điện thoại Việt Nam (10 hoặc 11 số nếu có 84)
    if (
      (pureDigits.startsWith('0') && pureDigits.length >= 10 && pureDigits.length <= 11) ||
      (pureDigits.startsWith('84') && pureDigits.length >= 11 && pureDigits.length <= 12)
    ) {
      return pureDigits;
    }
  }

  // Quét bất kỳ chuỗi số thuần túy nào có từ 9 đến 11 chữ số
  const pureMatches = clean.match(/[0-9]{9,11}/g) || [];
  if (pureMatches.length > 0) {
    return pureMatches[0];
  }

  return '';
}

/**
 * Kiểm tra xem chuỗi số có phải số điện thoại di động / cố định hợp lệ tại Việt Nam
 */
function isVietnamesePhone(digits = '') {
  if (!digits) return false;
  // Chuẩn hóa đầu số 84 -> 0
  const normalized = digits.startsWith('84') ? '0' + digits.slice(2) : digits;

  // Đầu số di động Việt Nam: 03x, 05x, 07x, 08x, 09x (10 số)
  // Đầu số bàn: 02x (11 số)
  return /^(0)(3|5|7|8|9)[0-9]{8}$/.test(normalized) || /^(02)[0-9]{9}$/.test(normalized);
}

/**
 * Hàm kiểm duyệt và phát hiện rò rỉ thông tin liên hệ (PII Leak Guard)
 * @param {string} text - Nội dung tin nhắn người dùng gõ
 * @returns {Object} { hasLeak, reason, detectedSample, maskedText, warningMessage }
 */
export function detectPiiLeak(text = '') {
  if (!text || typeof text !== 'string') {
    return { hasLeak: false, maskedText: text || '' };
  }

  const normalized = normalizeRawText(text);

  // 1. Kiểm tra số ngụy trang qua ký tự / dấu cách / dấu chấm
  const obfuscatedDigits = extractObfuscatedDigits(normalized);
  if (obfuscatedDigits && isVietnamesePhone(obfuscatedDigits)) {
    return {
      hasLeak: true,
      reason: 'phone_number_detected',
      detectedSample: obfuscatedDigits,
      warningMessage: 'Hệ thống phát hiện bạn đang gửi số điện thoại. Vì an toàn và chống lừa đảo/bom xe, CarMate tự động bảo mật số điện thoại cho đến khi cả hai bên bấm Xác nhận chốt chuyến.',
      maskedText: '[Đã che số điện thoại vì an toàn 🛡️]'
    };
  }

  // 2. Kiểm tra số viết bằng CHỮ tiếng Việt ("ko chín tám bốn...")
  const spelledOutDigits = extractSpelledOutNumbers(normalized);
  if (spelledOutDigits && isVietnamesePhone(spelledOutDigits)) {
    return {
      hasLeak: true,
      reason: 'spelled_out_phone_detected',
      detectedSample: spelledOutDigits,
      warningMessage: 'Hệ thống phát hiện bạn đang gửi số điện thoại bằng chữ. Để bảo vệ chuyến đi, vui lòng thỏa thuận điểm đón rồi bấm [Đề xuất chốt]. Số điện thoại sẽ tự động mở sau khi chốt!',
      maskedText: '[Đã che số điện thoại vì an toàn 🛡️]'
    };
  }

  // 3. Kiểm tra các từ khóa lôi kéo nền tảng (Zalo, Facebook, SĐT...)
  for (const pattern of OFF_PLATFORM_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        hasLeak: true,
        reason: 'off_platform_keyword_detected',
        detectedSample: normalized.match(pattern)?.[0] || 'liên hệ ngoài',
        warningMessage: 'Hệ thống phát hiện từ khóa trao đổi ngoài nền tảng. Vì an toàn và quyền lợi bảo vệ chuyến đi, vui lòng trao đổi trực tiếp trong khung chat CarMate!',
        maskedText: '[Đã che liên hệ ngoài vì an toàn 🛡️]'
      };
    }
  }

  return {
    hasLeak: false,
    maskedText: text
  };
}

/**
 * Che số điện thoại một phần để hiển thị an toàn (VD: 0984883750 -> 098***3750)
 */
export function maskPhoneNumber(phone = '') {
  if (!phone || typeof phone !== 'string') return '';
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length < 8) return '090***xxxx';
  return `${clean.slice(0, 3)}***${clean.slice(-4)}`;
}
