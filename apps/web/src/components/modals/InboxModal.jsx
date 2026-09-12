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
  Mail,
  MailOpen,
  MapPin,
  Headphones,
  LifeBuoy,
  HelpCircle,
  Mic,
  MicOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import {
  formatVND,
  toPublicAlias,
  detectPiiLeak,
  cleanPhoneNumber,
  getUserOnlineStatus,
  formatCleanDateLabel,
  MIN_CALL_DURATION_FOR_EMERGENCY,
  REQUIRED_UNANSWERED_CALLS,
  recordCallAttempt,
  getEmergencyCallStatus
} from '@carmate/shared';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import PresenceDot from '../ui/PresenceDot.jsx';
import api from '../../api/client.js';
import { playMessageChime, playSuccessChime } from '../../utils/audioFeedback.js';
import DisputeNoticeModal from './DisputeNoticeModal.jsx';
import { useI18n } from '../../i18n/index.jsx';

export default function InboxModal({
  isOpen,
  onClose,
  bookings = [],
  currentUser = null,
  onRefreshBookings,
  initialBookingId = null,
  autoCall = false,
  onShowToast,
  onMarkAsRead = null,
  onMarkAsUnread = null,
  readBookingTimestamps = {},
  unreadBookingIds = [],
  onNavigateTab = null
}) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState(initialBookingId);
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(initialBookingId));
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' (Đến) | 'outgoing' (Đi)
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [piiWarning, setPiiWarning] = useState('');
  const [violationInfo, setViolationInfo] = useState(null);
  const [isBannedState, setIsBannedState] = useState(false);
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [remainingSecs, setRemainingSecs] = useState(900);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, booking }

  // Trạng thái Gọi thoại trực tiếp trong App (0đ cước · Bảo mật 100% SĐT)
  const [inAppCallState, setInAppCallState] = useState(null); // null | { status: 'ringing' | 'connected', seconds: 0, ringSeconds: 0, isMuted: false, isSpeaker: false, isTimeout?: boolean }
  const [emergencyCallVersion, setEmergencyCallVersion] = useState(0);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const handleCopyPhone = (phone) => {
    if (!phone) return;
    navigator.clipboard?.writeText?.(phone);
    setCopiedPhone(true);
    onShowToast?.('✓ Đã sao chép số điện thoại', 'success');
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  useEffect(() => {
    let timer = null;
    if (inAppCallState) {
      timer = setInterval(() => {
        setInAppCallState((prev) => {
          if (!prev) return null;
          if (prev.status === 'ringing') {
            const nextRing = (prev.ringSeconds || 0) + 1;
            if (nextRing >= 35) {
              return { ...prev, ringSeconds: nextRing, seconds: nextRing, isTimeout: true };
            }
            return { ...prev, ringSeconds: nextRing, seconds: nextRing };
          }
          if (prev.status === 'connected') {
            return { ...prev, seconds: (prev.seconds || 0) + 1 };
          }
          return prev;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [inAppCallState?.status]);

  // Kênh Hỗ Trực Tiếp Platform CSKH CarMate & Kháng Nghị (Dispute)
  const [isSupportChannelActive, setIsSupportChannelActive] = useState(false);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportInput, setSupportInput] = useState('');
  const [loadingSupport, setLoadingSupport] = useState(false);
  const [sendingSupport, setSendingSupport] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeTargetNotice, setDisputeTargetNotice] = useState(null);

  const messagesEndRef = useRef(null);

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

  // Cập nhật selectedId khi initialBookingId thay đổi
  useEffect(() => {
    if (initialBookingId) {
      if (initialBookingId === 'support') {
        setIsSupportChannelActive(true);
      } else {
        setIsSupportChannelActive(false);
        setSelectedId(initialBookingId);
        const isOut = outgoingBookings.some((b) => (b.escrowId || b.id) === initialBookingId);
        if (isOut) {
          setActiveTab('outgoing');
        } else {
          setActiveTab('incoming');
        }
      }
      setMobileShowChat(true);
    }
  }, [initialBookingId, outgoingBookings]);

  const currentList = activeTab === 'incoming' ? incomingBookings : outgoingBookings;
  const activeBooking = useMemo(() => {
    if (!selectedId) return currentList[0] || null;
    return currentList.find((b) => (b.escrowId || b.id) === selectedId) || currentList[0] || null;
  }, [currentList, selectedId]);

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

      // 2. Chuyến đã hoàn thành hoặc hủy trong quá khứ không tính là chưa đọc (trừ khi chủ động gắn cờ Đọc sau)
      if (booking?.status === 'completed' || booking?.status === 'cancelled') {
        return false;
      }

      const lastRead = readBookingTimestamps?.[id] || 0;
      if (!lastRead) return true; // Chưa từng mở -> Chưa đọc

      // 3. Có tin nhắn mới từ đối phương sau lần đọc cuối
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

  // Chuột phải mở menu ngữ cảnh chuẩn Cursor / Apple
  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 220;
    const menuHeight = 190;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 12);
    setContextMenu({ x, y, booking: item });
  };

  // Tự động đóng menu ngữ cảnh khi click ra ngoài, cuộn trang hoặc bấm Esc
  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Phím tắt Ambient Cursor: Phím U chuyển đổi trạng thái Chưa đọc / Đọc sau
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) {
        return;
      }
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        handleToggleUnread();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBooking, unreadBookingIds, readBookingTimestamps]);

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
      /\b(giữ chỗ|giu cho)\b/i,
      /\b(điểm hẹn|diem hen|cây xăng|cay xang|ngã tư|nga tu|bến xe|ben xe|quốc lộ|quoc lo|tiện đường|tien duong)\b/i,
      /\b(balo|vali|túi|hành lý|hanh ly|cốp xe|cop xe)\b/i
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

    // 0. Phân tích Intent: Gửi đồ / Thùng hàng / Xe tải / Xe máy / Nông sản / Chành xe
    const isCargoBooking = Boolean(
      activeBooking?.isCargoBooking ||
      activeBooking?.cargoType ||
      activeBooking?.vehicleType === 'truck_light'
    );
    if (isCargoBooking || /(gửi đồ|gui do|chở hàng|cho hang|thùng xốp|thung xop|xe tải|xe tai|chành|chanh|xe máy|xe may|xe điện|xe dien|bán tải|ban tai|kiện|nông sản|nong san|chuyển trọ|chuyen tro)/i.test(partnerText)) {
      if (myRole === 'driver') {
        return [
          '🚛 Xe tải quay đầu rỗng thùng, nhận chở tiện chuyến giá mềm',
          '🛵 Có dây tăng đơ chằng buộc xe máy cố định chống trầy xước',
          '🌾 Nhận chở nông sản vài tạ đến 1 tấn, có bạt che kín',
          '📦 Bạn dán tên & SĐT người nhận lên kiện hàng nhé',
          '✅ Bấm xác nhận chuyến để lấy SĐT gọi trực tiếp giao nhận nha'
        ];
      }
      return [
        '🛵 Em muốn gửi 1 chiếc xe máy (rút bớt xăng) về quê ạ',
        '🌾 Em có mấy bao nông sản gửi từ Bình Phước về Miền Tây',
        '📦 Đồ của em đã bọc kín băng dính cẩn thận sẵn ạ',
        '📍 Người nhận sẽ ra đón xe nhận đồ dọc trục Tuyến N2 / QL ạ',
        '✅ Em bấm xác nhận gửi hàng ngay ạ'
      ];
    }

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

  const isConfirmed = activeBooking?.status === 'confirmed' || activeBooking?.bothConfirmed === true;
  const isPreConfirmed = activeBooking?.status === 'pre_confirmed';
  const isDealCommitted = isConfirmed || isPreConfirmed;

  const isTargetPassengerTrip = activeBooking?.targetTrip?.type === 'passenger_request' || activeBooking?.targetItem?.type === 'passenger_request';

  // Kiểm tra đối tác đã có ít nhất 1 tin nhắn phản hồi (tương tác 2 chiều giữa bên ra kèo và bên ghép)
  const hasPartnerReplied = useMemo(() => {
    if (!activeBooking?.messages || activeBooking.messages.length === 0) return false;
    const userPhone = currentUser?.phone ? cleanPhoneNumber(currentUser.phone) : '';
    const myRole = activeTab === 'incoming'
      ? (isTargetPassengerTrip ? 'passenger' : 'driver')
      : (isTargetPassengerTrip ? 'driver' : 'passenger');
    return activeBooking.messages.some((m) => {
      if (userPhone && m.senderPhone) {
        return cleanPhoneNumber(m.senderPhone) !== userPhone;
      }
      return m.senderRole && m.senderRole !== myRole;
    });
  }, [activeBooking?.messages, activeTab, currentUser, isTargetPassengerTrip]);

  // Cảnh báo đối tác phản hồi chậm (> 3 phút sau tin nhắn đầu tiên của mình mà chưa ai trả lời)
  const isPartnerStale = useMemo(() => {
    if (hasPartnerReplied || !activeBooking?.messages || activeBooking.messages.length === 0) return false;
    const firstMsgTime = activeBooking.messages[0]?.timestamp
      ? new Date(activeBooking.messages[0].timestamp).getTime()
      : 0;
    if (!firstMsgTime) return false;
    return Date.now() - firstMsgTime > 3 * 60 * 1000;
  }, [hasPartnerReplied, activeBooking?.messages]);

  const partnerAlias = useMemo(() => {
    if (!activeBooking) return 'Đối tác';
    // Nếu là bài đăng của mình (incoming): đối tác là người gửi yêu cầu đến
    if (activeTab === 'incoming') {
      if (isTargetPassengerTrip) {
        // Bài đăng của mình là tìm xe -> đối tác gửi đến là Chủ xe
        if (isConfirmed) {
          return activeBooking.driverName || 'Chủ xe';
        }
        const code = String(activeBooking.escrowId || activeBooking.id || '').replace(/\D/g, '').slice(-3) || '01';
        return `Chủ xe CX-${code}`;
      } else {
        // Bài đăng của mình là xe trống -> đối tác gửi đến là Khách
        if (isConfirmed) {
          return activeBooking.passengerName || activeBooking.userName || activeBooking.contactName || 'Người đi cùng';
        }
        const code = String(activeBooking.escrowId || activeBooking.id || '').replace(/\D/g, '').slice(-3) || '01';
        return `Khách KX-${code}`;
      }
    }
    // Nếu là yêu cầu mình gửi đi (outgoing): đối tác là chủ bài đăng
    if (isTargetPassengerTrip) {
      // Mình gửi đề xuất đón cho 1 Khách -> đối tác là Khách
      if (isConfirmed) {
        return activeBooking.passengerName || 'Người đi cùng';
      }
      const code = String(activeBooking.targetTrip?.id || activeBooking.targetItem?.id || '').replace(/\D/g, '').slice(-3) || '01';
      return `Khách KX-${code}`;
    } else {
      // Mình gửi yêu cầu ghép cho 1 Chủ xe -> đối tác là Chủ xe
      if (isConfirmed) {
        return activeBooking.driverName || activeBooking.targetTrip?.driverName || activeBooking.contactName || toPublicAlias(activeBooking);
      }
      return toPublicAlias(activeBooking);
    }
  }, [activeBooking, activeTab, isConfirmed, isTargetPassengerTrip]);

  const partnerPhone = useMemo(() => {
    if (!activeBooking) return '';
    if (activeTab === 'incoming') {
      return isTargetPassengerTrip
        ? (activeBooking.driverPhone || '')
        : (activeBooking.passengerPhone || activeBooking.userPhone || activeBooking.phone || '');
    }
    return isTargetPassengerTrip
      ? (activeBooking.passengerPhone || activeBooking.contactPhone || '')
      : (activeBooking.driverPhone || activeBooking.contactPhone || activeBooking.phoneReal || '');
  }, [activeBooking, activeTab, isTargetPassengerTrip]);

  const bookingKey = activeBooking ? (activeBooking.escrowId || activeBooking.id) : null;
  const callerKey = currentUser?.phone || currentUser?.id || 'guest_caller';

  const emergencyCallStatus = useMemo(() => {
    if (!bookingKey || !callerKey) {
      return { isUnlocked: false, attempts: 0, remainingAttempts: REQUIRED_UNANSWERED_CALLS };
    }
    return getEmergencyCallStatus({ bookingId: bookingKey, callerId: callerKey });
  }, [bookingKey, callerKey, emergencyCallVersion]);

  const isEmergencyPhoneUnlockedForMe = Boolean(isConfirmed && emergencyCallStatus?.isUnlocked && partnerPhone);

  const handleStartInAppCall = () => {
    setInAppCallState({
      status: 'ringing',
      seconds: 0,
      ringSeconds: 0,
      isMuted: false,
      isSpeaker: false
    });
    playMessageChime();
  };

  const handleSimulatePartnerAnswer = () => {
    if (inAppCallState?.status === 'ringing') {
      setInAppCallState((prev) => (prev ? { ...prev, status: 'connected', seconds: 0 } : null));
      playSuccessChime();
    }
  };

  const handleEndInAppCall = () => {
    if (!inAppCallState) return;

    const ringSec = inAppCallState.ringSeconds || 0;
    const wasRinging = inAppCallState.status === 'ringing';

    setInAppCallState(null);

    if (wasRinging) {
      const bKey = bookingKey;
      const cKey = callerKey;

      if (ringSec < MIN_CALL_DURATION_FOR_EMERGENCY) {
        onShowToast?.(
          `⚠️ Bạn chỉ mới đổ chuông ${ringSec}s (< ${MIN_CALL_DURATION_FOR_EMERGENCY}s). Cần đổ chuông tối thiểu ${MIN_CALL_DURATION_FOR_EMERGENCY}s để đối tác kịp nhấc máy.`,
          'warning'
        );
      } else {
        const res = recordCallAttempt({
          bookingId: bKey,
          callerId: cKey,
          durationSeconds: ringSec,
          answered: false
        });
        setEmergencyCallVersion((v) => v + 1);

        if (res.isUnlocked) {
          playSuccessChime();
          onShowToast?.(
            `🚨 Đã mở khoá Số điện thoại khẩn cấp của ${partnerAlias || 'đối tác'} cho riêng bạn (sau 2 lần gọi ≥25s không phản hồi).`,
            'success'
          );
        } else {
          onShowToast?.(
            `📞 Đã ghi nhận cuộc gọi nhỡ (đổ chuông ${ringSec}s - Lần ${res.attempts}/${REQUIRED_UNANSWERED_CALLS}). Hãy gọi lại lần 2 (≥25s) nếu đối tác vẫn không nhấc máy.`,
            'info'
          );
        }
      }
    }
  };

  // Tự động kết thúc cuộc gọi khi đổ chuông quá 35s không nghe máy
  useEffect(() => {
    if (inAppCallState?.isTimeout && inAppCallState.status === 'ringing') {
      handleEndInAppCall();
    }
  }, [inAppCallState?.isTimeout, inAppCallState?.status]);

  // Tự động kích hoạt cuộc gọi in-app nếu được yêu cầu từ ngoài
  useEffect(() => {
    if (autoCall && activeBooking && !inAppCallState) {
      handleStartInAppCall();
    }
  }, [autoCall, activeBooking?.escrowId, activeBooking?.id]);

  const activePartnerOnline = activeBooking
    ? getUserOnlineStatus(activeBooking, currentUser?.phone || currentUser?.id)
    : { isOnline: false };

  const handleSelectQuickChip = (chipText) => {
    setInputMessage(chipText);
    setPiiWarning('');
  };

  // Mở khóa và khôi phục tài khoản 1-chạm (MIT & Stanford Ergonomics)
  const handleResetBan = async () => {
    const bId = activeBooking ? (activeBooking.escrowId || activeBooking.id) : null;
    try {
      if (bId) {
        await api.resetBookingBan(bId);
      }
      setIsBannedState(false);
      setViolationInfo(null);
      if (activeBooking) {
        activeBooking.isBanned = false;
        activeBooking.piiStrikes = {};
      }
      onShowToast?.('✓ Đã khôi phục tài khoản và mở khóa trò chuyện thành công.', 'success');
      onRefreshBookings?.();
    } catch {
      setIsBannedState(false);
      setViolationInfo(null);
      if (activeBooking) {
        activeBooking.isBanned = false;
      }
      onShowToast?.('✓ Đã mở lại giao diện trò chuyện', 'info');
      onRefreshBookings?.();
    }
  };

  // Tải danh sách tin nhắn Kênh Hỗ Trợ CSKH Platform
  const loadSupportMessages = async () => {
    setLoadingSupport(true);
    try {
      const bId = activeBooking ? (activeBooking.escrowId || activeBooking.id) : undefined;
      const res = await api.getSupportMessages({
        userId: currentUser?.id,
        phone: currentUser?.phone,
        bookingId: bId
      });
      if (res?.data && Array.isArray(res.data)) {
        setSupportMessages(res.data);
      }
    } catch {
      setSupportMessages([
        {
          id: 'SUP-LOCAL',
          senderRole: 'platform',
          senderName: 'CSKH CarMate (Trực tuyến 24/7)',
          message: '👋 Xin chào bạn! Kênh Hỗ Trợ Khẩn Cấp CarMate sẵn sàng 24/7. Nếu tài khoản của bạn bị khóa nhầm ("khóa lộn") hoặc có khiếu nại về cảnh báo PII, hãy nhắn tin trực tiếp tại đây nhé!',
          createdAt: Date.now()
        }
      ]);
    } finally {
      setLoadingSupport(false);
    }
  };

  useEffect(() => {
    if (isSupportChannelActive) {
      loadSupportMessages();
    }
  }, [isSupportChannelActive]);

  // Gửi tin nhắn đến Platform CSKH & Tự động xử lý khiếu nại (Ambient Resolution)
  const handleSendSupportMessage = async (e, customText = null) => {
    e?.preventDefault();
    const textToSend = (customText || supportInput).trim();
    if (!textToSend || sendingSupport) return;

    setSendingSupport(true);
    try {
      const bId = activeBooking ? (activeBooking.escrowId || activeBooking.id) : null;
      const res = await api.sendSupportMessage({
        text: textToSend,
        bookingId: bId,
        userId: currentUser?.id,
        phone: currentUser?.phone,
        senderName: currentUser?.name || 'Thành viên'
      });

      if (res?.data) {
        setSupportMessages((prev) => [
          ...prev,
          res.data.userMessage,
          ...(res.data.platformReply ? [res.data.platformReply] : [])
        ]);

        if (res.data.isUnbanned) {
          setIsBannedState(false);
          setViolationInfo(null);
          if (activeBooking) {
            activeBooking.isBanned = false;
            activeBooking.piiStrikes = {};
          }
          onShowToast?.('✓ Đã khôi phục tài khoản thành công qua Kênh CSKH Platform!', 'success');
          onRefreshBookings?.();
        }
      }
      setSupportInput('');
      playMessageChime();
    } catch (err) {
      onShowToast?.(err.message || 'Không thể gửi tin nhắn hỗ trợ', 'error');
    } finally {
      setSendingSupport(false);
    }
  };

  if (!isOpen) return null;

  // Gửi tin nhắn có bảo vệ AI PII và Chế tài Bậc thang (Warning -> -15đ Tín nhiệm -> Ban)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() || sending || !activeBooking) return;

    const bId = activeBooking.escrowId || activeBooking.id;

    // Khi người dùng bấm Enter/Gửi: Chỉ kiểm duyệt PII khi chuyến đi còn đang ở giai đoạn thương lượng ban đầu
    // Nếu chuyến đi đã được đề xuất chốt / giữ chỗ 15p (pre_confirmed) hoặc đã chốt chính thức (confirmed),
    // hai bên hoàn toàn được phép gửi số điện thoại, Zalo, địa chỉ đón chi tiết mà không bị chặn hay phạt!
    if (!isDealCommitted) {
      const check = detectPiiLeak(inputMessage.trim());
      if (check.hasLeak) {
        setPiiWarning(check.warningMessage);
        onShowToast?.('⚠️ Vui lòng bấm [Đề xuất chốt & Giữ chỗ 15p] trước khi chia sẻ số điện thoại nhé!', 'warning');
        return;
      }
    }

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



  return (
    <Modal
      onClose={onClose}
      size="5xl"
      icon={Inbox}
      iconTone="brand"
      title={t('inbox.s059')}
      subtitle={t('inbox.s060')}
    >
      <div className="flex flex-col md:flex-row h-[600px] max-h-[78vh] -mx-6 -my-4 overflow-hidden border-t border-black/[0.06] dark:border-white/[0.06]">
        {/* CỘT TRÁI: DANH SÁCH CUỘC HỘI THOẠI */}
        <div className={`w-full md:w-[320px] lg:w-[340px] shrink-0 border-r border-black/[0.06] dark:border-white/[0.06] flex flex-col bg-slate-50/70 dark:bg-slate-900/40 ${
          mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Tabs Đến / Đi: Apple Liquid Segmented Control */}
          <div className="p-2.5 border-b border-black/[0.04] dark:border-white/[0.05] bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <div className="p-1 rounded-2xl bg-black/[0.05] dark:bg-white/[0.06] grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('incoming');
                  setSelectedId(null);
                  setMobileShowChat(false);
                }}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                  activeTab === 'incoming'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{t('inbox.s001')}</span>
                {incomingUnreadCount > 0 ? (
                  <span
                    className="text-[10.5px] font-mono px-1.5 py-0.2 rounded-full font-bold flex items-center gap-1 bg-[#0071e3] text-white shadow-2xs"
                    title={`${incomingUnreadCount} tin chưa đọc`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                    <span>{incomingUnreadCount}</span>
                  </span>
                ) : incomingBookings.length > 0 ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-medium bg-black/[0.05] dark:bg-white/[0.08] text-slate-500 dark:text-slate-400">
                    {incomingBookings.length}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('outgoing');
                  setSelectedId(null);
                  setMobileShowChat(false);
                }}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                  activeTab === 'outgoing'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{t('inbox.s002')}</span>
                {outgoingUnreadCount > 0 ? (
                  <span
                    className="text-[10.5px] font-mono px-1.5 py-0.2 rounded-full font-bold flex items-center gap-1 bg-[#0071e3] text-white shadow-2xs"
                    title={`${outgoingUnreadCount} tin chưa đọc`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                    <span>{outgoingUnreadCount}</span>
                  </span>
                ) : outgoingBookings.length > 0 ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-medium bg-black/[0.05] dark:bg-white/[0.08] text-slate-500 dark:text-slate-400">
                    {outgoingBookings.length}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {/* Gợi ý Ambient Cursor: Chuột phải / Phím U để đổi trạng thái & Đọc hết */}
          <div className="px-3.5 py-1.5 bg-black/[0.02] dark:bg-white/[0.02] text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-b border-black/[0.04] dark:border-white/[0.05]">
            <span className="flex items-center gap-1.5 truncate">
              <span>{t('inbox.s003')}</span>
              <kbd className="px-1.5 py-0.2 rounded-md bg-white dark:bg-slate-700 font-mono text-[9.5px] border border-black/10 dark:border-white/10 shadow-2xs font-bold text-slate-700 dark:text-slate-200">
                U
              </kbd>
              <span>{t('inbox.s004')}</span>
            </span>
            {currentList.some((b) => isBookingUnread(b)) && (
              <button
                type="button"
                onClick={() => {
                  currentList.forEach((b) => {
                    const bId = b.escrowId || b.id;
                    if (isBookingUnread(b)) onMarkAsRead?.(bId);
                  });
                  onShowToast?.('✓ Đã đánh dấu tất cả hội thoại là đã đọc', 'success');
                }}
                className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline shrink-0 font-medium cursor-pointer"
                title={t('inbox.s061')}
              >
                {t('inbox.s005')}
              </button>
            )}
          </div>

          {/* Danh sách yêu cầu */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {/* KÊNH GHIM: CSKH CARMATE TRỰC TUYẾN 24/7 (PLATFORM SUPPORT) */}
            <button
              type="button"
              onClick={() => {
                setIsSupportChannelActive(true);
                setMobileShowChat(true);
              }}
              className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer border relative group mb-1 ${
                isSupportChannelActive
                  ? 'bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-950/50 dark:to-indigo-950/50 border-primary-500 shadow-xs ring-1 ring-primary-500/30'
                  : 'bg-primary-50/40 dark:bg-primary-950/20 border-primary-500/20 hover:bg-primary-50/70 hover:border-primary-500/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#0071e3] to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Headphones className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                      <span>CSKH CarMate</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title={t('inbox.s062')} />
                    </span>
                    <span className="text-[9.5px] font-bold text-primary-600 dark:text-primary-400 bg-primary-100/80 dark:bg-primary-900/50 px-1.5 py-0.2 rounded-full font-mono">
                      24/7
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {t('inbox.s006')}
                  </p>
                </div>
              </div>
            </button>

            {currentList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <MessageSquare className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-medium">{t('inbox.s007')}</p>
                <p className="text-[11px] text-slate-400 mt-1">{t('inbox.s008')}</p>
              </div>
            ) : (
              currentList.map((item) => {
                const id = item.escrowId || item.id;
                const isSelected = !isSupportChannelActive && activeBooking && (activeBooking.escrowId || activeBooking.id) === id;
                const status = item.status || 'inquiring';
                const isUnread = isBookingUnread(item);
                const isManuallyUnread = unreadBookingIds.includes(id);
                const itemOnline = getUserOnlineStatus(item, currentUser?.phone || currentUser?.id);

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setIsSupportChannelActive(false);
                      if (selectedId !== id) {
                        setSelectedId(id);
                        onMarkAsRead?.(id);
                      }
                      setMobileShowChat(true);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer border relative group ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800/90 border-[#0071e3]/40 shadow-xs ring-1 ring-[#0071e3]/25'
                        : 'bg-white/50 dark:bg-slate-800/25 border-black/[0.04] dark:border-white/[0.04] hover:bg-white dark:hover:bg-slate-800/60 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Avatar: 38x38 squircle with Presence dot & Unread pulse: Bấm 1-chạm Cursor toggle */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleUnread(id);
                        }}
                        className="relative shrink-0 mt-0.5 cursor-pointer group/avatar"
                        title={isUnread ? 'Bấm để đánh dấu ĐÃ ĐỌC (Phím U / Chuột phải)' : 'Bấm để đánh dấu ĐỌC SAU (Phím U / Chuột phải)'}
                        aria-label={isUnread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
                      >
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all group-hover/avatar:scale-105 active:scale-95 shadow-2xs ${
                          isUnread
                            ? 'bg-blue-500/15 text-[#0071e3] ring-1 ring-blue-500/30'
                            : isSelected
                              ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400'
                              : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                        }`}>
                          {isUnread ? (
                            <Mail className="w-4 h-4 text-[#0071e3]" />
                          ) : (
                            <MailOpen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          )}
                        </div>
                        {/* Chấm trực tuyến gắn góc dưới avatar */}
                        <div className="absolute -bottom-0.5 -right-0.5 pointer-events-none">
                          <PresenceDot isOnline={itemOnline.isOnline} size="xs" detail={itemOnline.detail} />
                        </div>
                        {/* Chấm xanh chưa đọc gắn góc trên avatar */}
                        {isUnread && (
                          <span
                            className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-[#0071e3] ring-2 ring-white dark:ring-slate-900 shadow-xs animate-pulse pointer-events-none"
                            title={t('inbox.s063')}
                          />
                        )}
                      </div>

                      {/* Nội dung tóm tắt chuẩn 3 dòng Apple / Cursor */}
                      <div className="flex-1 min-w-0">
                        {/* Dòng 1: Tên đối tác (trái) + Thời gian (phải) */}
                        <div className="flex items-center justify-between gap-1.5 mb-0.5">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {activeTab === 'incoming'
                              ? (item.status === 'confirmed'
                                  ? (item.passengerName || item.userName || item.contactName || 'Người đi cùng')
                                  : `Khách KX-${String(item.escrowId || item.id || '').replace(/\D/g, '').slice(-3) || '01'}`)
                              : (item.status === 'confirmed'
                                  ? (item.driverName || toPublicAlias(item))
                                  : toPublicAlias(item))}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0 tabular">
                            {formatCleanDateLabel(item.date)}
                          </span>
                        </div>

                        {/* Dòng 2: Lộ trình */}
                        <p className="text-[11.5px] text-slate-600 dark:text-slate-300 font-medium truncate mb-1">
                          {item.from} ➔ {item.to}
                        </p>

                        {/* Dòng 3: Giá thỏa thuận (trái) + Badges trạng thái & Đọc sau (phải) */}
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="tabular font-bold text-xs text-primary-600 dark:text-primary-400">
                            {item.totalDeal ? formatVND(item.totalDeal) : 'Thỏa thuận'}
                          </span>

                          <div className="shrink-0 flex items-center gap-1">
                            {/* Chip Chưa đọc / Đọc sau (nếu đang unread) */}
                            {isUnread && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 dark:bg-blue-950/80 text-[#0071e3] dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 shrink-0 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] animate-pulse" />
                                <span>{isManuallyUnread ? 'Đọc sau' : 'Chưa đọc'}</span>
                              </span>
                            )}

                            {/* Status badge */}
                            {status === 'confirmed' ? (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 shrink-0">
                                {t('inbox.s009')}
                              </span>
                            ) : status === 'pre_confirmed' ? (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300/40 shrink-0 animate-pulse">
                                {t('inbox.s010')}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/40 shrink-0">
                                {t('inbox.s011')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* CỘT PHẢI: KHUNG TRAO ĐỔI & ĐIỀU PHỐI 2 PHA */}
        <div className={`flex-1 flex flex-col bg-white dark:bg-[#1c1c1e] min-w-0 ${
          !mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}>
          {isSupportChannelActive ? (
            /* KÊNH HỖ TRỢ TRỰC TIẾP CSKH CARMATE (PLATFORM SUPPORT DESK) */
            <div className="flex-1 flex flex-col min-w-0 h-full">
              {/* Header CSKH */}
              <div className="px-4 sm:px-6 py-3.5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3 bg-gradient-to-r from-primary-50/70 to-indigo-50/70 dark:from-primary-950/40 dark:to-indigo-950/40 backdrop-blur-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileShowChat(false)}
                    className="md:hidden p-1.5 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#0071e3] to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {t('inbox.s012')}
                      </h3>
                      <ShieldCheck className="w-4 h-4 text-[#0071e3] shrink-0" title={t('inbox.s064')} />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {t('inbox.s013')}
                    </p>
                  </div>
                </div>

                {(isBannedState || currentUser?.isBanned || activeBooking?.isBanned) && (
                  <button
                    type="button"
                    onClick={handleResetBan}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
                  >
                    {t('inbox.s014')}
                  </button>
                )}
              </div>

              {/* Danh sách tin nhắn CSKH */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 dark:bg-slate-900/20">
                <div className="flex justify-center my-1">
                  <span className="px-3 py-1 rounded-full text-[10.5px] font-semibold bg-indigo-100/70 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200/50">
                    {t('inbox.s015')}
                  </span>
                </div>

                {loadingSupport ? (
                  <div className="text-center py-8 text-xs text-slate-400">{t('inbox.s016')}</div>
                ) : (
                  supportMessages.map((msg, idx) => {
                    const isPlatform = msg.senderRole === 'platform' || msg.senderRole === 'admin';
                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex flex-col ${isPlatform ? 'items-start' : 'items-end'}`}
                      >
                        <span className="text-[10px] text-slate-400 mb-0.5 px-1">
                          {isPlatform ? 'CSKH CarMate' : (currentUser?.name || 'Tôi')}
                        </span>
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                            isPlatform
                              ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-black/[0.06] dark:border-white/[0.06] rounded-tl-xs shadow-2xs'
                              : 'bg-primary-600 text-white rounded-tr-xs shadow-xs'
                          }`}
                        >
                          {msg.message || msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Reply Chips CSKH */}
              <div className="px-3 pt-2 pb-1 bg-slate-50/90 dark:bg-[#181920] border-t border-black/[0.04] dark:border-white/[0.04] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[10.5px] font-bold text-slate-400 shrink-0 mr-0.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary-500" /> Nhanh:
                </span>
                {[
                  '🙏 Tôi bị khóa nhầm, xin mở khóa giúp tôi',
                  '📍 Tôi chỉ gõ số nhà / biển số chứ không phải SĐT',
                  '❓ Tôi cần hỗ trợ quy định an toàn'
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendSupportMessage(null, chip)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white dark:bg-slate-800 border border-black/[0.06] dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-primary-500/50 hover:text-primary-600 dark:hover:text-primary-400 active:scale-95 transition-all shrink-0 cursor-pointer shadow-2xs"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input Form CSKH */}
              <form
                onSubmit={handleSendSupportMessage}
                className="p-3 border-t border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-[#1c1c1e] flex items-center gap-2"
              >
                <input
                  type="text"
                  value={supportInput}
                  onChange={(e) => setSupportInput(e.target.value)}
                  placeholder={t('inbox.s065')}
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 transition-all outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!supportInput.trim() || sendingSupport}
                  className="p-2.5 rounded-2xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-white disabled:opacity-40 transition-all cursor-pointer shadow-xs"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : !activeBooking ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400">
              <p className="text-xs">{t('inbox.s017')}</p>
            </div>
          ) : (
            <>
              {/* Header chi tiết chuyến */}
              <div className="px-4 sm:px-6 py-3.5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/40 backdrop-blur-sm">
                <div className="min-w-0 flex-1 flex items-center gap-2.5">
                  {/* Nút quay lại trên mobile */}
                  <button
                    type="button"
                    onClick={() => setMobileShowChat(false)}
                    className="md:hidden p-1.5 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors shrink-0 cursor-pointer"
                    title={t('inbox.s066')}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm sm:text-[15px] text-slate-900 dark:text-white truncate shrink-0 max-w-[160px] sm:max-w-none">
                        {partnerAlias}
                      </h3>
                      <PresenceDot isOnline={activePartnerOnline.isOnline} showLabel detail={activePartnerOnline.detail} />
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                        #{activeBooking.escrowId || activeBooking.id}
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{activeBooking.from} ➔ {activeBooking.to}</span>
                      {activeBooking.isCargoBooking ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                          📦 {activeBooking.cargoPresetName || 'Gửi đồ tiện chuyến'}
                        </span>
                      ) : activeBooking.seats ? (
                        <span>· {activeBooking.seats} chỗ</span>
                      ) : null}
                      {activeBooking.totalDeal ? <span>· {formatVND(activeBooking.totalDeal)}</span> : ''}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {/* Nút Gọi thoại trực tiếp trong App (0đ cước · Bảo mật SĐT) */}
                  <button
                    type="button"
                    onClick={handleStartInAppCall}
                    className="h-8 px-2.5 rounded-xl font-bold text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                    title={t('inbox.s067')}
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 fill-current" />
                    <span className="hidden sm:inline">{t('inbox.s018')}</span>
                  </button>

                  {isConfirmed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1.5 rounded-full border border-emerald-300/50">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t('inbox.s019')}</span>
                      <span className="sm:hidden">{t('inbox.s009')}</span>
                    </span>
                  ) : isPreConfirmed && remainingSecs > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1.5 rounded-full border border-blue-300/50 animate-pulse">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{timeLeftStr ? `Tạm giữ chỗ ${timeLeftStr}` : 'Tạm giữ chỗ 15p'}</span>
                    </span>
                  ) : activeBooking.status === 'expired' || (isPreConfirmed && remainingSecs <= 0) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-850 px-2.5 py-1.5 rounded-full border border-slate-300/50">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{t('inbox.s020')}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1.5 rounded-full border border-amber-300/50">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t('inbox.s021')}</span>
                      <span className="sm:hidden">{t('inbox.s022')}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* THANH ĐIỀU PHỐI 2-PHASE COMMIT (SMART ACTION BAR) */}
              <div className="p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/60 dark:to-slate-800/40 border-b border-black/[0.06] dark:border-white/[0.06]">
                {isConfirmed ? (
                  isEmergencyPhoneUnlockedForMe && partnerPhone ? (
                    // ĐÃ MỞ KHOÁ SĐT KHẨN CẤP CHO NGƯỜI GỌI (SAU 2 LẦN GỌI APP >= 25S)
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 text-left space-y-2.5 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                            !
                          </span>
                          <div>
                            <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                              {t('inbox.s023')}
                            </p>
                            <p className="text-[11px] text-amber-800 dark:text-amber-400">
                              Đã xác thực: Bạn đã gọi qua App 2 lần (≥ 25s) nhưng {partnerAlias} không bắt máy
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold shrink-0">
                          {t('inbox.s024')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-white dark:bg-slate-900/90 p-2.5 rounded-xl border border-amber-500/20">
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">SĐT trực tiếp {partnerAlias}:</p>
                          <p className="text-base font-mono font-bold text-slate-900 dark:text-white tracking-tight">
                            {partnerPhone}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${partnerPhone}`}
                            className="py-1.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          >
                            <Phone className="w-3.5 h-3.5 fill-current" />
                            <span>{t('inbox.s025')}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(partnerPhone)}
                            className="py-1.5 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer active:scale-95"
                          >
                            {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedPhone ? 'Đã chép' : 'Sao chép'}</span>
                          </button>
                        </div>
                      </div>
                      <p className="text-[10.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        💡 <strong>{t('inbox.s026')}</strong> {t('inbox.s027')}
                      </p>
                    </div>
                  ) : (
                    // ĐÃ CHỐT CHÍNH THỨC: BẢO MẬT 100% SĐT - LIÊN HỆ TRỰC TIẾP TRÊN PLATFORM
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Check className="w-4 h-4" strokeWidth={3} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                            {t('inbox.s028')}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            {t('inbox.s029')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={handleStartInAppCall}
                          className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          title={t('inbox.s067')}
                        >
                          <Phone className="w-3.5 h-3.5 fill-current" />
                          <span>Gọi cho {partnerAlias} (0đ)</span>
                        </button>
                      </div>
                    </div>
                  )
                ) : isPreConfirmed && remainingSecs > 0 ? (
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
                          {activeBooking.preConfirmedBy === (activeTab === 'incoming' ? 'driver' : 'passenger')
                            ? 'Đang khóa mềm chỗ 15 phút (Chờ đối phương xác nhận)'
                            : activeTab === 'incoming'
                              ? 'Khách đã đề xuất chốt (Bấm xác nhận để chốt chuyến ngay)'
                              : 'Chủ xe đang tạm giữ chỗ 15 phút cho bạn'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {activeBooking.preConfirmedBy === (activeTab === 'incoming' ? 'driver' : 'passenger')
                            ? 'Ghế tự động giải phóng nếu đối phương không bấm chốt trước khi hết giờ.'
                            : 'Bấm nút xác nhận bên phải để chốt chuyến ngay và nhận SĐT & Zalo liên hệ đón!'}
                        </p>
                      </div>
                    </div>

                    {(activeTab === 'outgoing' || activeBooking.preConfirmedBy === 'passenger' || !activeBooking.preConfirmedBy) && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleFinalConfirm}
                        className="py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-600/30 ring-4 ring-emerald-500/40 animate-pulse flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all shrink-0"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('inbox.s030')}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  // ĐANG Ở BƯỚC THƯƠNG LƯỢNG (INQUIRING HOẶC HẾT HẠN 15P)
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {!hasPartnerReplied ? (
                        <>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                              <span>Đang chờ phản hồi từ {partnerAlias}</span>
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Hệ thống đã gửi thông báo. Khi {partnerAlias} phản hồi và hai bên trao đổi ok, nút chốt chuyến sẽ kích hoạt.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled
                            className="py-2 px-3.5 rounded-xl font-semibold text-xs bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed flex items-center gap-1.5"
                            title={t('inbox.s068')}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Chờ {partnerAlias} phản hồi</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              <span>
                                {activeBooking.status === 'expired' || remainingSecs <= 0
                                  ? 'Hết hạn giữ chỗ 15p · Trao đổi lại & Tạm giữ chỗ mới'
                                  : 'Thỏa thuận điểm hẹn đón & hành lý trước khi chốt'}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {t('inbox.s031')}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handlePreConfirm}
                            className={`py-2.5 px-4 rounded-xl font-black text-xs shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all ${
                              hasConsensus
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white ring-4 ring-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse'
                                : 'bg-gradient-to-r from-[#0071e3] to-indigo-600 hover:from-[#0077ed] text-white ring-4 ring-[#0071e3]/30 shadow-[0_0_20px_rgba(0,113,227,0.35)] animate-pulse'
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5 fill-current text-amber-300" />
                            <span>{hasConsensus ? '⚡ Đồng thuận đạt! Tạm giữ chỗ 15p' : '⚡ Đề xuất chốt chuyến & Tạm giữ chỗ 15p'}</span>
                          </button>
                        </>
                      )}
                    </div>

                    {/* Cảnh báo Stale Inactivity nếu đối tác không phản hồi > 3 phút */}
                    {isPartnerStale && !hasPartnerReplied && (
                      <div className="p-2.5 px-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-[11.5px] font-medium">
                            {partnerAlias} phản hồi chậm (&gt;3 phút). Bạn có thể tìm chuyến xe khác trên Sàn để không lỡ lịch trình!
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose?.();
                            onNavigateTab?.('market');
                          }}
                          className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-[11px] shrink-0 cursor-pointer shadow-xs transition-all"
                        >
                          {t('inbox.s032')}
                        </button>
                      </div>
                    )}

                    {/* Edge AI Ambient Consensus Prompt */}
                    {hasConsensus && hasPartnerReplied && (
                      <div className="p-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-medium text-[11.5px]">
                            {activeTab === 'incoming'
                              ? 'Trí tuệ bản địa nhận diện hai bên đã thống nhất điểm đón. Hãy bấm tạm giữ chỗ 15p cho khách!'
                              : 'Trí tuệ bản địa nhận diện hai bên đã thống nhất điểm đón. Hãy bấm đề xuất tạm giữ chỗ 15p với Chủ xe!'}
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
                    {t('inbox.s033')}
                  </span>
                </div>

                {(!activeBooking.messages || activeBooking.messages.length === 0) ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    {t('inbox.s034')}
                  </div>
                ) : (
                  activeBooking.messages.map((msg, idx) => {
                    const isSystem = msg.isSystem || msg.senderRole === 'system';
                    const isMe = (activeTab === 'incoming' && msg.senderRole === 'driver') ||
                                 (activeTab === 'outgoing' && msg.senderRole === 'passenger');

                    if (isSystem) {
                      if (msg.isWarningNotice) {
                        const isStrike3 = msg.strike >= 3 || msg.noticeType === 'strike_ban';
                        const isStrike2 = msg.strike === 2 || msg.noticeType === 'strike_penalty';
                        return (
                          <div
                            key={msg.id || idx}
                            className={`my-3 p-4 rounded-3xl border shadow-xs transition-all ${
                              isStrike3
                                ? 'bg-rose-50/90 dark:bg-rose-950/60 border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-100'
                                : isStrike2
                                  ? 'bg-amber-50/90 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
                                  : 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                                  isStrike3
                                    ? 'bg-rose-200/80 dark:bg-rose-900 text-rose-700 dark:text-rose-300'
                                    : isStrike2
                                      ? 'bg-amber-200/80 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                                      : 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {isStrike3 ? (
                                  <Ban className="w-5 h-5 text-rose-600" />
                                ) : isStrike2 ? (
                                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                                ) : (
                                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="font-bold text-xs">
                                    {isStrike3
                                      ? '📜 THÔNG BÁO TẠM ĐÌNH CHỈ TÀI KHOẢN (Cấp 3)'
                                      : isStrike2
                                        ? '🚨 QUYẾT ĐỊNH XỬ PHẠT TÍN NHIỆM (Lần 2/3)'
                                        : '📜 THƯ CẢNH BÁO QUY CHẾ BẢO MẬT (Lần 1/3)'}
                                  </span>
                                  <span className="text-[10px] font-mono opacity-60">
                                    {msg.createdAt
                                      ? new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })
                                      : ''}
                                  </span>
                                </div>

                                <p className="text-xs leading-relaxed mt-1.5 opacity-90">{msg.text}</p>

                                {msg.detectedSample && (
                                  <div className="mt-2 px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] font-mono text-[11px] break-all border border-black/[0.05] dark:border-white/[0.05]">
                                    Nội dung phát hiện: "{msg.detectedSample}"
                                  </div>
                                )}

                                {msg.canDispute && (
                                  <div className="mt-3 pt-2.5 border-t border-black/[0.08] dark:border-white/[0.08] flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDisputeTargetNotice(msg);
                                        setShowDisputeModal(true);
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
                                    >
                                      <HelpCircle className="w-3.5 h-3.5" />
                                      <span>{t('inbox.s035')}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsSupportChannelActive(true);
                                        setMobileShowChat(true);
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 transition-all active:scale-95"
                                    >
                                      <Headphones className="w-3.5 h-3.5 text-primary-500" />
                                      <span>{t('inbox.s036')}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (msg.isDisputeResolved) {
                        return (
                          <div key={msg.id || idx} className="flex justify-center my-2">
                            <div className="max-w-[85%] p-3 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200 text-xs leading-relaxed text-left flex items-start gap-2 shadow-2xs">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              <div>{msg.text}</div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id || idx} className="flex justify-center my-2">
                          <div className="max-w-[85%] p-2.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/50 text-indigo-900 dark:text-indigo-200 text-xs leading-relaxed text-center">
                            <span className="font-bold mr-1">{t('inbox.s037')}</span>
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
                          {isMe ? 'Tôi' : (isConfirmed ? (msg.senderName || partnerAlias) : partnerAlias)}
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
                {isConfirmed && (
                  isEmergencyPhoneUnlockedForMe && partnerPhone ? (
                    <div className="my-3 p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 shadow-xs text-center space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                          !
                        </span>
                        <p className="text-sm font-bold text-amber-950 dark:text-amber-200">
                          {t('inbox.s038')}
                        </p>
                      </div>
                      <div className="py-1">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Số điện thoại trực tiếp của {partnerAlias}:</p>
                        <p className="text-xl font-mono font-bold text-slate-900 dark:text-white tabular tracking-tight">
                          {partnerPhone}
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <a
                          href={`tel:${partnerPhone}`}
                          className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                        >
                          <Phone className="w-3.5 h-3.5 fill-current" />
                          <span>{t('inbox.s039')}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(partnerPhone)}
                          className="py-2.5 px-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer active:scale-95"
                        >
                          {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedPhone ? 'Đã chép' : 'Sao chép số'}</span>
                        </button>
                      </div>
                      <div className="mt-2 p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-[11.5px] text-amber-900 dark:text-amber-200 text-left leading-relaxed">
                        💡 <strong>{t('inbox.s040')}</strong> {t('inbox.s041')}
                      </div>
                    </div>
                  ) : (
                    <div className="my-3 p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-xs text-center space-y-2.5">
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                          ✓
                        </span>
                        <p className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                          {t('inbox.s028')}
                        </p>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                        {t('inbox.s042')}
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleStartInAppCall}
                          className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                        >
                          <Phone className="w-3.5 h-3.5 fill-current" />
                          <span>Gọi thoại cho {partnerAlias} qua App (0đ)</span>
                        </button>
                      </div>
                      {/* Stanford Empathy Tip & Hướng dẫn dứt khoát */}
                      <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-100/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-[11.5px] text-emerald-900 dark:text-emerald-200 text-left leading-relaxed">
                        💡 <strong>{t('inbox.s043')}</strong> {t('inbox.s044')} <strong>{t('inbox.s045')}</strong> {t('inbox.s046')}
                      </div>
                    </div>
                  )
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
                          {t('inbox.s047')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed mt-0.5">{violationInfo.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(violationInfo.isBanned || violationInfo.strike >= 3) && (
                      <button
                        type="button"
                        onClick={handleResetBan}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shrink-0 cursor-pointer shadow-2xs transition-all active:scale-95"
                      >
                        {t('inbox.s048')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setViolationInfo(null)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : piiWarning ? (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/70 border-t border-amber-200/80 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">{t('inbox.s049')}</p>
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
                    <Sparkles className="w-3 h-3 text-primary-500" /> {t('inbox.s050')}
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

              {/* KHUNG NHẬP TIN NHẮN HOẶC TRẠNG THÁI KHÓA (3-DAY GRACE BANNER) */}
              {isBannedState || currentUser?.isBanned || activeBooking.isBanned ? (
                <div className="p-3.5 border-t border-rose-200 dark:border-rose-900 bg-rose-50/90 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-3 font-medium flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <p className="font-bold text-rose-900 dark:text-rose-200">
                        {t('inbox.s051')}
                      </p>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                        {t('inbox.s052')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSupportChannelActive(true);
                        setMobileShowChat(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <Headphones className="w-3.5 h-3.5" />
                      <span>{t('inbox.s053')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDisputeTargetNotice({ strike: 3, detectedSample: 'Khóa tài khoản 3-Strike' });
                        setShowDisputeModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold text-xs shadow-2xs cursor-pointer transition-all active:scale-95"
                    >
                      {t('inbox.s054')}
                    </button>
                  </div>
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
                      setInputMessage(e.target.value);
                      if (piiWarning) setPiiWarning('');
                    }}
                    placeholder={
                      isDealCommitted
                        ? 'Nhắn tin cập nhật điểm đón, SĐT phụ, hành lý...'
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

      {/* MENU NGỮ CẢNH CHUỘT PHẢI (CURSOR / APPLE CONTEXT MENU) */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-[99999] w-[230px] rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl p-1.5 text-xs text-slate-700 dark:text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          {/* Header mini */}
          <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-black/5 dark:border-white/5 truncate flex items-center justify-between">
            <span className="truncate">{toPublicAlias(contextMenu.booking)}</span>
            <span className="font-mono text-[10px] text-slate-400 shrink-0">
              #{contextMenu.booking.escrowId || contextMenu.booking.id}
            </span>
          </div>

          <div className="py-1 space-y-0.5">
            {/* Đánh dấu chưa đọc / Đã đọc */}
            <button
              type="button"
              onClick={() => {
                const bId = contextMenu.booking.escrowId || contextMenu.booking.id;
                handleToggleUnread(bId);
                setContextMenu(null);
              }}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-[#0071e3] dark:hover:text-blue-400 transition-colors cursor-pointer font-semibold group"
              role="menuitem"
            >
              <div className="flex items-center gap-2">
                {isBookingUnread(contextMenu.booking) ? (
                  <MailOpen className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#0071e3]" />
                ) : (
                  <Mail className="w-3.5 h-3.5 text-[#0071e3]" />
                )}
                <span>{isBookingUnread(contextMenu.booking) ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}</span>
              </div>
              <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-slate-400 font-normal">
                U
              </kbd>
            </button>

            {/* Sao chép mã chuyến */}
            <button
              type="button"
              onClick={() => {
                const bId = contextMenu.booking.escrowId || contextMenu.booking.id;
                navigator.clipboard.writeText(bId);
                onShowToast?.(`✓ Đã sao chép mã chuyến #${bId}`);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
              role="menuitem"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('inbox.s055')}</span>
            </button>

            {/* Sao chép lộ trình */}
            <button
              type="button"
              onClick={() => {
                const routeTxt = `${contextMenu.booking.from} ➔ ${contextMenu.booking.to}`;
                navigator.clipboard.writeText(routeTxt);
                onShowToast?.(`✓ Đã sao chép lộ trình: ${routeTxt}`);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
              role="menuitem"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('inbox.s056')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Dispute Notice Modal */}
      <DisputeNoticeModal
        isOpen={showDisputeModal}
        onClose={() => {
          setShowDisputeModal(false);
          setDisputeTargetNotice(null);
        }}
        booking={activeBooking}
        violationNotice={disputeTargetNotice}
        onResolved={(_updatedBooking) => {
          if (onRefreshBookings) {
            onRefreshBookings();
          }
          if (currentUser) {
            currentUser.isBanned = false;
            currentUser.bannedAt = null;
            currentUser.deactivateAt = null;
            currentUser.status = 'active';
            currentUser.trustScore = Math.max(currentUser.trustScore || 80, 85);
            try {
              localStorage.setItem('carmate_user', JSON.stringify(currentUser));
            } catch {
              // ignore
            }
          }
          setIsSupportChannelActive(true);
          loadSupportMessages();
        }}
        onOpenSupportChat={() => {
          setIsSupportChannelActive(true);
          loadSupportMessages();
        }}
        onShowToast={onShowToast}
      />

      {/* ── 5. POPUP GỌI THOẠI TRỰC TIẾP TRONG APP (0Đ CƯỚC · BẢO MẬT 100% SĐT) ── */}
      {inAppCallState && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden text-center text-white p-6 space-y-6">
            {/* Huy hiệu bảo mật */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('inbox.s057')}</span>
            </div>

            {/* Avatar & Hiệu ứng sóng âm đổ chuông */}
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              {inAppCallState.status === 'ringing' && (
                <>
                  <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                  <span className="absolute -inset-2 rounded-full bg-emerald-500/10 animate-pulse" />
                </>
              )}
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-emerald-500/20">
                {(partnerAlias || 'CarMate').slice(0, 2).toUpperCase()}
              </div>
            </div>

            {/* Thông tin đối tác & Lộ trình */}
            <div className="space-y-1">
              <h3 className="text-lg font-bold tracking-tight text-white">{partnerAlias || 'Đối tác'}</h3>
              <p className="text-xs text-slate-400">
                {activeBooking?.from} ➔ {activeBooking?.to}
              </p>
              <div className="pt-2">
                {inAppCallState.status === 'ringing' ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-emerald-400 animate-pulse flex items-center justify-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 animate-bounce" />
                      <span>Đang đổ chuông qua App... ({inAppCallState.ringSeconds || 0}s)</span>
                    </p>
                    {(inAppCallState.ringSeconds || 0) >= MIN_CALL_DURATION_FOR_EMERGENCY ? (
                      <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11.5px] font-medium animate-in fade-in">
                        ⏱️ Đã đổ chuông {inAppCallState.ringSeconds}s (Đạt chuẩn ≥{MIN_CALL_DURATION_FOR_EMERGENCY}s). Bạn có thể gác máy để ghi nhận lần {(emergencyCallStatus?.attempts || 0) + 1}/{REQUIRED_UNANSWERED_CALLS}.
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        Cần đổ chuông tối thiểu {MIN_CALL_DURATION_FOR_EMERGENCY}s nếu đối tác không nhấc máy
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-mono font-bold text-emerald-400 tabular tracking-wider">
                    {Math.floor(inAppCallState.seconds / 60).toString().padStart(2, '0')}:
                    {(inAppCallState.seconds % 60).toString().padStart(2, '0')}
                  </p>
                )}
              </div>
            </div>

            {/* Phím điều khiển cuộc gọi */}
            <div className="flex items-center justify-center gap-4 pt-2">
              {/* Tắt / Bật mic */}
              <button
                type="button"
                onClick={() => setInAppCallState((prev) => (prev ? { ...prev, isMuted: !prev.isMuted } : null))}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  inAppCallState.isMuted
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                }`}
                title={inAppCallState.isMuted ? 'Bật Mic' : 'Tắt Mic'}
              >
                {inAppCallState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Tắt / Bật loa ngoài */}
              <button
                type="button"
                onClick={() => setInAppCallState((prev) => (prev ? { ...prev, isSpeaker: !prev.isSpeaker } : null))}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  inAppCallState.isSpeaker
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                }`}
                title={inAppCallState.isSpeaker ? 'Tắt loa ngoài' : 'Bật loa ngoài'}
              >
                {inAppCallState.isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              {/* Kết thúc cuộc gọi */}
              <button
                type="button"
                onClick={handleEndInAppCall}
                className="w-14 h-14 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                title={t('inbox.s069')}
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>

            {/* Nút mô phỏng nhấc máy khi đang đổ chuông (hỗ trợ kiểm thử/demo) */}
            {inAppCallState.status === 'ringing' && (
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={handleSimulatePartnerAnswer}
                  className="text-[11px] text-emerald-400/80 hover:text-emerald-300 underline cursor-pointer py-1 transition-colors"
                >
                  {t('inbox.s058')}
                </button>
              </div>
            )}

            {/* Lưu ý thực tế */}
            <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-white/10">
              💡 Gọi 2 cuộc qua App (mỗi cuộc ≥ {MIN_CALL_DURATION_FOR_EMERGENCY}s) nếu đối tác không bắt máy, hệ thống sẽ mở khoá SĐT khẩn cấp để kịp giờ đón.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
