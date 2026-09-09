import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Check,
  RotateCcw,
  Zap,
  ClipboardPaste,
  Car,
  Users,
  MapPin,
  Navigation,
  Clock,
  Coins,
  Phone,
  Package,
  HeartHandshake,
  Plane,
  RefreshCw,
  Share2,
  ArrowLeftRight
} from 'lucide-react';
import { parseNaturalTrip, SMART_TRIP_TEMPLATES } from '../../utils/nlpTripParser.js';
import { formatVND } from '@carmate/shared';
import TicketShareModal from '../modals/TicketShareModal.jsx';

export default function SmartTripComposer({ onApply, onInstantSubmit, currentRole = 'driver', onRoleChange, currentUser, isModal = false }) {
  const [inputText, setInputText] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [activeCategory, setActiveCategory] = useState(currentRole === 'passenger' ? 'passenger' : 'driver');
  const [directionFilter, setDirectionFilter] = useState('all'); // 'all' | 'outbound' | 'return'
  const [showTicketShare, setShowTicketShare] = useState(false);

  // Đồng bộ tab danh mục mẫu khi vai trò ở Form cha thay đổi
  useEffect(() => {
    if (currentRole === 'driver' || currentRole === 'passenger') {
      setActiveCategory(currentRole);
    }
  }, [currentRole]);

  // Phân tích văn bản thời gian thực (0ms)
  useEffect(() => {
    if (!inputText.trim()) {
      setParsedResult(null);
      return;
    }
    const result = parseNaturalTrip(inputText);
    if (result && result.role === 'driver' && currentUser?.vehicle) {
      result.carType = result.carType || `${currentUser.vehicle.brand} ${currentUser.vehicle.model}`.trim();
      result.capacity = result.capacity || currentUser.vehicle.capacity;
      result.carCategory = result.carCategory || currentUser.vehicle.carCategory;
      if (currentUser.vehicle.photos?.length >= 3) {
        result.carPhotos = currentUser.vehicle.photos;
      }
    }
    setParsedResult(result);
    if (result && onApply) {
      onApply(result);
    }
    // Tự động đồng bộ vai trò lên Form cha nếu phát hiện câu của Khách/Chủ xe
    if (result?.role && onRoleChange && result.role !== currentRole) {
      onRoleChange(result.role);
    }
  }, [inputText, currentUser]);

  const handleApplyTemplate = (tmpl) => {
    setInputText(tmpl.text);
    if (onRoleChange && tmpl.role && tmpl.role !== currentRole) {
      onRoleChange(tmpl.role);
    }
  };

  const handleCycleNextSample = () => {
    const list = currentTemplates.length > 0 ? currentTemplates : (SMART_TRIP_TEMPLATES[activeCategory] || SMART_TRIP_TEMPLATES.driver);
    const currentIndex = list.findIndex((t) => t.text.trim() === inputText.trim());
    const nextIndex = (currentIndex + 1) % list.length;
    handleApplyTemplate(list[nextIndex]);
  };

  // Đảo chiều lộ trình 1-chạm (Điểm đón ⇄ Điểm đến) trực tiếp trong câu nhập liệu
  const handleSwapDirection = () => {
    if (!parsedResult?.fromLocation || !parsedResult?.toLocation) return;
    const from = parsedResult.fromLocation;
    const to = parsedResult.toLocation;

    const placeholder = `__SWAP_${Date.now()}__`;
    const fromRegex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const toRegex = new RegExp(to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    let newText = inputText.replace(fromRegex, placeholder);
    newText = newText.replace(toRegex, from);
    newText = newText.replace(placeholder, to);

    setInputText(newText);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setInputText(text.trim());
      }
    } catch {
      // Bỏ qua nếu trình duyệt chặn quyền đọc clipboard
    }
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (parsedResult && onInstantSubmit) {
        onInstantSubmit(parsedResult);
      }
    }
  };

  const currentTemplates = useMemo(() => {
    const list = SMART_TRIP_TEMPLATES[activeCategory] || SMART_TRIP_TEMPLATES.driver;
    if (directionFilter === 'all') return list;
    return list.filter((t) => t.direction === directionFilter);
  }, [activeCategory, directionFilter]);

  const synthesizedTrip = useMemo(() => {
    if (!parsedResult) return null;
    return {
      id: `smart-${Date.now()}`,
      from: parsedResult.fromLocation || 'Hà Nội',
      to: parsedResult.toLocation || 'Hải Phòng',
      timeSlot: parsedResult.timeSlot || '07:00-09:00',
      timeSlotLabel: `${parsedResult.timeSlot || '07:00-09:00'} · ${parsedResult.scheduleDay || 'Hôm nay'}`,
      availableSeats: parsedResult.seats || 3,
      seatsNeeded: parsedResult.seats || 1,
      basePricePerSeat: parsedResult.price || 150000,
      carType: parsedResult.carType || 'Toyota Vios (Xe 5 chỗ)',
      routeCategory: parsedResult.carCategory === 'convenient_trip' ? 'Xe tiện chuyến' : 'Xe gia đình',
      phoneReal: parsedResult.phoneReal || currentUser?.phone || '',
      phone: parsedResult.phoneReal || currentUser?.phone || '',
      publicName: currentUser?.name || (parsedResult.role === 'driver' ? 'Chủ xe CarMate' : 'Khách CarMate'),
      notes: parsedResult.waypointNote || '',
      type: parsedResult.role === 'passenger' ? 'passenger_request' : 'driver_offer'
    };
  }, [parsedResult, currentUser]);

  return (
    <div
      className={
        isModal
          ? 'text-[#1d1d1f] dark:text-white relative'
          : 'rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 text-[#1d1d1f] dark:text-white p-4 sm:p-5 border border-black/[0.08] dark:border-white/[0.08] shadow-sm relative overflow-hidden mb-6 backdrop-blur-xl'
      }
    >
      {/* Ambient subtle glow only when not in modal */}
      {!isModal && (
        <>
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#0071e3]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Header Bar */}
      {isModal ? (
        <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
          <div className="flex items-center gap-1.5 text-xs text-[#6e6e73] dark:text-slate-400 font-medium shrink min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-[#0071e3] shrink-0 animate-pulse" />
            <span className="hidden sm:inline truncate">Dán nội dung hoặc chọn mẫu sẵn bên dưới:</span>
            <span className="sm:hidden font-medium text-[11px] truncate">Nội dung bài đăng:</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {parsedResult?.fromLocation && parsedResult?.toLocation && (
              <button
                type="button"
                onClick={handleSwapDirection}
                title={`Đảo chiều: ${parsedResult.toLocation} ➔ ${parsedResult.fromLocation}`}
                className="text-[11px] text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50 cursor-pointer inline-flex items-center gap-1 transition-all active:scale-95 shadow-xs font-medium"
              >
                <ArrowLeftRight className="w-3 h-3" />
                <span>Đảo chiều</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePasteClipboard}
              title="Dán nhanh nội dung vừa copy"
              className="text-[11px] text-[#1d1d1f] dark:text-slate-300 hover:text-black dark:hover:text-white px-2.5 py-1 rounded-lg bg-[#f5f5f7] dark:bg-white/5 hover:bg-[#e8e8ed] dark:hover:bg-white/10 border border-black/[0.08] dark:border-white/10 cursor-pointer inline-flex items-center gap-1 transition-all font-medium"
            >
              <ClipboardPaste className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Dán tin</span>
            </button>
            {inputText && (
              <button
                type="button"
                onClick={() => setInputText('')}
                className="text-[11px] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Làm mới</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-[#0071e3] animate-pulse" />
            </span>
            <div>
              <h4 className="text-xs sm:text-sm font-bold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-1.5">
                <span>Đăng chuyến nhanh bằng một câu</span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 text-[10px] font-semibold tracking-wide">
                  Tự động điền
                </span>
              </h4>
              <p className="text-[11px] text-[#6e6e73] dark:text-slate-400">
                {currentRole === 'passenger'
                  ? 'Dán nhu cầu tìm xe hoặc gõ 1 câu tự nhiên — Hệ thống tự điền điểm đón, giờ đi và ngân sách'
                  : 'Dán bài đăng Zalo/Facebook hoặc gõ 1 câu tự nhiên — Hệ thống tự điền lộ trình, giờ chạy và giá vé'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {parsedResult?.fromLocation && parsedResult?.toLocation && (
              <button
                type="button"
                onClick={handleSwapDirection}
                title={`Đảo chiều: ${parsedResult.toLocation} ➔ ${parsedResult.fromLocation}`}
                className="text-[11px] text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50 cursor-pointer inline-flex items-center gap-1 transition-all active:scale-95 shadow-xs font-medium"
              >
                <ArrowLeftRight className="w-3 h-3" />
                <span>Đảo chiều</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePasteClipboard}
              title="Dán nhanh nội dung vừa copy"
              className="text-[11px] text-[#1d1d1f] dark:text-slate-300 hover:text-black dark:hover:text-white px-2.5 py-1 rounded-lg bg-[#f5f5f7] dark:bg-white/5 hover:bg-[#e8e8ed] dark:hover:bg-white/10 border border-black/[0.08] dark:border-white/10 cursor-pointer inline-flex items-center gap-1 transition-all font-medium"
            >
              <ClipboardPaste className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Dán tin</span>
            </button>
            {inputText && (
              <button
                type="button"
                onClick={() => setInputText('')}
                className="text-[11px] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Làm mới</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* The Smart Omnibar Input */}
      <div className="relative z-10">
        <textarea
          rows={3}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            currentRole === 'passenger'
              ? 'Ví dụ: Sáng mai 8h em cần tìm xe ghép 1 người từ Bù Đốp đi Bệnh viện Chợ Rẫy Sài Gòn đón ở QL13 phụ xăng 120k sđt 0984883750...'
              : 'Ví dụ: Trưa nay 11h mình chạy Xpander 7 chỗ từ Đồng Xoài về Sài Gòn còn 4 chỗ cốp rộng nhận gửi kèm hàng hoá sđt 0988112233...'
          }
          className="w-full min-h-[86px] sm:min-h-[96px] rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.08] focus:border-[#0071e3] focus:bg-white dark:focus:bg-[#1c1c1e] focus:ring-4 focus:ring-[#0071e3]/10 p-3.5 text-xs sm:text-sm text-[#1d1d1f] dark:text-slate-100 placeholder:text-[#86868b] outline-none resize-none transition-all font-sans leading-relaxed shadow-inner"
        />
      </div>

      {/* ── THƯ VIỆN MẪU ĐA DẠNG: LUÔN HIỂN THỊ ĐỂ ĐỔI MẪU 1-CHẠM (APPLE HIG RIBBON) ── */}
      <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] relative z-10 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Hàng 1: Tabs Chủ xe / Khách + Nút Đổi mẫu nhanh trên mobile */}
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <div className="inline-flex items-center p-0.5 rounded-xl bg-[#e5e5ea]/80 dark:bg-slate-800/80 border border-black/[0.06] dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('driver');
                  if (onRoleChange) onRoleChange('driver');
                }}
                className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeCategory === 'driver'
                    ? 'bg-[#0071e3] text-white shadow-xs'
                    : 'text-[#6e6e73] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-slate-200'
                }`}
              >
                <Car className="w-3.5 h-3.5 shrink-0" />
                <span>Mẫu Chủ xe ({SMART_TRIP_TEMPLATES.driver.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('passenger');
                  if (onRoleChange) onRoleChange('passenger');
                }}
                className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeCategory === 'passenger'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-[#6e6e73] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Mẫu Khách ({SMART_TRIP_TEMPLATES.passenger.length})</span>
              </button>
            </div>

            {/* Nút đổi mẫu nhanh trên mobile */}
            <button
              type="button"
              onClick={handleCycleNextSample}
              title="Bấm để thử lần lượt các mẫu có sẵn"
              className="sm:hidden text-[11px] text-[#6e6e73] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-white px-2 py-1.5 rounded-lg bg-[#f5f5f7] dark:bg-white/5 hover:bg-[#e8e8ed] dark:hover:bg-white/10 border border-black/[0.06] dark:border-white/5 cursor-pointer inline-flex items-center gap-1 transition-all shrink-0 font-medium"
            >
              <RefreshCw className="w-3 h-3 text-amber-500" />
              <span>Đổi mẫu</span>
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* Segmented Filter Chiều đi / Chiều về */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-[#e5e5ea]/80 dark:bg-slate-800/80 border border-black/[0.06] dark:border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setDirectionFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                  directionFilter === 'all'
                    ? 'bg-white dark:bg-white/20 text-[#1d1d1f] dark:text-white font-bold shadow-xs'
                    : 'text-[#6e6e73] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-slate-200'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter('outbound')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-medium ${
                  directionFilter === 'outbound'
                    ? 'bg-[#0071e3] text-white font-bold shadow-xs'
                    : 'text-[#6e6e73] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-slate-200'
                }`}
              >
                <span>➔ Chiều đi</span>
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter('return')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-medium ${
                  directionFilter === 'return'
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : 'text-[#6e6e73] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-slate-200'
                }`}
              >
                <span>⬅ Chiều về</span>
              </button>
            </div>

            {/* Nút đổi mẫu nhanh trên desktop */}
            <button
              type="button"
              onClick={handleCycleNextSample}
              title="Bấm để thử lần lượt các mẫu có sẵn"
              className="hidden sm:inline-flex text-[11px] text-[#6e6e73] dark:text-slate-400 hover:text-[#1d1d1f] dark:hover:text-white px-2.5 py-1.5 rounded-lg bg-[#f5f5f7] dark:bg-white/5 hover:bg-[#e8e8ed] dark:hover:bg-white/10 border border-black/[0.06] dark:border-white/5 cursor-pointer items-center gap-1.5 transition-all shrink-0 font-medium"
            >
              <RefreshCw className="w-3 h-3 text-amber-500" />
              <span>Đổi mẫu khác</span>
            </button>
          </div>
        </div>

        {/* Danh sách các chip mẫu bấm 1 chạm */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 -mx-1 scrollbar-none">
          {currentTemplates.map((tmpl) => {
            const isSelected = inputText.trim() === tmpl.text.trim();
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                title={tmpl.desc}
                className={`text-[11px] px-3 py-1.5 rounded-xl border transition-all cursor-pointer text-left shrink-0 inline-flex items-center gap-1.5 select-none ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20 font-bold'
                    : 'border-black/[0.08] dark:border-white/[0.08] bg-[#f5f5f7] dark:bg-slate-800/60 hover:bg-[#e8e8ed] dark:hover:bg-slate-700/80 text-[#424245] dark:text-slate-300 hover:text-[#1d1d1f] dark:hover:text-white'
                }`}
              >
                {tmpl.badge.includes('Gia đình') ? (
                  <HeartHandshake className="w-3 h-3 text-pink-500 shrink-0" />
                ) : tmpl.badge.includes('Gửi hàng') ? (
                  <Package className="w-3 h-3 text-amber-500 shrink-0" />
                ) : tmpl.badge.includes('sân bay') ? (
                  <Plane className="w-3 h-3 text-sky-500 shrink-0" />
                ) : tmpl.role === 'passenger' ? (
                  <Users className="w-3 h-3 text-emerald-600 shrink-0" />
                ) : (
                  <Car className="w-3 h-3 text-[#0071e3] shrink-0" />
                )}
                <span>{tmpl.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-time Extracted Entity Pills (Chuẩn Cursor & Apple) */}
      {parsedResult && (
        <div className="mt-4 pt-3.5 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3 relative z-10 animate-in fade-in duration-200">
          {/* Header kết quả nhận diện */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-xs sm:text-sm">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Đã nhận diện và tự điền biểu mẫu:</span>
            </span>
            <span className="text-[11px] text-[#86868b] dark:text-slate-400 hidden sm:inline">
              Kiểm tra thông tin trước khi đăng
            </span>
          </div>

          {/* Các chip thực thể */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {/* Vai trò */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
              {parsedResult.role === 'driver' ? <Car className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
              <span>{parsedResult.role === 'driver' ? 'Chủ xe' : 'Người cần tìm xe'}</span>
            </span>

            {/* Điểm đón */}
            {parsedResult.fromLocation && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đi: {parsedResult.fromLocation}</span>
              </span>
            )}

            {/* Điểm đến */}
            {parsedResult.toLocation && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                <Navigation className="w-3.5 h-3.5 text-rose-500" />
                <span>Đến: {parsedResult.toLocation}</span>
              </span>
            )}

            {/* Điểm hẹn đón cụ thể (nếu có) */}
            {parsedResult.waypointNote && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-500/15 border border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 text-xs font-medium">
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                <span>{parsedResult.waypointNote}</span>
              </span>
            )}

            {/* Giờ đi */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-mono font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {parsedResult.timeSlot} · {parsedResult.scheduleDay}
              </span>
            </span>

            {/* Số ghế */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-semibold">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>
                {parsedResult.role === 'driver' ? `Cần ${parsedResult.seats} người` : `Cần ${parsedResult.seats} chỗ`}
              </span>
            </span>

            {/* Giá chia sẻ hoặc Ngân sách khách phụ xăng */}
            {parsedResult.price && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold font-mono">
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {parsedResult.role === 'driver' ? 'Phụ xăng: ' : 'Ngân sách: '}
                  {formatVND(parsedResult.price)}/ghế
                </span>
              </span>
            )}

            {/* Số điện thoại Zalo */}
            {parsedResult.phoneReal && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300 text-xs font-mono font-semibold">
                <Phone className="w-3.5 h-3.5 text-cyan-600" />
                <span>Zalo: {parsedResult.phoneReal}</span>
              </span>
            )}

            {/* CHỈ HIỂN THỊ THÔNG TIN XE CHO CHỦ XE (KHÔNG GÁN VÔ LÝ CHO NGƯỜI ĐI CÙNG) */}
            {parsedResult.role === 'driver' && (
              <>
                {parsedResult.hasRelatives && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                    <HeartHandshake className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Xe chở người thân · Nhận {parsedResult.seats} khách</span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs">
                  <Car className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {parsedResult.carCategory === 'convenient_trip' ? 'Xe tiện chuyến' : 'Xe gia đình'}
                    {parsedResult.capacity ? ` · ${parsedResult.capacity} chỗ` : ''}
                  </span>
                </span>
              </>
            )}

            {/* Nhận gửi đồ / bưu phẩm */}
            {parsedResult.acceptsParcel && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                <Package className="w-3.5 h-3.5 text-amber-600" />
                <span>{parsedResult.role === 'driver' ? 'Nhận kèm bưu phẩm' : 'Gửi bưu phẩm/hàng'}</span>
              </span>
            )}
          </div>

          {/* Dedicated Action Buttons (Hàng nút bấm chuẩn Apple & Mobile-first) */}
          <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              <button
                type="button"
                onClick={() => setShowTicketShare(true)}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] dark:bg-white/10 dark:hover:bg-white/20 border border-black/[0.08] dark:border-white/15 text-[#1d1d1f] dark:text-white text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer active:scale-[0.98] inline-flex items-center justify-center gap-2 shrink-0"
              >
                <Share2 className="w-4 h-4 text-[#0071e3] shrink-0" />
                <span>Xuất Vé VIP Đăng Zalo/FB</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (parsedResult && onInstantSubmit) {
                    onInstantSubmit(parsedResult);
                  }
                }}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#0071e3]/25 transition-all cursor-pointer active:scale-[0.98] inline-flex items-center justify-center gap-2 shrink-0"
              >
                <Zap className="w-4 h-4 fill-current text-white shrink-0" />
                <span>Đăng chuyến ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showTicketShare && synthesizedTrip && (
        <TicketShareModal
          trip={synthesizedTrip}
          onClose={() => setShowTicketShare(false)}
        />
      )}
    </div>
  );
}
