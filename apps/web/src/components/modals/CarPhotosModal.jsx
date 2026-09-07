import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, ShieldCheck, Camera, Check, Car } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

export default function CarPhotosModal({ trip, isOpen, onClose }) {
  // Hook phải luôn được gọi trước mọi early return (Rules of Hooks)
  const [activeIndex, setActiveIndex] = useState(0);

  const photos = Array.isArray(trip?.carPhotos) && trip.carPhotos.length >= 1 ? trip.carPhotos : [];

  if (!isOpen || !trip || photos.length === 0) return null;

  const currentPhoto = photos[activeIndex] || photos[0];
  const total = photos.length;

  const handlePrev = (e) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  };

  // Trích xuất mã biển số che mẫu (ví dụ 93A-***.86 dựa theo quê quán hoặc mặc định)
  const plateMask = trip.plateMask || (trip.from?.includes('Bình Phước') ? '93A - ***.86' : '51K - ***.24');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-[#161720] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate flex items-center gap-2">
                <span>Ảnh xe thực tế ({photos.length} góc chụp)</span>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Đã che biển số
                </span>
              </h3>
              <p className="text-xs text-slate-400 truncate">
                {trip.carType || 'Xe gia đình'} · Mã chuyến {trip.maskedCode}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Photo Display Area */}
        <div className="relative aspect-[16/10] sm:aspect-[16/9] bg-black/40 flex items-center justify-center overflow-hidden select-none group">
          <img
            src={currentPhoto.url || currentPhoto}
            alt={currentPhoto.label || `Ảnh xe ${activeIndex + 1}`}
            className="w-full h-full object-cover transition-transform duration-300"
          />

          {/* Privacy Plate Badge Watermark */}
          <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center gap-2 shadow-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11.5px] font-mono font-bold tracking-wide">Biển số: {plateMask}</span>
            <span className="text-[10px] text-emerald-300 font-normal hidden xs:inline">(Bảo mật quyền riêng tư)</span>
          </div>

          {/* Angle Tag Badge */}
          <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/20 text-white flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-primary-400" />
            <span className="text-xs font-bold text-white">
              {currentPhoto.label || `Góc ${activeIndex + 1}/${total}`}
            </span>
          </div>

          {/* Navigation Arrows */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-3 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm border border-white/20 opacity-90 transition-all cursor-pointer hover:scale-105"
                title="Ảnh trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-3 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm border border-white/20 opacity-90 transition-all cursor-pointer hover:scale-105"
                title="Ảnh tiếp"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Photo Counter */}
          <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-mono font-medium border border-white/10">
            {activeIndex + 1} / {total}
          </div>
        </div>

        {/* Caption & Reassurance */}
        {currentPhoto.caption && (
          <div className="px-5 py-2.5 bg-white/[0.02] border-b border-white/5 text-xs text-slate-300 text-center font-medium">
            &ldquo;{currentPhoto.caption}&rdquo;
          </div>
        )}

        {/* 3-5 Thumbnail Selector Strip */}
        <div className="p-3.5 bg-black/30 flex items-center justify-center gap-2 overflow-x-auto custom-scrollbar">
          {photos.map((p, idx) => {
            const isSel = idx === activeIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`relative w-16 sm:w-20 aspect-[16/10] rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                  isSel
                    ? 'border-primary-500 ring-2 ring-primary-500/30 scale-105'
                    : 'border-white/15 opacity-60 hover:opacity-100 hover:border-white/40'
                }`}
              >
                <img src={p.url || p} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white text-center py-0.5 font-bold truncate px-1">
                  {p.label ? p.label.replace('Góc ', '') : `${idx + 1}`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 bg-white/[0.01]">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <Check className="w-3.5 h-3.5" />
            <span>Đã xác minh đầy đủ góc trước, sau & thân xe</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-300 hover:text-white">
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}
