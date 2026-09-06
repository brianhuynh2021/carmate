import { useState, useCallback } from 'react';

/**
 * Custom Hook quản lý trạng thái hiển thị của các Modals trong toàn ứng dụng CarMate
 */
export default function useAppModals() {
  const [selectedItemForEscrow, setSelectedItemForEscrow] = useState(null);
  const [selectedDriverForTrust, setSelectedDriverForTrust] = useState(null);
  const [selectedTripForPhotos, setSelectedTripForPhotos] = useState(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [cancelRecord, setCancelRecord] = useState(null);
  const [delayRecord, setDelayRecord] = useState(null);
  const [ticketToShare, setTicketToShare] = useState(null);
  const [reviewRecord, setReviewRecord] = useState(null);
  const [selectedTripForRoute, setSelectedTripForRoute] = useState(null);
  const [editingTrip, setEditingTrip] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState({
    title: 'Đăng Nhập CarMate',
    subtitle: 'Đồng bộ bài đăng · Tiết kiệm chi phí · 100% an toàn',
    contextNotice: null,
    pendingTab: null
  });
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [pendingBookingTrip, setPendingBookingTrip] = useState(null);
  const [pendingPostTrip, setPendingPostTrip] = useState(null);

  const openAuthWithContext = useCallback(({
    title = 'Đăng Nhập CarMate',
    subtitle = 'Đồng bộ bài đăng · Tiết kiệm chi phí · 100% an toàn',
    contextNotice = null,
    pendingTab = null
  } = {}) => {
    setAuthModalConfig({ title, subtitle, contextNotice, pendingTab });
    setShowAuthModal(true);
  }, []);

  const closeAllModals = useCallback(() => {
    setSelectedItemForEscrow(null);
    setSelectedDriverForTrust(null);
    setSelectedTripForPhotos(null);
    setShowPolicyModal(false);
    setShowBenchmarkModal(false);
    setCancelRecord(null);
    setDelayRecord(null);
    setTicketToShare(null);
    setReviewRecord(null);
    setSelectedTripForRoute(null);
    setEditingTrip(null);
    setShowAuthModal(false);
    setShowTermsModal(false);
    setShowAiModal(false);
  }, []);

  return {
    selectedItemForEscrow,
    setSelectedItemForEscrow,
    selectedDriverForTrust,
    setSelectedDriverForTrust,
    selectedTripForPhotos,
    setSelectedTripForPhotos,
    showPolicyModal,
    setShowPolicyModal,
    showBenchmarkModal,
    setShowBenchmarkModal,
    cancelRecord,
    setCancelRecord,
    delayRecord,
    setDelayRecord,
    ticketToShare,
    setTicketToShare,
    reviewRecord,
    setReviewRecord,
    selectedTripForRoute,
    setSelectedTripForRoute,
    editingTrip,
    setEditingTrip,
    showAuthModal,
    setShowAuthModal,
    authModalConfig,
    setAuthModalConfig,
    showTermsModal,
    setShowTermsModal,
    showAiModal,
    setShowAiModal,
    showDeleteAccountModal,
    setShowDeleteAccountModal,
    pendingBookingTrip,
    setPendingBookingTrip,
    pendingPostTrip,
    setPendingPostTrip,
    openAuthWithContext,
    closeAllModals
  };
}
