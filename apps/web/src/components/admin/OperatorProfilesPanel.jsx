import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { VIRTUAL_HUBS } from '@carmate/shared';
import api from '../../api/client.js';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { buildAssistedTrip, buildClaimReview, buildOperatorPayload, dateTimeInput, freshUntilAfter, operatorDraft } from '../../utils/operatorAdmin.js';

const inputClass = "type-input w-full rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1a2232] p-3";
const cardClass = "type-body rounded-2xl border border-slate-300/70 dark:border-white/10 bg-white dark:bg-[#1a2232] p-4 space-y-3";
const labels = { draft: 'Bản nháp', published: 'Công khai', hidden: 'Đã ẩn', pending: 'Chờ xử lý', approved: 'Đã duyệt', reviewing: 'Đang xử lý', resolved: 'Đã xử lý', rejected: 'Từ chối' };
const sourceLabels = { website: 'Website', facebook: 'Facebook', owner_contact: 'Liên hệ trực tiếp chủ xe', legacy_directory: 'Danh bạ cũ, cần rà soát', other: 'Nguồn khác' };
const dateLabel = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa ghi nhận';
const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; } };
function Field({ label, children }) { return <label className="type-label block space-y-1.5"><span className="type-label">{label}</span>{children}</label>; }
function Channel({ value, onChange }) { return <select className={inputClass} value={value} onChange={event => onChange(event.target.value)}><option value="">Chọn kênh đã kiểm tra</option><option value="phone">Điện thoại</option><option value="zalo">Zalo</option><option value="email">Email</option><option value="in_person">Gặp trực tiếp</option></select>; }
function EvidenceTime({ value, onChange, label }) { return <div><Field label={`${label} (giờ Việt Nam)`}><input type="datetime-local" step="1" className={inputClass} value={value} onChange={event => onChange(event.target.value)} /></Field><button type="button" onClick={() => onChange(dateTimeInput(new Date().toISOString()))} className="type-button text-[#0071e3] py-2">Ghi thời điểm hiện tại</button></div>; }
// Hạn kiểm tra lại là ước lượng theo độ chắc của nguồn, không có đáp án cố định.
// Ba mốc quen dùng đặt sẵn để khỏi tính tay; vẫn sửa được trực tiếp ở ô ngày.
function FreshUntilField({ value, checkedAt, onChange }) {
  return <div><Field label="Cần kiểm tra lại trước (giờ Việt Nam)"><input type="datetime-local" step="1" className={inputClass} value={value} onChange={event => onChange(event.target.value)} /></Field>
    <div className="flex flex-wrap gap-3 py-2">{[['1 tháng', 30], ['3 tháng', 90], ['6 tháng', 180]].map(([label, days]) =>
      <button key={days} type="button" onClick={() => onChange(freshUntilAfter(checkedAt, days))} className="type-button text-[#0071e3]">{label}</button>)}</div></div>;
}
function History({ rows = [] }) { return <details className="type-body"><summary className="type-body-strong cursor-pointer">Lịch sử xử lý ({rows.length})</summary><ol className="mt-2 space-y-2">{[...rows].reverse().map((row, index) => <li key={index} className="type-body rounded-xl bg-slate-50 dark:bg-white/5 p-3"><p className="type-body">{labels[row.status] || row.status} · {dateLabel(row.at)}</p><p className="type-body whitespace-pre-wrap">{row.note}</p>{row.changedFields?.length > 0 && <p className="type-caption text-slate-500">Trường đã cập nhật: {row.changedFields.join(', ')}</p>}{row.actorId && <p className="type-caption text-slate-500">Người xử lý: {row.actorId}</p>}</li>)}</ol></details>; }

