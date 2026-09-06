import React, { useState, useMemo } from 'react';
import { ROUTE_BENCHMARKS, formatVND } from '@carmate/shared';
import { Fuel, Scale, ChevronRight, Check, TrendingDown, Route, Users, Sparkles, Milestone } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Chip, { Segmented } from '../ui/Chip.jsx';

export default function RouteBenchmarkBar({ searchKeyword = '', setSearchKeyword, forceOpen = false, onCloseForced }) {
  const { t } = useI18n();
  const [showDetail, setShowDetail] = useState(false);
  const [selectedRouteKey, setSelectedRouteKey] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('south'); // 'north' | 'central' | 'south'
  const [passengerCount, setPassengerCount] = useState(2); // 1 | 2 | 3 | 4

  const routeKeys = Object.keys(ROUTE_BENCHMARKS);

  // Tự động tìm tuyến phù hợp với từ khoá tìm kiếm ở trang chủ
  const activeRouteKey = useMemo(() => {
    if (selectedRouteKey) return selectedRouteKey;
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      const found = routeKeys.find((key) => {
        const info = ROUTE_BENCHMARKS[key];
        return key.toLowerCase().includes(kw) || info.name.toLowerCase().includes(kw) || info.keyword.toLowerCase().includes(kw);
      });
      if (found) {
        if (ROUTE_BENCHMARKS[found]?.region) {
          setSelectedRegion(ROUTE_BENCHMARKS[found].region);
        }
        return found;
      }
    }
    return 'Tuyến QL13';
  }, [searchKeyword, selectedRouteKey, routeKeys]);

  const info = ROUTE_BENCHMARKS[activeRouteKey] || ROUTE_BENCHMARKS['Tuyến QL13'];
  const open = showDetail || forceOpen;
  const close = () => { setShowDetail(false); onCloseForced?.(); };

  // Lọc tuyến theo miền đã chọn
  const routesInRegion = useMemo(() => {
    return routeKeys.filter(k => {
      const r = ROUTE_BENCHMARKS[k].region || 'south';
      return r === selectedRegion;
    });
  }, [selectedRegion, routeKeys]);

  // Tổng chi phí vận hành xe thực tế
  const totalOperatingCost = (info.fuelCost || 0) + (info.botFee || 0);

  // Mức chi phí chia sẻ ước tính theo số người ngồi ghép
  const calculatedSharePerPerson = useMemo(() => {
    // Nếu chỉ 1 khách ghép, chia đôi với chủ xe
    // Nếu 2-3 khách ghép, chia đều chi phí + một phần khấu hao xe
    if (passengerCount === 1) {
      return Math.round((totalOperatingCost * 0.65) / 10000) * 10000;
    }
    const perSeat = Math.round((totalOperatingCost / (passengerCount + 0.5)) / 10000) * 10000;
    return Math.max(perSeat, info.minSafePrice || 50000);
  }, [totalOperatingCost, passengerCount, info]);

  return (
    <>
      {/* ── THANH CHỈ BÁO COMPACT TRÊN TRANG CHỦ (Apple Card & Subtle Depth) ── */}
      <div
        onClick={() => setShowDetail(true)}
        className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 rounded-[18px] bg-white dark:bg-[#1c1c1e] border border-black/[0.06] hover:border-black/[0.14] dark:border-white/[0.08] dark:hover:border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all cursor-pointer group active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-[#0071e3]/10 text-[#0071e3] inline-flex items-center justify-center shrink-0">
            <Fuel className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-[13px] text-[#1d1d1f] dark:text-white font-semibold truncate">
              {info.shortName}:
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] font-bold text-xs font-mono whitespace-nowrap">
              ~{formatVND(info.suggestedRate)}{t('common.perSeat')}
            </span>
            <span className="text-[11.5px] text-[#86868b] dark:text-slate-400 hidden sm:inline truncate">
              · {t('benchmark.inclusive')}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
          className="text-xs font-semibold text-[#0071e3] group-hover:text-[#0077ed] px-3 py-1.5 rounded-full hover:bg-[#0071e3]/10 inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
        >
          <span>{t('benchmark.basis')}</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* ── MODAL ĐỊNH MỨC XĂNG & CẦU ĐƯỜNG CHUẨN CURSOR ── */}
      {open && (
        <Modal
          onClose={close}
          size="lg"
          icon={Scale}
          title={t('benchmark.modalTitle')}
          subtitle={t('benchmark.modalSub')}
          footer={
            <div className="flex items-center justify-end w-full">
              <Button onClick={close} variant="primary" size="sm" className="px-5 font-semibold">
                {t('common.understood')}
              </Button>
            </div>
          }
        >
          <div className="space-y-5 text-left">
            {/* 1. BỘ CHỌN THEO MIỀN (REGIONAL SELECTOR - KHÔNG CÒN ĐÁM MÂY 10 NÚT RỐI RẮM) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                  Khu vực & Tuyến hành lang
                </span>
                <span className="text-[11px] text-slate-400">Chọn để xem định mức</span>
              </div>

              {/* Segmented Miền Bắc - Trung - Nam */}
              <Segmented
                size="sm"
                fullWidth
                value={selectedRegion}
                onChange={(reg) => {
                  setSelectedRegion(reg);
                  const firstInRegion = routeKeys.find(k => (ROUTE_BENCHMARKS[k].region || 'south') === reg);
                  if (firstInRegion) {
                    setSelectedRouteKey(firstInRegion);
                    setSearchKeyword?.(ROUTE_BENCHMARKS[firstInRegion].keyword);
                  }
                }}
                options={[
                  { value: 'north', label: 'Miền Bắc (Hà Nội, Hải Phòng...)' },
                  { value: 'central', label: 'Miền Trung (Đà Nẵng, Huế...)' },
                  { value: 'south', label: 'Miền Nam (Sài Gòn, Bình Phước...)' }
                ]}
              />

              {/* Danh sách tuyến thuộc miền đã chọn */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {routesInRegion.map((k) => (
                  <Chip
                    key={k}
                    active={k === activeRouteKey}
                    onClick={() => {
                      setSelectedRouteKey(k);
                      setSearchKeyword?.(ROUTE_BENCHMARKS[k].keyword);
                    }}
                    className="h-8 px-3 text-xs"
                  >
                    {ROUTE_BENCHMARKS[k].shortName}
                  </Chip>
                ))}
              </div>
            </div>

            {/* 2. BỘ TÍNH TOÁN CHI PHÍ TƯƠNG TÁC (INTERACTIVE COST CALCULATOR) */}
            <section className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 dark:from-[#151c2e] dark:to-[#0f1422] border border-slate-200/90 dark:border-white/[0.08] space-y-4 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Route className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  <span>Chi phí xe thực tế ({info.shortName})</span>
                </h4>
                <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                  Cự ly: ~{info.distanceKm} km
                </span>
              </div>

              {/* 2 Thẻ chi phí kỹ thuật */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200/70 dark:border-white/5 shadow-2xs">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Fuel className="w-3.5 h-3.5 text-amber-500" />
                    <span>Xăng RON 95</span>
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white tabular mt-1">
                    ~{formatVND(info.fuelCost)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200/70 dark:border-white/5 shadow-2xs">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Milestone className="w-3.5 h-3.5 text-blue-500" />
                    <span>Vé cầu đường / BOT</span>
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white tabular mt-1">
                    ~{formatVND(info.botFee)}
                  </p>
                </div>

                <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                    Tổng chi phí chuyến xe
                  </p>
                  <p className="text-sm font-black text-emerald-800 dark:text-emerald-200 tabular mt-1">
                    ~{formatVND(totalOperatingCost)}
                  </p>
                </div>
              </div>

              {/* TƯƠNG TÁC SỐ NGƯỜI GHÉP XE (THE CURSOR INTERACTIVE SLIDER) */}
              <div className="pt-2 border-t border-slate-200/80 dark:border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                    <span>Số người cùng san sẻ chi phí:</span>
                  </label>
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400 tabular">
                    {passengerCount} người cùng đi
                  </span>
                </div>

                {/* Nút chọn số người đi cùng */}
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setPassengerCount(count)}
                      className={`h-9 rounded-xl text-xs font-semibold tabular transition-all cursor-pointer shadow-2xs ${
                        passengerCount === count
                          ? 'bg-primary-600 text-white font-bold shadow-sm'
                          : 'bg-white hover:bg-slate-100 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                      }`}
                    >
                      {count} khách
                    </button>
                  ))}
                </div>

                {/* Hộp kết quả đề xuất trực quan */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#1e293b] border border-primary-200 dark:border-primary-500/30 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Mức san sẻ công bằng mỗi người:
                    </p>
                    <p className="text-[11.5px] text-slate-600 dark:text-slate-300 mt-0.5">
                      Trọn gói xăng & vé BOT, thanh toán trực tiếp khi lên xe
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-primary-600 dark:text-primary-400 font-display tabular">
                      ~{formatVND(calculatedSharePerPerson)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono"> /ghế</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. SO SÁNH THỊ TRƯỜNG TINH TẾ (CLEAN COMPARATIVE MATRIX - KHÔNG CHÓI LÓA) */}
            <section className="p-4 rounded-2xl bg-white dark:bg-[#151c2e] border border-slate-200/90 dark:border-white/[0.08] space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-emerald-500" />
                <span>So sánh mức giá thị trường trên tuyến này</span>
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.02]">
                  <span className="text-slate-600 dark:text-slate-400">Limousine 9 chỗ</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 tabular font-mono">
                    {info.marketLimoRef}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.02]">
                  <span className="text-slate-600 dark:text-slate-400">Xe khách truyền thống</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 tabular font-mono">
                    {info.traditionalBusRef}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-900 dark:text-primary-200">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                    <span className="font-bold">Định mức chia sẻ CarMate</span>
                  </div>
                  <span className="font-black text-sm text-primary-700 dark:text-primary-300 tabular font-mono">
                    ~{formatVND(info.suggestedRate)}/ghế
                  </span>
                </div>
              </div>
            </section>

            {/* 4. CAM KẾT VĂN MINH */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02]">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Toàn bộ chi phí chia sẻ trực tiếp giữa chủ xe và khách khi lên xe.</span>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02]">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>0đ Phí sàn trung gian · Tự do hẹn điểm đón trả thuận tiện.</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
