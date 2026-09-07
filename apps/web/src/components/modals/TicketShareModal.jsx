import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { generateSocialShareText, formatVND, getTimeSlotLabel, getFacebookShareUrl } from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import { LogoMark } from '../ui/Logo.jsx';
import { FacebookIcon, ZaloIcon } from '../ui/SocialIcons.jsx';
import {
  generateTicketImage,
  downloadTicketImage,
  generateTicketStoryImage,
  downloadTicketStoryImage
} from '../../utils/ticketCanvas.js';

export default function TicketShareModal({ trip, onClose, onShowToast, onViewInMarket }) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);

  if (!trip) return null;
  const shareText = generateSocialShareText(trip);
  const fbUrl = getFacebookShareUrl(trip);

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
      console.warn('[Share] Lỗi sao chép:', err);
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
        downloadTicketImage(dataUrl, trip.id?.slice(0, 8) || 've-xe');
        onShowToast?.('Đã tải ảnh vé xe chuẩn vuông 4:5! Thích hợp gửi nhóm Zalo / Messenger.');
      }
    } catch (err) {
      console.warn('[Share] Lỗi tạo ảnh vé:', err);
      onShowToast?.('Không thể tạo file ảnh vé, vui lòng thử lại.');
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
        onShowToast?.('Đã tải ảnh Story 9:16 sắc nét! Đăng ngay lên Zalo Story, FB Story hoặc TikTok.');
      }
    } catch (err) {
      console.warn('[Share] Lỗi tạo ảnh story:', err);
      onShowToast?.('Không thể tạo file ảnh Story, vui lòng thử lại.');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `CarMate: ${trip.from} ➔ ${trip.to}`,
          text: shareText,
          url: `https://carmate.vn/t/${trip.id}`
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={Share2}
      title={t('ticket.title') || 'Chia sẻ chuyến đi'}
      subtitle={t('ticket.subtitle') || 'Gửi vào Zalo hoặc Facebook để tìm bạn đồng hành cùng tuyến'}
      footer={
        <div className="space-y-2.5 w-full">
          {/* Cặp đôi nút hành động đắc lực: Mở Zalo & Tải ảnh Story 9:16 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a
              href="https://zalo.me/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleCopy('Đã sao chép bài đăng! Hãy dán (Paste) vào nhóm Zalo')}
              className="w-full h-12 px-4 rounded-2xl font-bold text-sm bg-[#0068ff] hover:bg-[#0055d4] active:scale-[0.99] text-white shadow-md shadow-blue-500/20 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <ZaloIcon className="w-5 h-5 shrink-0" />
              <span>Mở Zalo chia sẻ</span>
            </a>

            <button
              type="button"
              disabled={isGeneratingStory}
              onClick={handleDownloadStory}
              className="w-full h-12 px-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white shadow-md shadow-emerald-500/20 transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {isGeneratingStory ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Đang kết xuất Story...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Tải ảnh Story 9:16</span>
                </>
              )}
            </button>
          </div>

          {/* 4 Lựa chọn bổ sung thanh lịch */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              disabled={isGeneratingImage}
              onClick={handleDownloadTicket}
              className="py-2.5 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-75"
              title="Tải ảnh vé tỉ lệ vuông 4:5 thích hợp gửi tin nhắn nhóm chat"
            >
              {isGeneratingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{isGeneratingImage ? 'Đang tạo...' : 'Ảnh vé 4:5'}</span>
            </button>

            <a
              href={fbUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleCopy('Đã sao chép! Đang mở Facebook để đăng tin...')}
              className="py-2.5 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2] shrink-0" />
              <span>Facebook</span>
            </a>

            <button
              type="button"
              onClick={() => handleCopy()}
              className="py-2.5 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
            </button>

            <button
              type="button"
              onClick={handleNativeShare}
              className="py-2.5 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Khác</span>
            </button>
          </div>

          {onViewInMarket && (
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onViewInMarket(trip);
              }}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              <span>Xem vị trí bài đăng trên Bảng tin công khai</span>
            </button>
          )}
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
              {t('ticket.stamp') || 'VÉ ĐI CHUNG'}
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

          <div className="relative mt-5 pt-4 border-t border-dashed border-white/20 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] text-slate-400">{t('ticket.cost') || 'Chi phí chia sẻ'}</p>
              <p className="text-2xl font-bold tabular tracking-tight leading-none mt-1">
                {formatVND(trip.basePricePerSeat || trip.expectedPrice || 180000)}
                <span className="text-xs font-normal text-slate-400">{t('common.perSeat')}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">{t('ticket.incl') || 'Đã gồm xăng & vé cầu đường'}</p>
            </div>
            <div className="text-right">
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
            💬 Tin nhắn đã soạn sẵn đầy đủ giờ giấc, lộ trình & link gửi Zalo.
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