function ProfileEditor({ profile, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => operatorDraft(profile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const set = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const save = async event => {
    event?.preventDefault(); if (lock.current) return;
    setError('');
    try {
      const payload = buildOperatorPayload(draft); lock.current = true; setBusy(true);
      const response = profile?.id ? await api.adminUpdateOperator(profile.id, payload) : await api.adminCreateOperator(payload);
      if (!response?.success) throw new Error(response?.error || 'Chưa lưu được hồ sơ.');
      onSaved(response.data); onClose();
    } catch (err) { setError(err.message); } finally { lock.current = false; setBusy(false); }
  };
  return <Modal title={profile?.id ? `Sửa hồ sơ: ${profile.name}` : 'Tạo bản nháp hồ sơ chủ xe'} subtitle="Hồ sơ danh bạ không tạo tài khoản hoặc chuyến chạy." size="2xl" onClose={() => !busy && onClose()} footer={<div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={onClose} className="type-button">Đóng</Button><Button disabled={busy} onClick={save} className="type-button">{busy ? 'Đang lưu…' : draft.status === 'published' ? 'Lưu và công khai' : draft.status === 'hidden' ? 'Lưu và ẩn hồ sơ' : 'Lưu bản nháp'}</Button></div>}>
    <form onSubmit={save} className="type-body space-y-4">
      {error && <p role="alert" className="type-body text-red-600">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Tên nhà xe / chủ xe"><input className={inputClass} value={draft.name} maxLength={160} onChange={event => set('name', event.target.value)} /></Field><Field label="Loại hồ sơ"><select className={inputClass} value={draft.kind} onChange={event => set('kind', event.target.value)}><option value="business">Nhà xe / đơn vị kinh doanh</option><option value="individual">Chủ xe cá nhân</option></select></Field></div>
      <Field label="Số liên hệ của hồ sơ"><input type="tel" className={inputClass} value={draft.contactPhone} onChange={event => set('contactPhone', event.target.value)} /></Field>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Tuyến / hành lang"><input className={inputClass} value={draft.corridor} onChange={event => set('corridor', event.target.value)} /></Field><Field label="Khu vực phục vụ, mỗi dòng một mục"><textarea className={inputClass} rows={3} value={draft.coverageText} onChange={event => set('coverageText', event.target.value)} /></Field></div>
      <Field label="Lịch chạy tham khảo"><textarea className={inputClass} value={draft.scheduleNote} maxLength={1500} onChange={event => set('scheduleNote', event.target.value)} /></Field>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Cách ghi giá"><select className={inputClass} value={draft.pricingMode} onChange={event => set('pricingMode', event.target.value)}><option value="contact">Liên hệ</option><option value="listed">Có thông tin giá tham khảo</option></select></Field><Field label="Thông tin giá theo nguồn"><textarea className={inputClass} value={draft.priceNote} maxLength={1500} onChange={event => set('priceNote', event.target.value)} /></Field></div>
      <Field label="Điểm / cách đón theo nguồn"><textarea className={inputClass} value={draft.pickupNote} maxLength={1500} onChange={event => set('pickupNote', event.target.value)} /></Field>
      <section className={`${cardClass} bg-slate-50`}><h3 className="type-heading">Nguồn và căn cứ công khai</h3><p className="type-body text-slate-500">Nhập theo nguồn thực tế. Hồ sơ từ danh bạ cũ cần rà soát trước khi công khai; lịch tham khảo không xác nhận có xe hoặc chỗ trống.</p>
        <Field label="Loại nguồn"><select className={inputClass} value={draft.sourceKind} onChange={event => set('sourceKind', event.target.value)}>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Tên nguồn / người cung cấp"><input className={inputClass} value={draft.sourceLabel} maxLength={200} onChange={event => set('sourceLabel', event.target.value)} /></Field>
        <Field label="Đường dẫn nguồn (nếu có)"><input type="url" className={inputClass} value={draft.sourceUrl} maxLength={1500} onChange={event => set('sourceUrl', event.target.value)} /></Field>
        <div className="grid sm:grid-cols-2 gap-3"><EvidenceTime label="Đã kiểm tra nguồn lúc" value={draft.checkedAt} onChange={value => set('checkedAt', value)} /><FreshUntilField value={draft.freshUntil} checkedAt={draft.checkedAt} onChange={value => set('freshUntil', value)} /></div>
        <Field label="Căn cứ công khai số liên hệ"><select className={inputClass} value={draft.contactPublicationBasis} onChange={event => set('contactPublicationBasis', event.target.value)}><option value="">Chưa có căn cứ</option><option value="official_business_source">Nguồn công khai chính thức của nhà xe</option><option value="owner_consent">Chủ số đã đồng ý công khai</option></select></Field>
        <Field label="Bằng chứng / nội dung đối chiếu và điều kiện được phép đăng"><textarea rows={3} className={inputClass} value={draft.authorizationNote} maxLength={3000} onChange={event => set('authorizationNote', event.target.value)} placeholder="Ghi rõ đã kiểm tra nguồn nào, ai cho phép và cho phép công khai thông tin gì." /></Field>
      </section>
      <Field label="Trạng thái sau khi lưu"><select className={inputClass} value={draft.status} onChange={event => set('status', event.target.value)}>{['draft', 'published', 'hidden'].map(status => <option key={status} value={status}>{labels[status]}</option>)}</select></Field>
      {draft.status === 'hidden' && <p className="type-body text-amber-700">Hồ sơ ngừng hiển thị trong danh bạ. Các chuyến đã đăng và cuộc hẹn cần được xử lý riêng.</p>}
      {profile?.id && <><p className="type-body">Người quản lý: {profile.ownerUserId || 'Chưa có tài khoản được duyệt nhận quản lý'}</p><History rows={profile.history} /></>}
    </form>
  </Modal>;
}

function ReviewEditor({ item, type, profile, suspended, onClose, onEditProfile, onSaved }) {
  const [draft, setDraft] = useState({ status: type === 'claims' ? 'approved' : 'reviewing', resolutionNote: '', changeSummary: '', channel: '', reviewedAt: '', authorityNote: '', checked: false });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  const set = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const closed = type === 'claims' ? item.status !== 'pending' : !['pending', 'reviewing'].includes(item.status);
  const save = async () => {
    if (lock.current || closed) return;
    try {
      setError(''); let payload;
      if (type === 'claims') payload = buildClaimReview(draft, item, profile);
      else {
        if (!draft.resolutionNote.trim()) throw new Error('Ghi rõ kết quả hoặc bước xử lý.');
        if (draft.status === 'resolved' && !draft.changeSummary.trim()) throw new Error('Ghi rõ những gì đã sửa/ẩn, hoặc vì sao thông tin được giữ nguyên.');
        payload = { status: draft.status, resolutionNote: `${draft.resolutionNote.trim()}${draft.status === 'resolved' ? `\nThay đổi đã thực hiện: ${draft.changeSummary.trim()}` : ''}` };
      }
      lock.current = true; setBusy(true);
      const response = type === 'claims' ? await api.adminReviewOperatorClaim(item.id, payload) : await api.adminReviewOperatorReport(item.id, payload);
      if (!response?.success) throw new Error(response?.error || 'Chưa lưu được kết luận.');
      onSaved(response.data); onClose();
    } catch (err) { setError(err.message); } finally { lock.current = false; setBusy(false); }
  };
  // Duyệt một chạm số do người xem đề xuất: máy chủ ghi số mới và kết luận phản ánh
  // trong cùng một giao dịch, rồi hạ hồ sơ về bản nháp để đối chiếu nguồn lại.
  const applyPhone = async () => {
    if (lock.current || closed) return;
    try {
      setError('');
      const note = draft.resolutionNote.trim() || 'Áp dụng số do người xem đề xuất.';
      lock.current = true; setBusy(true);
      const response = await api.adminApplyReportedPhone(item.id, { resolutionNote: note });
      if (!response?.success) throw new Error(response?.error || 'Chưa áp dụng được số đề xuất.');
      onSaved(response.data?.report || response.data); onClose();
    } catch (err) { setError(err.message); } finally { lock.current = false; setBusy(false); }
  };
  if (suspended) return null;
  return <Modal title={type === 'claims' ? 'Duyệt quyền quản lý hồ sơ' : 'Xử lý yêu cầu sửa / gỡ'} subtitle={`${item.operatorName || profile?.name || item.operatorId} · ${labels[item.status] || item.status}`} size="xl" onClose={() => !busy && onClose()} footer={<div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={onClose} className="type-button">Đóng</Button>{!closed && <Button disabled={busy} onClick={save} className="type-button">{busy ? 'Đang lưu…' : 'Lưu kết luận'}</Button>}</div>}>
    <div className="space-y-4">
      <p className="type-body whitespace-pre-wrap">{item.message}</p><p className="type-body text-slate-500">Tiếp nhận: {dateLabel(item.createdAt)}</p>
      {item.claimantUserId && <p className="type-body">Tài khoản yêu cầu: {item.claimantUserId}</p>}{item.reporterContact && <p className="type-body">Liên hệ người phản ánh: {item.reporterContact}</p>}
      {profile ? <div className={cardClass}><p className="type-body-strong">Hồ sơ hiện tại: {profile.name} · {labels[profile.status]}</p><p className="type-body">{profile.contactPhone || 'Chưa có số liên hệ'}</p><p className="type-body">Nguồn: {profile.source?.label || 'Chưa ghi nhận'} · kiểm tra {dateLabel(profile.checkedAt)}</p>{safeUrl(profile.source?.url) && <a className="type-body text-[#0071e3]" href={safeUrl(profile.source.url)} target="_blank" rel="noreferrer">Mở nguồn đã ghi nhận</a>}<div><Button variant="secondary" disabled={busy} onClick={() => onEditProfile(profile)} className="type-button">Mở hồ sơ để sửa hoặc ẩn</Button></div></div> : <p role="alert" className="type-body text-amber-700">Chưa tải được đúng hồ sơ. Làm mới danh sách trước khi duyệt quyền quản lý.</p>}
      {type === 'reports' && item.suggestedPhone && <section className={cardClass}>
        <p className="type-body-strong">Số do người xem đề xuất</p>
        <p className="type-body">{profile?.contactPhone || 'Chưa có số'} → <span className="type-body-strong">{item.suggestedPhone}</span></p>
        {item.appliedAt ? <p className="type-body text-slate-500">Đã áp dụng lúc {dateLabel(item.appliedAt)}.</p> : <>
          <p className="type-body text-slate-500">Áp dụng sẽ ghi số mới và đưa hồ sơ về bản nháp: số này chưa đối chiếu với nguồn chính thức nên không được hiển thị như số đã kiểm.</p>
          {!closed && <div><Button variant="secondary" disabled={busy} onClick={applyPhone} className="type-button">Áp dụng số này</Button></div>}
        </>}
      </section>}
      {!closed && <>
        <Field label="Kết luận / trạng thái"><select className={inputClass} value={draft.status} onChange={event => set('status', event.target.value)}>{(type === 'claims' ? ['approved', 'rejected'] : ['reviewing', 'resolved', 'rejected']).map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></Field>
        {type === 'claims' && draft.status === 'approved' && <section className={cardClass}>
          <p className="type-body">Kiểm tra quyền đại diện qua kênh liên hệ đã biết từ nguồn độc lập của hồ sơ. Thông tin do người yêu cầu tự khai cần được đối chiếu trước khi duyệt.</p>
          <Field label="Số liên hệ độc lập đã được duyệt"><input className={inputClass} readOnly value={profile?.contactPhone || ''} /></Field><Field label="Kênh đã kiểm tra"><Channel value={draft.channel} onChange={value => set('channel', value)} /></Field><EvidenceTime label="Kiểm tra quyền đại diện lúc" value={draft.reviewedAt} onChange={value => set('reviewedAt', value)} />
          <Field label="Bằng chứng quyền đại diện"><textarea className={inputClass} rows={3} value={draft.authorityNote} maxLength={3000} onChange={event => set('authorityNote', event.target.value)} /></Field>
          <label className="type-label flex gap-2"><input type="checkbox" checked={draft.checked} onChange={event => set('checked', event.target.checked)} />Tôi đã đối chiếu quyền đại diện qua kênh liên hệ độc lập ghi trên.</label>
        </section>}
        <Field label={draft.status === 'rejected' ? 'Lý do từ chối' : 'Nội dung kết luận / ghi chú xử lý'}><textarea className={inputClass} rows={3} maxLength={1500} value={draft.resolutionNote} onChange={event => set('resolutionNote', event.target.value)} /></Field>
        {type === 'reports' && draft.status === 'resolved' && <Field label="Đã sửa trường nào, ẩn hồ sơ nào, hoặc lý do giữ nguyên thông tin"><textarea className={inputClass} maxLength={450} value={draft.changeSummary} onChange={event => set('changeSummary', event.target.value)} /></Field>}
        {type === 'reports' && <p className="type-body text-slate-500">Lưu kết luận không tự sửa hay ẩn hồ sơ. Dùng nút mở hồ sơ ở trên để thực hiện thay đổi rồi ghi lại kết quả.</p>}
      </>}
      {error && <p role="alert" className="type-body text-red-600">{error}</p>}{item.resolutionNote && <p className="type-body whitespace-pre-wrap">Kết luận đã lưu: {item.resolutionNote}</p>}<History rows={item.history} />
    </div>
  </Modal>;
}

function AssistedTripEditor({ profile, onClose, onSaved }) {
  const [draft, setDraft] = useState({ originHubId: '', destinationHubId: '', date: '', time: '', capacity: '', availableSeats: '', carType: '', licensePlate: '', pricingMode: 'contact', basePricePerSeat: '', pickupMode: 'station', maxDetourKm: 0, pickupNotes: '', channel: '', approvedAt: '', evidenceNote: '', approved: false, publicContactConsent: false });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false); const attempt = useRef(null);
  const set = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const save = async () => {
    if (lock.current) return;
    try {
      setError(''); const body = buildAssistedTrip(draft, profile, VIRTUAL_HUBS); const fingerprint = JSON.stringify(body);
      if (!attempt.current || attempt.current.fingerprint !== fingerprint) attempt.current = { fingerprint, requestId: crypto.randomUUID() };
      lock.current = true; setBusy(true);
      const response = await api.adminCreateOperatorTrip(profile.id, { ...body, requestId: attempt.current.requestId });
      if (!response?.success) throw new Error(response?.error || 'Chưa đăng được chuyến.');
      onSaved(response.data); onClose();
    } catch (err) { setError(err.message); } finally { lock.current = false; setBusy(false); }
  };
  return <Modal title={`Nhập hộ chuyến đã được chấp thuận: ${profile.name}`} subtitle="Chuyến thuộc tài khoản người quản lý đã được duyệt. Mỗi lịch chạy cần được chủ xe chấp thuận riêng." size="2xl" onClose={() => !busy && onClose()} footer={<div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={onClose} className="type-button">Đóng</Button><Button disabled={busy} onClick={save} className="type-button">{busy ? 'Đang đăng…' : 'Đăng chuyến đã được chấp thuận'}</Button></div>}>
    <div className="space-y-4"><div className="grid sm:grid-cols-2 gap-3">{[['originHubId', 'Điểm đi'], ['destinationHubId', 'Điểm đến']].map(([key, label]) => <Field key={key} label={label}><select className={inputClass} value={draft[key]} onChange={event => set(key, event.target.value)}><option value="">Chọn trạm làm mốc</option>{VIRTUAL_HUBS.map(hub => <option key={hub.id} value={hub.id}>{hub.shortName || hub.name}</option>)}</select></Field>)}</div>
      <div className="grid sm:grid-cols-2 gap-3">{[['date', 'Ngày chạy', 'date'], ['time', 'Giờ chạy', 'time'], ['capacity', 'Sức chứa xe, gồm người lái', 'number'], ['availableSeats', 'Số chỗ nhận khách', 'number'], ['carType', 'Xe thực tế của chuyến', 'text'], ['licensePlate', 'Biển số thực tế', 'text']].map(([key, label, type]) => <Field key={key} label={label}><input className={inputClass} type={type} value={draft[key]} onChange={event => set(key, event.target.value)} /></Field>)}</div>
      <Field label="Giá do chủ xe chấp thuận"><select className={inputClass} value={draft.pricingMode} onChange={event => set('pricingMode', event.target.value)}><option value="contact">Liên hệ</option><option value="listed">Niêm yết giá mỗi ghế</option></select></Field>{draft.pricingMode === 'listed' && <Field label="Giá mỗi ghế (đồng)"><input className={inputClass} type="number" min="0" value={draft.basePricePerSeat} onChange={event => set('basePricePerSeat', event.target.value)} /></Field>}
      <Field label="Cách đón"><select className={inputClass} value={draft.pickupMode} onChange={event => set('pickupMode', event.target.value)}><option value="station">Tại trạm</option><option value="doorstep">Có đón tận nơi</option><option value="hybrid">Trạm hoặc điểm phù hợp</option></select></Field>{draft.pickupMode !== 'station' && <Field label="Có thể đi thêm tối đa (km)"><input className={inputClass} type="number" min="0" max="50" value={draft.maxDetourKm} onChange={event => set('maxDetourKm', event.target.value)} /></Field>}
      <Field label="Ghi chú điểm đón"><textarea className={inputClass} maxLength={500} value={draft.pickupNotes} onChange={event => set('pickupNotes', event.target.value)} /></Field>
      <section className={cardClass}><h3 className="type-heading">Chấp thuận cho chính chuyến này</h3><p className="type-body">Liên hệ đã duyệt: {profile.contactPhone}. Người quản lý: {profile.ownerUserId}.</p><Field label="Kênh chủ xe chấp thuận"><Channel value={draft.channel} onChange={value => set('channel', value)} /></Field><EvidenceTime label="Chủ xe chấp thuận lúc" value={draft.approvedAt} onChange={value => set('approvedAt', value)} /><Field label="Nội dung đã đối chiếu với chủ xe"><textarea className={inputClass} maxLength={2000} value={draft.evidenceNote} onChange={event => set('evidenceNote', event.target.value)} placeholder="Ghi rõ tuyến, ngày giờ, xe, chỗ, giá và điểm đón đã được chủ xe đồng ý." /></Field><label className="type-label flex gap-2"><input type="checkbox" checked={draft.approved} onChange={event => set('approved', event.target.checked)} />Chủ xe đã đồng ý cho tôi đăng chính lịch chạy và các điều kiện trên.</label><label className="type-label flex gap-2"><input type="checkbox" checked={draft.publicContactConsent} onChange={event => set('publicContactConsent', event.target.checked)} />Chủ số đồng ý công khai số {profile.contactPhone} trên chuyến này.</label></section>
      {error && <p role="alert" className="type-body text-red-600">{error}</p>}
    </div>
  </Modal>;
}

export default function OperatorProfilesPanel({ onNotice }) {
  const [tab, setTab] = useState('profiles'); const [status, setStatus] = useState(''); const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [editor, setEditor] = useState(null); const [review, setReview] = useState(null); const [assisted, setAssisted] = useState(null); const profiles = useRef(new Map()); const generation = useRef(0);
  const [publishing, setPublishing] = useState('');
  const load = useCallback(async () => {
    const version = ++generation.current; setLoading(true); setError('');
    try {
      const params = { limit: 50, offset: page * 50, ...(status ? { status } : {}), ...(query && tab === 'profiles' ? { q: query } : {}) };
      const response = tab === 'profiles' ? await api.adminListOperators(params) : tab === 'claims' ? await api.adminListOperatorClaims(params) : await api.adminListOperatorReports(params);
      if (!response?.success || !Array.isArray(response.data)) throw new Error(response?.error || 'Chưa tải được danh sách.');
      if (version !== generation.current) return;
      setRows(response.data); if (tab === 'profiles') response.data.forEach(profile => profiles.current.set(profile.id, profile));
    } catch (err) { if (version === generation.current) setError(err.message); } finally { if (version === generation.current) setLoading(false); }
  }, [tab, status, query, page]);
  useEffect(() => { setRows([]); load(); return () => { generation.current += 1; }; }, [load]);
  // Công khai ngay từ danh sách: giai đoạn đầu danh bạ cần lên sóng nhanh hơn tốc
  // độ đối chiếu từng nguồn. Hồ sơ vào danh bạ ở mức "chưa đối chiếu" nên giao diện
  // vẫn nói đúng độ tin cậy, và máy chủ ghi lại số lấy từ đâu để còn căn cứ trả lời
  // khi nhà xe đề nghị sửa hoặc gỡ.
  const quickPublish = async row => {
    if (publishing) return;
    setPublishing(row.id);
    try {
      const response = await api.adminQuickPublishOperator(row.id, {});
      if (!response?.success) throw new Error(response?.error || 'Chưa công khai được hồ sơ.');
      profiles.current.set(response.data.id, response.data);
      onNotice?.(`Đã công khai "${row.name}" dạng thông tin tham khảo, chưa đối chiếu nguồn.`);
      load();
    } catch (err) { onNotice?.(err.message); } finally { setPublishing(''); }
  };
  const saved = profile => { profiles.current.set(profile.id, profile); setReview(previous => previous?.item.operatorId === profile.id ? { ...previous, profile } : previous); onNotice?.('Đã lưu hồ sơ và lịch sử thay đổi.'); load(); };
  const openReview = async item => {
    setError('');
    try {
      const response = await api.adminGetOperator(item.operatorId);
      if (!response?.success || response.data?.id !== item.operatorId) throw new Error(response?.error || 'Chưa tải được đúng hồ sơ để đối chiếu.');
      const profile = response.data;
      profiles.current.set(profile.id, profile);
      setReview({ item, type: tab, profile });
    } catch (err) { setError(err.message); }
  };
  const statuses = tab === 'profiles' ? ['draft', 'published', 'hidden'] : tab === 'claims' ? ['pending', 'approved', 'rejected'] : ['pending', 'reviewing', 'resolved', 'rejected'];
  return <section className="space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="type-title">Hồ sơ chủ xe</h2><p className="type-body text-slate-500">Danh bạ có nguồn, người quản lý có quyền và phản ánh có kết quả xử lý.</p></div><Button icon={Plus} onClick={() => setEditor({})} className="type-button">Tạo bản nháp</Button></div>
    <nav className="flex gap-2 flex-wrap">{[['profiles', 'Hồ sơ'], ['claims', 'Nhận quyền quản lý'], ['reports', 'Yêu cầu sửa / gỡ']].map(([value, label]) => <Button key={value} variant={tab === value ? 'primary' : 'secondary'} onClick={() => { setTab(value); setStatus(''); setPage(0); }} className="type-button">{label}</Button>)}</nav>
    <div className="flex flex-wrap gap-2 items-center"><select aria-label="Lọc trạng thái" className={`type-input ${inputClass} sm:max-w-48`} value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}><option value="">Tất cả trạng thái</option>{statuses.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select>{tab === 'profiles' && <form className="type-body flex gap-2 flex-1" onSubmit={event => { event.preventDefault(); setQuery(search); setPage(0); }}><input aria-label="Tìm hồ sơ theo tên" className={inputClass} value={search} placeholder="Tên hồ sơ" onChange={event => setSearch(event.target.value)} /><Button icon={Search} variant="secondary" type="submit" className="type-button">Tìm</Button></form>}<Button icon={RefreshCw} variant="secondary" disabled={loading} onClick={load} className="type-button">Làm mới</Button></div>
    {error && <p role="alert" className="type-body rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}{loading && <p role="status" className="type-body text-slate-500">Đang tải dữ liệu…</p>}{!loading && !error && !rows.length && <p className={cardClass}>Không có bản ghi phù hợp bộ lọc này.</p>}
    {rows.map(row => <article key={row.id} className={cardClass}><div className="flex justify-between gap-3"><div><h3 className="type-heading">{tab === 'profiles' ? row.name : row.operatorName || row.operatorId}</h3><p className="type-body text-slate-500">{labels[row.status] || row.status}{tab === 'reports' ? ` · ${row.type === 'removal' ? 'Yêu cầu gỡ' : 'Đề nghị sửa'}` : ''}</p></div><div className="flex shrink-0 flex-col gap-2 sm:flex-row"><Button variant="secondary" onClick={() => tab === 'profiles' ? setEditor(row) : openReview(row)} className="type-button">{tab === 'profiles' ? 'Xem / sửa hồ sơ' : 'Mở xử lý'}</Button>{tab === 'profiles' && row.status !== 'published' && row.kind !== 'individual' && row.contactPhone && <Button disabled={publishing === row.id} onClick={() => quickPublish(row)} className="type-button">{publishing === row.id ? 'Đang công khai…' : 'Công khai ngay'}</Button>}</div></div>
      {tab === 'profiles' ? <><p className="type-body">{row.contactPhone || 'Chưa có số liên hệ'} · {row.kind === 'individual' ? 'Cá nhân' : 'Nhà xe / đơn vị'}</p><p className="type-body">Nguồn: {row.source?.label || 'Chưa ghi nhận'} · {row.ownerUserId ? 'Đã có người quản lý được duyệt' : 'Chưa nhận quyền quản lý'}</p><p className="type-caption text-slate-500">Kiểm tra: {dateLabel(row.checkedAt)} · hạn kiểm tra lại: {dateLabel(row.freshUntil)}</p>{row.source?.kind === 'legacy_directory' && <p className="type-body text-amber-700">Dữ liệu danh bạ cũ: cần bổ sung nguồn và bằng chứng trước khi công khai.</p>}{row.ownerUserId && row.status === 'published' && <Button variant="secondary" onClick={() => setAssisted(row)} className="type-button">Nhập hộ chuyến đã được chấp thuận</Button>}</> : <><p className="type-body whitespace-pre-wrap">{row.message}</p><p className="type-caption text-slate-500">Tiếp nhận: {dateLabel(row.createdAt)} · cập nhật: {dateLabel(row.updatedAt)}</p>{row.resolutionNote && <p className="type-body whitespace-pre-wrap">Kết quả: {row.resolutionNote}</p>}<History rows={row.history} /></>}
    </article>)}
    <div className="flex justify-between items-center gap-3"><p className="type-body text-slate-500">Trang {page + 1} · {rows.length} bản ghi đã tải</p><div className="flex gap-2"><Button variant="secondary" disabled={!page || loading} onClick={() => setPage(value => value - 1)} className="type-button">Trước</Button><Button variant="secondary" disabled={rows.length < 50 || loading} onClick={() => setPage(value => value + 1)} className="type-button">Tiếp</Button></div></div>
    {editor && <ProfileEditor key={editor.id || 'new'} profile={editor} onClose={() => setEditor(null)} onSaved={saved} />}
    {review && <ReviewEditor key={review.item.id} {...review} suspended={!!editor} onClose={() => setReview(null)} onEditProfile={setEditor} onSaved={() => { onNotice?.('Đã ghi nhận kết luận và lịch sử xử lý.'); load(); }} />}
    {assisted && <AssistedTripEditor profile={assisted} onClose={() => setAssisted(null)} onSaved={trip => onNotice?.(`Đã đăng chuyến được chủ xe chấp thuận: ${trip.id}`)} />}
  </section>;
}
