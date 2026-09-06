import React, { useState, useRef, useEffect } from 'react';
import { Phone, Users, ShieldCheck, MapPin, Building2, Bus, Milestone, Check, Sparkles, Navigation } from 'lucide-react';
import { formatVND, calculatePricing, getTimeSlotLabel, getZaloChatUrl, cleanPhoneNumber } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { RouteTimeline } from '../market/TripCard.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';
import { searchLocations } from '../../utils/vietnamLocations.js';
import api from '../../api/client.js';

// Điểm đón mốc nổi tiếng dọc trục QL13 & liên tỉnh (Hotspot Chips 1 chạm kiểu Grab)
const POPULAR_HOTSPOTS = [
  'Ngã 4 Bình Phước',
  'Trạm thu phí Lái Thiêu',
  'Cổng KCN VSIP 1',
  'Cầu Bình Triệu',
  'Ngã 4 Hàng Xanh',
  'Bến xe Miền Đông',
  'Cây xăng Petrolimex 17',
  'Chợ Tân Khai',
  'Cổng chào Bình Long'
];

export default function EscrowBookingModal({ item, currentUser, onClose, onConfirmBooking, onViewTrustProfile }) {
  const { lang } = useI18n();
  const [seats, setSeats] = useState(1);
  const [pickupPoint, setPickupPoint] = useState('');
  const [commitOnTime, setCommitOnTime] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [unmaskedPhone, setUnmaskedPhone] = useState(item?.phoneReal || '');

  // Autocomplete Dropdown State
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (pickupPoint.trim().length >= 2) {
      const results = searchLocations(pickupPoint, 5);
      setSuggestions(results);
    } else {
      setSuggestions([]);
    }
  }, [pickupPoint]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!item) return null;

  const isDriverItem = item.type === 'driver_offer';
  const maxSeats = item.availableSeats || item.seatsNeeded || 4;
  const pricing = calculatePricing(item, seats);
  const timeSlot = getTimeSlotLabel(item, lang);
  const activePhone = unmaskedPhone || item.phoneReal || '';
  const phoneClean = cleanPhoneNumber(activePhone);

  // Soạn sẵn tin nhắn Zalo lịch sự, rõ ràng
  const pickupText = pickupPoint.trim() ? `\n• Điểm hẹn đón mong muốn: ${pickupPoint.trim()}` : '';
  const zaloMessage = `Xin chào ${item.publicName}, tôi thấy chuyến đi của bạn trên CarMate:\n• Lộ trình: ${item.from} ➔ ${item.to}\n• Thời gian: ${timeSlot} (${item.date || 'Hôm nay'})\n• Số ghế: ${seats} người${pickupText}\n• Đóng góp dự kiến: ${formatVND(pricing.total)} (gửi khi lên xe)\n• Cam kết: Tôi cam kết có mặt đúng giờ, không hủy đột xuất.\nNhờ bạn xác nhận điểm đón giúp tôi nhé!`;

  const handleConfirmAndZalo = async () => {
    if (!commitOnTime || submitting) return;
    setSubmitting(true);

    try {
      const bookingCode = `CX-${Math.floor(1000 + Math.random() * 9000)}`;

      // Gọi API tạo booking để ghi nhận giao dịch và nhận SĐT thật từ DB
      let realPhone = item.phoneReal || '';
      try {
        const res = await api.createBooking({
          escrowId: bookingCode,
          tripId: item.id,
          targetTripId: item.id,
          from: item.from,
          to: item.to,
          pickupPoint: pickupPoint.trim() || undefined,
          seats,
          totalDeal: pricing.total,
          timeSlot,
          contactPhone: item.phoneReal
        });

        if (res?.success && res.data) {
          const fetchedPhone = res.data.contactPhone || res.data.driverPhone || res.data.phoneReal;
          if (fetchedPhone) {
            realPhone = fetchedPhone;
            setUnmaskedPhone(fetchedPhone);
          }
        }
      } catch (err) {
        console.warn('Ghi nhận booking qua API:', err.message);
      }

      // Thông báo cho component cha lưu state
      onConfirmBooking?.({
        escrowId: bookingCode,
        targetItem: item,
        commitmentType: 'zalo_direct',
        partyRole: isDriverItem ? 'Người đi cùng Chủ Xe' : 'Chủ xe đón Người đi cùng',
        contactName: item.publicName,
        contactPhone: realPhone || item.phoneReal,
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

      // Mở liên kết Zalo trực tiếp với số điện thoại thật
      const targetPhoneForZalo = realPhone || item.phoneReal || '0984883750';
      const zaloUrl = getZaloChatUrl(targetPhoneForZalo, zaloMessage);
      window.open(zaloUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="space-y-2.5 w-full">
      <Button
        fullWidth
        size="lg"
        disabled={!commitOnTime || submitting}
        onClick={handleConfirmAndZalo}
        className="bg-[#0068ff] hover:bg-[#0055d4] disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm font-semibold text-base py-3 cursor-pointer transition-all duration-150 active:scale-[0.99]"
      >
        <ZaloIcon className="w-5 h-5 mr-2" />
        {submitting ? 'Đang kết nối...' : (isDriverItem ? 'Xác nhận cam kết & Nhắn Zalo chốt điểm đón' : 'Xác nhận cam kết & Nhắn Zalo hẹn giờ')}
      </Button>

      {phoneClean && (
        <a
          href={`tel:${phoneClean}`}
          className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Phone className="w-4 h-4 text-emerald-600" />
          <span>Gọi trực tiếp {activePhone}</span>
        </a>
      )}
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
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="font-bold text-slate-900 text-base leading-tight">{item.publicName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 font-medium">{item.carType || 'Xe ô tô gia đình'}</span>
                {onViewTrustProfile && (
                  <button
                    type="button"
                    onClick={() => onViewTrustProfile(item)}
                    className="text-xs text-primary-600 font-semibold hover:underline cursor-pointer"
                  >
                    · Xem hồ sơ tín nhiệm
                  </button>
                )}
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200/60 text-xs font-bold tabular">
              {timeSlot}
            </span>
          </div>
          <RouteTimeline from={item.from} to={item.to} compact />
        </div>

        {/* Chọn số lượng người cùng đi */}
        {isDriverItem && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200">
            <span className="text-sm font-semibold text-slate-800 inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600" />
              Số người cùng đi:
            </span>
            <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-slate-100">
              {[1, 2, 3, 4].filter((n) => n <= maxSeats).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeats(n)}
                  className={`w-8 h-8 rounded-md text-sm font-bold tabular cursor-pointer transition-all ${
                    seats === n
                      ? 'bg-white text-primary-700 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Điểm đón mong muốn cụ thể với Hotspots & Dropdown Autocomplete kiểu Grab */}
        <div ref={dropdownRef} className="relative p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Điểm bạn muốn được đón dọc đường (tùy chọn):
            </label>
            {pickupPoint && (
              <button
                type="button"
                onClick={() => setPickupPoint('')}
                className="text-[11px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
              >
                Xóa
              </button>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              value={pickupPoint}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => {
                setPickupPoint(e.target.value);
                setShowSuggestions(true);
              }}
              placeholder="VD: Cầu vượt Mai Dịch, Ngã 4 Hàng Xanh, Cây xăng..."
              className="w-full h-10 px-3 pr-8 rounded-lg text-xs bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
            <Navigation className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />

            {/* Dropdown gợi ý địa điểm chuẩn kiểu Grab */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden py-1 max-h-48 overflow-y-auto anim-fade-in">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPickupPoint(s.name);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{s.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{s.detail}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Gợi ý điểm đón nhanh 1 chạm theo lộ trình (Hotspot Chips) */}
          <div className="space-y-1 pt-1">
            <p className="text-[11px] text-slate-500 font-medium">Gợi ý điểm đón thuận tiện dọc tuyến:</p>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {POPULAR_HOTSPOTS.map((spot) => (
                <button
                  key={spot}
                  type="button"
                  onClick={() => {
                    setPickupPoint(spot);
                    setShowSuggestions(false);
                  }}
                  className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                    pickupPoint === spot
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                  }`}
                >
                  {pickupPoint === spot && <Check className="w-3 h-3 inline mr-1 text-emerald-600 stroke-[3]" />}
                  {spot}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chi phí chia sẻ minh bạch - 0% phí sàn, KHÔNG THU CỌC */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden text-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-slate-600">Chi phí chia sẻ ({seats} người)</span>
            <span className="font-bold text-slate-900 tabular text-base">{formatVND(pricing.total)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-emerald-50/50">
            <span className="text-emerald-700 font-medium inline-flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4" />
              Phí nền tảng CarMate
            </span>
            <span className="font-bold text-emerald-700 text-xs">0đ (Miễn phí 100%)</span>
          </div>
          <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-800">Thanh toán khi lên xe</p>
              <p className="text-[11px] text-slate-500">Trọn gói xăng & cầu đường · Không thu cọc</p>
            </div>
            <p className="font-display font-extrabold text-lg text-primary-700 tabular">
              {formatVND(pricing.total)}
            </p>
          </div>
        </div>

        {/* Khối Cam Kết Văn Minh & Chống Bùng Kèo */}
        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={commitOnTime}
            onChange={(e) => setCommitOnTime(e.target.checked)}
            className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 shrink-0"
          />
          <span className="text-xs text-amber-900 leading-relaxed font-medium">
            <strong className="font-bold">Cam kết đi xe văn minh:</strong> Tôi cam kết có mặt đúng giờ tại điểm đón. Nếu có việc bận đột xuất, tôi sẽ chủ động gọi điện hoặc nhắn Zalo trước ít nhất 1 giờ để chủ xe sắp xếp ghế.
          </span>
        </label>
      </div>
    </Modal>
  );
}
