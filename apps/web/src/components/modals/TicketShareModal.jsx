import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  Loader2,
  MessageCircle,
  QrCode
} from 'lucide-react';
import {
  generateSocialShareText,
  getTimeSlotLabel,
  getZaloChatUrl,
  cleanPhoneNumber
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import { LogoMark } from '../ui/Logo.jsx';
import {
  generateTicketImage,
  downloadTicketImage,
  generateTicketStoryImage,
  downloadTicketStoryImage
} from '../../utils/ticketCanvas.js';

export default function TicketShareModal({ trip, onClose, onShowToast, onViewInMarket }) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);

  if (!trip) return null;
  const shareText = generateSocialShareText(trip);
  const contactPhone = cleanPhoneNumber(trip.phoneReal || trip.phone || '');
  /* eslint-disable-next-line no-unused-vars */
  const zaloPersonalUrl = contactPhone ? getZaloChatUrl(contactPhone) : null;

  const handleCopy = (customMsg) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch (err) {
      console.warn('[Share] Lỗi sao chép văn bản:', err);
    }
    setCopied(true);
    onShowToast?.(customMsg || t('toast.ticketCopied') || 'Đã sao chép nội dung bài đăng!');
    setTimeout(() => setCopied(false), 3000);
  };



  const handleDownloadTicket = async () => {
    try {
      setIsGeneratingImage(true);
      const dataUrl = await generateTicketImage(trip, lang);
      if (dataUrl) {
        downloadTicketImage(dataUrl, trip.id?.slice(0, 8) || 'the-thong-tin');
        onShowToast?.('Đã tải ảnh thẻ thông tin chuẩn 4:5! Thích hợp gửi nhóm Zalo / Messenger.');
      }
    } catch (err) {
      console.warn('[Share] Lỗi tạo ảnh thẻ:', err);
      onShowToast?.('Không thể tạo file ảnh thẻ thông tin, vui lòng thử lại.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadStory = async () => {
    try {
      setIsGeneratingStory(true);
      const dataUrl = await generateTicketStoryImage(trip, lang);
      if (dataUrl) {
        downloadTicketStoryImage(dataUrl, trip.id?.slice(0, 8) || 'story');
        onShowToast?.('Đã tải ảnh Story sắc nét! Đăng ngay lên Zalo Story, FB Story hoặc TikTok.');
      }
    } catch (err) {
      console.warn('[Share] Lỗi tạo ảnh story:', err);
      onShowToast?.('Không thể tạo file ảnh Story, vui lòng thử lại.');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  /**
   * Kích hoạt Native Share Sheet của hệ điều hành (gửi thẳng File ảnh thẻ thông tin và Text vào Zalo, FB, v.v.)
   */
  const handleNativeShare = async () => {
    try {
      setIsSharing(true);
      const dataUrl = await generateTicketImage(trip, lang);
      if (dataUrl && typeof File !== 'undefined') {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `the-thong-tin-carmate-${trip.id?.slice(0, 8) || 'chuyen-xe'}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `CarMate: ${trip.from} ➔ ${trip.to}`,
            text: shareText
          });
          return;
        }
      }

      if (navigator.share) {
        await navigator.share({
          title: `CarMate: ${trip.from} ➔ ${trip.to}`,
          text: shareText,
          url: `https://carmate.vn/t/${trip.id}`
        });
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('[Share] Lỗi Native Share:', err);
    } finally {
      setIsSharing(false);
    }

    // Dự phòng khi thiết bị không hỗ trợ navigator.share (ví dụ trình duyệt cũ trên PC)
    handleCopy('Đã sao chép bài đăng! Hãy dán vào ứng dụng bạn muốn gửi.');
  };

  // Tương thích ngược: Định danh hàm chia sẻ Zalo / Native Share
  const handleZaloShare = handleNativeShare;

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={Share2}
      title={t('ticket.title') || 'Thẻ thông tin chuyến đi'}
      subtitle={t('ticket.subtitle') || 'Lưu thẻ thông tin hành trình bảo mật hoặc chia sẻ liên kết'}
      footer={
        <div className="space-y-2.5 w-full">
          {/* Nút hành động chính: Tải Thẻ Thông Tin (Bảo mật SĐT) */}
          <button
            type="button"
            disabled={isGeneratingImage}
            onClick={handleDownloadTicket}
            className="w-full h-12 px-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-[#0071e3] to-[#0055d4] hover:from-[#0077ed] hover:to-[#004bbd] active:scale-[0.99] text-white shadow-md shadow-blue-500/25 transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {isGeneratingImage ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Đang tạo ảnh thẻ...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 shrink-0" />
                <span>Tải Thẻ Thông Tin (Bảo mật SĐT)</span>
              </>
            )}
          </button>

          {/* Hàng nút phụ: Chia sẻ ngay & Tải Story */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isSharing}
              onClick={handleNativeShare}
              className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-75"
            >
              {isSharing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              ) : (
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>{t('ticket.shareNow') || 'Chia sẻ ngay'}</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingStory}
              onClick={handleDownloadStory}
              className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-75"
            >
              {isGeneratingStory ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
              ) : (
                <Download className="w-3.5 h-3.5 text-sky-500" />
              )}
              <span>{t('ticket.downloadStory') || 'Tải Story'}</span>
            </button>
          </div>

          {/* Hàng tiện ích: Sao chép tóm tắt & Xem bài trên Bảng tin */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleCopy()}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã sao chép lời nhắn' : 'Sao chép văn bản tóm tắt'}</span>
            </button>

            {onViewInMarket && (
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onViewInMarket(trip);
                }}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Xem trên Bảng tin</span>
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Ticket Card — Trọng tâm thị giác duy nhất phong cách Google Boarding Pass */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-5 shadow-lg border border-white/10">
          <div
            className="absolute -top-20 -right-16 w-56 h-56 rounded-full bg-primary-600/40 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div className="absolute inset-0 hero-grid opacity-60 pointer-events-none" aria-hidden="true" />

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <LogoMark className="w-8 h-8" />
              <div>
                <p className="text-sm font-semibold leading-tight">
                  CarMate · {t('ticket.brandLine') || 'Xe Gia Đình Tiện Tuyến'}
                </p>
                <p className="text-[11px] text-slate-400">{t('ticket.brandSub') || '0% Phí sàn · Đi chung văn minh'}</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/20 text-slate-200">
              {t('ticket.stamp') || 'THẺ CHUYẾN ĐI'}
            </span>
          </div>

          <div className="relative mt-5 grid grid-cols-[1fr_auto] gap-4 items-start">
            <div className="min-w-0 space-y-3">
              <div>
                <p className="text-[11px] text-slate-400">{t('ticket.pickup') || 'Điểm đón'}</p>
                <p className="text-sm font-semibold truncate">{trip.from}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">{t('ticket.dropoff') || 'Điểm đến'}</p>
                <p className="text-sm font-semibold truncate">{trip.to}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-400">{trip.routeCategory}</p>
              <p className="text-lg font-semibold tabular">{getTimeSlotLabel(trip, lang)}</p>
            </div>
          </div>

          <div className="relative mt-5 pt-4 border-t border-dashed border-white/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-sky-400 font-semibold min-w-0">
              <QrCode className="w-3.5 h-3.5 shrink-0" />
              <span>Quét mã đặt chỗ</span>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] text-slate-400">{t('ticket.seatStatus') || 'Tình trạng chỗ'}</p>
              <p className="text-sm font-semibold text-amber-400">
                {t('ticket.seatsLeft', { n: trip.availableSeats || trip.seatsNeeded || 3 })}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{trip.carType || t('common.familyCar')}</p>
            </div>
          </div>
        </div>

        {/* Khối gợi ý tinh tế & Xem trước có thể thu gọn (Collapsible) */}
        <div className="pt-0.5 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            💬 Thẻ thông tin bảo mật lộ trình & mã QR tra cứu an toàn.
          </p>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>{showPreview ? 'Thu gọn bài viết mẫu' : 'Xem trước bài viết mẫu'}</span>
            {showPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showPreview && (
            <pre className="mt-2 text-left p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 font-sans whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
              {shareText}
            </pre>
          )}
        </div>
      </div>
    </Modal>
  );
}
