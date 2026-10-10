import React, { useState } from 'react';
import {
  ShieldCheck,
  Scale,
  Car,
  Users,
  MapPin,
  Fuel,
  CheckCircle2,
  Copy,
  Check,
  FileText,
  AlertCircle
} from 'lucide-react';
import { formatVND } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

export default function LegalShieldModal({
  isOpen = true,
  onClose,
  trip = {},
  ticket = {},
  userRole = 'rider',
  zIndex = 'z-[9999]'
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Extract trip information
  const tripCode = ticket?.code || ticket?.bookingCode || trip?.id || trip?.tripId || `CM-${Math.floor(10000 + Math.random() * 90000)}`;
  const driverName = trip?.driverName || trip?.author || trip?.userName || 'Chủ xe cá nhân CarMate';
  const driverPlate = trip?.licensePlate || trip?.plate || trip?.plateMask || '93A-385.XX (Biển trắng cá nhân)';
  const vehicleModel = trip?.carModel || trip?.carType || 'Xe ô tô gia đình 5-7 chỗ';
  const riderName = ticket?.passengerName || ticket?.riderName || (userRole === 'driver' ? 'Người đi cùng' : 'Thành viên CarMate');
  const routeFrom = trip?.from || trip?.origin || ticket?.pickupPoint || 'Bình Phước';
  const routeTo = trip?.to || trip?.destination || 'TP. Hồ Chí Minh';
  const fuelContribution = ticket?.fuelSurcharge || ticket?.price || trip?.price || 120000;
  const departureTime = trip?.timeSlotLabel || trip?.timeSlot || trip?.time || 'Hôm nay';

  const statutoryStatement = `THỎA THUẬN CHIA SẺ CHI PHÍ HÀNH TRÌNH DÂN SỰ (Mã: #${tripCode})
- Căn cứ Điều 3 Bộ Luật Dân sự 2015: Quyền tự do thỏa thuận dân sự phi thương mại.
- Căn cứ NĐ 52/2013/NĐ-CP & NĐ 85/2021/NĐ-CP: Nền tảng TMĐT kết nối nhu cầu xã hội.
- Chủ xe: ${driverName} | Biển số: ${driverPlate} (Xe cá nhân biển trắng, không kinh doanh vận tải theo NĐ 10/2020/NĐ-CP).
- Người đi cùng: ${riderName}.
- Lộ trình: ${routeFrom} ──> ${routeTo}.
- Mức đóng góp chi phí nhiên liệu: ${formatVND(fuelContribution)} (Bù đắp tiền xăng và trạm BOT, P ≤ Chi phí thực tế).
- Tính chất chuyến đi: Chuyến đi cá nhân tiện đường, chia sẻ chi phí nhiên liệu phi lợi nhuận theo Điều 3 BLDS 2015.`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(statutoryStatement);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal
      onClose={onClose}
      zIndex={zIndex}
      size="lg"
      icon={Scale}
      iconTone="brand"
      title="THẺ PHÁP LÝ HÀNH TRÌNH DÂN SỰ"
      subtitle="Căn cứ Điều 3 Bộ Luật Dân sự 2015 & Nghị định 52/2013/NĐ-CP"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-2xl bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép văn bản' : 'Sao chép văn bản pháp lý'}</span>
          </button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Đóng thẻ
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs text-slate-700 dark:text-slate-200">
        {/* ── CSGT (TRAFFIC POLICE) / TTGT (TRANSPORT INSPECTORATE) PRESENTATION PANEL (HIGH VISIBILITY NOTICE) ── */}
        <div className="p-4 rounded-3xl bg-amber-500/10 dark:bg-amber-500/15 border-2 border-amber-500/40 text-amber-950 dark:text-amber-100 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-mono font-bold text-xs sm:text-sm uppercase tracking-wide text-amber-900 dark:text-amber-300">
              VĂN BẢN TRÌNH LỰC LƯỢNG CHỨC NĂNG (CSGT / TTGT)
            </span>
          </div>
          <p className="text-[12px] sm:text-[12.5px] leading-relaxed font-medium">
            "Hành trình này là <strong>thỏa thuận dân sự tương trợ</strong> giữa Chủ xe cá nhân và Người đi cùng để chia sẻ tiền xăng và phí cầu đường BOT theo <strong>Điều 3 Bộ Luật Dân sự 2015</strong>. Phương tiện là <strong>xe cá nhân biển trắng</strong>, không thuộc đối tượng kinh doanh vận tải theo <strong>Nghị định 10/2020/NĐ-CP</strong>. Chủ xe tự cam kết hành trình cá nhân tiện đường, phi thương mại."
          </p>
        </div>

        {/* ── ELECTRONIC AGREEMENT DETAILS (APPLE WALLET STYLE CARD) ── */}
        <div className="rounded-3xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Mã xác lập thỏa thuận
              </span>
              <span className="font-mono font-bold text-sm sm:text-base text-primary-600 dark:text-primary-400">
                #{tripCode}
              </span>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Thỏa thuận Hợp lệ</span>
              </span>
            </div>
          </div>

          {/* Both participating parties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-black/[0.05] dark:border-white/[0.05] space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                <Car className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <span>Bên 1: Chủ xe cá nhân</span>
              </div>
              <div className="text-slate-600 dark:text-slate-400 pl-5">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{driverName}</p>
                <p className="font-mono text-[11px] text-slate-500">Biển số: {driverPlate}</p>
                <p className="text-[11px] text-slate-500">{vehicleModel}</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-black/[0.05] dark:border-white/[0.05] space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Bên 2: Người đi cùng</span>
              </div>
              <div className="text-slate-600 dark:text-slate-400 pl-5">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{riderName}</p>
                <p className="text-[11px] text-slate-500">Hình thức: Ghép xe tiện đường</p>
                <p className="text-[11px] text-slate-500">Khung giờ: {departureTime}</p>
              </div>
            </div>
          </div>

          {/* Route & shared costs */}
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-black/[0.05] dark:border-white/[0.05] space-y-2 text-[12px]">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-slate-500 dark:text-slate-400">Lộ trình cá nhân cố định: </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {routeFrom} ──&gt; {routeTo}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  (Đón trả tại điểm hẹn quy ước an toàn, không dừng đón khách vãng lai trên lòng đường)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1.5 border-t border-black/[0.04] dark:border-white/[0.04]">
              <Fuel className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-slate-500 dark:text-slate-400">Đóng góp chi phí nhiên liệu & BOT: </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatVND(fuelContribution)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1.5">
                  (Định mức bù trừ hao mòn thực tế, phi lợi nhuận)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3 PILLARS OF LEGAL PROTECTION ── */}
        <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
          <div className="font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5 text-primary-600" />
            <span>Căn cứ Quy định Pháp luật Nước CHXHCN Việt Nam</span>
          </div>
          <p>
            1. <strong>Điều 3 Bộ Luật Dân sự 2015:</strong> Mọi cam kết, thỏa thuận không vi phạm điều cấm của luật, không trái đạo đức xã hội đều có hiệu lực thực hiện đối với các bên và được pháp luật bảo vệ.
          </p>
          <p>
            2. <strong>Nghị định 10/2020/NĐ-CP (Khoản 1 Điều 3):</strong> Xe cá nhân chở người cùng cơ quan, bạn bè hoặc người tiện đường chia sẻ chi phí nhiên liệu không phải là hoạt động kinh doanh vận tải thương mại.
          </p>
          <p>
            3. <strong>Nghị định 52/2013/NĐ-CP & 85/2021/NĐ-CP:</strong> Nền tảng CarMate cung cấp giải pháp công nghệ kết nối thông tin giữa các cá nhân, không thu phí trung gian, không trực tiếp vận hành phương tiện.
          </p>
        </div>
      </div>
    </Modal>
  );
}
