import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, ChevronRight, ExternalLink, Loader2, Phone, RefreshCw, Search, X } from 'lucide-react';
import api from '../../api/client.js';
import {
  REPORT_RECEIPTS_KEY, safeSourceUrl, operatorPhone, operatorFreshness, operatorDate,
  freshnessBadge, coverageEndpoints, operatorPriceLabel,
  ownerStateLabel, ownerPatch, parseReceipts, mergeReceipt, parseCopiedReceipt
} from './operatorPresentation.js';

const cardClass = 'rounded-2xl border border-slate-300/70 dark:border-white/10 bg-white dark:bg-[#1a2232] p-4 shadow-sm';
// Directory rows use CorridorTripCard's background and border to blend in with the rest
// of the app, but drop the shadow and lift effect: in a long list where every row
// pops up, it is harder on the eyes than easy to read.
const rowClass = 'overflow-hidden rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#1c1c1e] transition-colors hover:border-slate-300 dark:hover:border-white/25';
const inputClass = 'mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1a2232] px-3 py-2 text-slate-900 dark:text-white type-input';
const primaryClass = 'min-h-11 rounded-xl bg-[#0071e3] px-4 py-2.5 text-white disabled:opacity-50 type-button';
const secondaryClass = 'min-h-11 rounded-xl border border-slate-300 dark:border-white/15 px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 type-button';

// Number of cards shown before tapping view all: enough to see the directory has real content,
// still compact on a phone screen.
const PREVIEW_COUNT = 8;
// Strip diacritics so typing "thanh cong" still finds "Thành Công".
const searchText = value => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

function ErrorNote({ children }) {
  return children ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 type-body">{children}</p> : null;
}

