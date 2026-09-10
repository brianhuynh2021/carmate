import React, { useState, useMemo } from 'react';
import { ROUTE_BENCHMARKS, formatVND } from '@carmate/shared';
import { Fuel, Scale, ChevronRight, Check, TrendingDown, Route, Sparkles, Milestone, ShieldAlert, Calculator } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Chip, { Segmented } from '../ui/Chip.jsx';

export default function RouteBenchmarkBar({ searchKeyword = '', setSearchKeyword, forceOpen = false, onCloseForced }) {
  const { t } = useI18n();
  const [showDetail, setShowDetail] = useState(false);
  const [selectedRouteKey, setSelectedRouteKey] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('south'); // 'north' | 'central' | 'south'

  const routeKeys = Object.keys(ROUTE_BENCHMARKS);

  // Tự động tìm tuyến phù hợp với từ khoá tìm kiếm ở trang chủ
  const activeRouteKey = useMemo(() => {
    if (selectedRouteKey) return selectedRouteKey;
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      const found = routeKeys.find((key) => {
        const info = ROUTE_BENCHMARKS[key];
        return (
          key.toLowerCase().includes(kw) ||
          info.name.toLowerCase().includes(kw) ||
          info.keyword.toLowerCase().includes(kw)
        );
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

  const defaultBenchmark = ROUTE_BENCHMARKS['Tuyến QL13'] || Object.values(ROUTE_BENCHMARKS)[0] || {
    name: 'Tuyến QL13',
    shortName: 'Bình Phước ⇄ Sài Gòn',
    distanceKm: 140,
    fuelCost: 210000,
    botFee: 140000
  };
  const info = ROUTE_BENCHMARKS[activeRouteKey] || defaultBenchmark;
  const open = showDetail || forceOpen;
  const close = () => {
    setShowDetail(false);
    setSelectedRouteKey(null);
    onCloseForced?.();
  };

  const applyFilterAndClose = () => {
    const route = ROUTE_BENCHMARKS[activeRouteKey] || info;
    if (route?.keyword) {
      setSearchKeyword?.(route.keyword);
    }
    close();
  };

  // Lọc tuyến theo miền đã chọn
  const routesInRegion = useMemo(() => {
    return routeKeys.filter((k) => {
      const r = ROUTE_BENCHMARKS[k]?.region || 'south';
      return r === selectedRegion;
    });
  }, [selectedRegion, routeKeys]);

  // Tổng chi phí vận hành xe thực tế
  const totalOperatingCost = (info?.fuelCost || 0) + (info?.botFee || 0);

  return (
    <>
      {/* ── THANH CHỈ BÁO ĐỊNH MỨC XĂNG & GIÁ THAM KHẢO (Apple Squircle & Liquid Aesthetics, Tối ưu Mobile) ── */}
      <div
        onClick={() => setShowDetail(true)}
        className="rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 border border-black/[0.08] dark:border-white/[0.08] p-3 sm:px-4 sm:py-3 shadow-xs hover:shadow-md hover:border-[#0071e3]/40 transition-all cursor-pointer group active:scale-[0.99] backdrop-blur-xl relative overflow-hidden"
      >
        {/* Ambient subtle glow */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#0071e3]/5 rounded-full blur-2xl pointer-events-none" />

        {/* Layout Responsive Apple Squircle & Liquid Banner */}
        <div className="flex items-center justify-between gap-3 sm:gap-4 relative z-10">
          {/* Khối Thông Tin Tuyến & Định Mức */}
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <span className="w-8.5 h-8.5 rounded-xl bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
              <Fuel className="w-4 h-4" />
            </span>

            <div className="min-w-0 flex-1 space-y-1">
              {/* Hàng Tiêu Đề Nhóm: Định mức xăng & Giá tham khảo */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-[#6e6e73] dark:text-slate-400 uppercase tracking-wider font-mono">
                  Định mức xăng & Giá tham khảo
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                  Chuẩn 8L/100km & Vé cầu đường
                </span>
              </div>

              {/* Hàng Dữ Liệu Tuyến: Tên tuyến + Cự ly + Giá đề xuất */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-[13.5px] text-[#1d1d1f] dark:text-white font-bold tracking-tight">
                  {info.shortName}
                </span>
                <span className="text-[11px] text-[#86868b] dark:text-slate-400 font-mono">
                  (~{info.distanceKm} km)
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] font-bold text-xs font-mono border border-[#0071e3]/20 shadow-2xs whitespace-nowrap">
                  ~{formatVND(info.suggestedRate)}{t('common.perSeat')}
                </span>
                <span className="text-[11px] text-[#86868b] dark:text-slate-400 font-medium hidden md:inline truncate">
                  · Xăng RON 95: ~{formatVND(info.fuelCost)} · <span>Vé cầu đường</span>: ~{formatVND(info.botFee)}
                </span>
              </div>
            </div>
          </div>

          {/* Mũi tên chỉ thị mở modal định mức Apple HIG */}
          <div className="flex items-center shrink-0 text-[#86868b] dark:text-slate-400 group-hover:text-[#0071e3] transition-colors pr-1">
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* ── MODAL ĐỊNH GIÁ THAM KHẢO ĐẲNG CẤP APPLE & CURSOR ── */}
      {open && (
        <Modal
          onClose={close}
          size="lg"
          icon={Scale}
          title={t('benchmark.modalTitle')}
          subtitle={t('benchmark.modalSub')}
          footer={
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between w-full gap-2.5 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyFilterAndClose}
                className="w-full sm:w-auto px-4 font-semibold rounded-full text-xs text-[#0071e3] border-[#0071e3]/40 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer justify-center"
              >
                🔍 {t('benchmark.filterThisRoute')}
              </Button>
              <Button onClick={close} variant="primary" size="sm" className="w-full sm:w-auto px-6 font-bold rounded-full cursor-pointer justify-center">
                {t('common.understood')}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 sm:space-y-5 text-left">
            {/* 1. BỘ CHỌN KHU VỰC & TUYẾN ĐƯỜNG (APPLE SEGMENTED & SQUIRCLE PILLS) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                  Khu vực & Tuyến hành lang
                </span>
                <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-medium">
                  Bấm chọn tuyến để xem
                </span>
              </div>

              {/* Segmented Miền Bắc - Trung - Nam */}
              <Segmented
                size="sm"
                fullWidth
                value={selectedRegion}
                onChange={(reg) => {
                  setSelectedRegion(reg);
                  const firstInRegion = routeKeys.find((k) => (ROUTE_BENCHMARKS[k]?.region || 'south') === reg);
                  if (firstInRegion) {
                    setSelectedRouteKey(firstInRegion);
                  }
                }}
                options={[
                  { value: 'north', label: 'Miền Bắc' },
                  { value: 'central', label: 'Miền Trung' },
                  { value: 'south', label: 'Miền Nam' }
                ]}
              />

              {/* Danh sách tuyến thuộc miền đã chọn */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {routesInRegion.map((k) => (
                  <Chip
                    key={k}
                    active={k === activeRouteKey}
                    onClick={() => {
                      setSelectedRouteKey(k);
                    }}
                    className="h-8 px-3 text-xs"
                  >
                    {ROUTE_BENCHMARKS[k]?.shortName || k}
                  </Chip>
                ))}
              </div>
            </div>

            {/* 2. HERO RESULT CARD: "Định giá tham khảo cho tuyến này" (ĐỈNH CAO APPLE & CON NGƯỜI VN) */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-white to-slate-50/90 dark:from-slate-900 dark:to-slate-800/90 border border-slate-200 dark:border-slate-800 shadow-[0_4px_20px_rgba(15,23,42,0.04)] text-center relative overflow-hidden">
              {/* Background ambient glow */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#0071e3]/10 dark:bg-[#0071e3]/20 blur-2xl pointer-events-none rounded-full" />

              <p className="text-xs sm:text-[13px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono">
                {t('benchmark.heroLabel')}
              </p>

              <div className="mt-2.5 flex items-baseline justify-center gap-1.5">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                  ~{formatVND(info.suggestedRate)}
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-400 font-mono">
                  {t('common.perSeat')}
                </span>
              </div>

              <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium max-w-md mx-auto leading-relaxed">
                {t('benchmark.heroDesc')}
              </p>
            </div>

            {/* 2.1 THÔNG TIN THAM KHẢO & QUYỀN TỰ DO THỎA THUẬN (BẢO VỆ CHỦ XE, NGƯỜI ĐI CÙNG & NỀN TẢNG) */}
            <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 text-left space-y-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {t('benchmark.disclaimerTitle')}
                </h4>
              </div>
              <p className="text-xs text-amber-900/90 dark:text-amber-300/90 leading-relaxed">
                {t('benchmark.disclaimerBody')}
              </p>
            </div>

            {/* 3. BÓC TÁCH CHI PHÍ THỰC TẾ (CURSOR HIGH-PRECISION TELEMETRY) */}
            <section className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Route className="w-3.5 h-3.5 text-[#0071e3]" />
                  <span>Bóc tách chi phí lăn bánh ({info?.shortName || ''})</span>
                </span>
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                  Cự ly: ~{info?.distanceKm || 0} km
                </span>
              </div>

              {/* 3 Thẻ chi phí đo lường */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                    <Fuel className="w-3.5 h-3.5 text-amber-500" />
                    <span>Xăng RON 95</span>
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-1">
                    ~{formatVND(info?.fuelCost || 0)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                    <Milestone className="w-3.5 h-3.5 text-blue-500" />
                    <span>Vé cầu đường</span>
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-1">
                    ~{formatVND(info?.botFee || 0)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60 shadow-2xs">
                  <p className="text-[11.5px] text-emerald-800 dark:text-emerald-300 font-bold">
                    Tổng chi phí chuyến xe
                  </p>
                  <p className="text-sm font-black text-emerald-900 dark:text-emerald-200 font-mono mt-1">
                    ~{formatVND(totalOperatingCost)}
                  </p>
                </div>
              </div>
            </section>

            {/* 3.1 BẢNG TÍNH ĐỊNH MỨC XĂNG & CHIA PHÍ THEO SỐ GHẾ (GOM CHUNG ĐỊNH MỨC XĂNG & ĐỊNH GIÁ THAM KHẢO) */}
            <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/50 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <span className="text-xs font-bold text-[#0071e3] dark:text-blue-300 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Định mức phụ xăng xe theo số người đi ghép</span>
                </span>
                <span className="text-[11px] font-mono text-[#6e6e73] dark:text-slate-400">
                  Chuẩn 8L/100km · Định mức xe 5-7 chỗ
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center pt-0.5">
                {[
                  { count: 1, label: 'Xe ghép 1 khách', share: Math.round((totalOperatingCost * 0.4) / 10000) * 10000, note: 'Khách phụ ~40% chi phí lăn bánh' },
                  { count: 2, label: 'Xe ghép 2 khách', share: Math.round((totalOperatingCost * 0.28) / 10000) * 10000, note: 'Khách phụ ~28% chi phí lăn bánh' },
                  { count: 3, label: 'Xe ghép 3 khách', share: info.suggestedRate, note: 'Mức chia đều văn minh nhất' }
                ].map((item) => (
                  <div key={item.count} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] shadow-2xs text-left sm:text-center">
                    <p className="text-xs text-[#6e6e73] dark:text-slate-400 font-semibold">{item.label}</p>
                    <p className="text-sm sm:text-base font-bold text-[#0071e3] font-mono mt-0.5">~{formatVND(item.share)}/ghế</p>
                    <p className="text-[10px] text-[#86868b] dark:text-slate-500 mt-0.5">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. SO SÁNH THỊ TRƯỜNG THỰC TẾ (APPLE VALUE COMPARISON) */}
            <section className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-emerald-600" />
                  <span>So sánh giá thị trường tuyến này</span>
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/60">
                  Tiết kiệm ~45% - 50%
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Limousine 9 chỗ đón trả</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{info.marketLimoRef}</span>
                </div>

                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Xe khách truyền thống</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {info.traditionalBusRef}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#0071e3]" />
                    <span className="font-bold text-[#0071e3] dark:text-blue-300">CarMate (Đi ghép xe gia đình)</span>
                  </div>
                  <span className="font-black text-sm text-[#0071e3] dark:text-blue-300 font-mono">
                    ~{formatVND(info.suggestedRate)}/ghế
                  </span>
                </div>
              </div>
            </section>

            {/* 5. NGUYÊN TẮC VĂN MINH & THỎA THUẬN TỰ DO (TÂM LÝ CON NGƯỜI VN) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  <strong>Thỏa thuận tự do:</strong> Hai bên tự do trao đổi qua Zalo để hẹn điểm đón trả và chốt mức chi
                  phí phù hợp nhất.
                </span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  <strong>0đ Phí sàn trung gian:</strong> {t('benchmark.benefit1')}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
