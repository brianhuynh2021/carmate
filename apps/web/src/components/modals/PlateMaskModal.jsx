import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, RotateCcw, Check, Eye, EyeOff, X, Sparkles } from 'lucide-react';
import { normalizePhotoUrl } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import { renderMaskedImageFromSource } from '../../utils/plateMasker.js';
import { useI18n } from '../../i18n/index.jsx';

export default function PlateMaskModal({
  isOpen,
  photo,
  onSave,
  onClose
}) {
  const { t } = useI18n();
  const rawOriginalUrl = typeof photo === 'string' ? photo : (photo?.originalUrl || photo?.url);
  const originalUrl = normalizePhotoUrl(rawOriginalUrl) || rawOriginalUrl || '';
  const rawCurrentUrl = typeof photo === 'string' ? photo : (photo?.url || photo?.originalUrl);
  const initialPreviewUrl = normalizePhotoUrl(rawCurrentUrl) || originalUrl || '';

  const [isMasked, setIsMasked] = useState(() => photo?.isMasked !== false);
  const [maskPos, setMaskPos] = useState(() => photo?.maskPos || { xRatio: 0.5, yRatio: 0.74 });
  const [previewUrl, setPreviewUrl] = useState(() => initialPreviewUrl);
  const [isRendering, setIsRendering] = useState(false);
  const imgRef = useRef(null);

  // Đồng bộ khi prop photo thay đổi
  useEffect(() => {
    if (photo) {
      setIsMasked(photo.isMasked !== false);
      setMaskPos(photo.maskPos || { xRatio: 0.5, yRatio: 0.74 });
      const raw = typeof photo === 'string' ? photo : (photo.url || photo.originalUrl);
      const norm = normalizePhotoUrl(raw) || '';
      setPreviewUrl(norm);
    }
  }, [photo]);

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
        if (!cancelled && url) {
          setPreviewUrl(url);
        }
      } catch (err) {
        console.warn('[PlateMaskModal] Lỗi render preview:', err);
        if (!cancelled) {
          setPreviewUrl((prev) => prev || originalUrl);
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }

    updateMask();
    return () => {
      cancelled = true;
    };
  }, [originalUrl, maskPos.xRatio, maskPos.yRatio, isMasked]);

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
    const baseObj = typeof photo === 'object' && photo !== null ? { ...photo } : {};
    onSave?.({
      ...baseObj,
      url: previewUrl || originalUrl,
      originalUrl: originalUrl || previewUrl,
      isMasked,
      maskPos
    });
    onClose?.();
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      title={t('plateMask.s010')}
      subtitle={t('plateMask.s011')}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={handleReset}
            className="type-button px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('plateMask.s001')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="type-button px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {t('plateMask.s002')}
            </button>
            <button
              type="button"
              disabled={isRendering}
              onClick={handleSave}
              className="type-button px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0071e3] to-[#0055d4] hover:from-[#0077ed] hover:to-[#004bbd] text-white shadow-md shadow-blue-500/20 transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-75"
            >
              <Check className="w-4 h-4" />
              <span>{t('plateMask.s003')}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Banner hướng dẫn 1-chạm */}
        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 flex items-center justify-between gap-2">
          <div className="type-caption flex items-center gap-2 text-blue-900 dark:text-blue-200">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{t('plateMask.s004')}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMasked(!isMasked)}
            className={`type-button px-2.5 py-1 rounded-lg transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
              isMasked
                ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {isMasked ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t('plateMask.s005')}</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>{t('plateMask.s006')}</span>
              </>
            )}
          </button>
        </div>

        {/* Khung ảnh tương tác Tap-to-Mask */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950/80 shadow-inner group select-none min-h-[260px] sm:min-h-[320px] flex items-center justify-center">
          {previewUrl ? (
            <img
              ref={imgRef}
              src={previewUrl}
              alt={t('plateMask.s012')}
              onClick={handleImageClick}
              onTouchStart={handleImageClick}
              className="w-full max-h-[380px] object-contain mx-auto cursor-crosshair active:scale-[0.99] transition-transform"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400 gap-2">
              <span className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span className="">{t('plateMask.s007')}</span>
            </div>
          )}

          {/* Loading indicator overlay khi đang render preview */}
          {isRendering && previewUrl && (
            <div className="type-badge absolute top-2 right-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-xs text-white flex items-center gap-1.5 pointer-events-none">
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{t('plateMask.s008')}</span>
            </div>
          )}

          {/* Vị trí chạm hint overlay */}
          {isMasked && (
            <div className="type-badge absolute top-2 left-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-xs text-white pointer-events-none flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Tọa độ che: {Math.round(maskPos.xRatio * 100)}% - {Math.round(maskPos.yRatio * 100)}%</span>
            </div>
          )}
        </div>

        <p className="type-caption text-slate-500 dark:text-slate-400 text-center">
          {t('plateMask.s009')}
        </p>
      </div>
    </Modal>
  );
}
