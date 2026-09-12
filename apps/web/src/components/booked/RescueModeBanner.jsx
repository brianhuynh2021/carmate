import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Phone, Bus, X } from 'lucide-react';
import { formatVND } from '@carmate/shared';
import api from '../../api/client.js';

/**
 * CHẾ ĐỘ CỨU HỘ — DẢI CẢNH BÁO TỰ HIỆN
 *
 * Trước đây khách chỉ thấy danh sách xe khách khi TỰ BẤM một nút nằm sâu trong
 * màn hình trạm — mà nút đó chỉ xuất hiện sau khi khách đã ra tới nơi và đã có
 * thẻ lên xe. Nghĩa là đúng kịch bản tệ nhất: phải ra đứng đường, chờ, tự nhận
 * ra mình bị bỏ rơi, rồi mới mò được đường tới phương án dự phòng.
 *
 * Dải này tự hiện ngay khi máy chủ bật cờ rescueMode (T-20 phút trước giờ chạy),
 * không cần khách làm gì cả. Khách vẫn còn ~20 phút để gọi xe khách — đủ thực tế
 * để kịp chuyến bay hoặc lịch khám bệnh.
 *
 * Chuyến KHÔNG bị huỷ: dải này là cảnh báo kèm phương án, quyền quyết định vẫn
 * thuộc về khách. Chủ xe xuất hiện kịp thì cờ được gỡ và dải tự biến mất.
 */
export default function RescueModeBanner({ bookingId, onShowToast }) {
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await api.getRescueStatus(bookingId);
      if (res?.success) setStatus(res);
    } catch {
      /* mất mạng thì giữ nguyên trạng thái đang hiển thị, không xoá cảnh báo */
    }
  }, [bookingId]);

  useEffect(() => {
    fetchStatus();
    // 45 giây/lần: đủ nhanh để khách thấy cảnh báo gần như tức thì sau khi máy
    // chủ bật cờ, mà không nện vào API khi app mở cả ngày.
    const timer = setInterval(fetchStatus, 45000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  // Chủ xe xác nhận kịp -> máy chủ gỡ cờ -> dải tự biến mất, và lần cảnh báo
  // sau (nếu có) lại hiện bình thường dù trước đó khách đã bấm ẩn.
  const isRescue = status?.rescueMode === true;
  useEffect(() => {
    if (!isRescue) setDismissed(false);
  }, [isRescue]);

  if (!isRescue || dismissed) return null;

  const lifebuoys = Array.isArray(status.lifebuoys) ? status.lifebuoys : [];
  const reasonLabel =
    status.reason === 'NO_GPS_SIGNAL'
      ? 'Chưa nhận được tín hiệu từ xe của chủ xe'
      : status.reason === 'STALE_HEARTBEAT'
        ? 'Tín hiệu xe đã ngắt quá lâu'
        : 'Chủ xe chưa xác nhận lên đường';

  return (
    <section
      role="alert"
      className="rounded-2xl border border-amber-400/60 bg-amber-50 dark:bg-amber-500/[0.08] overflow-hidden"
    >
      <div className="p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
            Chuyến đi có thể bị gián đoạn
          </p>
          <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/80">
            {reasonLabel}. Đừng lo — bạn vẫn còn thời gian, CarMate đã chuẩn bị sẵn phương án dưới đây.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Ẩn cảnh báo"
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-amber-700/70 dark:text-amber-300/70 hover:bg-amber-500/15 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {lifebuoys.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-wide text-amber-700/80 dark:text-amber-300/70 flex items-center gap-1.5">
            <Bus className="w-3 h-3" />
            Xe khách tuyến QL13 gần bạn nhất
          </p>

          {lifebuoys.map((bus) => (
            <div
              key={bus.id}
              className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-amber-300/50 dark:border-amber-500/20"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {bus.operator}
                </p>
                {bus.ticketPrice ? (
                  <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 shrink-0">
                    {formatVND(bus.ticketPrice)}
                  </span>
                ) : null}
              </div>

              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                {bus.pickupTime} · {bus.frequency} · {bus.departureStation}
              </p>

              {/* Số điện thoại là một liên kết gọi thẳng: lúc hoảng không ai muốn
                  copy số rồi mở bàn phím quay số thủ công. */}
              <a
                href={`tel:${String(bus.hotline || '').replace(/\s/g, '')}`}
                onClick={() => onShowToast?.(`Đang gọi ${bus.operator}…`)}
                className="mt-2 w-full h-10 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" />
                Gọi đặt vé ngay: {bus.hotline}
              </a>
            </div>
          ))}

          <p className="text-[10px] text-amber-700/70 dark:text-amber-300/60 leading-relaxed pt-1">
            Chuyến của bạn vẫn chưa bị huỷ. Nếu chủ xe xác nhận kịp, cảnh báo này sẽ tự tắt.
          </p>
        </div>
      )}
    </section>
  );
}
