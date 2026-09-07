import React, { useState } from 'react';
import {
  ShieldCheck,
  BadgeCheck,
  Check,
  Star,
  Car,
  CigaretteOff,
  Users,
  Heart,
  Share2,
  AlertTriangle,
  MessageSquare,
  User
} from 'lucide-react';
import { formatVND } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

export default function TrustProfileModal({ item, onClose, onBook }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('driver'); // 'driver' | 'passenger' | 'verify'

  if (!item) return null;

  const isCurrentDriver = item.type === 'driver_offer' || item.role === 'driver' || !item.type;
  const name = item.publicName || item.maskedCode || 'Nguyễn Anh Tuấn';
  const hometown = item.hometown || 'Bình Phước';
  const carModel = item.carModel || item.car?.model || 'Mitsubishi Xpander (7 chỗ)';
  const plate = item.licensePlateMasked || item.car?.plate || '93A-289.xx (Đã đối soát)';
  const karmaScore = item.karmaScore ?? item.trustScore ?? 75;
  const rating = item.rating || 4.95;
  const driverTrips =
    item.driverStats?.tripsCompleted || (isCurrentDriver ? item.safeTripsCount || item.tripsCompleted || 48 : 24);
  const passengerTrips = item.passengerStats?.tripsCompleted || 14;

  const safetyWarnings = item.safetyWarnings || [];
  const hasWarnings = safetyWarnings.length > 0;

  const verifications = item.verifications || [
    { label: 'Số điện thoại & Zalo chính chủ', desc: 'Đã xác thực OTP & Zalo thật' },
    { label: 'Căn cước công dân gắn chip', desc: 'Đã đối soát định danh cá nhân' },
    { label: 'Giấy phép lái xe B2', desc: 'GPLX còn hạn sử dụng hợp lệ' },
    { label: 'Đăng kiểm & Bảo hiểm TNDS', desc: 'Phương tiện đạt chuẩn lưu thông' }
  ];

  const handleShare = () => {
    const text = `Hồ sơ tín nhiệm CarMate: ${name} (${karmaScore}/100 điểm Karma, ${driverTrips} chuyến lái xe, ${passengerTrips} chuyến đi cùng). Xác thực CCCD & GPLX trên carmate.vn`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      }
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal
      onClose={onClose}
      size="lg"
      icon={ShieldCheck}
      iconTone="success"
      title="Hồ Sơ Thành Viên Cộng Đồng"
      subtitle="Bình đẳng hai chiều · Một người vừa là Chủ xe vừa là Bạn đồng hành"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <Button variant="outline" size="sm" icon={Share2} onClick={handleShare}>
            {copied ? 'Đã sao chép' : 'Chia sẻ hồ sơ'}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Đóng
            </Button>
            {onBook && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onBook(item);
                }}
              >
                {isCurrentDriver ? 'Ghép chuyến với bạn này' : 'Nhận đón bạn này'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        {/* Passport Card — Phong cách Thẻ Căn Cước Số / Google Wallet */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c4a6e] via-[#075985] to-[#0e1e36] text-white p-5 sm:p-6 shadow-lg border border-white/10">
          <div
            className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-white/15 blur-2xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {item.avatar || item.driverAvatar ? (
                <img
                  src={item.avatar || item.driverAvatar}
                  alt={name}
                  className="w-12 h-12 rounded-full object-cover shrink-0 border border-white/30 shadow-xs ring-2 ring-white/20"
                />
              ) : (
                <span className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md text-white inline-flex items-center justify-center shrink-0 border border-white/30 shadow-xs">
                  <User className="w-6 h-6 text-white" strokeWidth={2.2} />
                </span>
              )}
              <div>
                <h4 className="font-display text-lg sm:text-xl font-bold tracking-tight flex items-center gap-1.5">
                  <span>{name}</span>
                  <BadgeCheck className="w-4 h-4 text-amber-300 shrink-0" />
                </h4>
                <p className="text-xs text-sky-100 mt-0.5 font-medium">Thành viên CarMate · Đồng hương {hometown}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-200">Điểm Tín Nhiệm (Karma)</p>
              <p className="font-display text-3xl font-extrabold tabular tracking-tight leading-none mt-1">
                {karmaScore}
                <span className="text-xs font-medium text-sky-200">/100</span>
              </p>
            </div>
          </div>

          <dl className="relative mt-5 pt-4 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <dt className="text-[11px] text-blue-200">Lịch sử Cầm lái</dt>
              <dd className="text-xs font-semibold mt-0.5 tabular">{driverTrips} chuyến an toàn</dd>
            </div>
            <div>
              <dt className="text-[11px] text-blue-200">Lịch sử Đi cùng</dt>
              <dd className="text-xs font-semibold mt-0.5 tabular">{passengerTrips} chuyến đúng hẹn</dd>
            </div>
            <div>
              <dt className="text-[11px] text-blue-200">Đánh giá chung</dt>
              <dd className="text-xs font-semibold mt-0.5 tabular inline-flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                <span>{rating} / 5</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-blue-200">Tình trạng cộng đồng</dt>
              <dd className="text-xs font-semibold mt-0.5 text-emerald-300">
                {hasWarnings ? 'Có cảnh báo' : 'Văn minh 100%'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Cảnh báo an toàn nếu có */}
        {hasWarnings ? (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Cảnh báo ghi nhận từ các thành viên khác:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-rose-800 dark:text-rose-300">
                {safetyWarnings.map((w, idx) => (
                  <li key={idx}>{w.reason || w}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Thành viên gương mẫu: Chưa từng có phản ánh trễ hẹn, leo cây hoặc vi phạm văn hoá đi chung.</span>
          </div>
        )}

        {/* Bộ chuyển Tab 3 vai trò */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('driver')}
            className={`pb-2.5 px-3.5 border-b-2 inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'driver'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Kinh nghiệm Cầm lái ({driverTrips})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('passenger')}
            className={`pb-2.5 px-3.5 border-b-2 inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'passenger'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Kinh nghiệm Đi cùng ({passengerTrips})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verify')}
            className={`pb-2.5 px-3.5 border-b-2 inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'verify'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Xác minh giấy tờ</span>
          </button>
        </div>

        {/* Nội dung Tab Cầm lái */}
        {activeTab === 'driver' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Phương tiện sở hữu</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{carModel}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Biển số đối soát</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 tabular">{plate}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Được hành khách khen ngợi nhiều nhất:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Lái xe an toàn', 'Xe sạch êm không mùi', 'Đúng giờ', 'Không khói thuốc', 'Thân thiện'].map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-[11px] font-medium border border-blue-200 dark:border-blue-900"
                  >
                    ✓ {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">Chị Mai (Hành khách Lộc Ninh)</span>
                <span className="text-amber-500 font-bold inline-flex items-center gap-0.5">
                  5.0 <Star className="w-3 h-3 fill-amber-400" />
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                "Bác Tuấn lái xe rất cẩn thận, đón đúng giờ tại cổng chào, xe gia đình sạch sẽ không một chút mùi khói
                thuốc."
              </p>
            </div>
          </div>
        )}

        {/* Nội dung Tab Đi cùng (Khi người này đóng vai trò là Khách) */}
        {activeTab === 'passenger' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Tỷ lệ đúng giờ đón</p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">100% Đúng hẹn</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Đánh giá từ các chủ xe</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 inline-flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> 5.0 / 5 (12 đánh giá)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Được các chủ xe khác nhận xét:</p>
              <div className="flex flex-wrap gap-1.5">
                {['Đúng giờ điểm hẹn', 'Lịch sự văn minh', 'Giữ vệ sinh xe', 'Gửi tiền xăng sòng phẳng'].map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-medium border border-emerald-200 dark:border-emerald-900"
                  >
                    ✓ {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">Anh Hùng (Chủ xe Đồng Phú)</span>
                <span className="text-amber-500 font-bold inline-flex items-center gap-0.5">
                  5.0 <Star className="w-3 h-3 fill-amber-400" />
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                "Anh Tuấn đi nhờ xe tôi về Bến xe Miền Đông, đứng chờ đúng điểm hẹn, lên xe chào hỏi văn minh, gửi tiền
                xăng sòng phẳng."
              </p>
            </div>
          </div>
        )}

        {/* Nội dung Tab Xác minh giấy tờ */}
        {activeTab === 'verify' && (
          <div className="space-y-3">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {verifications.map((v, i) => (
                <li
                  key={i}
                  className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start gap-2.5"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 inline-flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">{v.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{v.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                Quy ước văn minh đi chung xe CarMate:
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-white dark:bg-[#151c2e] border border-slate-200/50 dark:border-white/[0.08]">
                  <CigaretteOff className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Không thuốc lá</p>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-[#151c2e] border border-slate-200/50 dark:border-white/[0.08]">
                  <Users className="w-4 h-4 text-primary-600 dark:text-primary-400 mx-auto mb-1" />
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Không nhồi nhét</p>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-[#151c2e] border border-slate-200/50 dark:border-white/[0.08]">
                  <Heart className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Giá trọn gói</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
