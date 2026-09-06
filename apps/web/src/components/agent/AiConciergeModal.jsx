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
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import api from '../../api/client.js';
import { formatVND, getZaloChatLink } from '@carmate/shared';

const QUICK_PROMPTS = [
  'Tìm xe từ Hàng Xanh về Đồng Xoài chiều nay',
  'Giá xăng và vé cầu đường tuyến QL13 hiện khoảng bao nhiêu?',
  'Kiểm tra độ uy tín của tài xế Tuấn Bình Phước',
  'Soạn giúp tôi tin nhắn Zalo hẹn đón lịch sự ở cây xăng'
];

export default function AiConciergeModal({ isOpen, onClose, onSelectTrip }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Dạ xin chào! Mình là **Trợ Lý CarMate AI (AI Concierge)** được tích hợp theo kiến trúc suy luận Agentic.\n\nBạn có thể hỏi bất kỳ lộ trình nào, tra cứu giá san sẻ công bằng, kiểm tra độ uy tín của chủ xe hoặc nhờ mình tìm chuyến ghép tiện đường nhất!',
      reasoningSteps: [
        '1. Khởi tạo: Sẵn sàng nhận diện ngôn ngữ tự nhiên tiếng Việt.',
        '2. Công cụ: Đã kết nối 5 Tools truy xuất cơ sở dữ liệu SQLite và bảng giá tuyến.'
      ],
      suggestedTrips: []
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState({});
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

  const toggleReasoning = (id) => {
    setExpandedReasoning(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.text }));

      const res = await api.agentChat(query, history);
      if (res.success && res.data) {
        const agentMsg = {
          id: `agent-${Date.now()}`,
          role: 'assistant',
          text: res.data.reply,
          reasoningSteps: res.data.reasoningSteps || [],
          suggestedTrips: res.data.suggestedTrips || []
        };
        setMessages(prev => [...prev, agentMsg]);
      } else {
        throw new Error(res.error || 'Không nhận được phản hồi');
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: 'Xin lỗi bạn, hiện tại kết nối đến Trợ lý AI đang bị gián đoạn: ' + (err.message || 'Vui lòng thử lại sau ít giây.'),
          reasoningSteps: ['Lỗi kết nối mạng hoặc máy chủ bận'],
          suggestedTrips: []
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl h-[92vh] sm:h-[680px] flex flex-col rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/90 dark:border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/5 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-primary-600/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Trợ Lý CarMate AI (AI Concierge)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300">
                  AI Dispatcher
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Điều phối ghép xe tự động · Gọi tool tra cứu SQLite & Bảng giá
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-white/10 hover:bg-slate-200/60 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            const hasReasoning = m.reasoningSteps && m.reasoningSteps.length > 0;
            const isExpanded = expandedReasoning[m.id];

            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-150`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-xl bg-primary-100 dark:bg-primary-950/80 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[88%] sm:max-w-[82%] space-y-2.5 ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Reasoning Dropdown (Stanford Inner Loop Trajectory) */}
                  {hasReasoning && !isUser && (
                    <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] overflow-hidden text-xs">
                      <button
                        type="button"
                        onClick={() => toggleReasoning(m.id)}
                        className="w-full px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>Quy trình suy luận của Agent ({m.reasoningSteps.length} bước)</span>
                        </span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="px-3 py-2 border-t border-slate-200/60 dark:border-white/5 space-y-1 bg-white/50 dark:bg-black/20 font-mono text-[10.5px] text-slate-600 dark:text-slate-300">
                          {m.reasoningSteps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-1.5">
                              <span className="text-primary-500 shrink-0">➔</span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main Chat Bubble */}
                  <div
                    className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                      isUser
                        ? 'bg-primary-600 text-white rounded-tr-xs shadow-md shadow-primary-600/20 font-medium'
                        : 'bg-slate-100/90 dark:bg-[#181a24] text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/60 dark:border-white/[0.08] shadow-2xs'
                    }`}
                  >
                    {m.text}
                  </div>

                  {/* Interactive Trip Cards in Chat */}
                  {m.suggestedTrips && m.suggestedTrips.length > 0 && (
                    <div className="space-y-2 pt-1 w-full">
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Chuyến xe phù hợp tìm thấy:
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {m.suggestedTrips.map((trip) => (
                          <div
                            key={trip.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#14161f] shadow-xs hover:border-primary-500/50 transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                  {trip.publicName}
                                </span>
                                <span className="text-[10.5px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-mono">
                                  {trip.carType}
                                </span>
                              </div>
                              <span className="font-mono font-black text-xs text-primary-600 dark:text-primary-400">
                                {formatVND(trip.price)}/ghế
                              </span>
                            </div>

                            <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="font-medium truncate">{trip.from} ➔ {trip.to}</span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{trip.timeSlot}</span>
                              </span>
                              <a
                                href={getZaloChatLink(trip.phoneReal || '0984883750', `Chào bạn, mình thấy chuyến xe ${trip.from} đi ${trip.to} của bạn trên CarMate, mình muốn đăng ký ghép chỗ!`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-7 px-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-bold inline-flex items-center gap-1 text-[11px] transition-all cursor-pointer"
                              >
                                <span>Nhắn Zalo đón</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
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
              <div className="w-7 h-7 rounded-xl bg-primary-100 dark:bg-primary-950/80 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 rounded-2xl rounded-tl-xs bg-slate-100 dark:bg-[#181a24] border border-slate-200/60 dark:border-white/[0.08] text-xs font-mono text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-ping"></span>
                <span>Agent đang suy luận & gọi công cụ tra cứu...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10.5px] font-mono text-slate-400 shrink-0">Gợi ý:</span>
            {QUICK_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(p)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white dark:bg-white/5 border border-slate-200/70 dark:border-white/10 hover:border-primary-500 text-slate-700 dark:text-slate-300 hover:text-primary-600 shrink-0 transition-all cursor-pointer shadow-2xs"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#11131a] shrink-0">
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
              placeholder="Nhập yêu cầu (VD: Tìm xe đi Hải Phòng sáng mai, có mang theo thú cưng...)"
              disabled={isLoading}
              className="flex-1 h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161824] text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="h-11 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-md shadow-primary-600/20 cursor-pointer active:scale-95"
            >
              <span>Gửi</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
