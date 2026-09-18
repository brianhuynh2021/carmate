export const REPORT_RECEIPTS_KEY = 'carmate_operator_reports_v1';

export function safeSourceUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function operatorPhone(value) {
  if (typeof value !== 'string' || !/^[+\d\s().-]+$/.test(value)) return null;
  const phone = value.replace(/[\s().-]/g, '');
  return /^\+?\d{8,15}$/.test(phone) ? phone : null;
}

export function operatorFreshness(operator, now = Date.now()) {
  const checked = Date.parse(operator?.checkedAt);
  const until = Date.parse(operator?.freshUntil);
  if (!Number.isFinite(checked) || !Number.isFinite(until) || checked > now || until < checked || operator?.freshness === 'unreviewed') {
    return { state: 'unknown', label: 'Chưa rõ thời điểm đối chiếu', message: 'Thông tin chưa đủ mốc kiểm tra. Hãy liên hệ để xác nhận.' };
  }
  if (until <= now || operator?.freshness === 'stale') {
    return { state: 'stale', label: 'Cần kiểm tra lại', message: 'Đã quá hạn đối chiếu. Số liên hệ, lịch và giá có thể đã thay đổi.' };
  }
  return { state: 'fresh', label: 'Trong hạn đối chiếu nguồn', message: 'Đối chiếu nguồn thông tin không xác nhận ghế trống, giờ đón hoặc chất lượng chuyến.' };
}

export function operatorDate(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Chưa có thông tin';
}

export function ownerStateLabel(status) {
  return ({ pending: 'Chờ kiểm tra', approved: 'Đã chấp thuận', rejected: 'Chưa được chấp thuận', revoked: 'Đã thu hồi', withdrawn: 'Đã rút yêu cầu', resolved: 'Đã xử lý', closed: 'Đã đóng', reviewing: 'Đang kiểm tra' })[String(status || '').toLowerCase()] || 'Chưa rõ trạng thái';
}

export function parseCoverage(value) {
  return [...new Set(String(value || '').split(/[,\n]/).map((part) => part.trim()).filter(Boolean))];
}

export function ownerPatch(draft) {
  return {
    coverage: parseCoverage(draft.coverage),
    scheduleNote: String(draft.scheduleNote || '').trim(),
    pricingMode: draft.pricingMode === 'listed' ? 'listed' : 'contact',
    priceNote: draft.pricingMode === 'listed' ? String(draft.priceNote || '').trim() : '',
    pickupNote: String(draft.pickupNote || '').trim()
  };
}

export function parseReceipts(raw) {
  try {
    const items = JSON.parse(raw || '[]');
    return Array.isArray(items) ? items.filter((item) => typeof item?.id === 'string' && typeof item?.accessToken === 'string' && item.id && item.accessToken).slice(0, 20) : [];
  } catch { return []; }
}

export function mergeReceipt(receipts, receipt) {
  return [receipt, ...receipts.filter((item) => item.id !== receipt.id)].slice(0, 20);
}

export function parseCopiedReceipt(raw) {
  try {
    const value = JSON.parse(raw);
    if (typeof value?.id !== 'string' || !value.id || value.id.length > 160 || typeof value.accessToken !== 'string' || !value.accessToken || value.accessToken.length > 200) return null;
    return { id: value.id, accessToken: value.accessToken };
  } catch { return null; }
}
// Hàng danh bạ chỉ đủ chỗ cho một nhãn ngắn. Ngày giờ đối chiếu đầy đủ để dành
// cho phần xổ ra, ngoài hàng chỉ cần biết còn trong hạn hay không.
export function freshnessBadge(operator, now = Date.now()) {
  const state = operatorFreshness(operator, now).state;
  if (state === 'fresh') return { state, label: 'Đã đối chiếu', tone: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10' };
  if (state === 'stale') return { state, label: 'Quá hạn', tone: 'text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10' };
  return { state, label: 'Chưa đối chiếu', tone: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/10' };
}

// Khu vực trong dữ liệu là một dòng dài nối bằng ⇄. Ngoài hàng chỉ hiện đầu và
// cuối tuyến; đọc cả chuỗi mười trạm trên một hàng vừa chật vừa mệt mắt.
export function coverageEndpoints(coverage = []) {
  const legs = String(coverage[0] || '').split(/[⇄→/]/).map(part => part.trim()).filter(Boolean);
  if (!legs.length) return '';
  return legs.length < 2 ? legs[0] : `${legs[0]} ⇄ ${legs[legs.length - 1]}`;
}

export function operatorPriceLabel(operator) {
  if (operator?.pricingMode !== 'listed' || !operator?.priceNote) return 'Liên hệ';
  return operator.priceNote;
}
