import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Phone, Bus, MapPin, X } from 'lucide-react';
import { formatVND, hasVerifiedHotline } from '@carmate/shared';
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
          <p className="text-amber-900 dark:text-amber-200 type-body-strong">
            Chuyến đi có thể bị gián đoạn
          </p>
          <p className="mt-1 text-amber-800/90 dark:text-amber-200/80 type-caption">
            {reasonLabel}. Hãy liên hệ chủ xe để kiểm tra. Những lựa chọn dưới đây cần được hỏi lại giờ và khả năng nhận khách.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Ẩn cảnh báo"
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-amber-700/70 dark:text-amber-300/70 hover:bg-amber-500/15 transition-colors cursor-pointer type-button"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {lifebuoys.length === 0 && <p className="px-4 pb-4 text-amber-800 dark:text-amber-200 type-body">Chưa có phương án thay thế trong dữ liệu hiện có.</p>}
      {lifebuoys.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-amber-700/80 dark:text-amber-300/70 flex items-center gap-1.5 tabular type-caption">
            <Bus className="w-3 h-3" />
            Phương án đi tiếp trên QL13
          </p>

          {lifebuoys.map((bus) => (
            <div
              key={bus.id}
              className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-amber-300/50 dark:border-amber-500/20"
            >
              <div className="flex items-center justify-between gap-2 min-w-0 type-body">
                <p className="text-slate-900 dark:text-white truncate type-body-strong">
                  {bus.operator}
                </p>
                {bus.ticketPrice ? (
                  <span className="text-amber-700 dark:text-amber-400 shrink-0 tabular type-body-strong">
                    {formatVND(bus.ticketPrice)}
                  </span>
                ) : null}
              </div>

              <p className="mt-0.5 text-slate-500 dark:text-slate-400 tabular type-body">
                {bus.pickupTime} · {bus.frequency}
              </p>

              {/* Chỉ hiện nút gọi khi số ĐÃ được đội vận hành kiểm chứng. Khách
                  bấm số đúng lúc hoảng nhất mà gặp số sai thì mất niềm tin vĩnh
                  viễn — thà đưa chỉ dẫn tự làm được còn hơn một nút gọi vô vọng. */}
              {hasVerifiedHotline(bus) ? (
                <a
                  href={`tel:${String(bus.hotline).replace(/\s/g, '')}`}
                  onClick={() => onShowToast?.(`Đang gọi ${bus.operator}…`)}
                  className="mt-2 w-full h-10 rounded-lg bg-amber-500 hover:bg-amber-400 text-white flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer type-button"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Gọi đặt vé ngay: {bus.hotline}
                </a>
              ) : (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-100/70 dark:bg-amber-500/10 flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-amber-900 dark:text-amber-200/90 type-body">
                    {bus.guidance || `Liên hệ nhà xe để xác nhận điểm đón ${bus.departureStation || 'phù hợp'} trước khi đến.`}
                  </p>
                </div>
              )}
            </div>
          ))}

          <p className="text-amber-700/70 dark:text-amber-300/60 pt-1 type-caption">
            Chuyến của bạn vẫn chưa bị huỷ. Nếu chủ xe xác nhận kịp, cảnh báo này sẽ tự tắt.
          </p>
        </div>
      )}
    </section>
  );
}
