import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, RotateCcw, Check, Eye, EyeOff, X, Sparkles } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import { renderMaskedImageFromSource } from '../../utils/plateMasker.js';

export default function PlateMaskModal({
  isOpen,
  photo,
  onSave,
  onClose
}) {
  const originalUrl = photo?.originalUrl || photo?.url;
  const [isMasked, setIsMasked] = useState(() => photo?.isMasked !== false);
  const [maskPos, setMaskPos] = useState(() => photo?.maskPos || { xRatio: 0.5, yRatio: 0.74 });
  const [previewUrl, setPreviewUrl] = useState(() => photo?.url || originalUrl);
  const [isRendering, setIsRendering] = useState(false);
  const imgRef = useRef(null);

  // Cập nhật preview canvas khi vị trí hoặc trạng thái che thay đổi
  useEffect(() => {
    if (!originalUrl) return;
    let cancelled = false;

    async function updateMask() {
      setIsRendering(true);
      try {
        const url = await renderMaskedImageFromSource(originalUrl, {
          xRatio: maskPos.xRatio,
          yRatio: maskPos.yRatio,
          isMasked
        });
        if (!cancelled) {
          setPreviewUrl(url);
        }
      } catch (err) {
        console.warn('[PlateMaskModal] Lỗi render preview:', err);
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }

    updateMask();
    return () => {
      cancelled = true;
    };
  }, [originalUrl, maskPos, isMasked]);

  if (!isOpen || !photo) return null;

  // Xử lý khi người dùng chạm hoặc click vào bất kỳ điểm nào trên ảnh
  const handleImageClick = (e) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);

    if (clientX === undefined || clientY === undefined) return;

    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const xRatio = Math.max(0.1, Math.min(0.9, Number((clickX / rect.width).toFixed(3))));
    const yRatio = Math.max(0.1, Math.min(0.95, Number((clickY / rect.height).toFixed(3))));

    setMaskPos({ xRatio, yRatio });
    setIsMasked(true);
  };

  const handleReset = () => {
    setMaskPos({ xRatio: 0.5, yRatio: 0.74 });
    setIsMasked(true);
  };

  const handleSave = () => {
    onSave?.({
      ...photo,
      url: previewUrl,
      originalUrl,
      isMasked,
      maskPos
    });
    onClose?.();
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      title="Bảo mật biển số xe thật"
      subtitle="Hệ thống tự động che biển số. Chạm vào ảnh nếu muốn đổi vị trí che."
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Về giữa</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isRendering}
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0071e3] to-[#0055d4] hover:from-[#0077ed] hover:to-[#004bbd] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-75"
            >
              <Check className="w-4 h-4" />
              <span>Xác nhận che biển</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Banner hướng dẫn 1-chạm */}
        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-900 dark:text-blue-200">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Chạm ngón tay vào vị trí biển số để dán thanh che bảo mật</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMasked(!isMasked)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
              isMasked
                ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {isMasked ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Đang che</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Bỏ che</span>
              </>
            )}
          </button>
        </div>

        {/* Khung ảnh tương tác Tap-to-Mask */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black/50 shadow-inner group select-none">
          <img
            ref={imgRef}
            src={previewUrl}
            alt="Preview xe che biển"
            onClick={handleImageClick}
            onTouchStart={handleImageClick}
            className="w-full max-h-[360px] object-contain mx-auto cursor-crosshair active:scale-[0.99] transition-transform"
          />

          {/* Vị trí chạm hint overlay */}
          <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-mono text-white pointer-events-none flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Tọa độ che: {Math.round(maskPos.xRatio * 100)}% - {Math.round(maskPos.yRatio * 100)}%</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
          💡 Ảnh xe hiển thị công khai trên CarMate sẽ giữ nguyên thanh che bảo mật này, bảo vệ 100% sự riêng tư của bạn.
        </p>
      </div>
    </Modal>
  );
}
