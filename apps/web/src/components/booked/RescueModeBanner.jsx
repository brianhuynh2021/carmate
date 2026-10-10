import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Phone, Bus, MapPin, X } from 'lucide-react';
import { formatVND, hasVerifiedHotline } from '@carmate/shared';
import api from '../../api/client.js';

/**
 * RESCUE MODE — SELF-APPEARING WARNING STRIP
 *
 * Previously a passenger only saw the list of coaches when they MANUALLY TAPPED a button buried deep in the
 * station screen — and that button only appeared after the passenger had already arrived on site and received a
 * boarding card. That is exactly the worst-case scenario: having to stand out on the road, wait, realize
 * on their own that they had been abandoned, and only then find their way to the fallback option.
 *
 * This strip appears automatically as soon as the server raises the rescueMode flag (T-20 minutes before departure),
 * with no action needed from the passenger. The passenger still has ~20 minutes to call a coach — realistic enough
 * to still catch a flight or a medical appointment.
 *
 * The trip is NOT cancelled: this strip is a warning with an alternative, and the decision still
 * belongs to the passenger. If the driver shows up in time the flag is cleared and the strip disappears by itself.
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
      /* if the network drops, keep the currently displayed state and do not clear the warning */
    }
  }, [bookingId]);

  useEffect(() => {
    fetchStatus();
    // Every 45 seconds: fast enough for the passenger to see the warning almost instantly after the server
    // raises the flag, without hammering the API when the app stays open all day.
    const timer = setInterval(fetchStatus, 45000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  // Driver confirms in time -> server clears the flag -> strip disappears by itself, and the next
  // warning (if any) shows up normally even if the passenger had dismissed it earlier.
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

              {/* Only show the call button when the number HAS been verified by the operations team. If a passenger
                  dials at their most panicked moment and reaches a wrong number, they lose trust
                  forever — better to give instructions they can follow themselves than a hopeless call button. */}
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
