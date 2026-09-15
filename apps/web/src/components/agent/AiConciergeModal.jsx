import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Clock,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Users,
  HeartHandshake
} from 'lucide-react';
import api from '../../api/client.js';
import { formatVND, getZaloChatLink, SITE_INFO } from '@carmate/shared';
import { ZaloIcon } from '../ui/SocialIcons.jsx';
import { useI18n } from '../../i18n/index.jsx';

const QUICK_PROMPTS = [
  'Tìm xe từ Hàng Xanh về Đồng Xoài chiều nay',
  'Chi phí xăng và phí cầu đường tuyến QL13 hiện khoảng bao nhiêu?',
  'Kiểm tra độ uy tín của Chủ xe Tuấn Bình Phước',
  'Soạn giúp tôi tin nhắn Zalo hẹn đón lịch sự ở cây xăng'
];

export default function AiConciergeModal({ isOpen, onClose, onSelectTrip }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Xin chào! Mình là **Trợ lý CarMate**.\n\nMình có thể hỗ trợ bạn:\n• Tìm chuyến xe ghép cùng đường có điểm đón tiện nhất\n• Tra cứu định mức tiền xăng & phí cầu đường hợp lý\n• Kiểm tra điểm tín nhiệm và đánh giá của chủ xe\n\nBạn đang muốn tìm chuyến đi đâu hôm nay?',
      reasoningSteps: [],
      suggestedTrips: []
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const history = messages.filter((m) => m.id !== 'welcome').map((m) => ({ role: m.role, content: m.text }));

      const res = await api.agentChat(query, history);
      if (res.success && res.data) {
        const agentMsg = {
          id: `agent-${Date.now()}`,
          role: 'assistant',
          text: res.data.reply,
          reasoningSteps: res.data.reasoningSteps || [],
          suggestedTrips: res.data.suggestedTrips || []
        };
        setMessages((prev) => [...prev, agentMsg]);
      } else {
        throw new Error(res.error || 'Không nhận được phản hồi');
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text:
            'Xin lỗi bạn, hiện tại kết nối đến Trợ lý đang bị gián đoạn: ' +
            (err.message || 'Vui lòng thử lại sau ít giây.'),
          reasoningSteps: ['Lỗi kết nối mạng hoặc máy chủ bận'],
          suggestedTrips: []
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl h-[92vh] sm:h-[680px] flex flex-col rounded-2xl bg-white border border-black/[0.08] shadow-[0_20px_48px_rgba(0,0,0,0.16)] overflow-hidden animate-in zoom-in-95 duration-200 text-left"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] bg-[#f5f5f7]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[#1d1d1f] type-title">{t('aiConcierge.s001')}</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#107c41] border border-emerald-200/80 type-badge">
                  {t('aiConcierge.s002')}
                </span>
              </div>
              <p className="text-[#86868b] type-caption">
                {t('aiConcierge.s003')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-full border border-black/[0.08] hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] flex items-center justify-center transition-all cursor-pointer active:scale-90 type-button"
            title={t('aiConcierge.s011')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          {messages.map((m) => {
            const isUser = m.role === 'user';

            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-150`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[88%] sm:max-w-[82%] space-y-2.5 ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Main Chat Bubble */}
                  <div
                    className={`p-3.5 sm:p-4 rounded-2xl whitespace-pre-line type-caption ${
                      isUser
                        ? 'bg-[#0071e3] text-white rounded-tr-xs shadow-xs'
                        : 'bg-white text-[#1d1d1f] rounded-tl-xs border border-black/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                    }`}
                  >
                    {m.text}
                  </div>

                  {/* Interactive Trip Cards in Chat */}
                  {m.suggestedTrips && m.suggestedTrips.length > 0 && (
                    <div className="space-y-2 pt-1 w-full">
                      <p className="text-slate-500 type-caption">
                        {t('aiConcierge.s004')}
                      </p>
                      <div className="grid grid-cols-1 gap-2.5">
                        {m.suggestedTrips.map((trip) => (
                          <div
                            key={trip.id}
                            className="p-3.5 rounded-2xl border border-black/[0.08] bg-white shadow-xs hover:border-[#0071e3]/40 transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[#1d1d1f] type-caption">{trip.publicName}</span>
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 tabular type-badge">
                                  {trip.carType}
                                </span>
                              </div>
                              <span className="text-[#0071e3] tabular type-body-strong">
                                {formatVND(trip.basePricePerSeat || trip.price || trip.expectedPrice || 180000)}/ghế
                              </span>
                            </div>

                            <div className="text-[#1d1d1f] flex items-center gap-1.5 type-body">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate type-body">
                                {trip.from} ➔ {trip.to}
                              </span>
                            </div>

                            {/* Tags: Xe chở người thân / Đón dọc hành lang */}
                            <div className="flex flex-wrap gap-1.5">
                              {trip.hasRelatives && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 type-body">
                                  <HeartHandshake className="w-3 h-3 text-indigo-500" />
                                  <span>Xe chở người thân (Còn {trip.actualAvailableSeats || 1} ghế)</span>
                                </span>
                              )}
                              {trip.isCorridorFallback && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 type-badge">
                                  <span>{t('aiConcierge.s005')}</span>
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 type-body">
                                <Users className="w-3 h-3 text-slate-500" />
                                <span>Khả dụng: {trip.actualAvailableSeats || trip.seats || 1} chỗ</span>
                              </span>
                            </div>

                            {trip.reflection && (
                              <p className="text-amber-900 bg-amber-50/70 p-2 rounded-xl border border-amber-200/60 type-caption">
                                💡 {trip.reflection}
                              </p>
                            )}

                            <div className="flex items-center justify-between text-[#86868b] pt-1.5 border-t border-black/[0.04] type-body">
                              <span className="flex items-center gap-1 type-body">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{trip.timeSlot}</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                {onSelectTrip && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onSelectTrip(trip);
                                      onClose?.();
                                    }}
                                    className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center transition-all cursor-pointer type-button"
                                    title={t('aiConcierge.s012')}
                                  >
                                    {t('aiConcierge.s006')}
                                  </button>
                                )}
                                <a
                                  href={getZaloChatLink(
                                    trip.phoneReal || SITE_INFO.phoneRaw,
                                    `Chào bạn, mình thấy chuyến xe ${trip.from} đi ${trip.to} của bạn trên CarMate, mình muốn đăng ký ghép chỗ!`
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="h-7 px-3 rounded-lg bg-[#0068ff] text-white hover:bg-[#0055d4] inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs type-button"
                                >
                                  <ZaloIcon className="w-3.5 h-3.5 mr-0.5" />
                                  <span>{t('aiConcierge.s007')}</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 rounded-2xl rounded-tl-xs bg-[#f5f5f7] border border-black/[0.06] text-[#515154] flex items-center gap-2 type-caption">
                <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-pulse"></span>
                <span>{t('aiConcierge.s008')}</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="px-4 py-2 border-t border-black/[0.06] bg-[#f5f5f7] shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[#86868b] shrink-0 type-caption">{t('aiConcierge.s009')}</span>
            {QUICK_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(p)}
                disabled={isLoading}
                className="px-3 py-1 rounded-full bg-white border border-black/[0.08] hover:border-black/[0.16] text-[#515154] hover:text-[#1d1d1f] shrink-0 transition-all cursor-pointer shadow-xs active:scale-[0.98] type-button"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-black/[0.06] bg-white shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={t('aiConcierge.s013')}
              disabled={isLoading}
              className="flex-1 h-11 px-4 rounded-xl border border-black/[0.08] bg-[#f5f5f7] hover:bg-[#ebebee] focus:bg-white text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all type-input"
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="h-11 px-5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-40 text-white inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-[0.98] type-button"
            >
              <span>{t('aiConcierge.s010')}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
