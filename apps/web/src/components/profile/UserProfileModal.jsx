import React, { useState, useMemo, useRef } from 'react';
import {
  User,
  Car,
  ShieldCheck,
  Camera,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Mail,
  Phone,
  MapPin,
  FileText,
  Loader2,
  Info,
  Check,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import { GoogleIcon, TelegramIcon } from '../ui/SocialIcons.jsx';
import api from '../../api/client.js';
import { useTranslation } from '../../i18n/index.jsx';
import { computeTrustScore, DEFAULT_TRUST_RULES } from '@carmate/shared';
import { processCarPhotoUpload } from '../../utils/plateMasker.js';
import { isAdminUser } from '../../utils/adminGate.js';

// List of common car makes in Vietnam
const POPULAR_BRANDS = [
  'Toyota',
  'Hyundai',
  'Kia',
  'Honda',
  'Mazda',
  'Mitsubishi',
  'VinFast',
  'Ford',
  'Khác'
];

// List of common car models
const POPULAR_MODELS = {
  Toyota: ['Vios', 'Veloz Cross', 'Corolla Cross', 'Fortuner', 'Innova', 'Camry', 'Raize'],
  Hyundai: ['Accent', 'Creta', 'Tucson', 'Santa Fe', 'Custin', 'Grand i10'],
  Kia: ['Seltos', 'Carnival', 'Sonet', 'K3', 'Carens', 'Morning'],
  Honda: ['City', 'CR-V', 'HR-V', 'Civic'],
  Mazda: ['Mazda 3', 'CX-5', 'CX-8', 'Mazda 2'],
  Mitsubishi: ['Xpander', 'Xforce', 'Outlander', 'Attrage'],
  VinFast: ['VF 5 Plus', 'VF 6', 'VF 7', 'VF 8', 'VF 9', 'Fadil'],
  Ford: ['Everest', 'Ranger', 'Territory', 'Explorer']
};

// Common vehicle colors
const POPULAR_COLORS = ['Trắng', 'Đen', 'Bạc / Xám', 'Đỏ', 'Xanh dương', 'Vàng cát / Nâu'];

// Common vehicle amenities
const VEHICLE_PERKS = [
  'Không hút thuốc',
  'Máy lạnh mát mẻ',
  'Nước suối miễn phí',
  'Cốp rộng chứa hành lý',
  'Wifi & Cổng sạc nhanh',
  'Nhận chở thú cưng nhỏ'
];

// Standard vehicle photo positions
const PHOTO_SLOTS = [
  { id: 0, label: 'Mặt trước xe', sub: 'Rõ biển số', required: true },
  { id: 1, label: 'Góc nghiêng thân xe', sub: 'Tổng thể xe', required: true },
  { id: 2, label: 'Nội thất khoang khách', sub: 'Ghế ngồi sạch sẽ', required: true },
  { id: 3, label: 'Mặt sau đuôi xe', sub: 'Cốp xe & Biển số', required: false },
  { id: 4, label: 'Không gian cốp', sub: 'Chỗ để hành lý', required: false }
];

/**
 * Compress the image to WebP directly on the Client (Canvas API)
 * ~15ms speed, size reduced from 5MB to ~120KB while keeping the sharpness
 */
function compressImageToWebP(file, maxDimension = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UserProfileModal({ currentUser, onClose, onSave, onShowToast, onOpenDeleteAccount }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'garage' | 'trust'
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [formError, setFormError] = useState('');

  // 1. Personal info State
  const [name, setName] = useState(() => currentUser?.name || '');
  const [phone, setPhone] = useState(() => currentUser?.phone || '');
  const [email, setEmail] = useState(() => currentUser?.email || '');
  const [avatar, setAvatar] = useState(() => currentUser?.avatar || '');
  const [gender, setGender] = useState(() => currentUser?.gender || '');
  const [homeAddress, setHomeAddress] = useState(() => currentUser?.homeAddress || '');
  const [workAddress, setWorkAddress] = useState(() => currentUser?.workAddress || '');
  const [bio, setBio] = useState(() => currentUser?.bio || '');
  const [isCompressingAvatar, setIsCompressingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  // 2. Vehicle Garage State
  const existingVehicle = currentUser?.vehicle || {};
  const [hasCar, setHasCar] = useState(() => Boolean(existingVehicle.brand || existingVehicle.plate));
  const [brand, setBrand] = useState(() => existingVehicle.brand || 'Toyota');
  const [model, setModel] = useState(() => existingVehicle.model || 'Vios');
  const [plate, setPlate] = useState(() => existingVehicle.plate || '');
  const [color, setColor] = useState(() => existingVehicle.color || 'Trắng');
  const [capacity, setCapacity] = useState(() => Number(existingVehicle.capacity) || 5);
  const [carCategory, setCarCategory] = useState(() => existingVehicle.carCategory || 'family_car');
  const [selectedPerks, setSelectedPerks] = useState(() => existingVehicle.perks || [
    'Không hút thuốc',
    'Máy lạnh mát mẻ',
    'Cốp rộng chứa hành lý'
  ]);
  const [photos, setPhotos] = useState(() => {
    const existing = existingVehicle.photos || [];
    return [existing[0] || '', existing[1] || '', existing[2] || '', existing[3] || '', existing[4] || ''];
  });

  const fileInputRefs = useRef([]);

  // Count valid photos
  const validPhotosCount = useMemo(() => photos.filter(Boolean).length, [photos]);
  const isVerifiedCar = validPhotosCount >= 3;

  // Toggle vehicle amenities
  const togglePerk = (perk) => {
    setSelectedPerks((prev) =>
      prev.includes(perk) ? prev.filter((p) => p !== perk) : [...prev, perk]
    );
  };

  // Load public trust rules from the server
  const [publicRules, setPublicRules] = useState(DEFAULT_TRUST_RULES);

  React.useEffect(() => {
    let mounted = true;
    api.getPublicTrustRules?.()
      .then((res) => {
        if (mounted && res?.success && Array.isArray(res.data)) {
          setPublicRules(res.data);
        }
      })
      .catch((err) => {
        console.warn('[ProfileModal] Lỗi tải quy tắc tín nhiệm động:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Compute dynamic Trust by 4 pillars (MIT & Stanford)
  const trustCalc = useMemo(() => {
    const vehicleData = hasCar
      ? {
          brand,
          model,
          plate,
          photos,
          hasVerifiedPhotos: isVerifiedCar
        }
      : null;

    const historyData = {
      completedTrips: Number(currentUser?.completedTrips || 0),
      rating: Number(currentUser?.rating || 5.0),
      lateReports: Number(currentUser?.lateReports || 0),
      cancelReports: Number(currentUser?.cancelReports || 0),
      mismatchReports: Number(currentUser?.mismatchReports || 0)
    };

    const activeUser = {
      ...currentUser,
      avatar,
      gender,
      isCccdVerified: currentUser?.isCccdVerified ?? 1,
      isGplxVerified: currentUser?.isGplxVerified ?? 1,
      role: hasCar ? 'driver' : 'passenger'
    };

    return computeTrustScore(activeUser, vehicleData, historyData, publicRules);
  }, [currentUser, avatar, gender, hasCar, brand, model, plate, photos, isVerifiedCar, publicRules]);

  // Upload & compress to WebP
  const handlePhotoUpload = async (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast?.('Vui lòng chọn tệp định dạng hình ảnh (.jpg, .png, .webp)');
      return;
    }

    try {
      const slotType = index === 0 ? 'front' : index === 3 ? 'back' : 'other';
      const result = await processCarPhotoUpload(file, slotType);
      setPhotos((prev) => {
        const next = [...prev];
        next[index] = result.maskedUrl;
        return next;
      });
      if (result.isMasked) {
        onShowToast?.(`🔒 Đã tải và tự động che biển số ảnh ${PHOTO_SLOTS[index].label}!`);
      } else {
        onShowToast?.(`Đã tải ảnh ${PHOTO_SLOTS[index].label} thành công!`);
      }
    } catch (err) {
      console.warn('[ProfileModal] Lỗi nén/che ảnh:', err);
      onShowToast?.('Không thể tải ảnh, vui lòng thử lại');
    }
  };

  // Handle compression and update the personal avatar
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressingAvatar(true);
    setFormError('');
    try {
      // Compress to a square 400x400 WebP, high-quality avatar standard (~25KB, 0ms load)
      const compressed = await compressImageToWebP(file, 400, 0.85);
      setAvatar(compressed);
      onShowToast?.('Đã tải ảnh đại diện thành công!');
    } catch (err) {
      console.warn('Lỗi nén ảnh avatar:', err);
      setFormError('Không thể xử lý file ảnh đại diện, vui lòng thử lại');
    } finally {
      setIsCompressingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  // Delete the photo in the slot
  const handleRemovePhoto = (index) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = '';
      return next;
    });
  };

  // Validate & Save info
  const handleSave = async (e) => {
    e?.preventDefault();
    setFormError('');

    // Check name
    if (!name.trim()) {
      setFormError('Vui lòng nhập họ và tên hiển thị');
      setActiveTab('profile');
      return;
    }

    // Check phone number if entered
    if (phone.trim()) {
      const rawP = phone.trim().replace(/\D/g, '');
      if (rawP.length < 9 || rawP.length > 11) {
        setFormError('Số điện thoại không đúng định dạng (yêu cầu 10 chữ số)');
        setActiveTab('profile');
        return;
      }
    }

    // Check email if entered
    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setFormError('Địa chỉ email không đúng định dạng');
        setActiveTab('profile');
        return;
      }
    }

    // Check license plate if the has-a-vehicle toggle is on
    let cleanPlate = plate.trim().toUpperCase();
    if (hasCar) {
      if (cleanPlate) {
        const rawOnly = cleanPlate.replace(/[^0-9A-Z]/g, '');
        const plateRegex = /^[0-9]{2}[A-Z]{1,2}[0-9]{4,5}$/;
        if (!plateRegex.test(rawOnly)) {
          setFormError('Biển số xe chưa đúng chuẩn (Ví dụ: 51K-892.41, 29A-456.78)');
          setActiveTab('garage');
          return;
        }
      }
    }

    // Package the update payload
    const payload = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || null,
      avatar: avatar || null,
      gender: gender || null,
      trustScore: trustCalc.score,
      homeAddress: homeAddress.trim(),
      workAddress: workAddress.trim(),
      bio: bio.trim(),
      vehicle: hasCar
        ? {
            brand: brand.trim(),
            model: model.trim(),
            plate: cleanPlate,
            color,
            capacity: Number(capacity),
            carCategory,
            perks: selectedPerks,
            photos: photos.filter(Boolean)
          }
        : null
    };

    setIsSaving(true);
    try {
      await onSave?.(payload);
      onShowToast?.('Đã lưu hồ sơ cá nhân và garage xe thành công!');
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
      }, 3000);
    } catch (err) {
      setFormError(err.message || 'Không thể lưu hồ sơ, vui lòng thử lại');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={t('profile2.s060')}
      subtitle={currentUser?.phone ? `Tài khoản: ${currentUser.phone}` : 'Quản lý thông tin & phương tiện'}
      icon={User}
      iconTone="primary"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl text-[#515154] dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer type-button"
          >
            {t('profile2.s001')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`h-10 px-6 rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 active:scale-[0.98] disabled:opacity-50 type-button ${
              isSaved
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)]'
                : 'bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-[0_2px_8px_rgba(0,113,227,0.3)]'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t('profile2.s002')}</span>
              </>
            ) : isSaved ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Đã lưu thành công!</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{t('profile2.s003')}</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Form error if any */}
        {formError && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 flex items-center gap-2.5 text-rose-600 dark:text-rose-400 type-caption">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Success notification saved in place */}
        {isSaved && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 flex items-center gap-2 transition-all type-caption">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Đã lưu thay đổi hồ sơ thành công! Bạn có thể tiếp tục chỉnh sửa các mục khác hoặc bấm Đóng khi hoàn tất.</span>
          </div>
        )}

        {/* Apple Segmented Capsule Tab Control - Pinned in place on scroll */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md pb-2 -mt-1 pt-0.5">
          <div className="p-1 rounded-2xl bg-[#e8e8ed] dark:bg-slate-800/80 border border-black/[0.05] dark:border-white/[0.06] flex items-center gap-1 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex-1 h-9 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all type-button ${
                activeTab === 'profile'
                  ? 'bg-white dark:bg-slate-700 text-[#1d1d1f] dark:text-white shadow-xs'
                  : 'text-[#515154] dark:text-slate-300 hover:text-[#1d1d1f]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{t('profile2.s004')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('garage')}
              className={`flex-1 h-9 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all relative type-button ${
                activeTab === 'garage'
                  ? 'bg-white dark:bg-slate-700 text-[#1d1d1f] dark:text-white shadow-xs'
                  : 'text-[#515154] dark:text-slate-300 hover:text-[#1d1d1f]'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>{t('profile2.s005')}</span>
              {hasCar && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5" title={t('profile2.s061')} />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trust')}
              className={`flex-1 h-9 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all type-button ${
                activeTab === 'trust'
                  ? 'bg-white dark:bg-slate-700 text-[#1d1d1f] dark:text-white shadow-xs'
                  : 'text-[#515154] dark:text-slate-300 hover:text-[#1d1d1f]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('profile2.s006')}</span>
            </button>
          </div>
        </div>

        {/* TAB 1: PERSONAL INFO */}
        {activeTab === 'profile' && (
          <div className="space-y-4 pt-1">
            {/* Profile card header with portrait/avatar photo update feature */}
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.06]">
              <div
                className="relative group/avatar cursor-pointer shrink-0"
                onClick={() => avatarInputRef.current?.click()}
                title={t('profile2.s062')}
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name || 'Avatar'}
                    className="w-14 h-14 rounded-full object-cover shadow-sm ring-2 ring-emerald-500/40"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#0071e3] to-[#5ac8fa] text-white flex items-center justify-center shadow-xs ring-2 ring-[#0071e3]/20">
                    <User className="w-7 h-7 text-white" strokeWidth={2.2} />
                  </div>
                )}

                {/* Camera overlay on hover or while compressing the photo */}
                <div
                  className={`absolute inset-0 rounded-full bg-black/45 transition-opacity flex items-center justify-center text-white ${
                    isCompressingAvatar ? 'opacity-100' : 'opacity-0 group-hover/avatar:opacity-100'
                  }`}
                >
                  {isCompressingAvatar ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 drop-shadow" />
                  )}
                </div>

                {/* Mini camera badge at the bottom corner */}
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#0071e3] text-white border-2 border-white dark:border-[#1c1c1e] flex items-center justify-center shadow-xs cursor-pointer hover:bg-[#0077ed] transition-transform active:scale-90">
                  <Camera className="w-2.5 h-2.5" />
                </span>
              </div>

              {/* Hidden file input */}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden type-input"
                onChange={handleAvatarFileChange}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-[#1d1d1f] dark:text-white truncate type-heading">
                    {name || 'Chưa đặt tên hiển thị'}
                  </h4>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 type-badge">
                    {t('profile2.s007')}
                  </span>
                </div>
                <p className="text-[#86868b] mt-0.5 tabular type-body">
                  {phone || currentUser?.phone || currentUser?.email || 'Chưa liên kết SĐT'}
                </p>

                {/* Avatar action buttons */}
                <div className="flex items-center gap-2.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isCompressingAvatar}
                    className="text-[#0071e3] hover:underline cursor-pointer inline-flex items-center gap-1 type-button"
                  >
                    <Camera className="w-3 h-3" />
                    <span>{avatar ? 'Đổi ảnh đại diện' : 'Tải ảnh đại diện cá nhân'}</span>
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAvatar('');
                      }}
                      className="text-rose-500 hover:text-rose-600 cursor-pointer type-button"
                    >
                      {t('profile2.s008')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Field 1: Display name */}
            <div>
              <label className="block text-[#1d1d1f] dark:text-slate-200 mb-1.5 type-label">
                {t('profile2.s009')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('profile2.s063')}
                  className="w-full h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all outline-none type-input"
                />
              </div>
              <p className="text-[#86868b] mt-1 type-caption">
                {t('profile2.s010')}
              </p>
              {name && (name.startsWith('Thành viên USR-') || name.startsWith('USR-')) && (
                <div className="mt-1.5 flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 type-caption">
                  <span>{t('profile2.s011')}</span>
                  <button
                    type="button"
                    onClick={() => setName('')}
                    className="text-amber-900 dark:text-amber-200 underline shrink-0 cursor-pointer hover:opacity-80 type-button"
                  >
                    {t('profile2.s012')}
                  </button>
                </div>
              )}
            </div>

            {/* Field 1b: Gender (Apple Segmented Control) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[#1d1d1f] dark:text-slate-200 type-label">
                  {t('profile.gender') || 'Giới tính'}
                </label>
                <span className="text-[#0071e3] bg-[#0071e3]/10 px-2 py-0.5 rounded-full type-badge">
                  {t('profile2.s013')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'male', label: t('profile.male') || 'Nam', icon: '👨' },
                  { id: 'female', label: t('profile.female') || 'Nữ', icon: '👩' },
                  { id: 'other', label: t('profile.other') || 'Khác', icon: '✨' }
                ].map((g) => {
                  const isSelected = gender === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGender(g.id)}
                      className={`h-10 px-3 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 border select-none type-button ${
                        isSelected
                          ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-[0_2px_8px_rgba(0,113,227,0.25)]'
                          : 'bg-white dark:bg-slate-900 text-[#515154] dark:text-slate-300 border-black/[0.1] dark:border-white/[0.12] hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="type-body">{g.icon}</span>
                      <span>{g.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[#86868b] mt-1 type-caption">
                {t('profile.genderDesc') ||
                  'Chọn giới tính giúp kết nối bạn đồng hành phù hợp và an tâm (+3 điểm tín nhiệm)'}
              </p>
            </div>

            {/* Field 1b: Contact phone number */}
            <div>
              <label className="block text-[#1d1d1f] dark:text-slate-200 mb-1.5 type-label">
                {t('profile2.s014')} <span className="text-[#86868b] type-caption">{t('profile2.s015')}</span>
              </label>
              <div className="relative type-body">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('profile2.s064')}
                  className="w-full h-10 pl-9 pr-3.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all outline-none tabular type-input"
                />
                <Phone className="w-4 h-4 text-[#86868b] absolute left-3 top-3 pointer-events-none" />
              </div>
              <p className="text-[#86868b] mt-1 type-caption">
                {t('profile2.s016')}
              </p>
            </div>

            {/* Field 2: Email for appointment notifications */}
            <div>
              <label className="block text-[#1d1d1f] dark:text-slate-200 mb-1.5 type-label">
                {t('profile2.s017')} <span className="text-[#86868b] type-caption">{t('profile2.s018')}</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-10 pl-9 pr-3.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all outline-none tabular type-input"
                />
                <Mail className="w-4 h-4 text-[#86868b] absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Field 3: Area of residence & Frequent pickup points */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#1d1d1f] dark:text-slate-200 mb-1.5 type-label">
                  {t('profile2.s019')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={homeAddress}
                    onChange={(e) => setHomeAddress(e.target.value)}
                    placeholder={t('profile2.s065')}
                    className="w-full h-10 pl-8 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] outline-none type-input"
                  />
                  <MapPin className="w-3.5 h-3.5 text-[#86868b] absolute left-2.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[#1d1d1f] dark:text-slate-200 mb-1.5 type-label">
                  {t('profile2.s020')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={workAddress}
                    onChange={(e) => setWorkAddress(e.target.value)}
                    placeholder={t('profile2.s066')}
                    className="w-full h-10 pl-8 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] outline-none type-input"
                  />
                  <MapPin className="w-3.5 h-3.5 text-[#86868b] absolute left-2.5 top-3.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Field 4: Bio / Notes */}
            <div>
              <label className="block text-[#1d1d1f] dark:text-slate-200 mb-1.5 type-label">
                {t('profile2.s021')}
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                placeholder={t('profile2.s067')}
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] outline-none resize-none type-input"
              />
            </div>

            {/* ── LINKED IDENTITY ACCOUNTS (ACCOUNT LINKING & MERGING) ── */}
            <div className="pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[#1d1d1f] dark:text-slate-200 flex items-center gap-1.5 type-caption">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3]" />
                  <span>{t('profile2.s022')}</span>
                </span>
                <span className="text-[#86868b] type-caption">{t('profile2.s023')}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Google Card */}
                <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GoogleIcon className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[#1d1d1f] dark:text-white truncate type-caption">Google</p>
                      <p className="text-[#86868b] truncate type-caption">
                        {currentUser?.googleId || currentUser?.email ? (currentUser?.email || 'Đã liên kết') : 'Chưa liên kết'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full shrink-0 type-badge ${
                    currentUser?.googleId || currentUser?.email
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#86868b]'
                  }`}>
                    {currentUser?.googleId || currentUser?.email ? 'Đã liên kết' : 'Trống'}
                  </span>
                </div>

                {/* Telegram Card */}
                <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TelegramIcon className="w-4 h-4 text-[#229ED9] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[#1d1d1f] dark:text-white truncate type-caption">Telegram</p>
                      <p className="text-[#86868b] truncate type-caption">
                        {currentUser?.telegramId || currentUser?.username
                          ? `@${currentUser?.username || currentUser?.telegramId}`
                          : 'Chưa liên kết'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full shrink-0 type-badge ${
                    currentUser?.telegramId || currentUser?.username
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#86868b]'
                  }`}>
                    {currentUser?.telegramId || currentUser?.username ? 'Đã liên kết' : 'Trống'}
                  </span>
                </div>
              </div>

              <p className="text-[#86868b] type-caption">
                {t('profile2.s024')}
              </p>
            </div>

            {/* ── PRIVACY & ACCOUNT DATA MANAGEMENT (APPLE PRIVACY & STANFORD ERGONOMICS) ── */}
            <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-slate-700 dark:text-slate-300 type-caption">
                  {t('profile2.s025')}
                </p>
                <p className="text-[#86868b] type-caption">
                  {t('profile2.s026')}
                </p>
              </div>

              {currentUser?.role !== 'admin' &&
                !isAdminUser(currentUser) && (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onOpenDeleteAccount?.();
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer inline-flex items-center gap-1.5 type-button"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{t('profile2.s027')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MY VEHICLE GARAGE (MY GARAGE) */}
        {activeTab === 'garage' && (
          <div className="space-y-4 pt-1">
            {/* Vehicle ownership toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-[#1d1d1f] dark:text-white type-caption">{t('profile2.s028')}</p>
                  <p className="text-[#86868b] type-caption">
                    {t('profile2.s029')}
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer type-label">
                <input
                  type="checkbox"
                  checked={hasCar}
                  onChange={(e) => setHasCar(e.target.checked)}
                  className="sr-only peer type-input"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0071e3]" />
              </label>
            </div>

            {hasCar ? (
              <div className="space-y-4">
                {/* Car make & Car model */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#1d1d1f] dark:text-slate-200 mb-1.5 type-label">
                      {t('profile2.s030')}
                    </label>
                    <select
                      value={brand}
                      onChange={(e) => {
                        setBrand(e.target.value);
                        const models = POPULAR_MODELS[e.target.value];
                        if (models && models.length > 0) setModel(models[0]);
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-[#1d1d1f] dark:text-white focus:border-[#0071e3] outline-none cursor-pointer type-input"
                    >
                      {POPULAR_BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#1d1d1f] dark:text-slate-200 mb-1.5 type-label">
                      {t('profile2.s031')}
                    </label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="VD: Vios, Accent, CX-5, Xpander..."
                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] outline-none type-input"
                    />
                  </div>
                </div>

                {/* License plate & Paint color */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#1d1d1f] dark:text-slate-200 mb-1.5 flex items-center justify-between type-label">
                      <span>{t('profile2.s032')}</span>
                      <span className="text-[#86868b] tabular type-caption">{t('profile2.s033')}</span>
                    </label>
                    <div className="relative type-body">
                      <input
                        type="text"
                        value={plate}
                        onChange={(e) => setPlate(e.target.value.toUpperCase())}
                        placeholder="VD: 51K-892.41"
                        maxLength={12}
                        className="w-full h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] outline-none tabular type-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#1d1d1f] dark:text-slate-200 mb-1.5 type-label">
                      {t('profile2.s034')}
                    </label>
                    <select
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-[#1d1d1f] dark:text-white focus:border-[#0071e3] outline-none cursor-pointer type-input"
                    >
                      {POPULAR_COLORS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Vehicle classification & MIT Invariant on seat count */}
                <div>
                  <label className="block text-[#1d1d1f] dark:text-slate-200 mb-1.5 type-label">
                    {t('profile2.s035')} <span className="text-rose-500 type-body-strong">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCapacity(5);
                        setCarCategory('family_car');
                      }}
                      className={`p-3 rounded-2xl border text-left cursor-pointer transition-all type-button ${
                        capacity === 5
                          ? 'bg-[#0071e3]/5 dark:bg-[#0071e3]/10 border-[#0071e3] text-[#1d1d1f] dark:text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-black/[0.08] dark:border-white/[0.08] text-[#515154] hover:bg-black/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="type-caption">{t('profile2.s036')}</span>
                        {capacity === 5 && <CheckCircle2 className="w-4 h-4 text-[#0071e3]" />}
                      </div>
                      <p className="text-[#86868b] type-caption">
                        {t('profile2.s037')} <strong className="text-emerald-600 tabular type-body-strong">{t('profile2.s038')}</strong>
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCapacity(7);
                        setCarCategory('shared_van');
                      }}
                      className={`p-3 rounded-2xl border text-left cursor-pointer transition-all type-button ${
                        capacity === 7
                          ? 'bg-[#0071e3]/5 dark:bg-[#0071e3]/10 border-[#0071e3] text-[#1d1d1f] dark:text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-black/[0.08] dark:border-white/[0.08] text-[#515154] hover:bg-black/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="type-caption">{t('profile2.s039')}</span>
                        {capacity === 7 && <CheckCircle2 className="w-4 h-4 text-[#0071e3]" />}
                      </div>
                      <p className="text-[#86868b] type-caption">
                        {t('profile2.s037')} <strong className="text-emerald-600 tabular type-body-strong">{t('profile2.s040')}</strong>
                      </p>
                    </button>
                  </div>
                </div>

                {/* Amenities in the vehicle */}
                <div>
                  <label className="block text-[#1d1d1f] dark:text-slate-200 mb-1.5 type-label">
                    {t('profile2.s041')}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {VEHICLE_PERKS.map((perk) => {
                      const selected = selectedPerks.includes(perk);
                      return (
                        <button
                          key={perk}
                          type="button"
                          onClick={() => togglePerk(perk)}
                          className={`px-3 py-1.5 rounded-full cursor-pointer transition-all type-button ${
                            selected
                              ? 'bg-[#0071e3] text-white shadow-2xs'
                              : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#515154] dark:text-slate-300 hover:bg-black/[0.08]'
                          }`}
                        >
                          {perk}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SET OF GENUINE OWNER'S REAL VEHICLE PHOTOS (3 - 5 PHOTOS) */}
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-[#1d1d1f] dark:text-white flex items-center gap-1.5 type-heading">
                        <Camera className="w-3.5 h-3.5 text-[#0071e3]" />
                        <span>{t('profile2.s042')}</span>
                        <span className="text-[#0071e3] tabular type-caption">
                          ({validPhotosCount}/5 ảnh)
                        </span>
                      </h4>
                      <p className="text-[#86868b] type-caption">
                        {t('profile2.s043')} <strong className="type-body-strong">{t('profile2.s044')}</strong>
                      </p>
                    </div>

                    {isVerifiedCar ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 inline-flex items-center gap-1 type-badge">
                        <CheckCircle2 className="w-3 h-3" /> {t('profile2.s045')}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 type-badge">
                        Cần thêm {Math.max(0, 3 - validPhotosCount)} ảnh nữa
                      </span>
                    )}
                  </div>

                  {/* 5-cell Squircle photo grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {PHOTO_SLOTS.map((slot, index) => {
                      const photoUrl = photos[index];
                      return (
                        <div
                          key={slot.id}
                          className="relative group rounded-2xl overflow-hidden aspect-4/3 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] flex flex-col items-center justify-center text-center p-2 transition-all hover:border-[#0071e3]/40"
                        >
                          <input
                            type="file"
                            accept="image/*"
                            ref={(el) => (fileInputRefs.current[index] = el)}
                            onChange={(e) => handlePhotoUpload(index, e)}
                            className="hidden type-input"
                          />

                          {photoUrl ? (
                            <>
                              <img
                                src={photoUrl}
                                alt={slot.label}
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => fileInputRefs.current[index]?.click()}
                                  title={t('profile2.s068')}
                                  className="w-11 h-11 rounded-full bg-white/90 text-slate-800 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer shadow-md type-button"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(index)}
                                  title={t('profile2.s008')}
                                  className="w-11 h-11 rounded-full bg-rose-500/90 text-white flex items-center justify-center hover:scale-110 transition-transform cursor-pointer shadow-md type-button"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="absolute bottom-1.5 left-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white truncate type-caption">
                                {slot.label}
                              </div>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[index]?.click()}
                              className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-2 type-button"
                            >
                              <div className="w-11 h-11 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-[#86868b] group-hover:text-[#0071e3] group-hover:scale-110 transition-all mb-1">
                                <Camera className="w-4 h-4" />
                              </div>
                              <span className="text-[#1d1d1f] dark:text-slate-200 type-caption">
                                {slot.label}
                              </span>
                              <span className="text-[#86868b] type-caption">{slot.sub}</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-dashed border-black/[0.08] dark:border-white/[0.08]">
                <Car className="w-8 h-8 text-[#86868b] mx-auto mb-2 opacity-50" />
                <p className="text-[#1d1d1f] dark:text-white type-caption">{t('profile2.s046')}</p>
                <p className="text-[#86868b] mt-1 max-w-sm mx-auto type-caption">
                  {t('profile2.s047')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TRUST & DOCUMENTS (DYNAMIC TRUST & REPUTATION ENGINE) */}
        {activeTab === 'trust' && (
          <div className="space-y-4 pt-1 type-body">
            {/* Trust Score Gauge */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-700 dark:text-emerald-400 type-caption">
                      {t('profile2.s048')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full type-badge ${
                        trustCalc.level.badgeColor === 'purple'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : trustCalc.level.badgeColor === 'amber'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : trustCalc.level.badgeColor === 'emerald'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                      }`}
                    >
                      {trustCalc.level.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-emerald-700 dark:text-emerald-400 tabular type-metric">
                      {trustCalc.score}
                    </h3>
                    <span className="text-emerald-600/70 tabular type-body-strong">{t('profile2.s049')}</span>
                    {trustCalc.isCapApplied && (
                      <span className="text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full type-badge">
                        🔒 Đạt {trustCalc.rawScore}đ (Bị khóa trần {trustCalc.capLimit}đ)
                      </span>
                    )}
                  </div>
                  <p className="text-[#515154] dark:text-slate-300 mt-1 type-caption">
                    {trustCalc.level.description} • Áp dụng theo vai trò <strong className="type-body-strong">{hasCar ? 'Chủ xe' : 'Người đi cùng'}</strong>
                  </p>
                </div>

                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldCheck className="w-8 h-8" />
                </div>
              </div>

              {/* Progress Bar with Tier Marks */}
              <div className="space-y-1.5 pt-1 type-body">
                <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative type-body">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, Math.min(100, trustCalc.score))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-slate-400 tabular type-caption">
                  <span>{t('profile2.s050')}</span>
                  <span>{t('profile2.s051')}</span>
                  <span>{t('profile2.s052')}</span>
                  <span>{t('profile2.s053')}</span>
                  <span>{t('profile2.s054')}</span>
                </div>
              </div>
            </div>

            {/* Score ceiling warning when the avatar is missing (Missing Avatar Invariant) */}
            {trustCalc.isCapApplied && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 flex items-start gap-3.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <p className="text-amber-900 dark:text-amber-300 type-caption">
                    Điểm số thực tế của bạn là {trustCalc.rawScore}đ, nhưng bị giới hạn ở trần {trustCalc.capLimit}đ
                  </p>
                  <p className="text-amber-800/90 dark:text-amber-300/90 type-body">
                    Theo Tiêu chuẩn Tín nhiệm CarMate, thành viên chưa cập nhật ảnh đại diện chính diện sẽ không thể vượt qua {trustCalc.capLimit} điểm nhằm đảm bảo an toàn tuyệt đối và loại bỏ tài khoản ẩn danh trên toàn sàn.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('profile');
                      setTimeout(() => avatarInputRef.current?.click(), 100);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer transition-all mt-1 type-button"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {t('profile2.s055')}
                  </button>
                </div>
              </div>
            )}

            {/* List of criteria achieved */}
            <div className="space-y-2">
              <span className="text-slate-400 tabular type-caption">
                Tiêu chí đã tích lũy ({trustCalc.earnedCriteria.length})
              </span>
              <div className="space-y-1.5">
                {trustCalc.earnedCriteria.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                      <span className="text-[#1d1d1f] dark:text-white type-caption">
                        {item.title}
                      </span>
                    </div>
                    <span className="text-emerald-600 tabular type-caption">
                      +{item.points}đ
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggestions for next behaviors to earn points (Stanford B=MAP) */}
            {trustCalc.pendingCriteria.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-slate-400 tabular type-caption">
                  Gợi ý hành vi nâng điểm tín nhiệm ({trustCalc.pendingCriteria.length})
                </span>
                <div className="space-y-2">
                  {trustCalc.pendingCriteria.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900 dark:text-white type-caption">
                            {item.title}
                          </span>
                          <span className="text-sky-600 bg-sky-50 dark:bg-sky-950 px-1.5 py-0.5 rounded tabular type-badge">
                            +{item.points}đ
                          </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 type-caption">
                          {item.description}
                        </p>
                      </div>

                      {item.actionType === 'upload_avatar' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('profile');
                            setTimeout(() => avatarInputRef.current?.click(), 100);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer text-center type-button"
                        >
                          {t('profile2.s056')}
                        </button>
                      )}

                      {(item.actionType === 'upload_vehicle_photos' || item.actionType === 'register_vehicle') && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('garage')}
                          className="px-3 py-1.5 rounded-lg bg-[#0071e3] hover:bg-[#0077ed] text-white shrink-0 cursor-pointer text-center type-button"
                        >
                          {t('profile2.s057')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Penalty deductions (if any) */}
            {trustCalc.penalties.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-1.5">
                <span className="text-rose-800 dark:text-rose-300 type-caption">
                  Lịch sử ghi nhận trừ điểm ({trustCalc.penalties.length})
                </span>
                <div className="space-y-1">
                  {trustCalc.penalties.map((pen) => (
                    <div key={pen.id} className="flex items-center justify-between text-rose-700 dark:text-rose-400 type-caption">
                      <span>• {pen.title}</span>
                      <span className="tabular type-body-strong">{pen.points}đ</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CarMate cultural creed */}
            <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.06] text-[#515154] dark:text-slate-400 space-y-1 type-caption">
              <p className="type-body">
                💡 <strong className="type-body-strong">{t('profile2.s058')}</strong> {t('profile2.s059')}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
