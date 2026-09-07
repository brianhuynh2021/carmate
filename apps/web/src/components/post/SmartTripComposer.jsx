import React, { useState, useEffect } from 'react';
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
  RefreshCw
} from 'lucide-react';
import { parseNaturalTrip, SMART_TRIP_TEMPLATES } from '../../utils/nlpTripParser.js';
import { formatVND } from '@carmate/shared';

export default function SmartTripComposer({ onApply, onInstantSubmit, currentRole = 'driver', onRoleChange }) {
  const [inputText, setInputText] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [activeCategory, setActiveCategory] = useState(currentRole === 'passenger' ? 'passenger' : 'driver');

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
    setParsedResult(result);
    if (result && onApply) {
      onApply(result);
    }
    // Tự động đồng bộ vai trò lên Form cha nếu phát hiện câu của Khách/Tài xế
    if (result?.role && onRoleChange && result.role !== currentRole) {
      onRoleChange(result.role);
    }
  }, [inputText]);

  const handleApplyTemplate = (tmpl) => {
    setInputText(tmpl.text);
    if (onRoleChange && tmpl.role && tmpl.role !== currentRole) {
      onRoleChange(tmpl.role);
    }
  };

  const handleCycleNextSample = () => {
    const list = SMART_TRIP_TEMPLATES[activeCategory] || SMART_TRIP_TEMPLATES.driver;
    const currentIndex = list.findIndex((t) => t.text.trim() === inputText.trim());
    const nextIndex = (currentIndex + 1) % list.length;
    handleApplyTemplate(list[nextIndex]);
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

  const currentTemplates = SMART_TRIP_TEMPLATES[activeCategory] || SMART_TRIP_TEMPLATES.driver;

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-900 via-[#16181d] to-[#0f1013] text-white p-4 sm:p-5 border border-slate-800 shadow-xl relative overflow-hidden mb-6">
      {/* Glow Effect phong cách Cursor & Apple */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-primary-500/20 text-primary-400 border border-primary-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary-400 animate-pulse" />
          </span>
          <div>
            <h4 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Đăng chuyến nhanh bằng một câu</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-medium tracking-wide">
                Tự động điền
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              {currentRole === 'passenger'
                ? 'Dán nhu cầu tìm xe hoặc gõ 1 câu tự nhiên — Hệ thống tự điền điểm đón, giờ đi và ngân sách'
                : 'Dán bài đăng Zalo/Facebook hoặc gõ 1 câu tự nhiên — Hệ thống tự điền lộ trình, giờ chạy và giá vé'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handlePasteClipboard}
            title="Dán nhanh nội dung vừa copy"
            className="text-[11px] text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer inline-flex items-center gap-1 transition-all"
          >
            <ClipboardPaste className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Dán tin</span>
          </button>
          {inputText && (
            <button
              type="button"
              onClick={() => setInputText('')}
              className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 cursor-pointer inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Làm mới</span>
            </button>
          )}
        </div>
      </div>

      {/* The Smart Omnibar Input */}
      <div className="relative z-10">
        <textarea
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            currentRole === 'passenger'
              ? 'Ví dụ: Sáng mai 8h em cần tìm xe ghép 1 người từ Bù Đốp đi Bệnh viện Chợ Rẫy Sài Gòn đón ở QL13 phụ xăng 120k sđt 0984883750...'
              : 'Ví dụ: Chiều nay 17h mình chở vợ con từ Bù Đốp về Sài Gòn xe 7 chỗ còn 1 ghế sau đón QL13 phụ xăng 120k sđt 0984883750...'
          }
          className="w-full rounded-xl bg-black/40 border border-slate-700/80 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/25 p-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 outline-none resize-none transition-all font-sans leading-relaxed"
        />
      </div>

      {/* ── THƯ VIỆN MẪU ĐA DẠNG: LUÔN HIỂN THỊ ĐỂ ĐỔI MẪU 1-CHẠM (APPLE HIG RIBBON) ── */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 relative z-10 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Segmented Controller chuyển tab Mẫu Chủ xe / Mẫu Khách */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/[0.08] w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setActiveCategory('driver');
                if (onRoleChange) onRoleChange('driver');
              }}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'driver'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Car className="w-3 h-3" />
              <span>Mẫu Chủ xe ({SMART_TRIP_TEMPLATES.driver.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('passenger');
                if (onRoleChange) onRoleChange('passenger');
              }}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'passenger'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Mẫu Khách tìm xe ({SMART_TRIP_TEMPLATES.passenger.length})</span>
            </button>
          </div>

          {/* Nút đổi mẫu nhanh tuần tự */}
          <button
            type="button"
            onClick={handleCycleNextSample}
            title="Bấm để thử lần lượt các mẫu có sẵn"
            className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer inline-flex items-center gap-1 transition-all"
          >
            <RefreshCw className="w-3 h-3 text-amber-400" />
            <span>Đổi mẫu khác</span>
          </button>
        </div>

        {/* Danh sách các chip mẫu bấm 1 chạm */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {currentTemplates.map((tmpl) => {
            const isSelected = inputText.trim() === tmpl.text.trim();
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                title={tmpl.desc}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-left shrink-0 inline-flex items-center gap-1.5 select-none ${
                  isSelected
                    ? 'border-emerald-400/80 bg-emerald-500/20 text-emerald-200 ring-2 ring-emerald-500/20 font-bold'
                    : 'border-slate-800 bg-slate-800/60 hover:bg-slate-700/80 hover:border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {tmpl.badge.includes('Gia đình') ? (
                  <HeartHandshake className="w-3 h-3 text-pink-400 shrink-0" />
                ) : tmpl.badge.includes('Gửi hàng') ? (
                  <Package className="w-3 h-3 text-amber-400 shrink-0" />
                ) : tmpl.badge.includes('sân bay') ? (
                  <Plane className="w-3 h-3 text-sky-400 shrink-0" />
                ) : tmpl.role === 'passenger' ? (
                  <Users className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <Car className="w-3 h-3 text-primary-400 shrink-0" />
                )}
                <span>{tmpl.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-time Extracted Entity Pills (Chuẩn Cursor & Apple) */}
      {parsedResult && (
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 space-y-2.5 relative z-10 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold text-xs">
              <Check className="w-3.5 h-3.5" />
              <span>Đã nhận diện và tự điền biểu mẫu:</span>
            </span>
            <button
              type="button"
              onClick={() => {
                if (parsedResult && onInstantSubmit) {
                  onInstantSubmit(parsedResult);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <Zap className="w-3.5 h-3.5 fill-current text-slate-950" />
              <span>Đăng chuyến ngay (1 chạm)</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {/* Vai trò */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold">
              {parsedResult.role === 'driver' ? <Car className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
              <span>{parsedResult.role === 'driver' ? 'Chủ xe' : 'Người cần tìm xe'}</span>
            </span>

            {/* Điểm đón */}
            {parsedResult.fromLocation && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Đi: {parsedResult.fromLocation}</span>
              </span>
            )}

            {/* Điểm đến */}
            {parsedResult.toLocation && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                <Navigation className="w-3.5 h-3.5 text-rose-400" />
                <span>Đến: {parsedResult.toLocation}</span>
              </span>
            )}

            {/* Điểm hẹn đón cụ thể (nếu có) */}
            {parsedResult.waypointNote && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-medium">
                <MapPin className="w-3.5 h-3.5 text-teal-400" />
                <span>{parsedResult.waypointNote}</span>
              </span>
            )}

            {/* Giờ đi */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {parsedResult.timeSlot} · {parsedResult.scheduleDay}
              </span>
            </span>

            {/* Số ghế */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>
                {parsedResult.role === 'driver' ? `Còn ${parsedResult.seats} chỗ` : `Cần ${parsedResult.seats} ghế`}
              </span>
            </span>

            {/* Giá chia sẻ hoặc Ngân sách khách phụ xăng */}
            {parsedResult.price && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {parsedResult.role === 'driver' ? 'Phụ xăng: ' : 'Ngân sách: '}
                  {formatVND(parsedResult.price)}/ghế
                </span>
              </span>
            )}

            {/* Số điện thoại Zalo */}
            {parsedResult.phoneReal && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold">
                <Phone className="w-3.5 h-3.5 text-cyan-400" />
                <span>Zalo: {parsedResult.phoneReal}</span>
              </span>
            )}

            {/* CHỈ HIỂN THỊ THÔNG TIN XE CHO TÀI XẾ (KHÔNG GÁN VÔ LÝ CHO HÀNH KHÁCH) */}
            {parsedResult.role === 'driver' && (
              <>
                {parsedResult.hasRelatives && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
                    <HeartHandshake className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Xe chở người thân · Nhận {parsedResult.seats} khách</span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs">
                  <Car className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {parsedResult.carCategory === 'convenient_trip' ? 'Xe tiện chuyến' : 'Xe gia đình'}
                    {parsedResult.capacity ? ` · ${parsedResult.capacity} chỗ` : ''}
                  </span>
                </span>
              </>
            )}

            {/* Nhận gửi đồ / bưu phẩm */}
            {parsedResult.acceptsParcel && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <Package className="w-3.5 h-3.5 text-amber-400" />
                <span>{parsedResult.role === 'driver' ? 'Nhận kèm bưu phẩm' : 'Gửi bưu phẩm/hàng'}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
