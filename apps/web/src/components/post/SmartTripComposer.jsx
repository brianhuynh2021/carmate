import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  CornerDownLeft,
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
  HeartHandshake
} from 'lucide-react';
import { parseNaturalTrip } from '../../utils/nlpTripParser.js';
import { formatVND } from '@carmate/shared';

const SAMPLES = [
  'Chiều nay 17h mình chở vợ con từ Bù Đốp về Sài Gòn xe 7 chỗ còn 1 ghế sau đón QL13 phụ xăng 120k sđt 0984883750',
  'Sáng mai 7h mình từ Lộc Ninh về Sài Gòn xe Veloz tiện chuyến còn 4 chỗ 180k đón dọc QL13 sđt 0913889922',
  'Tìm xe đi từ Đà Nẵng ra Huế sáng mai tầm 9h cần 2 ghế sđt 0905112233'
];

export default function SmartTripComposer({ onApply, onInstantSubmit }) {
  const [inputText, setInputText] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [hasApplied, setHasApplied] = useState(false);

  // Phân tích văn bản thời gian thực (0ms)
  useEffect(() => {
    if (!inputText.trim()) {
      setParsedResult(null);
      setHasApplied(false);
      return;
    }
    const result = parseNaturalTrip(inputText);
    setParsedResult(result);
    if (result && onApply) {
      onApply(result);
      setHasApplied(true);
    }
  }, [inputText]);

  const handleApplySample = (sampleText) => {
    setInputText(sampleText);
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

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-900 via-[#16181d] to-[#0f1013] text-white p-4 sm:p-5 border border-slate-800 shadow-xl relative overflow-hidden mb-6">
      {/* Glow Effect phong cách Cursor */}
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
              Dán bài đăng Zalo/Facebook hoặc gõ 1 câu tự nhiên — Hệ thống tự điền lộ trình, giờ chạy và giá vé
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
          placeholder="Ví dụ: Chiều nay 17h mình chạy Hà Nội về Hải Phòng xe 7 chỗ còn 3 ghế 150k đón Mỹ Đình sđt 0984883750..."
          className="w-full rounded-xl bg-black/40 border border-slate-700/80 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/25 p-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 outline-none resize-none transition-all font-sans leading-relaxed"
        />
      </div>

      {/* Thử Mẫu Tin Nhanh (1 chạm) */}
      {!inputText && (
        <div className="pt-2.5 flex items-center gap-1.5 flex-wrap relative z-10">
          <span className="text-[11px] text-slate-500 font-medium">Thử mẫu nhanh:</span>
          {SAMPLES.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplySample(sample)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/70 text-slate-300 hover:text-white transition-colors cursor-pointer text-left truncate max-w-xs inline-flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">
                {idx === 0 ? 'Bù Đốp ➔ Sài Gòn (Chở vợ con)' : idx === 1 ? 'Lộc Ninh ➔ Sài Gòn' : 'Đà Nẵng ➔ Huế'}
              </span>
            </button>
          ))}
        </div>
      )}

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
              <span>{parsedResult.role === 'driver' ? 'Chủ xe' : 'Khách tìm xe'}</span>
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
              <span>{parsedResult.seats} ghế</span>
            </span>

            {/* Giá chia sẻ */}
            {parsedResult.price && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>{formatVND(parsedResult.price)}/ghế</span>
              </span>
            )}

            {/* Xe gia đình chở người thân */}
            {parsedResult.hasRelatives && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
                <HeartHandshake className="w-3.5 h-3.5 text-indigo-400" />
                <span>Xe chở người thân · Chỉ nhận {parsedResult.seats} khách</span>
              </span>
            )}

            {/* Số điện thoại Zalo */}
            {parsedResult.phoneReal && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold">
                <Phone className="w-3.5 h-3.5 text-cyan-400" />
                <span>Zalo: {parsedResult.phoneReal}</span>
              </span>
            )}

            {/* Phân loại xe */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs">
              <Car className="w-3.5 h-3.5 text-slate-400" />
              <span>{parsedResult.carCategory === 'convenient_trip' ? 'Xe tiện chuyến' : 'Xe gia đình'}</span>
            </span>

            {/* Nhận gửi đồ / bưu phẩm */}
            {parsedResult.acceptsParcel && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <Package className="w-3.5 h-3.5 text-amber-400" />
                <span>Nhận gửi đồ/hàng</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
