import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Inbox,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Copy,
  Check,
  Sparkles,
  ArrowLeft,
  User,
  ShieldCheck,
  Zap,
  MessageSquare,
  AlertCircle,
  ShieldAlert,
  PhoneOff,
  Ban,
  Mail
} from 'lucide-react';
import { formatVND, toPublicAlias, detectPiiLeak, cleanPhoneNumber, getUserOnlineStatus } from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import PresenceDot from '../ui/PresenceDot.jsx';
import api from '../../api/client.js';
import { playMessageChime, playSuccessChime } from '../../utils/audioFeedback.js';

export default function InboxModal({
  isOpen,
  onClose,
  bookings = [],
  currentUser = null,
  onRefreshBookings,
  initialBookingId = null,
  onReportUnreachablePhone = null,
  onShowToast,
  onMarkAsRead = null,
  onMarkAsUnread = null,
  readBookingTimestamps = {},
  unreadBookingIds = []
}) {
  const [selectedId, setSelectedId] = useState(initialBookingId);
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' (Đến) | 'outgoing' (Đi)
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [piiWarning, setPiiWarning] = useState('');
  const [violationInfo, setViolationInfo] = useState(null);
  const [isBannedState, setIsBannedState] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [remainingSecs, setRemainingSecs] = useState(900);
  const messagesEndRef = useRef(null);

  // Cập nhật selectedId khi initialBookingId thay đổi
  useEffect(() => {
    if (initialBookingId) {
      setSelectedId(initialBookingId);
    }
  }, [initialBookingId]);

  // Phân loại danh sách booking: Đến (Chủ xe nhận) và Đi (Khách gửi)
  const { incomingBookings, outgoingBookings } = useMemo(() => {
    const userPhone = currentUser?.phone || '';
    const userId = currentUser?.id || '';

    const incoming = [];
    const outgoing = [];

    bookings.forEach((b) => {
      const isDriver =
        (userPhone && b.driverPhone && b.driverPhone.includes(userPhone)) ||
        (userId && b.driverId === userId) ||
        b.partyRole?.includes('Chủ xe') ||
        b.tripType === 'driver_offer';

      if (isDriver) {
        incoming.push(b);
      } else {
        outgoing.push(b);
      }
    });

    // Nếu môi trường dev chưa đăng nhập, chia đều hoặc hiển thị tất cả
    if (incoming.length === 0 && outgoing.length === 0 && bookings.length > 0) {
      return { incomingBookings: bookings, outgoingBookings: [] };
    }

    return { incomingBookings: incoming, outgoingBookings: outgoing };
  }, [bookings, currentUser]);

  const currentList = activeTab === 'incoming' ? incomingBookings : outgoingBookings;
  const activeBooking = useMemo(() => {
    if (!selectedId) return currentList[0] || null;
    return bookings.find((b) => (b.escrowId || b.id) === selectedId) || currentList[0] || null;
  }, [bookings, selectedId, currentList]);

  // Helper kiểm tra xem 1 cuộc trao đổi có đang ở trạng thái Chưa đọc / Đọc sau hay không
  const isBookingUnread = useMemo(() => {
    const userPhone = currentUser?.phone ? cleanPhoneNumber(currentUser.phone) : '';
    return (itemOrId) => {
      const id = typeof itemOrId === 'string' ? itemOrId : (itemOrId?.escrowId || itemOrId?.id);
      if (!id) return false;

      // 1. Người dùng chủ động gắn cờ Đọc sau (Unread)
      if (unreadBookingIds.includes(id)) return true;

      const booking = typeof itemOrId === 'object' && itemOrId !== null
        ? itemOrId
        : bookings.find((b) => (b.escrowId || b.id) === id);

      const lastRead = readBookingTimestamps?.[id] || 0;
      if (!lastRead) return true; // Chưa từng mở -> Chưa đọc

      // 2. Có tin nhắn mới từ đối phương sau lần đọc cuối
      const hasNewMessage = (booking?.messages || []).some((m) => {
        const isMe = userPhone && cleanPhoneNumber(m.senderPhone || '') === userPhone;
        return !isMe && new Date(m.timestamp).getTime() > lastRead;
      });

      return hasNewMessage;
    };
  }, [unreadBookingIds, bookings, readBookingTimestamps, currentUser]);

  // Đếm số lượng tin chưa đọc theo từng Tab (Đến / Đi)
  const incomingUnreadCount = useMemo(() => {
    return incomingBookings.filter((b) => isBookingUnread(b)).length;
  }, [incomingBookings, isBookingUnread]);

  const outgoingUnreadCount = useMemo(() => {
    return outgoingBookings.filter((b) => isBookingUnread(b)).length;
  }, [outgoingBookings, isBookingUnread]);

  // Thao tác 1-chạm: Đánh dấu Chưa đọc (Đọc sau) / Đánh dấu Đã đọc
  const handleToggleUnread = (targetBookingId = null) => {
    const targetId = targetBookingId || (activeBooking ? (activeBooking.escrowId || activeBooking.id) : null);
    if (!targetId) return;

    const currentlyUnread = isBookingUnread(targetId);
    if (currentlyUnread) {
      onMarkAsRead?.(targetId);
      onShowToast?.('✓ Đã đánh dấu cuộc trò chuyện là đã đọc', 'success');
    } else {
      onMarkAsUnread?.(targetId);
      onShowToast?.('✉️ Đã đánh dấu chưa đọc để bạn xem lại sau', 'info');
    }
  };

  const activeBookingId = activeBooking ? (activeBooking.escrowId || activeBooking.id) : null;
  const isActiveUnread = activeBookingId ? isBookingUnread(activeBooking) : false;

  // Cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeBooking?.messages]);

  // Tự động đánh dấu đã đọc khi xem cuộc hội thoại (trừ khi đang được chủ động gắn cờ Đọc sau)
  useEffect(() => {
    if (activeBooking) {
      const bId = activeBooking.escrowId || activeBooking.id;
      if (bId && !unreadBookingIds.includes(bId)) {
        onMarkAsRead?.(bId);
      }
    }
  }, [activeBooking, onMarkAsRead, unreadBookingIds]);

  // Bộ đếm thời gian thực 15 phút (Soft-lock TTL Countdown)
  useEffect(() => {
    if (!activeBooking || activeBooking.status !== 'pre_confirmed' || !activeBooking.preConfirmedExpiresAt) {
      setTimeLeftStr('');
      setRemainingSecs(900);
      return;
    }

    const interval = setInterval(() => {
      const remainingMs = new Date(activeBooking.preConfirmedExpiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setTimeLeftStr('00:00 (Hết hạn)');
        setRemainingSecs(0);
        clearInterval(interval);
      } else {
        const totalSecs = Math.floor(remainingMs / 1000);
        setRemainingSecs(totalSecs);
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        setTimeLeftStr(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeBooking]);

  // Trí tuệ Bản địa (Edge AI): Nhận diện thỏa thuận đồng thuận chốt chuyến trong chat (< 0.2ms)
  const hasConsensus = useMemo(() => {
    if (!activeBooking || activeBooking.status !== 'inquiring') return false;
    const msgs = activeBooking.messages || [];
    if (msgs.length === 0) return false;

    // Quét 4 tin nhắn gần nhất
    const recentMsgs = msgs.slice(-4);
    const consensusKeywords = [
      /\b(ok|oke|okie|oki)\b/i,
      /\b(chốt|chot)\b/i,
      /\b(đồng ý|dong y)\b/i,
      /\b(nhất trí|nhat tri)\b/i,
      /\b(hẹn anh|hẹn bạn|hẹn em|hen anh|hen em)\b/i,
      /\b(được anh|được em|duoc anh|duoc em|được nha|duoc nha)\b/i,
      /\b(đón em|don em|đón anh|don anh|đón nhé|don nhe)\b/i,
      /\b(giữ chỗ|giu cho)\b/i
    ];

    return recentMsgs.some((m) => {
      if (m.isSystem) return false;
      const txt = (m.text || '').toLowerCase();
      return consensusKeywords.some((regex) => regex.test(txt));
    });
  }, [activeBooking]);

  // Gợi ý tin nhắn thông minh theo ngữ cảnh (Cursor AI Context-Aware Smart Replies)
  const quickResponseChips = useMemo(() => {
    if (activeBooking?.status !== 'inquiring') return [];
    const msgs = activeBooking?.messages || [];
    const myRole = activeTab === 'incoming' ? 'driver' : 'passenger';
    // Lấy tin nhắn gần nhất của đối tác
    const lastPartnerMsg = [...msgs].reverse().find((m) => !m.isSystem && m.senderRole !== myRole);
    const partnerText = (lastPartnerMsg?.text || '').toLowerCase();

    // 1. Phân tích Intent: Hỏi hoặc đề cập đến Hành lý / Vali / Thùng hàng
    if (/(vali|hành lý|hanh ly|đồ đạc|do dac|balo|thùng|thung|cốp|cop)/i.test(partnerText)) {
      if (myRole === 'driver') {
        return [
          '🧳 Cốp xe rộng, để vừa 1 vali to và túi',
          '🎒 Xe chỉ nhận balo gọn thôi nhé bạn',
          '📦 Có nhận thùng đồ nhỏ gửi kèm nha'
        ];
      }
      return [
        '🎒 Em chỉ mang 1 balo nhỏ gọn',
        '🧳 Em có 1 vali size 20 và balo xách tay',
        '📦 Em có 1 thùng quà quê nhỏ gọn thôi ạ'
      ];
    }

    // 2. Phân tích Intent: Điểm đón / Cây xăng / Ngã tư / Trục đường
    if (/(đón ở|don o|chỗ nào|cho nao|ở đâu|o dau|cây xăng|cay xang|ngã tư|nga tu|quốc lộ|quoc lo|tiện đường|tien duong)/i.test(partnerText)) {
      if (myRole === 'driver') {
        return [
          '📍 Đón tại cây xăng/ngã tư trên trục đường chính nhé',
          '📍 Bạn đứng ở cổng chào mình ghé đón',
          '📍 Sau khi chốt chuyến có ngay SĐT để gọi đón'
        ];
      }
      return [
        '📍 Em đứng đợi ở cây xăng ven đường chính',
        '📍 Bạn ghé ngã tư đón giúp em được không?',
        '📍 Em đón đúng điểm hẹn trên đường nhé'
      ];
    }

    // 3. Phân tích Intent: Giờ giấc / Thời gian xuất phát
    if (/(mấy giờ|may gio|khi nào|khi nao|đúng giờ|dung gio|sớm|muộn|trễ|khoảng|chạy chưa|chay chua)/i.test(partnerText)) {
      if (myRole === 'driver') {
        return [
          '⏱️ Xe xuất phát đúng giờ hẹn, bạn ra trước 5p nhé',
          '⏱️ Dự kiến đến điểm đón đúng giờ',
          '⏱️ Xe chạy đúng khung giờ đã thông báo'
        ];
      }
      return [
        '⏱️ Em ra điểm hẹn trước 5 phút chờ xe',
        '⏱️ Khung giờ đó em sẵn sàng xuất phát rồi ạ',
        '⏱️ Bạn cứ thong thả đi, em đợi được ạ'
      ];
    }

    // 4. Phân tích Intent: Đồng ý / Chốt chuyến / Giữ chỗ
    if (/(ok|oke|chốt|chot|đồng ý|dong y|nhất trí|nhat tri|giữ chỗ|giu cho|hẹn)/i.test(partnerText)) {
      if (myRole === 'driver') {
        return [
          '🤝 Nhất trí nhé, mình giữ chỗ cho bạn',
          '✅ Bấm Xác nhận chuyến để trao đổi SĐT đón nha',
          '👍 Đã chốt, hẹn gặp bạn đúng giờ nhé'
        ];
      }
      return [
        '🤝 Dạ ok bạn, chốt giúp em nhé',
        '✅ Em bấm xác nhận giữ chỗ ngay ạ',
        '👍 Nhất trí, em chờ bạn đến đón'
      ];
    }

    // Gợi ý mặc định theo vai trò (Stanford Zero-Thinking Default)
    if (myRole === 'driver') {
      return [
        '👍 Đồng ý đón tại điểm này',
        '⏱️ Xe đến tầm giờ đã hẹn nhé',
        '🧳 Xe chỉ nhận balo/túi gọn'
      ];
    }
    return [
      '📍 Em đón đúng điểm hẹn trên đường',
      '🎒 Em chỉ mang 1 balo nhỏ gọn',
      '🤝 Dạ ok bạn, chốt giúp em nhé'
    ];
  }, [activeBooking?.status, activeBooking?.messages, activeTab]);

  const handleSelectQuickChip = (chipText) => {
    setInputMessage(chipText);
    setPiiWarning('');
  };

  if (!isOpen) return null;

  // Gửi tin nhắn có bảo vệ AI PII và Chế tài Bậc thang (Warning -> -15đ Tín nhiệm -> Ban)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() || sending || !activeBooking) return;

    const bId = activeBooking.escrowId || activeBooking.id;

    setPiiWarning('');
    setSending(true);

    try {
      const senderRole = activeTab === 'incoming' ? 'driver' : 'passenger';
      const senderName = activeTab === 'incoming' ? 'Chủ xe' : 'Người đi cùng';

      await api.sendBookingMessage(bId, {
        text: inputMessage.trim(),
        senderRole,
        senderName
      });

      setInputMessage('');
      setViolationInfo(null);
      playMessageChime();
      onMarkAsRead?.(bId);
      onRefreshBookings?.();
    } catch (err) {
      const vData = err.data || {};
      const strike = vData.strike || 1;
      const isBanned = Boolean(vData.isBanned || err.status === 403);

      setViolationInfo({
        strike,
        level: vData.violationLevel || (isBanned ? 'banned' : strike === 2 ? 'penalty' : 'warning'),
        message: err.message || 'Lỗi gửi tin nhắn',
        trustScore: vData.trustScore,
        isBanned
      });

      if (isBanned) {
        setIsBannedState(true);
      }

      onShowToast?.(
        isBanned
          ? '⛔ Tài khoản của bạn đã bị khóa do vi phạm liên tục!'
          : strike === 2
            ? `🚨 CẢNH CÁO: Đã trừ -15 điểm tín nhiệm (còn ${vData.trustScore || 0}/100)`
            : '⚠️ Cảnh báo: Không chia sẻ thông tin ngoài luồng khi chưa chốt chuyến!'
      );

      onRefreshBookings?.();
    } finally {
      setSending(false);
    }
  };

  // Thao tác 1: Đề xuất chốt & Giữ chỗ 15 phút (Pre-confirm)
  const handlePreConfirm = async () => {
    if (!activeBooking || actionLoading) return;
    const bId = activeBooking.escrowId || activeBooking.id;
    setActionLoading(true);
    try {
      const preConfirmedBy = activeTab === 'incoming' ? 'driver' : 'passenger';
      await api.preConfirmBooking(bId, { preConfirmedBy });
      playSuccessChime();
      onShowToast?.('⚡ Đã đề xuất chốt chuyến & tạm giữ chỗ 15 phút!');
      onRefreshBookings?.();
    } catch (err) {
      onShowToast?.(err.message || 'Lỗi khi đề xuất chốt chuyến');
    } finally {
      setActionLoading(false);
    }
  };

  // Thao tác 2: Xác nhận chốt chuyến chính thức (Final Confirm - Mutual Commit)
  const handleFinalConfirm = async () => {
    if (!activeBooking || actionLoading) return;
    const bId = activeBooking.escrowId || activeBooking.id;
    setActionLoading(true);
    try {
      const confirmedBy = activeTab === 'incoming' ? 'driver' : 'passenger';
      await api.finalConfirmBooking(bId, { confirmedBy });
      playSuccessChime();
      onShowToast?.('🎉 ĐÃ CHỐT CHUYẾN CHÍNH THỨC! Chúc hai bạn chuyến đi an toàn.');
      onRefreshBookings?.();
    } catch (err) {
      onShowToast?.(err.message || 'Lỗi khi xác nhận chốt chuyến');
    } finally {
      setActionLoading(false);
    }
  };

  // Sao chép số điện thoại
  const handleCopyPhone = (phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
    onShowToast?.('✓ Đã sao chép số điện thoại vào bộ nhớ tạm');
  };

  const partnerAlias = activeBooking ? toPublicAlias(activeBooking) : 'Đối tác';
  const partnerPhone = activeBooking?.driverPhone || activeBooking?.contactPhone || activeBooking?.phoneReal || '';
  const isConfirmed = activeBooking?.status === 'confirmed' || activeBooking?.bothConfirmed === true;
  const isPreConfirmed = activeBooking?.status === 'pre_confirmed';
  const activePartnerOnline = activeBooking
    ? getUserOnlineStatus(activeBooking, currentUser?.phone || currentUser?.id)
    : { isOnline: false };

  return (
    <Modal
      onClose={onClose}
      size="xl"
      icon={Inbox}
      iconTone="brand"
      title="Hộp Thư Yêu Cầu & Trao Đổi"
      subtitle="Bảo mật PII 100% · Trao đổi ẩn danh · Khóa mềm 2 pha trước khi chốt"
    >
      <div className="flex flex-col md:flex-row h-[560px] max-h-[75vh] -mx-6 -my-4 overflow-hidden border-t border-black/[0.06] dark:border-white/[0.06]">
        {/* CỘT TRÁI: DANH SÁCH CUỘC HỘI THOẠI */}
        <div className="w-full md:w-[260px] shrink-0 border-r border-black/[0.06] dark:border-white/[0.06] flex flex-col bg-slate-50/70 dark:bg-slate-900/40">
          {/* Tabs Đến / Đi */}
          <div className="p-3 border-b border-black/[0.04] dark:border-white/[0.05] grid grid-cols-2 gap-1.5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setActiveTab('incoming')}
              className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'incoming'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
              }`}
            >
              <span>Yêu cầu Đến</span>
              {incomingBookings.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-1 ${
                  activeTab === 'incoming' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {incomingUnreadCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-blue-400 animate-pulse" title="Có tin chưa đọc" />
                  )}
                  <span>{incomingBookings.length}</span>
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('outgoing')}
              className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'outgoing'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
              }`}
            >
              <span>Yêu cầu Đi</span>
              {outgoingBookings.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-1 ${
                  activeTab === 'outgoing' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {outgoingUnreadCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-blue-400 animate-pulse" title="Có tin chưa đọc" />
                  )}
                  <span>{outgoingBookings.length}</span>
                </span>
              )}
            </button>
          </div>

          {/* Danh sách yêu cầu */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {currentList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <MessageSquare className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-medium">Chưa có yêu cầu nào</p>
                <p className="text-[11px] text-slate-400 mt-1">Các tin nhắn ghép chuyến sẽ hiển thị tại đây</p>
              </div>
            ) : (
              currentList.map((item) => {
                const id = item.escrowId || item.id;
                const isSelected = activeBooking && (activeBooking.escrowId || activeBooking.id) === id;
                const status = item.status || 'inquiring';
                const isUnread = isBookingUnread(item);
                const isManuallyUnread = unreadBookingIds.includes(id);
                const itemOnline = getUserOnlineStatus(item, currentUser?.phone || currentUser?.id);

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      if (selectedId !== id) {
                        setSelectedId(id);
                        onMarkAsRead?.(id);
                      }
                    }}
                    className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer border relative group ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800 border-primary-500/40 shadow-xs ring-1 ring-primary-500/20'
                        : 'bg-white/40 dark:bg-slate-800/30 border-transparent hover:bg-white/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[#0071e3] shrink-0 animate-pulse shadow-xs shadow-primary-500/50" title="Chưa đọc (Đọc sau)" />
                        )}
                        <PresenceDot isOnline={itemOnline.isOnline} size="xs" detail={itemOnline.detail} />
                        <span>{toPublicAlias(item)}</span>
                        {isManuallyUnread && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50 shrink-0">
                            Đọc sau
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleUnread(id);
                          }}
                          className={`p-1 rounded-full transition-all cursor-pointer ${
                            isUnread
                              ? 'text-[#0071e3] bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 ring-1 ring-blue-500/20'
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                          }`}
                          title={isUnread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc để đọc sau'}
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        {status === 'confirmed' ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 shrink-0">
                            Đã chốt
                          </span>
                        ) : status === 'pre_confirmed' ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300/40 shrink-0 animate-pulse">
                            Giữ chỗ 15p
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300/40 shrink-0">
                            Đang hỏi
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate">
                      {item.from} ➔ {item.to}
                    </p>

                    <div className="flex items-center justify-between text-[10.5px] text-slate-400 mt-1.5 pt-1.5 border-t border-black/[0.04] dark:border-white/[0.05]">
                      <span className="tabular font-semibold text-primary-600 dark:text-primary-400">
                        {item.totalDeal ? formatVND(item.totalDeal) : 'Thỏa thuận'}
                      </span>
                      <span>{item.date || 'Hôm nay'}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* CỘT PHẢI: KHUNG TRAO ĐỔI & ĐIỀU PHỐI 2 PHA */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#1c1c1e] min-w-0">
          {!activeBooking ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400">
              <p className="text-xs">Chọn một cuộc trao đổi để xem chi tiết</p>
            </div>
          ) : (
            <>
              {/* Header chi tiết chuyến */}
              <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {partnerAlias}
                    </h3>
                    <PresenceDot isOnline={activePartnerOnline.isOnline} showLabel detail={activePartnerOnline.detail} />
                    <span className="text-[11px] text-slate-500 tabular">#{activeBooking.escrowId || activeBooking.id}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                    {activeBooking.from} ➔ {activeBooking.to} · {activeBooking.seats || 1} ghế · {activeBooking.totalDeal ? formatVND(activeBooking.totalDeal) : ''}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {/* Nút 1-chạm Đánh dấu chưa đọc / Đọc sau */}
                  <button
                    type="button"
                    onClick={() => handleToggleUnread()}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                      isActiveUnread
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-300/60 dark:border-blue-700/60 ring-1 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary-600 dark:hover:text-primary-400'
                    }`}
                    title={isActiveUnread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc để xem lại sau'}
                  >
                    <Mail className={`w-3.5 h-3.5 ${isActiveUnread ? 'text-[#0071e3]' : 'text-slate-500'}`} />
                    <span>{isActiveUnread ? 'Chưa đọc (Đọc sau)' : 'Đọc sau'}</span>
                  </button>

                  {isConfirmed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-300/40">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đã chốt chính thức</span>
                    </span>
                  ) : isPreConfirmed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-300/40 animate-pulse">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Giữ chỗ: {timeLeftStr}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-300/40">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Thương lượng ẩn danh</span>
                    </span>
                  )}
                </div>
              </div>

              {/* THANH ĐIỀU PHỐI 2-PHASE COMMIT (SMART ACTION BAR) */}
              <div className="p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/60 dark:to-slate-800/40 border-b border-black/[0.06] dark:border-white/[0.06]">
                {isConfirmed ? (
                  // ĐÃ CHỐT CHÍNH THỨC: MỞ KHÓA SĐT THẬT
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4" strokeWidth={3} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          Chuyến đi đã chốt thành công 2 chiều!
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          SĐT {partnerAlias}: <strong className="text-slate-900 dark:text-white tabular">{partnerPhone || 'Đã cấp quyền'}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {partnerPhone && (
                        <>
                          <a
                            href={`tel:${partnerPhone}`}
                            className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Gọi điện</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(partnerPhone)}
                            className="py-1.5 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
                          >
                            {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedPhone ? 'Đã chép' : 'Chép SĐT'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : isPreConfirmed ? (
                  // ĐANG Ở BƯỚC PRE-CONFIRM: SOFT-LOCK 15 PHÚT (DYNAMIC ISLAND LIQUID COUNTDOWN)
                  <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-slate-50 dark:from-slate-900/60 dark:to-blue-950/40 border border-blue-200/70 dark:border-blue-800/50 shadow-xs flex-wrap">
                    <div className="flex items-center gap-3">
                      {/* Dynamic Island Capsule */}
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-xs transition-colors ${
                          remainingSecs <= 180
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 animate-pulse'
                            : 'bg-[#0071e3]/10 border-[#0071e3]/20 text-[#0071e3] dark:text-sky-400'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            remainingSecs <= 180 ? 'bg-amber-500 animate-ping' : 'bg-[#0071e3] animate-pulse'
                          }`}
                        />
                        <span className="text-xs font-mono font-black tracking-wider">
                          {timeLeftStr || '15:00'}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {activeTab === 'incoming'
                            ? 'Đang khóa mềm 1 ghế (Chờ khách bấm chốt)'
                            : 'Chủ xe đang giữ chỗ cho bạn'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {activeTab === 'incoming'
                            ? 'Ghế tự động giải phóng nếu khách không chốt trước khi hết giờ.'
                            : 'Bấm xác nhận bên phải để nhận ngay SĐT & Zalo chủ xe!'}
                        </p>
                      </div>
                    </div>

                    {activeTab === 'outgoing' && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleFinalConfirm}
                        className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all shrink-0"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>XÁC NHẬN CHỐT CHUYẾN</span>
                      </button>
                    )}
                  </div>
                ) : (
                  // ĐANG Ở BƯỚC THƯƠNG LƯỢNG (INQUIRING)
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Thỏa thuận điểm hẹn đón & hành lý trước khi chốt</span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Sau khi trao đổi xong, bấm "Đề xuất chốt" để giữ chỗ mềm 15 phút.
                        </p>
                      </div>

                      {activeTab === 'incoming' && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handlePreConfirm}
                          className={`py-2 px-3.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all ${
                            hasConsensus
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white ring-2 ring-amber-400/60 shadow-[0_0_16px_rgba(245,158,11,0.35)] animate-pulse'
                              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 fill-current text-amber-300" />
                          <span>{hasConsensus ? '⚡ Đồng thuận đạt! Giữ chỗ 15p' : 'Đề xuất chốt & Giữ chỗ 15p'}</span>
                        </button>
                      )}
                    </div>

                    {/* Edge AI Ambient Consensus Prompt */}
                    {hasConsensus && activeTab === 'incoming' && (
                      <div className="p-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-medium text-[11.5px]">
                            Trí tuệ bản địa nhận diện hai bên đã thống nhất điểm đón. Hãy bấm giữ chỗ 15p cho khách!
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* KHUNG DANH SÁCH TIN NHẮN */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 dark:bg-slate-900/20">
                {/* Tin nhắn thông báo hệ thống ban đầu */}
                <div className="flex justify-center my-1">
                  <span className="px-3 py-1 rounded-full text-[10.5px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/40">
                    🛡️ Chế độ bảo mật CarMate: SĐT tự động ẩn cho đến khi 2 bên cùng chốt chuyến
                  </span>
                </div>

                {(!activeBooking.messages || activeBooking.messages.length === 0) ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Chưa có tin nhắn nào. Hãy nhắn tin để thỏa thuận điểm đón!
                  </div>
                ) : (
                  activeBooking.messages.map((msg, idx) => {
                    const isSystem = msg.isSystem || msg.senderRole === 'system';
                    const isMe = (activeTab === 'incoming' && msg.senderRole === 'driver') ||
                                 (activeTab === 'outgoing' && msg.senderRole === 'passenger');

                    if (isSystem) {
                      return (
                        <div key={msg.id || idx} className="flex justify-center my-2">
                          <div className="max-w-[85%] p-2.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/50 text-indigo-900 dark:text-indigo-200 text-xs leading-relaxed text-center">
                            <span className="font-bold mr-1">ℹ️ Thông báo:</span>
                            {msg.text}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-[10px] text-slate-400 mb-0.5 px-1">
                          {msg.senderName || (isMe ? 'Tôi' : partnerAlias)}
                        </span>
                        <div
                          className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                            isMe
                              ? 'bg-primary-600 text-white rounded-tr-xs shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/60 rounded-tl-xs shadow-2xs'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                {isConfirmed && partnerPhone && (
                  <div className="my-3 p-3.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-xs text-center space-y-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                        ✓
                      </span>
                      <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                        Chuyến đi đã chốt thành công!
                      </p>
                    </div>
                    <div className="py-0.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Số điện thoại liên hệ {partnerAlias}:</p>
                      <p className="text-lg font-mono font-bold text-slate-900 dark:text-white tabular tracking-tight">
                        {partnerPhone}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={`tel:${partnerPhone}`}
                        className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Gọi điện</span>
                      </a>
                      <a
                        href={`sms:${partnerPhone}`}
                        className="py-2 px-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Nhắn SMS</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(partnerPhone)}
                        className="py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
                      >
                        {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPhone ? 'Đã chép' : 'Chép'}</span>
                      </button>
                    </div>
                    {/* Stanford Empathy Tip & Hướng dẫn liên lạc văn minh */}
                    <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-100/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-[11.5px] text-emerald-900 dark:text-emerald-200 text-left leading-relaxed">
                      💡 <strong>Mẹo liên hệ:</strong> Đối tác có thể đang lái xe hoặc bận việc. Nếu chưa gọi được ngay, bạn hãy gửi tin nhắn Zalo/SMS để đối tác liên hệ lại nhé!
                    </div>

                    {onReportUnreachablePhone && (
                      <div className="pt-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            onReportUnreachablePhone(activeBooking);
                            onClose();
                          }}
                          className="text-[11.5px] text-slate-500 hover:text-[#0071e3] dark:text-slate-400 dark:hover:text-[#2997ff] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>Chưa thấy đối tác phản hồi hoặc cần hỗ trợ?</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* CẢNH BÁO AI PII VÀ CHẾ TÀI BẬC THANG */}
              {violationInfo ? (
                <div
                  className={`px-4 py-2.5 border-t text-xs flex items-start gap-2.5 anim-shake ${
                    violationInfo.isBanned || violationInfo.strike >= 3
                      ? 'bg-rose-100 dark:bg-rose-950/80 border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-100'
                      : violationInfo.strike === 2
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                        : 'bg-amber-50 dark:bg-amber-950/70 border-amber-200/80 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  {violationInfo.isBanned || violationInfo.strike >= 3 ? (
                    <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : violationInfo.strike === 2 ? (
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold">
                        {violationInfo.isBanned || violationInfo.strike >= 3
                          ? 'Khóa tài khoản vĩnh viễn (Cấp 3):'
                          : violationInfo.strike === 2
                            ? 'Cảnh cáo nghiêm trọng (Cấp 2):'
                            : 'Cảnh báo quy chế (Cấp 1):'}
                      </p>
                      {violationInfo.strike === 2 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 text-[10px] font-mono font-bold">
                          -15 Điểm Tín Nhiệm
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed mt-0.5">{violationInfo.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViolationInfo(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
              ) : piiWarning ? (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/70 border-t border-amber-200/80 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2 anim-shake">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Nhắc nhở an toàn từ CarMate AI:</p>
                    <p className="text-[11px] leading-relaxed mt-0.5">{piiWarning}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPiiWarning('')}
                    className="text-amber-600 hover:text-amber-800 text-xs font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
              ) : null}

              {/* ZERO-TYPING QUICK RESPONSE CHIPS */}
              {activeBooking.status !== 'completed' && quickResponseChips.length > 0 && (
                <div className="px-3 pt-2 pb-1 bg-slate-50/90 dark:bg-[#181920] border-t border-black/[0.04] dark:border-white/[0.04] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[10.5px] font-bold text-slate-400 shrink-0 mr-0.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary-500" /> Gợi ý:
                  </span>
                  {quickResponseChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectQuickChip(chip)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-primary-500/50 hover:text-primary-600 dark:hover:text-primary-400 active:scale-95 transition-all shrink-0 cursor-pointer shadow-2xs"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {/* KHUNG NHẬP TIN NHẮN HOẶC TRẠNG THÁI KHÓA */}
              {isBannedState || currentUser?.isBanned || activeBooking.isBanned ? (
                <div className="p-3.5 border-t border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-center gap-2 font-medium">
                  <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>⛔ Tài khoản của bạn đã bị khóa do cố tình vi phạm quy chế bảo mật thông tin liên tục.</span>
                </div>
              ) : (
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 border-t border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-[#1c1c1e] flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputMessage}
                    disabled={isConfirmed && activeBooking.status === 'completed'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInputMessage(val);
                      if (!isConfirmed && val.trim()) {
                        const check = detectPiiLeak(val);
                        if (check.hasLeak) {
                          setPiiWarning(check.warningMessage);
                        } else if (piiWarning) {
                          setPiiWarning('');
                        }
                      } else if (piiWarning) {
                        setPiiWarning('');
                      }
                    }}
                    placeholder={
                      isConfirmed
                        ? 'Nhắn tin cập nhật điểm đón / chuẩn bị lên xe...'
                        : 'Thỏa thuận điểm đón, hành lý (SĐT tự động bảo mật)...'
                    }
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 transition-all outline-hidden"
                  />

                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || sending}
                    className="p-2.5 rounded-2xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-white disabled:opacity-40 transition-all cursor-pointer shadow-xs"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
