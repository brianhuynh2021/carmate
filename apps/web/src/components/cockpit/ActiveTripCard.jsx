import React, { useState } from 'react';
import {
  Car,
  Clock,
  MapPin,
  Users,
  Phone,
  MessageSquare,
  Lock,
  Unlock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { formatVND, cleanPhoneNumber } from '@carmate/shared';
import api from '../../api/client.js';

export default function ActiveTripCard({
  trip,
  onLockTrip,
  onCancelTrip,
  onRefresh,
  onShowToast
}) {
  const [isLocking, setIsLocking] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Bận việc gia đình đột xuất');

  if (!trip) return null;

  const manifest = Array.isArray(trip.manifest) ? trip.manifest : [];
  const bookedCount = manifest.length;
  const availableSeatsCount = Number(trip.availableSeats ?? 0);
  const totalSeats = Math.max(bookedCount + availableSeatsCount, Number(trip.capacity || 2));
  const isFullOrLocked = trip.status === 'full' || availableSeatsCount <= 0;

  // Format code
  const tripCode = trip.id ? (trip.id.startsWith('TRIP-') ? trip.id.replace('TRIP-', 'CX-') : trip.id) : 'CX-2257';

  // Format ngày & giờ
  const timeDisplay = trip.time || (trip.timeSlot ? trip.timeSlot.split('-')[0] : '07:00');
  const dateDisplay = trip.date || 'Ngày mai';

  // Khóa nhận thêm khách
  const handleToggleLock = async () => {
    setIsLocking(true);
    try {
      const nextStatus = isFullOrLocked ? 'active' : 'full';
      await api.updateTripStatus(trip.id, nextStatus);
      if (onLockTrip) onLockTrip(trip.id, nextStatus);
      if (onRefresh) onRefresh();
      onShowToast?.(
        nextStatus === 'full'
          ? '🔒 Đã khóa nhận thêm khách. Chuyến xe sẽ ẩn trên sàn tìm kiếm.'
          : '🔓 Đã mở lại nhận khách. Chuyến xe tiếp tục xuất hiện trên sàn.'
      );
    } catch (err) {
      onShowToast?.(`⚠️ Không thể thay đổi trạng thái: ${err.message || 'Thử lại sau'}`);
    } finally {
      setIsLocking(false);
    }
  };

  // Xác nhận hủy chuyến
  const handleConfirmCancel = async () => {
    setIsCanceling(true);
    try {
      await api.deleteTrip(trip.id);
      if (onCancelTrip) onCancelTrip(trip.id, cancelReason);
      if (onRefresh) onRefresh();
      setShowCancelModal(false);
      onShowToast?.('⚠️ Đã hủy chuyến xe. Hệ thống đã gửi tin nhắn xin lỗi tới khách đi cùng.');
    } catch (err) {
      onShowToast?.(`⚠️ Không thể hủy chuyến: ${err.message || 'Thử lại sau'}`);
    } finally {
      setIsCanceling(false);
    }
  };

  // Tạo danh sách ghế cố định
  const seatSlots = [];
  for (let i = 0; i < totalSeats; i++) {
    if (i < bookedCount) {
      seatSlots.push({ type: 'booked', data: manifest[i], index: i + 1 });
    } else {
      seatSlots.push({ type: 'empty', index: i + 1 });
    }
  }

  return (
    <div className="rounded-3xl bg-[#FFFFFF] dark:bg-[#1a2232] border border-slate-300/70 dark:border-white/10 shadow-md hover:shadow-lg transition-all overflow-hidden text-slate-900 dark:text-slate-100 font-sans">
      {/* ── HEADER THẺ: MÃ CHUYẾN · KHỞI HÀNH · BADGE ── */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-white/[0.02] dark:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs">
                #{tripCode}
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                Khởi hành: <strong className="text-slate-900 dark:text-white font-black">{timeDisplay}</strong> · {dateDisplay}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
              <span>{trip.from || 'Tân Khai (QL13)'}</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span>{trip.to || 'Cụm BV Chợ Rẫy'}</span>
            </div>
          </div>

          {/* Badge trạng thái Real-time */}
          <div>
            {bookedCount === 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-600/40 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>🟢 Đang nhận khách (0/{totalSeats} ghế)</span>
              </span>
            ) : bookedCount < totalSeats && !isFullOrLocked ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-600/40 text-amber-800 dark:text-amber-300 text-xs font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>🟡 Đã có {bookedCount} khách đặt ({bookedCount}/{totalSeats} ghế)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-600/40 text-rose-700 dark:text-rose-300 text-xs font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>🔴 Đã đủ khách ({bookedCount}/{totalSeats} ghế)</span>
              </span>
            )}
          </div>
        </div>

        {/* Thông tin phương tiện */}
        <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400 font-mono">
          <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-bold">
            <Car className="w-3.5 h-3.5 text-emerald-500" />
            <span>{trip.carType || 'Mitsubishi Xpander'}</span>
          </span>
          <span>•</span>
          <span className="text-slate-700 dark:text-slate-300">
            Biển số: <strong className="font-bold text-slate-900 dark:text-white">{trip.licensePlate || trip.plateMask || '93A - 568.xx'}</strong>
          </span>
          <span>•</span>
          <span>
            Phụ xăng: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatVND(trip.basePricePerSeat || 165000)}/ghế</strong>
          </span>
        </div>
      </div>

      {/* ── DANH SÁCH GHẾ (REAL-TIME SEAT MANIFEST) ── */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold uppercase font-mono text-slate-500 dark:text-slate-400">
          <span>Danh sách ghế ({bookedCount}/{totalSeats} đã giữ chỗ)</span>
          <span className="text-[11px] font-normal lowercase">Cập nhật tức thì khi có OTP</span>
        </div>

        <div className="space-y-2">
          {seatSlots.map((slot) => {
            if (slot.type === 'empty') {
              return (
                <div
                  key={`empty-${slot.index}`}
                  className="p-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-slate-200/70 dark:bg-white/5 text-slate-400 font-mono font-bold flex items-center justify-center text-xs">
                      #{slot.index}
                    </div>
                    <div>
                      <span className="font-bold text-slate-600 dark:text-slate-400 block font-mono">
                        Ghế {slot.index}: Còn trống
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Đang sẵn sàng đón khách trên tuyến
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                    Sẵn sàng ghép
                  </span>
                </div>
              );
            }

            // Ghế đã có khách đặt
            const passenger = slot.data;
            const passengerPhone = passenger.passengerPhone || passenger.phone || '0984568421';
            const cleanPhone = cleanPhoneNumber(passengerPhone);
            const passengerName = passenger.passengerName || passenger.contactName || `Khách đi cùng #${slot.index}`;
            const pickupSpot = passenger.pickupSpot || trip.from || 'Cây xăng Petrolimex Tân Khai';

            return (
              <div
                key={`booked-${slot.index}`}
                className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 font-mono font-black flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-xs">
                    #{slot.index}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Khách: <strong className="text-[#0071e3]">{passengerName}</strong>
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        Đã xác thực OTP
                      </span>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                      SĐT: {passengerPhone}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Đón tại: <strong>{pickupSpot}</strong></span>
                    </p>
                  </div>
                </div>

                {/* Nút hành động nhanh: Gọi & Zalo 1-chạm */}
                <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                  <a
                    href={`tel:${cleanPhone}`}
                    className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                    title="Bấm gọi xác nhận ngay"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Gọi xác nhận</span>
                  </a>

                  <a
                    href={`https://zalo.me/${cleanPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                    title="Nhắn tin Zalo đón khách"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Nhắn Zalo</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── NÚT KIỂM SOÁT CỦA CHỦ XE ── */}
      <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.02] flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleToggleLock}
          disabled={isLocking}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
            isFullOrLocked
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25'
              : 'bg-slate-200/80 dark:bg-white/10 border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
          }`}
        >
          {isFullOrLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          <span>{isFullOrLocked ? 'Mở nhận thêm khách' : 'Khóa nhận thêm khách'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowCancelModal(true)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Hủy chuyến</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* MODAL XÁC NHẬN HỦY CHUYẾN (KÈM LÝ DO & CẢNH BÁO TÍN NHIỆM)             */}
      {/* ===================================================================== */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-[#1a2232] border border-slate-300 dark:border-white/10 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Xác nhận hủy chuyến #{tripCode}?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {bookedCount > 0
                    ? `Hiện có ${bookedCount} người đi cùng đã giữ chỗ trên chuyến này.`
                    : 'Chuyến xe sẽ được gỡ khỏi sàn tìm kiếm.'}
                </p>
              </div>
            </div>

            {bookedCount > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/40 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                <strong className="block font-bold">Lưu ý trước khi hủy:</strong>
                <p>
                  Hệ thống sẽ tự động gửi tin nhắn xin lỗi và điều phối xe hỗ trợ khác cho khách.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Lý do hủy chuyến:
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white outline-none"
              >
                <option value="Bận việc gia đình đột xuất">Bận việc gia đình đột xuất</option>
                <option value="Xe gặp sự cố kỹ thuật">Xe gặp sự cố kỹ thuật</option>
                <option value="Thời tiết mưa bão không thuận lợi">Thời tiết mưa bão không thuận lợi</option>
                <option value="Thay đổi lộ trình di chuyển">Thay đổi lộ trình di chuyển</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="h-10 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 transition-all cursor-pointer"
              >
                Giữ chuyến xe
              </button>

              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCanceling}
                className="h-10 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {isCanceling ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