function Panel({ title, onClose, children, busy = false }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const latest = useRef({ busy, onClose });
  latest.current = { busy, onClose };
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event) => {
      if (latest.current.busy) return;
      if (event.key === 'Escape') { event.preventDefault(); latest.current.onClose(); }
      if (event.key === 'Tab') {
        const controls = [...(dialogRef.current?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary') || [])].filter((element) => element.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; previousFocus?.focus?.(); };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" onClick={() => { if (!busy) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-[#DFE5EC] p-4 text-slate-900 shadow-xl dark:bg-[#0b0f19] dark:text-white sm:rounded-3xl sm:p-5" onClick={(event) => event.stopPropagation()}>
        <header className="mb-4 flex items-start justify-between gap-3">
          <h2 className="pt-1 type-title">{title}</h2>
          <button ref={closeRef} type="button" aria-label="Đóng" disabled={busy} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white dark:bg-white/10 disabled:opacity-50 type-button"><X size={20} /></button>
        </header>
        <div className="space-y-4">{children}</div>
      </section>
    </div>, document.body
  );
}

function SourceInfo({ operator, compact = false }) {
  const freshness = operatorFreshness(operator);
  const sourceUrl = safeSourceUrl(operator.source?.url);
  return <div className={`space-y-2 type-caption ${freshness.state === 'fresh' ? 'text-slate-600 dark:text-slate-300' : 'text-amber-800 dark:text-amber-200'}`}>
    <p className="type-body-strong">{freshness.label}</p>
    <p className="type-body">Đối chiếu: {operatorDate(operator.checkedAt)} · Hạn kiểm tra lại: {operatorDate(operator.freshUntil)}</p>
    {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 text-[#0071e3] underline dark:text-blue-300 type-button" onClick={(event) => event.stopPropagation()}>{operator.source?.label || 'Xem nguồn thông tin'}<ExternalLink size={12} /></a> : <p className="type-body">Nguồn: {operator.source?.label || 'Chưa ghi rõ'} · Không có liên kết công khai.</p>}
    {operator.contentUpdatedByOwner && <p className="type-body">Thông tin hoạt động do người quản lý cập nhật, cần được đối chiếu lại.</p>}
    {!compact && <p className="type-body">{freshness.message}</p>}
  </div>;
}

function ManagementInfo({ operator }) {
  return <p className="text-slate-600 dark:text-slate-300 type-caption">{operator.managementStatus === 'claimed'
    ? 'Đã xác nhận người quản lý qua kênh liên hệ. Đây không phải đánh giá chất lượng hay bảo đảm chuyến đi.'
    : 'Chưa xác nhận người quản lý hồ sơ. Thông tin được tham khảo từ nguồn ghi bên dưới.'}</p>;
}

function ClaimForm({ operator, currentUser, onRequireAuth, onDone, onBusyChange }) {
  const [message, setMessage] = useState('');
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const submit = async (user) => {
    if (!user) { setError('Vui lòng đăng nhập để gửi yêu cầu quản lý.'); return; }
    setBusy(true); onBusyChange(true); setError('');
    try {
      const result = await api.claimOperator(operator.id, { message: message.trim(), ownerAttestation: attested });
      if (!result?.success || !result.data) throw new Error('Chưa gửi được yêu cầu.');
      setSubmitted(result.data); onDone?.();
    } catch (err) { setError(err.message || 'Chưa gửi được yêu cầu. Hãy thử lại.'); }
    finally { setBusy(false); onBusyChange(false); }
  };
  const begin = (event) => {
    event.preventDefault();
    if (!attested || message.trim().length < 20) { setError('Mô tả ít nhất 20 ký tự và xác nhận quyền đại diện trước khi gửi.'); return; }
    if (currentUser) { submit(currentUser); return; }
    if (!onRequireAuth) { setError('Chưa mở được đăng nhập. Bản nháp vẫn được giữ.'); return; }
    onBusyChange(true);
    onRequireAuth({ title: 'Đăng nhập để nhận quản lý hồ sơ', subtitle: 'Nội dung bạn đã nhập được giữ nguyên. Yêu cầu sẽ được kiểm tra trước khi cấp quyền.', onSuccess: submit, onCancel: () => onBusyChange(false) });
  };
  if (submitted) return <div role="status" className={cardClass}><h3 className="type-heading">Đã gửi yêu cầu kiểm tra</h3><p className="mt-2 type-body">Bạn chưa được cấp quyền quản lý. CarMate cần kiểm tra quyền đại diện qua nguồn và kênh liên hệ của nhà xe.</p><p className="mt-2 break-all type-caption">Mã yêu cầu: {submitted.id || 'Xem trong Hồ sơ tôi quản lý'}</p></div>;
  return <form onSubmit={begin} className={` ${cardClass} space-y-3`}>
    <h3 className="type-heading">Tôi đại diện nhà xe này</h3>
    <p className="text-slate-600 dark:text-slate-300 type-body">Mô tả vai trò của bạn, kênh liên hệ chính thức và cách kiểm tra quyền đại diện. Chỉ nhập số điện thoại không tự cấp quyền quản lý. Không gửi mật khẩu hoặc mã OTP.</p>
    <label className="block type-label">Thông tin chứng minh quyền đại diện<textarea required minLength={20} maxLength={2000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} className={inputClass} placeholder="Tôi là… Trang/kênh chính thức… Có thể kiểm tra qua…" /></label>
    <label className="flex items-start gap-2 type-label"><input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} required className="mt-1 h-4 w-4 type-input" /><span>Tôi là chủ hoặc người được phép đại diện nhà xe và chịu trách nhiệm về thông tin gửi kiểm tra.</span></label>
    <ErrorNote>{error}</ErrorNote><button disabled={busy} type="submit" className={primaryClass}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu quản lý'}</button>
  </form>;
}

function ReportForm({ operator, onReceipt, onBusyChange }) {
  const [type, setType] = useState('correction');
  const [message, setMessage] = useState('');
  const [suggestedPhone, setSuggestedPhone] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); onBusyChange(true); setError('');
    try {
      const result = await api.reportOperator(operator.id, { type, message: message.trim(),
        ...(type === 'correction' && suggestedPhone.trim() ? { suggestedPhone: suggestedPhone.trim() } : {}),
        ...(contact.trim() ? { reporterContact: contact.trim() } : {}) });
      if (!result?.success || !result.data?.id || !result.data.accessToken) throw new Error('Chưa nhận được mã theo dõi. Vui lòng thử lại.');
      onReceipt({ ...result.data, operatorName: operator.name }); setSent(true);
    } catch (err) { setError(err.message || 'Chưa gửi được phản ánh.'); }
    finally { setBusy(false); onBusyChange(false); }
  };
  if (sent) return <p role="status" className={cardClass}>Đã nhận phản ánh. Mở “Phản ánh đã gửi” trong danh bạ để theo dõi. Việc gửi phản ánh chưa có nghĩa là hồ sơ đã được sửa hoặc gỡ.</p>;
  return <form onSubmit={submit} className={` ${cardClass} space-y-3`}>
    <h3 className="type-heading">Báo thông tin sai hoặc đề nghị gỡ</h3>
    <p className="text-slate-600 dark:text-slate-300 type-caption">Không cần đăng nhập. Nội dung phản ánh và thông tin liên hệ không xuất hiện trên danh bạ công khai.</p>
    <label className="block type-label">Bạn muốn báo điều gì?<select value={type} onChange={(event) => setType(event.target.value)} className={inputClass}><option value="correction">Thông tin cần sửa</option><option value="removal">Đề nghị gỡ hồ sơ</option></select></label>
    <label className="block type-label">Nội dung và nguồn để kiểm tra<textarea required minLength={10} maxLength={3000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} className={inputClass} placeholder="Thông tin nào không còn đúng? Có thể đối chiếu ở đâu?" /></label>
    {type === 'correction' && <label className="block type-label">Số đúng của nhà xe (không bắt buộc)<input type="tel" inputMode="tel" value={suggestedPhone} onChange={(event) => setSuggestedPhone(event.target.value)} maxLength={40} className={inputClass} placeholder={operator.contactPhone ? `Đang hiển thị ${operator.contactPhone}` : 'Số tổng đài hoặc số liên hệ đúng'} /><span className="mt-1 block text-slate-500 type-caption">Ghi kèm nguồn ở ô trên để quản trị đối chiếu. Số chỉ lên danh bạ sau khi được duyệt.</span></label>}
    <label className="block type-label">Liên hệ để hỏi thêm (không bắt buộc)<input value={contact} onChange={(event) => setContact(event.target.value)} maxLength={200} className={inputClass} placeholder="Email hoặc số điện thoại" /></label>
    <ErrorNote>{error}</ErrorNote><button type="submit" disabled={busy} className={primaryClass}>{busy ? 'Đang gửi…' : 'Gửi phản ánh'}</button>
  </form>;
}

// The directory is a list to skim, not a stack of text-heavy cards: each bus operator collapses
// into one skimmable row, and tapping expands the parts needed for a call.
function OperatorRow({ operator, open, onToggle, onOpenDetail }) {
  const badge = freshnessBadge(operator);
  const phone = operatorPhone(operator.contactPhone);
  const route = coverageEndpoints(operator.coverage);
  const panelId = `operator-panel-${operator.id}`;
  return <article className={rowClass}>
    <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId}
      className="flex w-full items-center gap-3 px-4 py-3 text-left">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-slate-900 dark:text-white type-body-strong">{operator.name}</span>
        {route && <span className="mt-0.5 block truncate text-slate-500 dark:text-slate-400 type-caption">{route}</span>}
      </span>
      {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 type-caption ${badge.tone}`}>{badge.label}</span>}
      <ChevronRight size={18} className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
    </button>

    {open && <div id={panelId} className="space-y-3 border-t border-slate-200 px-4 py-3 dark:border-white/10">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt className="text-slate-500 dark:text-slate-400 type-caption">Giá</dt>
        <dd className={`type-body ${operator.priceStale ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{operatorPriceLabel(operator)}{operator.priceStale && ' · giá cũ'}</dd>
        {operator.scheduleNote && <><dt className="text-slate-500 dark:text-slate-400 type-caption">Lịch</dt>
          <dd className="text-slate-700 dark:text-slate-200 type-body">{operator.scheduleNote}</dd></>}
        <dt className="text-slate-500 dark:text-slate-400 type-caption">Quản lý</dt>
        <dd className="text-slate-700 dark:text-slate-200 type-body">{operator.managementStatus === 'claimed' ? 'Đã xác nhận người quản lý' : 'Chưa có người quản lý'}</dd>
        <dt className="text-slate-500 dark:text-slate-400 type-caption">Đối chiếu</dt>
        <dd className="text-slate-700 dark:text-slate-200 type-body">{operatorDate(operator.checkedAt)}</dd>
      </dl>

      <div className="flex items-center gap-2">
        {phone
          ? <a href={`tel:${phone}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0071e3] px-3 text-white transition-colors hover:bg-[#0062c4] type-button"><Phone size={15} />Gọi {operator.contactPhone}</a>
          : <span className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-100 px-3 text-slate-500 dark:bg-white/10 dark:text-slate-400 type-button">Chưa có số liên hệ</span>}
        <button type="button" onClick={onOpenDetail} className={`${secondaryClass} shrink-0`}>Nguồn &amp; báo sai</button>
      </div>
    </div>}
  </article>;
}

function OperatorDetail({ id, currentUser, onRequireAuth, onClose, onReceipt, onClaimChange }) {
  const [operator, setOperator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await api.getOperator(id); if (!result?.success || !result.data) throw new Error('Hồ sơ hiện không thể xem.'); setOperator(result.data); }
    catch (err) { setError(err.message || 'Chưa tải được hồ sơ.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const phone = operatorPhone(operator?.contactPhone);
  return <Panel title={operator?.name || 'Thông tin nhà xe'} onClose={onClose} busy={busy}>
    {loading ? <p role="status" className="type-body">Đang tải thông tin…</p> : error ? <><ErrorNote>{error}</ErrorNote><button className={secondaryClass} onClick={load}>Thử lại</button></> : <>
      <div className={` ${cardClass} space-y-3`}>
        <ManagementInfo operator={operator} />
        <dl className="space-y-3 type-body">
          <div><dt className="text-slate-500">Khu vực / tuyến tham khảo</dt><dd>{operator.coverage?.length ? operator.coverage.join(' · ') : 'Chưa công bố'}</dd></div>
          <div><dt className="text-slate-500">Lịch hoạt động</dt><dd className="whitespace-pre-wrap">{operator.scheduleNote || 'Liên hệ để hỏi lịch hiện tại'}</dd></div>
          <div><dt className="text-slate-500">Giá</dt><dd>{operator.pricingMode === 'listed' && operator.priceNote ? operator.priceNote : 'Liên hệ để hỏi giá'}</dd>{operator.priceStale && <dd className="mt-1 text-amber-700 dark:text-amber-300 type-caption">Thông tin giá cần được kiểm tra lại.</dd>}</div>
          <div><dt className="text-slate-500 type-body">Điểm đón</dt><dd className="whitespace-pre-wrap type-body">{operator.pickupNote || 'Liên hệ để hỏi điểm đón'}</dd></div>
        </dl>
        <p className="rounded-xl bg-slate-100 p-3 dark:bg-white/5 type-caption">Danh bạ không có dữ liệu ghế trống hoặc xác nhận xe đón. Hãy hỏi trực tiếp lịch, điểm đón và tổng tiền trước khi đi.</p>
        {phone ? <a href={`tel:${phone}`} className={`type-button ${primaryClass} inline-flex w-full items-center justify-center gap-2`}><Phone size={16} />Gọi {operator.contactPhone}</a> : <p className="type-body">Chưa có số điện thoại công khai phù hợp để gọi.</p>}
      </div>
      <div className={cardClass}><SourceInfo operator={operator} /></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><button disabled={busy} type="button" className={secondaryClass} onClick={() => setAction(action === 'report' ? '' : 'report')}>Báo sai / Đề nghị gỡ</button>{operator.managementStatus !== 'claimed' && <button disabled={busy} type="button" className={secondaryClass} onClick={() => setAction(action === 'claim' ? '' : 'claim')}>Tôi đại diện nhà xe này</button>}</div>
      {action === 'report' && <ReportForm operator={operator} onReceipt={onReceipt} onBusyChange={setBusy} />}
      {action === 'claim' && <ClaimForm operator={operator} currentUser={currentUser} onRequireAuth={onRequireAuth} onDone={onClaimChange} onBusyChange={setBusy} />}
    </>}
  </Panel>;
}

function OwnerEditor({ operator, onSaved }) {
  const [draft, setDraft] = useState(() => ({ coverage: (operator.coverage || []).join('\n'), scheduleNote: operator.scheduleNote || '', pricingMode: operator.pricingMode || 'contact', priceNote: operator.priceNote || '', pickupNote: operator.pickupNote || '' }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const change = (key, value) => { setDraft((old) => ({ ...old, [key]: value })); setSaved(false); };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setSaved(false);
    try { const result = await api.updateOperator(operator.id, ownerPatch(draft)); if (!result?.success) throw new Error('Chưa lưu được thay đổi.'); setSaved(true); onSaved?.(); }
    catch (err) { setError(err.message || 'Chưa lưu được thay đổi.'); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className={` ${cardClass} space-y-3`}>
    <h3 className="type-heading">{operator.name}</h3><p className="type-caption">Bạn có quyền cập nhật thông tin hoạt động. Tên, số liên hệ và nguồn cần được kiểm tra riêng; gửi phản ánh nếu cần sửa các mục này. Lưu thay đổi sẽ xoá các mốc đối chiếu nguồn để chờ kiểm tra lại.</p>
    <label className="block type-label">Tuyến / khu vực (mỗi dòng một mục)<textarea rows={3} maxLength={1500} value={draft.coverage} onChange={(event) => change('coverage', event.target.value)} className={inputClass} /></label>
    <label className="block type-label">Thông tin lịch hoạt động<textarea rows={3} maxLength={1500} value={draft.scheduleNote} onChange={(event) => change('scheduleNote', event.target.value)} className={inputClass} /></label>
    <label className="block type-label">Cách công bố giá<select value={draft.pricingMode} onChange={(event) => change('pricingMode', event.target.value)} className={inputClass}><option value="contact">Liên hệ</option><option value="listed">Niêm yết thông tin giá</option></select></label>
    {draft.pricingMode === 'listed' && <label className="block type-label">Giá và điều kiện áp dụng<textarea required rows={2} maxLength={1500} value={draft.priceNote} onChange={(event) => change('priceNote', event.target.value)} className={inputClass} /></label>}
    <label className="block type-label">Thông tin điểm đón<textarea rows={3} maxLength={1500} value={draft.pickupNote} onChange={(event) => change('pickupNote', event.target.value)} className={inputClass} /></label>
    <ErrorNote>{error}</ErrorNote>{saved && <p role="status" className="text-emerald-700 dark:text-emerald-300 type-body">Đã lưu thông tin. Hồ sơ cần được đối chiếu lại; các mốc kiểm tra nguồn đã được xoá.</p>}<button disabled={busy} type="submit" className={primaryClass}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
  </form>;
}

function MyOperators({ onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await api.getMyOperators(); if (!result?.success || !result.data) throw new Error('Chưa tải được hồ sơ quản lý.'); setData(result.data); }
    catch (err) { setError(err.message || 'Chưa tải được hồ sơ quản lý.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return <Panel title="Hồ sơ tôi quản lý" onClose={onClose}>
    {loading ? <p role="status" className="type-body">Đang tải…</p> : error ? <><ErrorNote>{error}</ErrorNote><button onClick={load} className={secondaryClass}>Thử lại</button></> : <>
      {!data.profiles?.length && !data.claims?.length && <p className={cardClass}>Bạn chưa có hồ sơ hoặc yêu cầu quản lý. Mở hồ sơ trong danh bạ và chọn “Tôi đại diện nhà xe này” để gửi thông tin kiểm tra.</p>}
      {!!data.claims?.length && <div className={` ${cardClass} space-y-3`}><h3 className="type-heading">Yêu cầu quản lý đã gửi</h3>{data.claims.map((claim) => <div key={claim.id} className="border-t border-slate-200 pt-3 dark:border-white/10 type-body"><p className="type-body">{claim.operatorName || 'Yêu cầu quản lý hồ sơ'}</p><p className="type-body">{ownerStateLabel(claim.status)}</p><p className="break-all text-slate-500 type-caption">Mã: {claim.id}</p>{claim.resolutionNote && <p className="mt-1 whitespace-pre-wrap type-body">{claim.resolutionNote}</p>}</div>)}</div>}
      {(data.profiles || []).map((operator) => <OwnerEditor key={operator.id} operator={operator} onSaved={onChanged} />)}
    </>}
  </Panel>;
}

function ReportTracking({ receipts, onChange, onRemove, onClose, storageFailed }) {
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [restoreText, setRestoreText] = useState('');
  const check = async (receipt) => {
    setPending(receipt.id); setError('');
    try { const result = await api.getOperatorReportStatus({ id: receipt.id, accessToken: receipt.accessToken }); if (!result?.success || !result.data) throw new Error('Chưa tải được trạng thái.'); onChange({ ...receipt, ...result.data, accessToken: receipt.accessToken, operatorName: receipt.operatorName }); setRestoreText(''); }
    catch (err) { setError(err.message || 'Chưa tải được trạng thái.'); }
    finally { setPending(''); }
  };
  const restore = (event) => {
    event.preventDefault();
    const receipt = parseCopiedReceipt(restoreText);
    if (!receipt) { setError('Mã chưa đúng định dạng. Hãy dán toàn bộ nội dung đã sao chép, gồm id và accessToken.'); return; }
    check(receipt);
  };
  const copy = async (receipt) => {
    try { await navigator.clipboard.writeText(JSON.stringify({ id: receipt.id, accessToken: receipt.accessToken })); setCopied(receipt.id); }
    catch { setError('Chưa sao chép được. Mở “Xem mã lưu riêng” và lưu cả hai mã.'); }
  };
  return <Panel title="Phản ánh đã gửi" onClose={onClose}>
    <p className="type-body">Mã theo dõi được lưu riêng trong trình duyệt này. Người có mã truy cập có thể xem phản ánh; không chia sẻ công khai. Xoá dữ liệu trình duyệt sẽ mất danh sách này.</p>
    {storageFailed && <ErrorNote>Trình duyệt không lưu được mã. Hãy sao chép mã riêng trước khi đóng trang.</ErrorNote>}
    <ErrorNote>{error}</ErrorNote>
    <form onSubmit={restore} className={` ${cardClass} space-y-2`}><label className="block type-label">Khôi phục phản ánh bằng mã đã lưu<textarea value={restoreText} onChange={(event) => setRestoreText(event.target.value)} required maxLength={1000} rows={2} autoComplete="off" spellCheck={false} className={inputClass} placeholder='Dán toàn bộ mã riêng đã sao chép tại đây' /></label><button type="submit" disabled={!!pending} className={secondaryClass}>Kiểm tra và lưu lại</button></form>
    {!receipts.length && <p className={cardClass}>Trình duyệt này chưa lưu phản ánh nào.</p>}
    {receipts.map((receipt) => <div key={receipt.id} className={` ${cardClass} space-y-2`}><h3 className="type-heading">{receipt.operatorName || 'Phản ánh hồ sơ nhà xe'}</h3><p className="type-body">{ownerStateLabel(receipt.status)}</p><p className="break-all type-caption">Mã theo dõi: {receipt.id}</p>{receipt.resolutionNote && <p className="whitespace-pre-wrap type-body">{receipt.resolutionNote}</p>}<div className="flex flex-wrap gap-2"><button disabled={!!pending} onClick={() => check(receipt)} className={secondaryClass}>{pending === receipt.id ? 'Đang kiểm tra…' : 'Kiểm tra trạng thái'}</button><button onClick={() => copy(receipt)} className={secondaryClass}>{copied === receipt.id ? 'Đã chép mã riêng' : 'Sao chép mã riêng'}</button></div><details className="type-caption"><summary className="cursor-pointer py-2 type-button">Xem mã lưu riêng</summary><label className="type-label">Mã truy cập<input readOnly value={receipt.accessToken} className={inputClass} /></label></details><details className="type-caption"><summary className="cursor-pointer py-2 type-button">Bỏ mã khỏi thiết bị này</summary><p className="py-2 type-body">Lưu một bản mã riêng nếu bạn còn muốn tra cứu. Phản ánh vẫn được giữ trong hệ thống để xử lý.</p><button className={secondaryClass} onClick={() => onRemove(receipt.id)}>Xác nhận bỏ mã đã lưu</button></details></div>)}
  </Panel>;
}

export default function OperatorDirectory({ corridor, currentUser, onRequireAuth }) {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showMine, setShowMine] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [receipts, setReceipts] = useState(() => { try { return parseReceipts(localStorage.getItem(REPORT_RECEIPTS_KEY)); } catch { return []; } });
  const [storageFailed, setStorageFailed] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const requestId = ++sequence.current; setLoading(true); setError('');
    try {
      const result = await api.listOperators({ corridor });
      if (!result?.success || !Array.isArray(result.data)) throw new Error('Chưa tải được danh bạ.');
      if (requestId === sequence.current) setOperators(result.data);
    } catch (err) { if (requestId === sequence.current) { setError(err.message || 'Chưa tải được danh bạ.'); setOperators([]); } }
    finally { if (requestId === sequence.current) setLoading(false); }
  }, [corridor]);
  useEffect(() => { load(); return () => { sequence.current += 1; }; }, [load, revision]);
  const saveReceipt = (receipt) => {
    setReceipts((old) => {
      const next = mergeReceipt(old, receipt);
      try { localStorage.setItem(REPORT_RECEIPTS_KEY, JSON.stringify(next)); setStorageFailed(false); }
      catch { setStorageFailed(true); }
      return next;
    });
  };
  const removeReceipt = (id) => {
    const next = receipts.filter(receipt => receipt.id !== id);
    try { localStorage.setItem(REPORT_RECEIPTS_KEY, JSON.stringify(next)); setReceipts(next); setStorageFailed(false); }
    catch { setStorageFailed(true); }
  };
  const openMine = () => {
    if (currentUser) { setShowMine(true); return; }
    if (!onRequireAuth) { setError('Chưa mở được đăng nhập. Hãy thử lại.'); return; }
    onRequireAuth({ title: 'Đăng nhập để xem hồ sơ quản lý', subtitle: 'Danh bạ và liên hệ vẫn mở cho mọi người.', onSuccess: async () => { setShowMine(true); } });
  };
  // A real route only has a few dozen bus operators, so filter right on the already-loaded list:
  // type a few letters and it appears, no scrolling and no need to call the server again.
  const needle = searchText(query);
  const matches = needle ? operators.filter(operator => searchText([operator.name, operator.corridor, ...(operator.coverage || [])].join(' ')).includes(needle)) : operators;
  const visible = expanded ? matches : matches.slice(0, PREVIEW_COUNT);
  return <section aria-labelledby="operator-directory-title" className="mt-6 space-y-3 border-t border-slate-300/70 pt-5 dark:border-white/10">
    <div className="flex items-start gap-2"><BookOpen size={20} className="mt-0.5 shrink-0 text-[#0071e3]" /><div><h2 id="operator-directory-title" className="text-slate-900 dark:text-white type-heading">Danh bạ nhà xe tham khảo</h2><p className="mt-1 text-slate-600 dark:text-slate-300 type-caption">Nguồn liên hệ để bạn tự hỏi chuyến. Danh bạ không phải kết quả xe đang có ghế trong khung giờ tìm kiếm.</p></div></div>
    {loading ? <p role="status" className="flex items-center gap-2 py-3 text-slate-500 type-body"><Loader2 size={16} className="animate-spin" />Đang tải danh bạ…</p> : error ? <div className="space-y-2"><ErrorNote>{error}</ErrorNote><button type="button" onClick={load} className={secondaryClass}><RefreshCw size={14} className="mr-1 inline" />Thử tải lại</button></div> : !operators.length ? <div className={cardClass}><p className="type-body-strong">Chưa có hồ sơ công khai trên tuyến này</p><p className="mt-1 text-slate-600 dark:text-slate-300 type-caption">Danh bạ chỉ hiển thị sau khi nguồn thông tin được kiểm tra. Bạn vẫn có thể tìm chuyến và đăng nhu cầu ở phía trên.</p></div> : <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-52 flex-1"><span className="sr-only">Tìm nhà xe theo tên hoặc khu vực</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm nhà xe hoặc khu vực…"
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 type-input dark:border-white/20 dark:bg-[#1c1c1e] dark:text-white" />
        </label>
        <p aria-live="polite" className="text-slate-500 type-caption">{matches.length === operators.length ? `${operators.length} nhà xe` : `${matches.length}/${operators.length} nhà xe`}</p>
      </div>
      {!matches.length ? <div className={cardClass}><p className="type-body-strong">Không có nhà xe nào khớp “{query.trim()}”</p><p className="mt-1 text-slate-600 dark:text-slate-300 type-caption">Thử bớt từ khóa, hoặc xóa ô tìm để xem lại toàn bộ danh bạ.</p></div> : <>
      <div className="space-y-2">{visible.map((operator) => <OperatorRow key={operator.id} operator={operator} open={openId === operator.id} onToggle={() => setOpenId(openId === operator.id ? null : operator.id)} onOpenDetail={() => setSelectedId(operator.id)} />)}</div>
      {matches.length > PREVIEW_COUNT && <button type="button" onClick={() => setExpanded(!expanded)} className={`type-button ${secondaryClass} w-full`}>{expanded ? 'Thu gọn danh bạ' : `Xem tất cả ${matches.length} nhà xe`}</button>}
      </>}
    </>}
    <div className="flex flex-wrap gap-2"><button type="button" onClick={openMine} className={secondaryClass}>Hồ sơ tôi quản lý</button><button type="button" onClick={() => setShowReports(true)} className={secondaryClass}>Phản ánh đã gửi{receipts.length ? ` (${receipts.length})` : ''}</button></div>
    {selectedId && <OperatorDetail key={selectedId} id={selectedId} currentUser={currentUser} onRequireAuth={onRequireAuth} onClose={() => setSelectedId(null)} onReceipt={(receipt) => { saveReceipt(receipt); setSelectedId(null); setShowReports(true); }} onClaimChange={() => setRevision((old) => old + 1)} />}
    {showMine && <MyOperators key={currentUser?.id || currentUser?.userId || 'authenticated'} onClose={() => setShowMine(false)} onChanged={() => setRevision((old) => old + 1)} />}
    {showReports && <ReportTracking receipts={receipts} onChange={saveReceipt} onRemove={removeReceipt} onClose={() => setShowReports(false)} storageFailed={storageFailed} />}
  </section>;
}
