import { useState, useCallback, useRef } from 'react';
import { createAuthContinuation } from '../utils/driverTripDraft.js';

/**
 * Custom Hook quản lý trạng thái hiển thị của các Modals trong toàn ứng dụng CarMate
 */
export default function useAppModals() {
  const authContinuation = useRef(createAuthContinuation());
  const authCancellation = useRef(null);
  const [selectedItemForEscrow, setSelectedItemForEscrow] = useState(null);
  const [selectedDriverForTrust, setSelectedDriverForTrust] = useState(null);
  const [selectedTripForPhotos, setSelectedTripForPhotos] = useState(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [cancelRecord, setCancelRecord] = useState(null);
  const [delayRecord, setDelayRecord] = useState(null);
  const [reviewRecord, setReviewRecord] = useState(null);
  const [selectedTripForRoute, setSelectedTripForRoute] = useState(null);
  const [editingTrip, setEditingTrip] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState({
    title: 'Đăng Nhập CarMate',
    subtitle: 'Quản lý chuyến và nhận phản hồi cho nhu cầu của bạn.',
    contextNotice: null,
    pendingTab: null
  });
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);

  const openAuthWithContext = useCallback(
    ({
      title = 'Đăng Nhập CarMate',
      subtitle = 'Quản lý chuyến và nhận phản hồi cho nhu cầu của bạn.',
      contextNotice = null,
      pendingTab = null,
      onSuccess = null,
      onCancel = null
    } = {}) => {
      authContinuation.current.set(onSuccess);
      authCancellation.current = onCancel;
      setAuthModalConfig({ title, subtitle, contextNotice, pendingTab });
      setShowAuthModal(true);
    },
    []
  );

  const takeAuthContinuation = useCallback(() => {
    authCancellation.current = null;
    return authContinuation.current.take();
  }, []);

  const cancelAuth = useCallback(() => {
    const onCancel = authCancellation.current;
    authCancellation.current = null;
    authContinuation.current.clear();
    setShowAuthModal(false);
    onCancel?.();
  }, []);

  const closeAllModals = useCallback(() => {
    authContinuation.current.clear();
    authCancellation.current = null;
    setSelectedItemForEscrow(null);
    setSelectedDriverForTrust(null);
    setSelectedTripForPhotos(null);
    setShowPolicyModal(false);
    setShowBenchmarkModal(false);
    setCancelRecord(null);
    setDelayRecord(null);
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
    openAuthWithContext,
    takeAuthContinuation,
    cancelAuth,
    closeAllModals
  };
}
