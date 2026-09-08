import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Fuel,
  Coins,
  ShieldCheck,
  TrendingDown,
  Car,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { ROUTE_BENCHMARKS, formatVND } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';

export default function FairSplitModal({
  isOpen,
  onClose,
  initialRouteKey,
  onSelectSuggestedPrice
}) {
  const routeKeys = Object.keys(ROUTE_BENCHMARKS || {});
  const defaultRouteKey = routeKeys[0] || 'Tuyến CT Hà Nội - Hải Phòng';

  const [selectedRouteKey, setSelectedRouteKey] = useState(
    () => (initialRouteKey && ROUTE_BENCHMARKS?.[initialRouteKey] ? initialRouteKey : defaultRouteKey)
  );
  const [customDistanceKm, setCustomDistanceKm] = useState(105);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [passengerSeats, setPassengerSeats] = useState(3);
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState(24000);

  const currentBenchmark =
    (ROUTE_BENCHMARKS && ROUTE_BENCHMARKS[selectedRouteKey]) ||
    (ROUTE_BENCHMARKS && ROUTE_BENCHMARKS[defaultRouteKey]) || {
      name: 'Hà Nội ⇄ Hải Phòng (Cao Tốc 5B ~105km)',
      shortName: 'Hà Nội ⇄ Hải Phòng',
      distanceKm: 105,
      fuelCost: 160000,
      botFee: 190000
    };

  const distanceKm = isCustomMode ? (Number(customDistanceKm) || 10) : (currentBenchmark?.distanceKm || 105);
  const tollFee = isCustomMode ? Math.round(distanceKm * 600) : (currentBenchmark?.botFee || 0);

  // MIT Mathematical Invariant: Định mức xăng xe 8L/100km cho xe gia đình 5-7 chỗ
  const litersConsumed = useMemo(() => {
    return Math.round((distanceKm * 8) / 100 * 10) / 10;
  }, [distanceKm]);

  const fuelCost = useMemo(() => {
    return Math.round(litersConsumed * fuelPricePerLiter);
  }, [litersConsumed, fuelPricePerLiter]);

  const totalTripCost = fuelCost + tollFee;

  // Chi phí phụ xăng công bằng mỗi ghế
  const fairPricePerSeat = useMemo(() => {
    if (!passengerSeats || passengerSeats <= 0) return totalTripCost;
    return Math.round(totalTripCost / (passengerSeats + 1) / 5000) * 5000;
  }, [totalTripCost, passengerSeats]);

  // So sánh với taxi truyền thống hoặc taxi công nghệ (trung bình 12.500đ/km + vé cầu đường)
  const taxiCost = useMemo(() => {
    return distanceKm * 12500 + tollFee;
  }, [distanceKm, tollFee]);

  const savingsPct = useMemo(() => {
    if (!taxiCost) return 0;
    return Math.min(85, Math.max(50, Math.round((1 - fairPricePerSeat / taxiCost) * 100)));
  }, [fairPricePerSeat, taxiCost]);

  if (!isOpen) return null;

  return (
    <Modal
      onClose={onClose}
      size="lg"
      icon={Calculator}
      iconTone="primary"
      title="Định Mức Xăng Xe & Cầu Đường"
      subtitle="Minh bạch chi phí lăn bánh thực tế — Không mặc cả, không thương mại taxi"
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
          <div className="text-xs text-[#86868b] flex items-center justify-center sm:justify-start gap-1.5 w-full sm:w-auto text-center sm:text-left">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Định mức khuyến nghị: <strong>{formatVND(fairPricePerSeat)}</strong> / ghế</span>
          </div>
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer w-full sm:w-auto text-center"
            >
              Đóng
            </button>
            {onSelectSuggestedPrice && (
              <button
                type="button"
                onClick={() => {
                  onSelectSuggestedPrice(fairPricePerSeat);
                  onClose?.();
                }}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#0071e3] hover:bg-[#0077ed] active:scale-[0.98] rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 w-full sm:w-auto"
              >
                <span>Áp dụng giá này ({formatVND(fairPricePerSeat)})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* ── CHỌN TUYẾN HOẶC TỰ NHẬP ── */}
        <div className="surface p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label htmlFor="fair-route-select" className="text-xs font-bold text-[#1d1d1f] dark:text-white uppercase tracking-wider">
              Chọn Hành Lang Tuyến
            </label>
            <div className="inline-flex p-0.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setIsCustomMode(false)}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  !isCustomMode ? 'bg-white dark:bg-[#1c1c1e] text-[#0071e3] shadow-xs' : 'text-slate-500'
                }`}
              >
                Tuyến mẫu
              </button>
              <button
                type="button"
                onClick={() => setIsCustomMode(true)}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  isCustomMode ? 'bg-white dark:bg-[#1c1c1e] text-[#0071e3] shadow-xs' : 'text-slate-500'
                }`}
              >
                Tự nhập cự ly
              </button>
            </div>
          </div>

          {!isCustomMode ? (
            <select
              id="fair-route-select"
              value={selectedRouteKey}
              onChange={(e) => setSelectedRouteKey(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.1] text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#0071e3]/30"
            >
              {routeKeys.map((k) => (
                <option key={k} value={k}>
                  {ROUTE_BENCHMARKS[k]?.shortName || k} (~{ROUTE_BENCHMARKS[k]?.distanceKm || 0}km)
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="custom-dist-input" className="text-[11px] text-[#86868b] block mb-1">Cự ly thực tế (km)</label>
                <input
                  id="custom-dist-input"
                  type="number"
                  min="5"
                  max="1000"
                  value={customDistanceKm}
                  onChange={(e) => setCustomDistanceKm(Number(e.target.value) || 10)}
                  className="w-full h-9 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/[0.08] text-xs font-bold text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="fuel-price-input" className="text-[11px] text-[#86868b] block mb-1">Giá xăng RON95 (đ/Lít)</label>
                <input
                  id="fuel-price-input"
                  type="number"
                  step="500"
                  value={fuelPricePerLiter}
                  onChange={(e) => setFuelPricePerLiter(Number(e.target.value) || 24000)}
                  className="w-full h-9 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/[0.08] text-xs font-bold text-slate-800 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Số ghế khách chia sẻ */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-black/[0.04]">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Số người đi cùng chia sẻ:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPassengerSeats(s)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    passengerSeats === s
                      ? 'bg-[#0071e3] text-white shadow-xs'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-black/[0.06]'
                  }`}
                >
                  {s}
                </button>
              ))}
              <span className="text-xs text-slate-400 ml-1">khách</span>
            </div>
          </div>
        </div>

        {/* ── BẢNG BÓC TÁCH CHI PHÍ TOÁN HỌC (MIT INVARIANTS) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Cột 1: Chi phí thực tế xe lăn bánh */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.08] shadow-xs space-y-2.5">
            <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-[#0071e3]" />
              <span>Tổng Chi Phí Lăn Bánh</span>
            </span>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <Fuel className="w-3.5 h-3.5 text-amber-500" />
                  <span>Xăng ({litersConsumed} Lít × {fuelPricePerLiter.toLocaleString()}đ):</span>
                </span>
                <span className="font-semibold tabular">{formatVND(fuelCost)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-sky-500" />
                  <span>Vé cầu đường (Cao tốc):</span>
                </span>
                <span className="font-semibold tabular">{formatVND(tollFee)}</span>
              </div>

              <div className="pt-2 border-t border-black/[0.06] flex items-center justify-between font-bold text-sm text-[#1d1d1f] dark:text-white">
                <span>Tổng chi phí chuyến:</span>
                <span className="tabular text-rose-600 dark:text-rose-400">{formatVND(totalTripCost)}</span>
              </div>
            </div>
          </div>

          {/* Cột 2: Mức phụ xăng công bằng & So sánh tiết kiệm */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 shadow-xs space-y-2.5">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mức Phụ Xăng Đề Xuất</span>
            </span>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular">
                  {formatVND(fairPricePerSeat)}
                </span>
                <span className="text-xs text-emerald-800/80 dark:text-emerald-300 font-semibold">/ một khách</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium pt-0.5">
                Chia đều cho Chủ xe và {passengerSeats} người đi cùng.
              </p>
            </div>

            <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Giá Taxi nguyên chuyến:</span>
                <span className="line-through tabular">{formatVND(taxiCost)}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-400">
                <span>Tiết kiệm cho khách:</span>
                <span className="tabular">~{savingsPct}% chi phí</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── GIẢI THÍCH TRIẾT LÝ VĂN MINH (STANFORD ERGONOMICS) ── */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-black/[0.04] text-[11.5px] text-[#515154] dark:text-slate-400 flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Bản chất CarMate:</strong> Chia sẻ chi phí lăn bánh thực tế giữa những người cùng hướng, không phải dịch vụ kinh doanh vận tải thương mại. Chủ xe lấy lại phần tiền xăng cầu đường, còn khách có chuyến đi gia đình an toàn, văn minh với chi phí chỉ bằng 1/3 taxi.
          </p>
        </div>
      </div>
    </Modal>
  );
}
