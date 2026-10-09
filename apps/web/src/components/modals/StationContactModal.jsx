import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageSquare,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ShieldCheck,
  ShieldAlert,
  Send,
  X,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
  Car,
  User,
  AlertCircle
} from 'lucide-react';
import { detectPiiLeak } from '@carmate/shared';
import { playMessageChime, playSuccessChime } from '../../utils/audioFeedback.js';
import { useI18n } from '../../i18n/index.jsx';

// List of 1-tap quick message templates at the station (Curbside Quick Chips - Stanford Ergonomics)
const CURBSIDE_QUICK_CHIPS = [
  '📍 Tôi đã đứng sẵn ở sảnh đón trạm xăng',
  '⛽ Tôi đang đứng gần cột bơm xăng số 2',
  '🎒 Tôi có vali / hành lý cần để cốp xe',
  '🚗 Tôi đã thấy xe đang tấp vào sân trạm',
  '⏱️ Tôi chuẩn bị sẵn mã PIN 4 số rồi nhé'
];

export default function StationContactModal({
  isOpen = true,
  onClose,
  boardingPass = {},
  currentHub = {},
  currentUser: _currentUser = null,
  onShowToast = null,
  zIndex = 'z-[9999]'
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'call'
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState(() => [
    {
      id: 'sys-init',
      sender: 'system',
      text: boardingPass?.carInfo?.plate
        ? `Hệ thống: Chuyến đi tiện chuyến #${boardingPass?.pin || ''} đã kết nối. Xe ${boardingPass?.carInfo?.vehicleModel || 'ô tô'} (${boardingPass?.carInfo?.plate}) đang di chuyển tới trạm.`
        : `Hệ thống: Bạn đang trong hàng đợi trạm đón. Kênh liên lạc an toàn với chủ xe sẽ tự động kích hoạt ngay khi có chủ xe nhận đón.`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // In-app call state (In-App VoIP Audio Call)
  const [callState, setCallState] = useState('idle'); // 'idle' | 'ringing' | 'connected' | 'ended'
  const [callSeconds, setCallSeconds] = useState(0);
  const [ringSeconds, setRingSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  const messagesEndRef = useRef(null);

  // Scroll to the bottom of the messages when a new message arrives
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  // Filter that blocks personal information leaks (PII Leak Guard)
  const piiCheck = useMemo(() => {
    if (!inputText.trim()) return { hasLeak: false };
    return detectPiiLeak(inputText);
  }, [inputText]);

  // Timer for call ringing & call duration
  useEffect(() => {
    let timer = null;
    if (callState === 'ringing') {
      timer = setInterval(() => {
        setRingSeconds((prev) => {
          if (prev >= 25) {
            setCallState('ended');
            onShowToast?.('Chủ xe đang tập trung lái xe nên chưa thể nhấc máy. Vui lòng gửi tin nhắn nhanh!');
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else if (callState === 'connected') {
      timer = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState, onShowToast]);

  // Lock page scrolling while the modal is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!isOpen) return null;

  const driverDisplayName = boardingPass?.carInfo?.driverName || 'Chủ xe cá nhân';
  const carDisplayModel = boardingPass?.carInfo?.vehicleModel || 'Xe ô tô gia đình';
  const carDisplayPlate = boardingPass?.carInfo?.plate || 'Đang chờ kết nối';
  const stationName = currentHub?.name || boardingPass?.hubName || 'Trạm đón QL13';

  // Send a free-form message
  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || piiCheck.hasLeak) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'rider',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    playMessageChime();

    // Automatic smart reply from the driver (simulates the vehicle approaching the station)
    setTimeout(() => {
      const driverReplies = [
        'Chủ xe: Đã nhận được thông tin! Xe tôi đang rà phanh tấp vào mép sân trạm, bạn chuẩn bị sẵn mã PIN nhé!',
        'Chủ xe: Tôi đang bật đèn khẩn cấp (hazard) rẽ vào cây xăng, bạn quan sát xe màu trắng nhé.',
        'Chủ xe: Đã thấy vị trí của bạn, 30 giây nữa xe dừng hẳn trước quầy trạm xăng.'
      ];
      const randomReply = driverReplies[Math.floor(Math.random() * driverReplies.length)];
      setMessages((prev) => [
        ...prev,
        {
          id: `reply-${Date.now()}`,
          sender: 'driver',
          text: randomReply,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      playMessageChime();
    }, 1200);
  };

  // Send a 1-tap quick message (Curbside Quick Chip)
  const handleSendQuickChip = (chipText) => {
    const cleanText = chipText.replace(/^[^\w\sÀ-ỹ]+/i, '').trim();
    const newMsg = {
      id: `chip-${Date.now()}`,
      sender: 'rider',
      text: chipText,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, newMsg]);
    playMessageChime();
    onShowToast?.(`Đã gửi: "${cleanText}"`);

    // Reply from the driver
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `reply-${Date.now()}`,
          sender: 'driver',
          text: `Chủ xe: Đã nhận tin "${cleanText}". Xe đang tiếp cận sân trạm an toàn!`,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      playMessageChime();
    }, 1100);
  };

  // Start an in-app voice call
  const handleStartCall = () => {
    setCallState('ringing');
    setRingSeconds(0);
    setCallSeconds(0);
    setIsMuted(false);
    setIsSpeaker(false);
    playMessageChime();
  };

  // Simulate the partner picking up (supports quick testing/demo)
  const handleSimulateAnswer = () => {
    setCallState('connected');
    setCallSeconds(0);
    playSuccessChime();
    onShowToast?.('Chủ xe đã kết nối cuộc gọi thoại an toàn!');
  };

  // End the call
  const handleEndCall = () => {
    setCallState('ended');
    playMessageChime();
    onShowToast?.('Đã kết thúc cuộc gọi thoại.');
  };

  const modalContent = (
    <div
      className={`fixed inset-0 ${zIndex} flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-[#0d0f18] text-white rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* ── MODAL HEADER ── */}
        <header className="p-4 sm:p-5 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0 shadow-xs">
              <Car className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="type-heading text-white truncate">{driverDisplayName}</h3>
                <span className="type-caption px-1.5 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  PIN #{boardingPass?.pin || '8842'}
                </span>
              </div>
              <p className="type-caption text-slate-400 truncate mt-0.5">
                {carDisplayModel} · <strong className="type-body-strong text-slate-200">{carDisplayPlate}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="type-button w-11 h-11 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={t('stationContact.s016')}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* ── APPLE SEGMENTED TAB CAPSULE (CHAT vs VOICE CALL) ── */}
        <div className="p-2.5 border-b border-white/[0.06] bg-black/30">
          <div className="p-1 rounded-2xl bg-white/[0.05] border border-white/[0.06] flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`type-button flex-1 h-9 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                activeTab === 'chat'
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t('stationContact.s001')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('call')}
              className={`type-button flex-1 h-9 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                activeTab === 'call'
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{t('stationContact.s002')}</span>
              {callState === 'connected' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* ── TAB 1 CONTENT: 1-TAP MESSAGES & SECURE CHAT ── */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0c14]">
            {/* PII security warning header */}
            <div className="type-caption px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-emerald-300">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{t('stationContact.s003')}</span>
              </span>
              <span className="type-caption text-emerald-400/80">{t('stationContact.s004')}</span>
            </div>

            {/* Message history lines */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                if (msg.sender === 'system') {
                  return (
                    <div
                      key={msg.id}
                      className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center space-y-1 my-1"
                    >
                      <p className="type-caption text-slate-300">{msg.text}</p>
                      <span className="type-caption text-slate-500 block">{msg.time}</span>
                    </div>
                  );
                }

                const isRider = msg.sender === 'rider';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isRider ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    <div className="type-caption flex items-center gap-1.5 text-slate-400 px-1">
                      <span>{isRider ? 'Bạn (Người đi cùng)' : driverDisplayName}</span>
                      <span>•</span>
                      <span>{msg.time}</span>
                    </div>
                    <div
                      className={`type-caption max-w-[85%] px-3.5 py-2.5 rounded-2xl ${
                        isRider
                          ? 'bg-[#0071e3] text-white rounded-br-xs shadow-md'
                          : 'bg-white/[0.08] text-slate-100 rounded-bl-xs border border-white/[0.08]'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* 1-tap quick message chip frame (Curbside Quick Presets - Stanford 0-Typing) */}
            <div className="p-3 border-t border-white/[0.06] bg-black/20 space-y-2">
              <div className="type-caption flex items-center justify-between text-slate-400 px-0.5">
                <span className="flex items-center gap-1 text-sky-400">
                  <Sparkles className="w-3 h-3" />
                  <span>{t('stationContact.s005')}</span>
                </span>
                <span className="">{t('stationContact.s006')}</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {CURBSIDE_QUICK_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendQuickChip(chip)}
                    className="type-button px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 border border-white/[0.08] text-slate-200 hover:text-white whitespace-nowrap shrink-0 transition-all cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* PII violation warning if the user types a phone number/Zalo */}
            {piiCheck.hasLeak && (
              <div className="type-caption mx-3 mb-2 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-start gap-2 animate-in fade-in">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="type-body space-y-0.5">
                  <span className="block text-rose-200">
                    ⚠️ Phát hiện thông tin liên hệ ngoài sàn ({piiCheck.detectedSample || 'SĐT/Zalo'}):
                  </span>
                  <span>{piiCheck.warningMessage || 'Để bảo vệ an toàn và chống lừa đảo, vui lòng liên lạc trực tiếp trong app!'}</span>
                </div>
              </div>
            )}

            {/* Message input form */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/[0.08] bg-black/40 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={t('stationContact.s017')}
                className="type-input flex-1 h-11 px-3.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || piiCheck.hasLeak}
                className="type-button w-11 h-11 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-30 disabled:hover:bg-sky-500 text-slate-950 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-md active:scale-95"
                title={t('stationContact.s018')}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ── TAB 2 CONTENT: IN-APP VOICE CALL (IN-APP VOIP CALL) ── */}
        {activeTab === 'call' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 bg-[#0a0c14] text-center space-y-6 min-h-[380px]">
            {/* Safety badge */}
            <div className="type-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('stationContact.s007')}</span>
            </div>

            {/* Avatar & ringing sound-wave effect */}
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              {callState === 'ringing' && (
                <>
                  <span className="absolute inset-0 rounded-full bg-sky-500/20 animate-ping" />
                  <span className="absolute -inset-3 rounded-full bg-sky-500/10 animate-pulse" />
                </>
              )}
              {callState === 'connected' && (
                <span className="absolute -inset-2 rounded-full bg-emerald-500/20 animate-pulse" />
              )}
              <div className="type-metric relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-sky-600 to-emerald-500 flex items-center justify-center text-white shadow-xl shadow-sky-500/20 border border-white/20">
                <Car className="w-9 h-9 text-white" />
              </div>
            </div>

            {/* Partner info & call duration */}
            <div className="space-y-1 max-w-xs">
              <h4 className="type-heading text-white">{driverDisplayName}</h4>
              <p className="type-caption text-slate-400">
                {carDisplayModel} ({carDisplayPlate})
              </p>
              <p className="type-caption text-slate-500">
                {t('stationContact.s008')} <strong className="type-body-strong text-slate-300">{stationName}</strong>
              </p>

              <div className="pt-2">
                {callState === 'idle' && (
                  <p className="type-caption text-slate-400">
                    {t('stationContact.s009')}
                  </p>
                )}

                {callState === 'ringing' && (
                  <div className="space-y-1.5">
                    <p className="type-caption text-sky-400 animate-pulse flex items-center justify-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 animate-bounce" />
                      <span>Đang đổ chuông qua App ({ringSeconds}s)...</span>
                    </p>
                    <p className="type-caption text-slate-500">
                      {t('stationContact.s010')}
                    </p>
                  </div>
                )}

                {callState === 'connected' && (
                  <div className="space-y-1">
                    <span className="type-badge px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-block">
                      {t('stationContact.s011')}
                    </span>
                    <p className="type-title text-emerald-400">
                      {Math.floor(callSeconds / 60).toString().padStart(2, '0')}:
                      {(callSeconds % 60).toString().padStart(2, '0')}
                    </p>
                  </div>
                )}

                {callState === 'ended' && (
                  <p className="type-caption text-slate-400">
                    {t('stationContact.s012')}
                  </p>
                )}
              </div>
            </div>

            {/* Call control keypad */}
            <div className="pt-2 w-full max-w-xs flex items-center justify-center gap-4">
              {callState === 'idle' || callState === 'ended' ? (
                <button
                  type="button"
                  onClick={handleStartCall}
                  className="type-button w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>{t('stationContact.s013')}</span>
                </button>
              ) : (
                <>
                  {/* Mute / unmute mic */}
                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    className={`type-button w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                      isMuted
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                    }`}
                    title={isMuted ? 'Mở Mic' : 'Tắt Mic'}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  {/* Turn speakerphone off / on */}
                  <button
                    type="button"
                    onClick={() => setIsSpeaker(!isSpeaker)}
                    className={`type-button w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                      isSpeaker
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                    }`}
                    title={isSpeaker ? 'Tắt Loa Ngoài' : 'Bật Loa Ngoài'}
                  >
                    {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>

                  {/* Large red hang-up button */}
                  <button
                    type="button"
                    onClick={handleEndCall}
                    className="type-button w-14 h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                    title={t('stationContact.s019')}
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            {/* Button to simulate the partner picking up (dev only) */}
            {callState === 'ringing' && import.meta.env.DEV && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSimulateAnswer}
                  className="type-button text-sky-400 hover:text-sky-300 underline cursor-pointer transition-colors"
                >
                  {t('stationContact.s014')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MODAL FOOTER ── */}
        <footer className="type-caption p-3 bg-black/40 border-t border-white/[0.06] text-center text-slate-500">
          {t('stationContact.s015')}
        </footer>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
