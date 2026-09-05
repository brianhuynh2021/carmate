import React, { useState } from 'react';
import { Phone, Users, ShieldCheck } from 'lucide-react';
import { formatVND, calculatePricing, getTimeSlotLabel, getZaloChatUrl, cleanPhoneNumber } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { RouteTimeline } from '../market/TripCard.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';

export default function EscrowBookingModal({ item, onClose, onConfirmBooking, onViewTrustProfile }) {
  const { lang } = useI18n();
  const [seats, setSeats] = useState(1);
  const [pickupPoint, setPickupPoint] = useState('');
  const [commitOnTime, setCommitOnTime] = useState(true);

  if (!item) return null;

  const isDriverItem = item.type === 'driver_offer';
  const maxSeats = item.availableSeats || item.seatsNeeded || 4;
  const pricing = calculatePricing(item, seats);
  const timeSlot = getTimeSlotLabel(item, lang);
  const phoneClean = cleanPhoneNumber(item.phoneReal);

  // Tin nhắn mẫu khi mở Zalo với chủ xe / người tìm xe
  const pickupText = pickupPoint.trim() ? `\n• Điểm hẹn đón mong muốn: ${pickupPoint.trim()}` : '';
  const zaloMessage = `Xin chào ${item.publicName}, tôi thấy chuyến đi của bạn trên CarMate:\n• Lộ trình: ${item.from} ➔ ${item.to}\n• Thời gian: ${timeSlot} (${item.date || 'Hôm nay'})\n• Số ghế: ${seats} người${pickupText}\n• Đóng góp dự kiến: ${formatVND(pricing.total)} (gửi khi lên xe)\n• Cam kết: Tôi cam kết có mặt đúng giờ, không hủy đột xuất.\nNhờ bạn xác nhận điểm đón giúp tôi nhé!`;

  const handleConfirmAndZalo = () => {
    if (!commitOnTime) return;
    const bookingCode = `CX-${Math.floor(1000 + Math.random() * 9000)}`;
    onConfirmBooking({
      escrowId: bookingCode,
      targetItem: item,
      commitmentType: 'zalo_direct',
      partyRole: isDriverItem ? 'Người đi cùng Chủ Xe' : 'Chủ xe đón Người đi cùng',
      contactName: item.publicName,
      contactPhone: item.phoneReal,
      seats,
      pickupPoint: pickupPoint.trim() || undefined,
      depositAmount: 0,
      fullTripAmount: pricing.total,
      paidToEscrow: 0,
      remainingCash: pricing.total,
      totalDeal: pricing.total,
      timeSlot,
      from: item.from,
      to: item.to,
      status: 'zalo_active',
      bothConfirmed: false,
      createdAt: 'Vừa xong'
    });

    // Mở liên kết chat Zalo trực tiếp
    const zaloUrl = getZaloChatUrl(item.phoneReal, zaloMessage);
    window.open(zaloUrl, '_blank', 'noopener,noreferrer');
  };

  const footer = (
    <div className="space-y-2.5 w-full">
      <Button
        fullWidth
        size="lg"
        disabled={!commitOnTime}
        onClick={handleConfirmAndZalo}
        className="bg-[#0068ff] hover:bg-[#0055d4] disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md font-semibold text-base py-3 cursor-pointer"
      >
        <ZaloIcon className="w-5 h-5 mr-2" />
        {isDriverItem ? 'Xác nhận cam kết & Nhắn Zalo chốt điểm đón' : 'Xác nhận cam kết & Nhắn Zalo hẹn giờ'}
      </Button>

      <a
        href={`tel:${phoneClean}`}
        className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <Phone className="w-4 h-4 text-emerald-600" />
        <span>Gọi trực tiếp {item.phoneReal}</span>
      </a>
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={ZaloIcon}
      iconTone="brand"
      title={isDriverItem ? 'Ghép chuyến & Nhắn Zalo' : 'Nhận đón & Nhắn Zalo'}
      subtitle="0% phí sàn · Không thu cọc · Kết nối trực tiếp qua Zalo"
      footer={footer}
    >
      <div className="space-y-4">
        {/* Tóm tắt chuyến đi */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-base leading-tight">{item.publicName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">{item.carType || 'Xe gia đình'}</span>
                {onViewTrustProfile && (
                  <button
                    type="button"
                    onClick={() => onViewTrustProfile(item)}
                    className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline cursor-pointer"
                  >
                    · Xem hồ sơ tín nhiệm
                  </button>
                )}
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary-100/80 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 text-xs font-bold tabular">
              {timeSlot}
            </span>
          </div>
          <RouteTimeline from={item.from} to={item.to} compact />
        </div>

        {/* Chọn số lượng người cùng đi */}
        {isDriverItem && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600" />
              Số người cùng đi:
            </span>
            <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              {[1, 2, 3, 4].filter((n) => n <= maxSeats).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeats(n)}
                  className={`w-8 h-8 rounded-md text-sm font-bold tabular cursor-pointer transition-all ${
                    seats === n
                      ? 'bg-white text-primary-700 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Điểm đón mong muốn cụ thể */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            📍 Điểm bạn muốn được đón dọc đường (tùy chọn):
          </label>
          <input
            type="text"
            value={pickupPoint}
            onChange={(e) => setPickupPoint(e.target.value)}
            placeholder="VD: Cầu vượt Mai Dịch, Ngã 4 Hàng Xanh, Cây xăng..."
            className="w-full h-9 px-3 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-primary-500"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Điểm này sẽ được tự động soạn sẵn vào tin nhắn Zalo gửi đến {item.publicName}.
          </p>
        </div>

        {/* Chi phí chia sẻ minh bạch - 0% phí sàn, KHÔNG THU CỌC */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 overflow-hidden text-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">Chi phí chia sẻ ({seats} người)</span>
            <span className="font-bold text-slate-900 dark:text-white tabular text-base">{formatVND(pricing.total)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <span className="text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Phí nền tảng CarMate
            </span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400">0đ (Miễn phí 100%)</span>
          </div>
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Thanh toán khi lên xe</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Trọn gói xăng & cầu đường · Không thu cọc</p>
            </div>
            <p className="font-display font-extrabold text-lg text-primary-700 dark:text-primary-300 tabular">
              {formatVND(pricing.total)}
            </p>
          </div>
        </div>

        {/* Khối Cam Kết Văn Minh & Chống Bùng Kèo */}
        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={commitOnTime}
            onChange={(e) => setCommitOnTime(e.target.checked)}
            className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 shrink-0"
          />
          <span className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
            <strong className="font-bold">Cam kết đi xe văn minh:</strong> Tôi cam kết có mặt đúng giờ tại điểm đón. Nếu có việc bận đột xuất, tôi sẽ chủ động gọi điện hoặc nhắn Zalo trước ít nhất 1 giờ để chủ xe sắp xếp ghế.
          </span>
        </label>
      </div>
    </Modal>
  );
}
