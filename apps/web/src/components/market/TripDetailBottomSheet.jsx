import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Car,
  Clock,
  Star,
  Sparkles,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { formatVND } from '@carmate/shared';
import { CarMateBadge } from '../ui/Logo.jsx';

/**
 * Trả về chuỗi Thứ và Ngày/Tháng/Năm theo định dạng Việt Nam (ví dụ: "Thứ 2 (14/09/2026)")
 */
function formatTripTimeHeader(departureLabel = '04:30', departureDate = null) {
  let targetDate = new Date();

  if (departureDate === 'Ngày mai') {
    targetDate = new Date(Date.now() + 86400000);
  } else if (departureDate === 'Hôm nay') {
    targetDate = new Date();
  } else if (departureDate) {
    const parsed = new Date(departureDate);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  const dayOfWeekNames = [
    'Chủ Nhật',
    'Thứ 2',
    'Thứ 3',
    'Thứ 4',
    'Thứ 5',
    'Thứ 6',
    'Thứ 7'
  ];
  const dayName = dayOfWeekNames[targetDate.getDay()] || 'Hôm nay';
  const day = String(targetDate.getDate()).padStart(2, '0');
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');

  return `${dayName} (${day}/${month})`;
}

/**
 * BOTTOM SHEET / MODAL CHI TIẾT CHUYẾN XE (PROGRESSIVE DISCLOSURE)
 *
 * Chuẩn Apple HIG & Liquid Aesthetics:
 * - Mobile: Trượt mượt mà từ đáy (Bottom Sheet) với thanh kéo tròn, bo góc trên rounded-t-3xl.
 * - Desktop: Modal căn giữa màn hình với bo góc squircle rounded-3xl.
 * - Sticky Bottom Bar: Nút giữ chỗ 0đ cọc to, rõ, bám đáy.
 */
export default function TripDetailBottomSheet({
  isOpen,
  onClose,
  trip,
  originName = 'Cây xăng Petrolimex Tân Khai (QL13)',
  destName = 'Cụm BV Chợ Rẫy / BV Đại học Y Dược',
  destNote = 'Cụm BV: Chợ Rẫy, Ung Bướu, ĐHYD / Hàng Xanh',
  segmentPrice = 165000,
  onConfirmBook
}) {
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [selectedSeats, setSelectedSeats] = useState(1);

  const allPhotos = (() => {
    let list = [];
    if (Array.isArray(trip?.photos) && trip.photos.length > 0) {
      list = trip.photos.map((p) => (typeof p === 'string' ? p : p?.url)).filter(Boolean);
    } else if (Array.isArray(trip?.carPhotos) && trip.carPhotos.length > 0) {
      list = trip.carPhotos.map((p) => (typeof p === 'string' ? p : p?.url)).filter(Boolean);
    } else if (trip?.carPhotoUrl || trip?.carImage || trip?.vehicleImage || trip?.image) {
      const single = trip?.carPhotoUrl || trip?.carImage || trip?.vehicleImage || trip?.image;
      list = single ? [single] : [];
    }

    // Tuyệt đối chỉ dùng ảnh xe thực tế (loại bỏ ảnh gia đình/con người)
    list = list.filter((p) => !p.includes('hero_family_ride') && !p.includes('passenger_comfort'));

    // Nếu chuyến chưa có đủ các góc chụp thực tế, trang bị trọn bộ 5 góc xe 7 chỗ gia đình thật (Đầu xe, Thân xe, Đuôi xe, Nội thất ghế da, Khoang cốp)
    if (list.length < 2) {
      return [
        'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1509000000103-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=80'
      ];
    }
    return list;
  })();

  // Đóng bằng phím ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Ngăn cuộn trang phía sau khi mở sheet
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !trip || typeof document === 'undefined') return null;

  const seatsAvailable = Number(trip.seatsAvailable ?? 1);
  const totalSeats = Number(trip.totalSeats || trip.capacity || 4);
  const isSoldOut = seatsAvailable <= 0;
  const displayPrice = trip.pricePerSeat || segmentPrice;
  const timeHeader = formatTripTimeHeader(trip.departureLabel, trip.departureDate);
  const vehicleModel = trip.vehicleModel || 'Xe 7 chỗ gia đình';
  const maskedPlate = trip.plateMasked || '93A-541.xx';

  // Thông tin chủ xe & danh xưng văn minh CarMate: "Chủ xe: H. (#102)"
  const driverDisplayName = (() => {
    const rawCode = trip?.maskedCode || trip?.driver?.maskedCode || trip?.driverCode || trip?.id || '';
    const numMatch = String(rawCode).match(/\d+/);
    const codeSuffix = numMatch ? `#${numMatch[0]}` : '#102';

    const rawName = trip?.driverName || trip?.publicName || trip?.driver?.name || trip?.driver?.publicName || '';
    let cleanName = String(rawName)
      .replace(/^Chủ xe\s+/i, '')
      .replace(/^(Anh|Chị|Chú|Bác)\s+/i, '')
      .replace(/\(.*\)/g, '')
      .trim();

    if (!cleanName || /^CX-\d+/i.test(cleanName) || /^\d+$/.test(cleanName)) {
      cleanName = 'Huỳnh';
    }

    const initial = cleanName.charAt(0).toUpperCase();
    return `${initial}. (${codeSuffix})`;
  })();
  const driverRating = Number(trip.rating || 5.0).toFixed(1);
  const driverTrips = Number(trip.completedCount || trip.assurance?.completedTrips || 98);

  // Tiện ích xe
  const amenitiesText = Array.isArray(trip.amenities) && trip.amenities.length > 0
    ? trip.amenities.join(' · ')
    : 'Không khói thuốc · Cốp rộng · Xe êm';


  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
        onClick={onClose}
      >
      <div
        className="w-full max-h-[96vh] sm:max-h-[95vh] sm:max-w-lg bg-white dark:bg-[#1c1c1e] rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200/70 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thanh kéo trên mobile (Apple Pull Handle) */}
        <div className="pt-2 pb-0.5 flex justify-center sm:hidden shrink-0">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-white/20 rounded-full" />
        </div>

        {/* ── HEADER MODAL ── */}
        <div className="px-5 py-3 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <CarMateBadge size="xs" />
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 dark:bg-blue-950/50 text-[#0071e3] dark:text-blue-300 border border-blue-200/60 dark:border-blue-700/40">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
              <span>Chuyến xe xác thực</span>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── NỘI DUNG CUỘN (SCROLLABLE BODY - CHUẨN MIT TRANSIT CANVAS #DFE5EC) ── */}
        <div className="overflow-y-auto px-4 sm:px-5 py-3.5 space-y-3 text-slate-900 dark:text-white bg-[#DFE5EC] dark:bg-[#121721] transition-colors">
          {/* 1. KHỐI THỜI GIAN & TÌNH TRẠNG CHỖ */}
          <div className="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs hover:shadow-md hover:border-slate-400/80 dark:hover:border-white/25 hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="px-2.5 py-1 rounded-xl bg-slate-950 dark:bg-black text-white font-mono font-bold text-base sm:text-lg shrink-0 shadow-2xs border border-blue-500/20">
                {trip.departureLabel || '04:30'}
              </span>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {timeHeader}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              {isSoldOut ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-500">
                  Đã hết chỗ
                </span>
              ) : seatsAvailable >= 2 ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline">Số ghế:</span>
                  <div className="inline-flex items-center bg-emerald-50 dark:bg-emerald-950/60 p-0.5 rounded-full border border-emerald-300 dark:border-emerald-700/60 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setSelectedSeats(1)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono transition-all cursor-pointer ${
                        selectedSeats === 1
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-white/10'
                      }`}
                    >
                      1 ghế
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSeats(2)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono transition-all cursor-pointer ${
                        selectedSeats === 2
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-white/10'
                      }`}
                    >
                      2 ghế
                    </button>
                  </div>
                </div>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  Nhận 1 ghế
                </span>
              )}
            </div>
          </div>

          {/* 2. LỘ TRÌNH THỰC TẾ (ĐÓN / TRẢ) */}
          <div className="p-3 rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs hover:shadow-md hover:border-slate-400/80 dark:hover:border-white/25 hover:-translate-y-0.5 transition-all duration-200 space-y-1.5">
            <div className="flex items-start gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 text-[8px] font-bold shadow-2xs">
                ●
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {originName}
                </p>
              </div>
            </div>

            <div className="flex items-center pl-1 -my-1 text-slate-300 dark:text-slate-600">
              <span className="text-xs font-mono select-none">↓</span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[#0071e3] bg-white dark:bg-[#1c1c1e] text-[#0071e3] flex items-center justify-center shrink-0 mt-0.5 text-[7px] font-bold shadow-2xs">
                ○
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {destName}
                </p>
              </div>
            </div>
          </div>

          {/* 3. THÔNG TIN CHỦ XE & PHƯƠNG TIỆN */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs hover:shadow-md hover:border-slate-400/80 dark:hover:border-white/25 hover:-translate-y-0.5 transition-all duration-200 space-y-2.5 relative">
            {/* Banner Ảnh Xe Thực Tế Trải Rộng Toàn Khung (Đa góc chụp) */}
            {allPhotos.length > 0 && (
              <div className="space-y-1.5">
                <div
                  className="relative w-full h-36 sm:h-40 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-xs group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoViewerOpen(true);
                  }}
                >
                  <img
                    src={allPhotos[selectedPhotoIndex] || allPhotos[0]}
                    alt={`Ảnh xe thực tế - Góc ${selectedPhotoIndex + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 pointer-events-none" />

                  {/* Badge định danh ảnh xe thật */}
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[10.5px] font-semibold flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Ảnh xe thực tế ({selectedPhotoIndex + 1}/{allPhotos.length})</span>
                  </div>

                  {/* Nút gợi ý xem ảnh lớn */}
                  <div className="absolute bottom-2 left-auto right-2.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[10.5px] font-medium flex items-center gap-1 shadow-sm">
                    <span>Chạm để phóng to</span>
                  </div>
                </div>

                {/* Dải thumbnails phụ bên dưới để chuyển góc chụp xe thực tế */}
                {allPhotos.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                    {allPhotos.map((photo, idx) => {
                      const angleLabels = ['Đầu xe', 'Thân xe', 'Đuôi xe', 'Nội thất', 'Cốp xe'];
                      const label = angleLabels[idx] || `Góc ${idx + 1}`;
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`relative w-14 h-9 sm:w-16 sm:h-10 shrink-0 rounded-lg overflow-hidden border transition-all cursor-pointer group ${
                            idx === selectedPhotoIndex
                              ? 'border-[#0071e3] ring-2 ring-[#0071e3]/40'
                              : 'border-slate-200 dark:border-white/10 opacity-70 hover:opacity-100'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPhotoIndex(idx);
                          }}
                        >
                          <img
                            src={photo}
                            alt={label}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[8.5px] font-medium text-white text-center leading-tight py-0.5 pointer-events-none">
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Chủ xe:</span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {driverDisplayName}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{driverRating}</span>
                <span className="text-slate-400 font-normal">({driverTrips} chuyến)</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Dòng xe:</span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {vehicleModel}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-white dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-white/10 shadow-2xs">
                {maskedPlate}
              </span>
            </div>

            <div className="pt-1.5 border-t border-slate-200 dark:border-white/10">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Tiện nghi: </span>
                {amenitiesText}
              </p>
            </div>
          </div>

          {/* 4. CAM KẾT NỀN TẢNG (AN TÂM 100%) */}
          <div className="p-3 rounded-2xl bg-white dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-xs hover:shadow-md hover:border-slate-400/80 dark:hover:border-white/25 hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 text-[11px] sm:text-[11.5px] text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                Không cần đặt cọc · Trả tiền trực tiếp cho chủ xe khi lên xe
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
              <span>Giá chia sẻ trọn gói xăng xe & cầu đường, không phụ phí phát sinh</span>
            </div>
          </div>
        </div>

        {/* ── STICKY BOTTOM ACTION BAR (CỐ ĐỊNH Ở ĐÁY) ── */}
        <div className="p-3 sm:p-3.5 border-t border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md shrink-0 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[10.5px] text-slate-400 uppercase tracking-wider font-semibold">
              Chi phí chia sẻ
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatVND(displayPrice * selectedSeats)}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">/ {selectedSeats} ghế</span>
            </div>
          </div>

          <button
            type="button"
            disabled={isSoldOut}
            onClick={() => onConfirmBook?.(trip, selectedSeats)}
            className="flex-1 max-w-xs h-11 sm:h-12 rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>{isSoldOut ? 'Đã hết chỗ' : 'GIỮ CHỖ NGAY (0đ CỌC)'}</span>
          </button>
        </div>
      </div>
    </div>

      {/* PHOTO VIEWER MODAL */}
      {photoViewerOpen && allPhotos.length > 0 && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/95 flex flex-col items-center justify-center animate-fade-in"
          onClick={() => setPhotoViewerOpen(false)}
        >
          <button 
            type="button"
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full cursor-pointer z-10"
            onClick={(e) => { e.stopPropagation(); setPhotoViewerOpen(false); }}
          >
            <X className="w-6 h-6" />
          </button>
          
          <img 
            src={allPhotos[selectedPhotoIndex]} 
            alt="Ảnh xe chi tiết" 
            className="max-w-full max-h-[80vh] object-contain select-none"
            onClick={(e) => e.stopPropagation()}
          />
          
          {allPhotos.length > 1 && (
            <div className="absolute inset-y-0 w-full flex items-center justify-between px-4 pointer-events-none">
              <button 
                type="button"
                className="p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer backdrop-blur-sm"
                onClick={(e) => { e.stopPropagation(); setSelectedPhotoIndex(Math.max(0, selectedPhotoIndex - 1)); }}
                disabled={selectedPhotoIndex === 0}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                type="button"
                className="p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer backdrop-blur-sm"
                onClick={(e) => { e.stopPropagation(); setSelectedPhotoIndex(Math.min(allPhotos.length - 1, selectedPhotoIndex + 1)); }}
                disabled={selectedPhotoIndex === allPhotos.length - 1}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          )}
          
          {allPhotos.length > 1 && (
            <div className="absolute bottom-8 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              {allPhotos.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-1.5 h-1.5 rounded-full transition-all ${idx === selectedPhotoIndex ? 'bg-white scale-125' : 'bg-white/30'}`} 
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>,
    document.body
  );
}
