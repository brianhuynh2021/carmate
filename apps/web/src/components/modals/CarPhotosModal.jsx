import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ShieldCheck, Camera, Check, Car, Package } from 'lucide-react';
import { maskLicensePlate, normalizePhotoUrl } from '@carmate/shared';
import Button from '../ui/Button.jsx';
import { useI18n } from '../../i18n/index.jsx';

export default function CarPhotosModal({ trip, isOpen, onClose }) {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [failedImages, setFailedImages] = useState({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const photos = Array.isArray(trip?.carPhotos) && trip.carPhotos.length >= 1 ? trip.carPhotos : [];
  const total = photos.length;
  const currentPhoto = photos[activeIndex] || photos[0];
  const currentPhotoUrl = normalizePhotoUrl(currentPhoto);

  // Close with the Escape key & navigate with the arrow keys
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft' && total > 1) {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
      } else if (e.key === 'ArrowRight' && total > 1) {
        setActiveIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, total, onClose]);

  if (!isOpen || !trip) return null;

  const handlePrev = (e) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  };

  // Extract the privacy-masked license plate code (e.g. 93A - ***.86 or 51K - ***.24)
  const plateMask = maskLicensePlate(trip.plateMask || trip.plate || trip.licensePlate, trip.from);
  const effectiveCapacity = (trip.carType && trip.carType.includes('7')) ? 7 : (trip.capacity || 5);
  const cleanCarName = trip.carType
    ? trip.carType.split('(')[0].trim().replace(/\s*(cá nhân|gia đình)\b/gi, '')
    : `Xe ${effectiveCapacity} chỗ`;

  const modalNode = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#161720] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 1. HEADER: VEHICLE INFO & PHOTOS ONLY ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 shrink-0">
              <Car className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="type-heading text-white truncate flex items-center gap-2">
                <span>{cleanCarName}</span>
                <span className="type-caption px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {total > 0 ? `${total} ảnh chụp` : 'Xe đã xác minh'}
                </span>
              </h3>
              <p className="type-caption text-slate-400 truncate mt-0.5">
                Xe {effectiveCapacity} chỗ{trip.maskedCode ? ` · Mã chuyến ${trip.maskedCode}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="type-button w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={t('carPhotos.s010')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── 2. BODY: VEHICLE PHOTOS OR VEHICLE SPEC ILLUSTRATION CARD ── */}
        {total > 0 ? (
          <>
            {/* Main Photo Display Area */}
            <div className="relative aspect-[16/10] sm:aspect-[16/9] bg-black/40 flex items-center justify-center overflow-hidden select-none group">
              {currentPhotoUrl && !failedImages[activeIndex] ? (
                <img
                  src={currentPhotoUrl}
                  alt={currentPhoto.label || `Ảnh xe ${activeIndex + 1}`}
                  onError={() => setFailedImages((prev) => ({ ...prev, [activeIndex]: true }))}
                  className="w-full h-full object-cover transition-transform duration-300"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-slate-400 p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                    <Car className="w-7 h-7" />
                  </div>
                  <p className="type-caption text-slate-300">
                    {currentPhoto.label || `Góc ${activeIndex + 1}`}
                  </p>
                  <p className="type-caption text-slate-500">
                    {t('carPhotos.s001')}
                  </p>
                </div>
              )}

              {/* Privacy Plate Badge Watermark */}
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center gap-2 shadow-lg">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="type-caption font-mono">Biển số: {plateMask}</span>
                <span className="type-caption text-emerald-300 hidden xs:inline">{t('carPhotos.s002')}</span>
              </div>

              {/* Angle Tag Badge */}
              <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/20 text-white flex items-center gap-1.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-primary-400" />
                <span className="type-caption text-white">
                  {currentPhoto.label || `Góc ${activeIndex + 1}/${total}`}
                </span>
              </div>

              {/* Navigation Arrows */}
              {total > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="type-button absolute left-3 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm border border-white/20 opacity-90 transition-all cursor-pointer hover:scale-105"
                    title={t('carPhotos.s011')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="type-button absolute right-3 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm border border-white/20 opacity-90 transition-all cursor-pointer hover:scale-105"
                    title={t('carPhotos.s012')}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Photo Counter */}
              <div className="type-badge absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10">
                {activeIndex + 1} / {total}
              </div>
            </div>

            {/* Thumbnail Strip */}
            {total > 1 && (
              <div className="p-3 bg-black/30 flex items-center justify-center gap-2 overflow-x-auto custom-scrollbar">
                {photos.map((p, idx) => {
                  const isSel = idx === activeIndex;
                  const thumbUrl = normalizePhotoUrl(p);
                  const isFailed = failedImages[idx];
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      className={`type-button relative w-16 sm:w-20 aspect-[16/10] rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                        isSel
                          ? 'border-primary-500 ring-2 ring-primary-500/30 scale-105'
                          : 'border-white/15 opacity-60 hover:opacity-100 hover:border-white/40'
                      }`}
                    >
                      {thumbUrl && !isFailed ? (
                        <img
                          src={thumbUrl}
                          alt={`Thumbnail ${idx + 1}`}
                          onError={() => setFailedImages((prev) => ({ ...prev, [idx]: true }))}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400">
                          <Car className="w-4 h-4" />
                        </div>
                      )}
                      <span className="type-caption absolute bottom-0 inset-x-0 bg-black/70 text-white text-center py-0.5 truncate px-1">
                        {p.label ? p.label.replace('Góc ', '') : `${idx + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Case where the vehicle has no photos uploaded: show the Apple-standard spec card */
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.02]">
            <div className="w-20 h-20 rounded-3xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400">
              <Car className="w-10 h-10" />
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="type-heading text-white">{cleanCarName}</h4>
              <p className="type-caption text-slate-400">
                {t('carPhotos.s003')}
              </p>
            </div>
          </div>
        )}

        {/* ── 3. SPECS BAR: TRANSPARENT VEHICLE SPECS ── */}
        <div className="grid grid-cols-3 gap-2 px-5 py-3 border-t border-white/5 bg-white/[0.01]">
          <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center text-center">
            <span className="text-slate-400">{t('carPhotos.s004')}</span>
            <span className="type-caption text-white truncate max-w-full mt-0.5">{cleanCarName}</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center text-center">
            <span className="text-slate-400">{t('carPhotos.s005')}</span>
            <span className="type-caption text-white mt-0.5">{effectiveCapacity} chỗ</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center text-center">
            <span className="text-slate-400">{t('carPhotos.s006')}</span>
            <span className="type-caption font-mono text-emerald-400 mt-0.5">{plateMask}</span>
          </div>
        </div>

        {/* Included amenities (if any) */}
        {trip.acceptsParcel && (
          <div className="type-caption px-5 py-2 border-t border-white/5 flex items-center gap-2 text-amber-300/90 bg-amber-500/5">
            <Package className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>{t('carPhotos.s007')}</span>
          </div>
        )}

        {/* ── 4. FOOTER: REASSURANCE & CLOSE BUTTON ── */}
        <div className="type-caption px-5 py-3.5 border-t border-white/10 flex items-center justify-between text-slate-400 bg-white/[0.02]">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{t('carPhotos.s008')}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-300 hover:text-white cursor-pointer">
            {t('carPhotos.s009')}
          </Button>
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== 'undefined') {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
}
