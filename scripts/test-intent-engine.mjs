/**
 * ============================================================================
 * KIỂM THỬ BỘ HIỂU Ý ĐỊNH BẢN ĐỊA (NATIVE INTENT ENGINE — ZERO-LLM)
 * ============================================================================
 *
 * 1. Chuẩn hoá & so khớp mờ tiếng Việt (khử dấu, viết tắt, lỗi gõ)
 * 2. Phân loại ý định có trọng số (8 nhóm ý định)
 * 3. Trích xuất thực thể: điểm đi/đến, thời gian, số ghế, ngân sách, tiện ích
 * 4. BẤT BIẾN AN TOÀN: tuyệt đối KHÔNG bịa ra địa danh không có trong câu
 * 5. Hiệu năng: toàn bộ suy luận phải chạy dưới 1ms/câu (yêu cầu Cursor Ambient)
 */

import {
  foldDiacritics,
  expandColloquial,
  similarity,
  damerauLevenshtein,
  diceCoefficient,
  fuzzyFind,
  findBestSpan,
  classifyIntent,
  extractRoute,
  extractTime,
  extractSeats,
  extractBudget,
  extractPerks,
  parseUserMessage,
  INTENTS
} from '@carmate/shared';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(70)}\n${title}\n${'─'.repeat(70)}`);
}

// ════════════════════════════════════════════════════════════════════
section('1. CHUẨN HOÁ & SO KHỚP MỜ TIẾNG VIỆT');
// ════════════════════════════════════════════════════════════════════

check('Khử dấu "Bù Đốp" -> "bu dop"', foldDiacritics('Bù Đốp') === 'bu dop');
check('Khử dấu "Đồng Xoài" -> "dong xoai"', foldDiacritics('Đồng Xoài') === 'dong xoai');
check('Khử dấu chữ Đ hoa', foldDiacritics('ĐỒNG XOÀI') === 'dong xoai');
check('Mở rộng viết tắt "sg" -> "sai gon"', expandColloquial('sg') === 'sai gon');
check('Mở rộng viết tắt "tp.hcm" -> "sai gon"', expandColloquial('tp.hcm') === 'sai gon');
check('Mở rộng viết tắt "bp" -> "binh phuoc"', expandColloquial('bp') === 'binh phuoc');

check('Khoảng cách Levenshtein cơ bản', damerauLevenshtein('bu dop', 'bu dop') === 0);
check('Levenshtein bắt hoán vị kề (gõ nhanh)', damerauLevenshtein('hnag', 'hang') === 1, 'phải là 1 phép hoán vị');
check('Dice trùng khít = 1', diceCoefficient('hang xanh', 'hang xanh') === 1);

check('Gõ không dấu "budop" nhận ra "Bù Đốp"', similarity('budop', 'Bù Đốp') >= 0.9);
check('Gõ sai dấu "bù đóp" nhận ra "Bù Đốp"', similarity('bù đóp', 'Bù Đốp') >= 0.9);
check('Gõ lỗi "Đôngf Xoài" nhận ra "Đồng Xoài"', similarity('Đôngf Xoài', 'Đồng Xoài') >= 0.8);
check('Viết tắt "dx" nhận ra "Đồng Xoài"', similarity('dx', 'Đồng Xoài') >= 0.85);
check('Hai địa danh khác nhau phải điểm thấp', similarity('bu dop', 'Hàng Xanh') < 0.3);

check(
  'fuzzyFind xếp hạng đúng ứng viên',
  fuzzyFind('budop', [{ n: 'Hàng Xanh' }, { n: 'Bù Đốp' }], { getText: (c) => c.n })[0]?.item.n === 'Bù Đốp'
);
check(
  'findBestSpan trả về cụm gọn nhất, không nuốt giới từ',
  findBestSpan('mai minh di tu bu dop', 'Bù Đốp')?.span === 'bu dop'
);

// ════════════════════════════════════════════════════════════════════
section('2. PHÂN LOẠI Ý ĐỊNH');
// ════════════════════════════════════════════════════════════════════

const intentCases = [
  ['cho mình hỏi đi bù đốp bao nhiêu tiền vậy ạ', INTENTS.ASK_PRICE],
  ['nhiu tien z a', INTENTS.ASK_PRICE],
  ['có xe nào đi sg sáng mai không', INTENTS.FIND_TRIP],
  ['mai mình đi từ bù đốp xuống hàng xanh 2 ghế nhé', INTENTS.FIND_TRIP],
  ['ông tài xế này có uy tín không vậy', INTENTS.CHECK_TRUST],
  ['huỷ chuyến giùm mình', INTENTS.CANCEL_TRIP],
  ['xe tôi tới đâu rồi', INTENTS.TRIP_STATUS],
  ['carmate có mất phí không', INTENTS.ASK_POLICY],
  ['xin chào', INTENTS.GREETING]
];

for (const [text, expected] of intentCases) {
  const result = classifyIntent(text);
  check(`"${text}" -> ${expected}`, result.intent === expected, `nhận được: ${result.intent}`);
}

check('Chuỗi rỗng trả về UNKNOWN', classifyIntent('').intent === INTENTS.UNKNOWN);
check('Độ tin cậy nằm trong [0,1]', intentCases.every(([t]) => {
  const c = classifyIntent(t).confidence;
  return c >= 0 && c <= 1;
}));

// ════════════════════════════════════════════════════════════════════
section('3. BẤT BIẾN AN TOÀN — KHÔNG BAO GIỜ BỊA ĐỊA DANH');
// ════════════════════════════════════════════════════════════════════

// Đây là bất biến quan trọng nhất của toàn engine. Câu KHÔNG chứa địa danh thì
// tuyệt đối không được sinh ra điểm đi/điểm đến. Thà bỏ sót còn hơn bịa đặt.
const noPlaceCases = [
  'nhiu tien z a',
  'huỷ chuyến giùm mình',
  'xin chào',
  'carmate có mất phí không',
  'xe tôi tới đâu rồi',
  'ông tài xế này có uy tín không vậy',
  'cho mình hỏi cái này với',
  'ok bạn nhé cảm ơn',
  'alo alo',
  'bao nhiêu tiền vậy bạn',
  'mình muốn đặt 2 ghế',
  'giá cả thế nào'
];

for (const text of noPlaceCases) {
  const route = extractRoute(text);
  check(
    `KHÔNG bịa địa danh: "${text}"`,
    route.from === null && route.to === null,
    `bịa ra: ${route.from || ''} ${route.to || ''}`
  );
}

// ════════════════════════════════════════════════════════════════════
section('4. TRÍCH XUẤT ĐIỂM ĐI / ĐIỂM ĐẾN');
// ════════════════════════════════════════════════════════════════════

const routeCases = [
  ['mai mình đi từ bù đốp xuống hàng xanh', /Bù Đốp/i, /Hàng Xanh/i],
  ['từ Chơn Thành xuống Bàu Bàng', /Chơn Thành/i, /Bàu Bàng/i],
  ['xe từ Lộc Ninh đi Chợ Rẫy', /Lộc Ninh/i, /Chợ Rẫy/i],
  ['đi Bình Long về Tân Khai', null, /Bình Long|Tân Khai/i]
];

for (const [text, fromPattern, toPattern] of routeCases) {
  const route = extractRoute(text);
  if (fromPattern) {
    check(`Điểm đi của "${text}"`, fromPattern.test(route.from || ''), `nhận: ${route.from}`);
  }
  if (toPattern) {
    check(`Điểm đến của "${text}"`, toPattern.test(route.to || ''), `nhận: ${route.to}`);
  }
}

check('Nhận địa danh 1 từ đứng riêng: "đi Hàng Xanh"', /Hàng Xanh/i.test(extractRoute('đi Hàng Xanh').to || ''));
check('Nhận tỉnh/thành: "đi sg"', /HCM|Sài Gòn/i.test(extractRoute('có xe nào đi sg không').to || extractRoute('có xe nào đi sg không').from || ''));

// Mọi địa danh trả về PHẢI là hub/tỉnh có thật trong hệ thống.
const sampleRoute = extractRoute('từ Chơn Thành xuống Bàu Bàng');
check(
  'Địa danh trả về luôn kèm định danh hệ thống (hub id / province id)',
  Boolean(sampleRoute.fromHub?.id) && Boolean(sampleRoute.toHub?.id)
);

// ════════════════════════════════════════════════════════════════════
section('5. TRÍCH XUẤT THỜI GIAN');
// ════════════════════════════════════════════════════════════════════

const NOW = new Date(2026, 8, 15); // 15/09/2026

check('"hôm nay" -> đúng ngày hiện tại', extractTime('đi hôm nay', NOW).date === '2026-09-15');
check('"mai" -> ngày kế tiếp', extractTime('đi mai', NOW).date === '2026-09-16');
check('"ngày kia" -> cách 2 ngày', extractTime('đi ngày kia', NOW).date === '2026-09-17');
check('Ngày tuyệt đối "25/12"', extractTime('đi ngày 25/12', NOW).date === '2026-12-25');

check('"sáng" -> khung giờ sáng', extractTime('đi sáng mai', NOW).timeSlot === '07:00-09:00');
check('"chiều" -> khung giờ chiều', extractTime('đi chiều nay', NOW).timeSlot === '13:00-15:00');
check('"sáng sớm" ưu tiên hơn "sáng"', extractTime('đi sáng sớm mai', NOW).timeSlot === '05:00-07:00');
check('Giờ cụ thể "7h" -> giờ 7', extractTime('đi 7h sáng', NOW).explicitHour === 7);
check('"5 giờ chiều" quy đổi thành 17h', extractTime('đi 5 giờ chiều', NOW).explicitHour === 17);
check('Giờ không hợp lệ bị loại bỏ', extractTime('đi 99h', NOW).explicitHour === null);
check('Câu không có thời gian -> null', extractTime('tìm xe đi Hàng Xanh', NOW).date === null);

// ════════════════════════════════════════════════════════════════════
section('6. TRÍCH XUẤT SỐ GHẾ & NGÂN SÁCH');
// ════════════════════════════════════════════════════════════════════

check('"2 ghế" -> 2', extractSeats('đặt 2 ghế') === 2);
check('"3 người" -> 3', extractSeats('nhà mình 3 người') === 3);
check('"hai người" (chữ) -> 2', extractSeats('hai người đi') === 2);
check('"một mình" -> 1', extractSeats('mình đi một mình') === 1);
check('Mặc định khi không nói -> 1', extractSeats('tìm xe đi Hàng Xanh') === 1);
check('Số ghế vô lý bị loại (99 ghế)', extractSeats('đặt 99 ghế') === 1);

check('"dưới 150k" -> 150000', extractBudget('tìm xe dưới 150k') === 150000);
check('"200 nghìn" -> 200000', extractBudget('khoảng 200 nghìn') === 200000);
check('Số tiền phi lý bị loại', extractBudget('giá 5 đồng') === null);
check('Không nói giá -> null', extractBudget('tìm xe đi Hàng Xanh') === null);

// ════════════════════════════════════════════════════════════════════
section('7. TRÍCH XUẤT TIỆN ÍCH & RÀNG BUỘC');
// ════════════════════════════════════════════════════════════════════

check('Nhận "không thuốc lá"', extractPerks('xe không thuốc lá').noSmoking === true);
check('Nhận "xe gia đình"', extractPerks('tìm xe gia đình').requiresFamilyCar === true);
check('Nhận "hành lý"', extractPerks('mình có nhiều hành lý').hasLuggage === true);
check('Nhận "trẻ em"', extractPerks('đi cùng trẻ em').withChild === true);
check('Nhận "sân bay"', extractPerks('ra sân bay').needAirport === true);
check('Nhận "bệnh viện"', extractPerks('đi bệnh viện').needHospital === true);
check('Câu trung tính không sinh cờ thừa', Object.keys(extractPerks('tìm xe đi Hàng Xanh')).length === 0);

// ════════════════════════════════════════════════════════════════════
section('8. PHÂN TÍCH TỔNG HỢP (parseUserMessage)');
// ════════════════════════════════════════════════════════════════════

const full = parseUserMessage('mai mình đi từ bù đốp xuống hàng xanh 2 ghế xe gia đình không thuốc lá', {
  now: NOW
});
check('Ý định = tìm chuyến', full.intent === INTENTS.FIND_TRIP);
check('Điểm đi Bù Đốp', /Bù Đốp/i.test(full.slots.from || ''));
check('Điểm đến Hàng Xanh', /Hàng Xanh/i.test(full.slots.to || ''));
check('Ngày = mai', full.slots.date === '2026-09-16');
check('Số ghế = 2', full.slots.seats === 2);
check('Cờ xe gia đình', full.slots.requiresFamilyCar === true);
check('Cờ không thuốc lá', full.slots.noSmoking === true);
check('Không cần hỏi lại (đủ thông tin)', full.needsClarification === false);
check('Nhãn engine đúng', full.engine === 'native-intent-engine-v1');

const vague = parseUserMessage('alo bạn ơi', { now: NOW });
check('Câu mơ hồ -> cần hỏi lại', vague.needsClarification === true || vague.intent === INTENTS.GREETING);

const missing = parseUserMessage('tìm xe đi ghép', { now: NOW });
check('Thiếu tuyến -> báo cần hỏi lại', missing.needsClarification === true);
check('Liệt kê đúng slot còn thiếu', missing.missingSlots.includes('from') || missing.missingSlots.includes('to'));

// ════════════════════════════════════════════════════════════════════
section('9. ĐỘ BỀN ĐẦU VÀO (ROBUSTNESS)');
// ════════════════════════════════════════════════════════════════════

const hostileInputs = [
  '',
  '   ',
  null,
  undefined,
  '<script>alert(1)</script>',
  '🚗🚗🚗',
  'a'.repeat(5000),
  '!!!???...',
  '0000000000',
  'SELECT * FROM users'
];

let robust = true;
let crashedOn = '';
for (const input of hostileInputs) {
  try {
    const r = parseUserMessage(input);
    if (typeof r.intent !== 'string' || typeof r.confidence !== 'number') {
      robust = false;
      crashedOn = String(input).slice(0, 30);
    }
  } catch (err) {
    robust = false;
    crashedOn = `${String(input).slice(0, 30)} (${err.message})`;
  }
}
check('Không sập với đầu vào rỗng/độc hại/quá dài', robust, crashedOn);

const xssRoute = extractRoute('<script>alert(1)</script>');
check('Đầu vào XSS không sinh địa danh', xssRoute.from === null && xssRoute.to === null);

// ════════════════════════════════════════════════════════════════════
section('10. HIỆU NĂNG (CURSOR AMBIENT — DƯỚI 1ms)');
// ════════════════════════════════════════════════════════════════════

const perfSentences = [
  'mai mình đi từ bù đốp xuống hàng xanh 2 ghế',
  'có xe nào đi sg sáng mai không',
  'nhiu tien z a',
  'tìm xe gia đình không thuốc lá dưới 150k đi Đồng Xoài'
];

// Làm nóng để loại nhiễu JIT.
for (let i = 0; i < 50; i++) parseUserMessage(perfSentences[i % perfSentences.length]);

const ITERATIONS = 400;
const start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  parseUserMessage(perfSentences[i % perfSentences.length]);
}
const avgMs = (performance.now() - start) / ITERATIONS;

console.log(`  ⏱️  Thời gian trung bình: ${avgMs.toFixed(3)}ms/câu`);
check(`Suy luận dưới 1ms/câu (đo được ${avgMs.toFixed(3)}ms)`, avgMs < 1);

// ════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(70)}`);
console.log(`KẾT QUẢ: ${passed}/${passed + failed} bài kiểm thử PASS`);
if (failed > 0) {
  console.log(`\n❌ ${failed} bài THẤT BẠI:`);
  failures.forEach((f) => console.log(`   • ${f}`));
  console.log('═'.repeat(70));
  process.exit(1);
}
console.log('✅ TOÀN BỘ BÀI KIỂM THỬ ĐẠT — Bộ hiểu ý định bản địa sẵn sàng vận hành.');
console.log('═'.repeat(70));
