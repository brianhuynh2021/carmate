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

// Danh sách hãng xe phổ biến tại Việt Nam
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

// Danh sách mẫu xe phổ biến
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

// Màu xe phổ biến
const POPULAR_COLORS = ['Trắng', 'Đen', 'Bạc / Xám', 'Đỏ', 'Xanh dương', 'Vàng cát / Nâu'];

// Tiện nghi xe phổ biến
const VEHICLE_PERKS = [
  'Không hút thuốc',
  'Máy lạnh mát mẻ',
  'Nước suối miễn phí',
  'Cốp rộng chứa hành lý',
  'Wifi & Cổng sạc nhanh',
  'Nhận chở thú cưng nhỏ'
];

// Các vị trí ảnh xe tiêu chuẩn
const PHOTO_SLOTS = [
  { id: 0, label: 'Mặt trước xe', sub: 'Rõ biển số', required: true },
  { id: 1, label: 'Góc nghiêng thân xe', sub: 'Tổng thể xe', required: true },
  { id: 2, label: 'Nội thất khoang khách', sub: 'Ghế ngồi sạch sẽ', required: true },
  { id: 3, label: 'Mặt sau đuôi xe', sub: 'Cốp xe & Biển số', required: false },
  { id: 4, label: 'Không gian cốp', sub: 'Chỗ để hành lý', required: false }
];

/**
 * Nén ảnh sang chuẩn WebP trực tiếp trên Client (Canvas API)
 * Tốc độ ~15ms, kích thước giảm từ 5MB xuống ~120KB mà giữ nguyên độ nét
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
  const [formError, setFormError] = useState('');

  // 1. State Thông tin cá nhân
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

  // 2. State Garage xe
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

  // Đếm số ảnh hợp lệ
  const validPhotosCount = useMemo(() => photos.filter(Boolean).length, [photos]);
  const isVerifiedCar = validPhotosCount >= 3;

  // Toggle tiện nghi xe
  const togglePerk = (perk) => {
    setSelectedPerks((prev) =>
      prev.includes(perk) ? prev.filter((p) => p !== perk) : [...prev, perk]
    );
  };

  // Nạp quy tắc tín nhiệm công khai từ máy chủ
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

  // Tính toán Tín nhiệm động theo 4 trụ cột (MIT & Stanford)
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

  // Upload & Nén ảnh WebP
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

  // Xử lý nén và cập nhật ảnh đại diện cá nhân
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressingAvatar(true);
    setFormError('');
    try {
      // Nén ảnh vuông 400x400 WebP chuẩn avatar chất lượng cao (~25KB, tải 0ms)
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

  // Xóa ảnh ở slot
  const handleRemovePhoto = (index) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = '';
      return next;
    });
  };

  // Validate & Lưu thông tin
  const handleSave = async (e) => {
    e?.preventDefault();
    setFormError('');

    // Kiểm tra tên
    if (!name.trim()) {
      setFormError('Vui lòng nhập họ và tên hiển thị');
      setActiveTab('profile');
      return;
    }

    // Kiểm tra số điện thoại nếu có nhập
    if (phone.trim()) {
      const rawP = phone.trim().replace(/\D/g, '');
      if (rawP.length < 9 || rawP.length > 11) {
        setFormError('Số điện thoại không đúng định dạng (yêu cầu 10 chữ số)');
        setActiveTab('profile');
        return;
      }
    }

    // Kiểm tra email nếu có nhập
    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setFormError('Địa chỉ email không đúng định dạng');
        setActiveTab('profile');
        return;
      }
    }

    // Kiểm tra biển số xe nếu bật có xe
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

    // Đóng gói payload cập nhật
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
      onClose?.();
    } catch (err) {
      setFormError(err.message || 'Không thể lưu hồ sơ, vui lòng thử lại');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Hồ sơ & Garage của tôi"
      subtitle={currentUser?.phone ? `Tài khoản: ${currentUser.phone}` : 'Quản lý thông tin & phương tiện'}
      icon={User}
      iconTone="primary"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl text-xs font-semibold text-[#515154] dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-10 px-6 rounded-xl text-xs font-semibold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-[0_2px_8px_rgba(0,113,227,0.3)] transition-all cursor-pointer inline-flex items-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Lưu thay đổi</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Lỗi Form nếu có */}
        {formError && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Apple Segmented Capsule Tab Control - Ghim cố định khi cuộn */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md pb-2 -mt-1 pt-0.5">
          <div className="p-1 rounded-2xl bg-[#e8e8ed] dark:bg-slate-800/80 border border-black/[0.05] dark:border-white/[0.06] flex items-center gap-1 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex-1 h-9 rounded-xl inline-flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer transition-all ${
                activeTab === 'profile'
                  ? 'bg-white dark:bg-slate-700 text-[#1d1d1f] dark:text-white shadow-xs'
                  : 'text-[#515154] dark:text-slate-300 hover:text-[#1d1d1f]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Thông tin cá nhân</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('garage')}
              className={`flex-1 h-9 rounded-xl inline-flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer transition-all relative ${
                activeTab === 'garage'
                  ? 'bg-white dark:bg-slate-700 text-[#1d1d1f] dark:text-white shadow-xs'
                  : 'text-[#515154] dark:text-slate-300 hover:text-[#1d1d1f]'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Garage xe của tôi</span>
              {hasCar && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5" title="Đã có cấu hình xe" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trust')}
              className={`flex-1 h-9 rounded-xl inline-flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer transition-all ${
                activeTab === 'trust'
                  ? 'bg-white dark:bg-slate-700 text-[#1d1d1f] dark:text-white shadow-xs'
                  : 'text-[#515154] dark:text-slate-300 hover:text-[#1d1d1f]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Tín nhiệm & Giấy tờ</span>
            </button>
          </div>
        </div>

        {/* TAB 1: THÔNG TIN CÁ NHÂN */}
        {activeTab === 'profile' && (
          <div className="space-y-4 pt-1">
            {/* Header Thẻ đại diện với tính năng cập nhật ảnh chân dung/avatar */}
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.06]">
              <div
                className="relative group/avatar cursor-pointer shrink-0"
                onClick={() => avatarInputRef.current?.click()}
                title="Chạm để đổi ảnh đại diện cá nhân"
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

                {/* Overlay camera khi hover hoặc đang nén ảnh */}
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

                {/* Huy hiệu camera mini góc dưới */}
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#0071e3] text-white border-2 border-white dark:border-[#1c1c1e] flex items-center justify-center shadow-xs cursor-pointer hover:bg-[#0077ed] transition-transform active:scale-90">
                  <Camera className="w-2.5 h-2.5" />
                </span>
              </div>

              {/* Input file ẩn */}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-[#1d1d1f] dark:text-white truncate">
                    {name || 'Chưa đặt tên hiển thị'}
                  </h4>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                    Đã xác thực
                  </span>
                </div>
                <p className="text-xs text-[#86868b] font-mono mt-0.5">
                  {phone || currentUser?.phone || currentUser?.email || 'Chưa liên kết SĐT'}
                </p>

                {/* Nút hành động ảnh đại diện */}
                <div className="flex items-center gap-2.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isCompressingAvatar}
                    className="text-[11.5px] font-semibold text-[#0071e3] hover:underline cursor-pointer inline-flex items-center gap-1"
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
                      className="text-[11.5px] text-rose-500 hover:text-rose-600 font-medium cursor-pointer"
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Trường 1: Tên hiển thị */}
            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 mb-1.5">
                Họ và tên hiển thị <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn Hùng"
                  className="w-full h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-xs text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all outline-none"
                />
              </div>
              <p className="text-[11px] text-[#86868b] mt-1">
                Tên hiển thị giúp Người đi cùng hoặc Chủ xe nhận diện trên danh sách và xác nhận lịch hẹn.
              </p>
              {name && (name.startsWith('Thành viên USR-') || name.startsWith('USR-')) && (
                <div className="mt-1.5 flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300">
                  <span>💡 Bạn có thể đổi sang tên thật hoặc tên thường gọi (VD: Minh Nhật) để tiện xưng hô.</span>
                  <button
                    type="button"
                    onClick={() => setName('')}
                    className="text-amber-900 dark:text-amber-200 font-bold underline shrink-0 cursor-pointer hover:opacity-80"
                  >
                    Đổi tên
                  </button>
                </div>
              )}
            </div>

            {/* Trường 1b: Giới tính (Apple Segmented Control) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#1d1d1f] dark:text-slate-200">
                  {t('profile.gender') || 'Giới tính'}
                </label>
                <span className="text-[10.5px] font-bold text-[#0071e3] bg-[#0071e3]/10 px-2 py-0.5 rounded-full">
                  +3đ Tín nhiệm
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
                      className={`h-10 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 border select-none ${
                        isSelected
                          ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-[0_2px_8px_rgba(0,113,227,0.25)]'
                          : 'bg-white dark:bg-slate-900 text-[#515154] dark:text-slate-300 border-black/[0.1] dark:border-white/[0.12] hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="text-sm">{g.icon}</span>
                      <span>{g.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#86868b] mt-1">
                {t('profile.genderDesc') ||
                  'Chọn giới tính giúp kết nối bạn đồng hành phù hợp và an tâm (+3 điểm tín nhiệm)'}
              </p>
            </div>

            {/* Trường 1b: Số điện thoại liên hệ */}
            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 mb-1.5">
                Số điện thoại liên hệ <span className="text-[11px] font-normal text-[#86868b]">(Gọi đón xe & Zalo)</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ví dụ: 0984 883 750"
                  className="w-full h-10 pl-9 pr-3.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-xs text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all outline-none font-mono"
                />
                <Phone className="w-4 h-4 text-[#86868b] absolute left-3 top-3 pointer-events-none" />
              </div>
              <p className="text-[11px] text-[#86868b] mt-1">
                Dùng để Chủ xe và Người đi cùng gọi điện hoặc gửi tin nhắn Zalo chốt điểm hẹn đón.
              </p>
            </div>

            {/* Trường 2: Email nhận thông báo lịch hẹn */}
            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 mb-1.5">
                Địa chỉ Email <span className="text-[11px] font-normal text-[#86868b]">(Nhận thông báo lịch hẹn)</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-10 pl-9 pr-3.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-xs text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all outline-none font-mono"
                />
                <Mail className="w-4 h-4 text-[#86868b] absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Trường 3: Khu vực sinh sống & Điểm đón thường xuyên */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 mb-1.5">
                  Khu vực thường ở
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={homeAddress}
                    onChange={(e) => setHomeAddress(e.target.value)}
                    placeholder="VD: Quận 1, TP.HCM"
                    className="w-full h-10 pl-8 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-xs text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] outline-none"
                  />
                  <MapPin className="w-3.5 h-3.5 text-[#86868b] absolute left-2.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 mb-1.5">
                  Khu vực làm việc / Điểm đến
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={workAddress}
                    onChange={(e) => setWorkAddress(e.target.value)}
                    placeholder="VD: TP. Vũng Tàu"
                    className="w-full h-10 pl-8 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-xs text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] outline-none"
                  />
                  <MapPin className="w-3.5 h-3.5 text-[#86868b] absolute left-2.5 top-3.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Trường 4: Giới thiệu / Lưu ý */}
            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 mb-1.5">
                Giới thiệu ngắn / Phong cách đi xe
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                placeholder="VD: Đi lại hàng tuần thứ 2 và thứ 6, tính tình vui vẻ, xe gia đình giữ gìn sạch sẽ..."
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-xs text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] outline-none resize-none"
              />
            </div>

            {/* ── TÀI KHOẢN ĐỊNH DANH ĐÃ LIÊN KẾT (ACCOUNT LINKING & MERGING) ── */}
            <div className="pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1d1d1f] dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3]" />
                  <span>Tài khoản định danh liên kết</span>
                </span>
                <span className="text-[11px] text-[#86868b]">Tự động hợp nhất 1 tài khoản</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Thẻ Google */}
                <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GoogleIcon className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#1d1d1f] dark:text-white truncate">Google</p>
                      <p className="text-[10px] text-[#86868b] truncate">
                        {currentUser?.googleId || currentUser?.email ? (currentUser?.email || 'Đã liên kết') : 'Chưa liên kết'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    currentUser?.googleId || currentUser?.email
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#86868b]'
                  }`}>
                    {currentUser?.googleId || currentUser?.email ? 'Đã liên kết' : 'Trống'}
                  </span>
                </div>

                {/* Thẻ Telegram */}
                <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TelegramIcon className="w-4 h-4 text-[#229ED9] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#1d1d1f] dark:text-white truncate">Telegram</p>
                      <p className="text-[10px] text-[#86868b] truncate">
                        {currentUser?.telegramId || currentUser?.username
                          ? `@${currentUser?.username || currentUser?.telegramId}`
                          : 'Chưa liên kết'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    currentUser?.telegramId || currentUser?.username
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#86868b]'
                  }`}>
                    {currentUser?.telegramId || currentUser?.username ? 'Đã liên kết' : 'Trống'}
                  </span>
                </div>
              </div>

              <p className="text-[10.5px] text-[#86868b] leading-relaxed">
                CarMate tự động đối soát Số điện thoại và Email để hợp nhất tài khoản Google & Telegram làm 1, không tạo 2 tài khoản trùng lặp.
              </p>
            </div>

            {/* ── QUYỀN RIÊNG TƯ & QUẢN LÝ DỮ LIỆU TÀI KHOẢN (APPLE PRIVACY & STANFORD ERGONOMICS) ── */}
            <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Quyền riêng tư & Quản lý tài khoản
                </p>
                <p className="text-[10.5px] text-[#86868b]">
                  Dữ liệu cá nhân được bảo vệ theo Nghị định 13/2023/NĐ-CP
                </p>
              </div>

              {currentUser?.role !== 'admin' &&
                !currentUser?.phone?.includes('0984883750') &&
                !currentUser?.phone?.includes('0984 883 750') && (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onOpenDeleteAccount?.();
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Yêu cầu xóa tài khoản...</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: GARAGE XE CỦA TÔI (MY GARAGE) */}
        {activeTab === 'garage' && (
          <div className="space-y-4 pt-1">
            {/* Toggle Sở hữu xe */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#1d1d1f] dark:text-white">Tôi là Chủ xe có phương tiện</p>
                  <p className="text-[11px] text-[#86868b]">
                    Lưu xe vào Garage để tự động điền 100% khi Đăng chuyến chia sẻ
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCar}
                  onChange={(e) => setHasCar(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0071e3]" />
              </label>
            </div>

            {hasCar ? (
              <div className="space-y-4">
                {/* Hãng xe & Mẫu xe */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 mb-1.5">
                      Hãng xe (Brand)
                    </label>
                    <select
                      value={brand}
                      onChange={(e) => {
                        setBrand(e.target.value);
                        const models = POPULAR_MODELS[e.target.value];
                        if (models && models.length > 0) setModel(models[0]);
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-xs text-[#1d1d1f] dark:text-white focus:border-[#0071e3] outline-none cursor-pointer"
                    >
                      {POPULAR_BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 mb-1.5">
                      Dòng xe / Đời xe (Model)
                    </label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="VD: Vios, Accent, CX-5, Xpander..."
                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-xs text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] outline-none"
                    />
                  </div>
                </div>

                {/* Biển số xe & Màu sơn */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 mb-1.5 flex items-center justify-between">
                      <span>Biển số xe Việt Nam</span>
                      <span className="text-[10px] text-[#86868b] font-normal font-mono">Định dạng 51K-892.41</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={plate}
                        onChange={(e) => setPlate(e.target.value.toUpperCase())}
                        placeholder="VD: 51K-892.41"
                        maxLength={12}
                        className="w-full h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-xs font-mono font-bold tracking-wider text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:border-[#0071e3] outline-none uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 mb-1.5">
                      Màu sơn ngoại thất
                    </label>
                    <select
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.12] text-xs text-[#1d1d1f] dark:text-white focus:border-[#0071e3] outline-none cursor-pointer"
                    >
                      {POPULAR_COLORS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Phân loại xe & Bất biến MIT Invariant số ghế */}
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 mb-1.5">
                    Phân loại & Số ghế xe <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCapacity(5);
                        setCarCategory('family_car');
                      }}
                      className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                        capacity === 5
                          ? 'bg-[#0071e3]/5 dark:bg-[#0071e3]/10 border-[#0071e3] text-[#1d1d1f] dark:text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-black/[0.08] dark:border-white/[0.08] text-[#515154] hover:bg-black/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">Xe 5 chỗ (Sedan/SUV)</span>
                        {capacity === 5 && <CheckCircle2 className="w-4 h-4 text-[#0071e3]" />}
                      </div>
                      <p className="text-[11px] text-[#86868b]">
                        Chủ xe + Tối đa <strong className="text-emerald-600 font-mono">4 khách</strong>
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCapacity(7);
                        setCarCategory('shared_van');
                      }}
                      className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                        capacity === 7
                          ? 'bg-[#0071e3]/5 dark:bg-[#0071e3]/10 border-[#0071e3] text-[#1d1d1f] dark:text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-black/[0.08] dark:border-white/[0.08] text-[#515154] hover:bg-black/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">Xe 7 chỗ (MPV/SUV)</span>
                        {capacity === 7 && <CheckCircle2 className="w-4 h-4 text-[#0071e3]" />}
                      </div>
                      <p className="text-[11px] text-[#86868b]">
                        Chủ xe + Tối đa <strong className="text-emerald-600 font-mono">6 khách</strong>
                      </p>
                    </button>
                  </div>
                </div>

                {/* Tiện nghi trên xe */}
                <div>
                  <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-slate-200 mb-1.5">
                    Tiện nghi & Quy định trên xe
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {VEHICLE_PERKS.map((perk) => {
                      const selected = selectedPerks.includes(perk);
                      return (
                        <button
                          key={perk}
                          type="button"
                          onClick={() => togglePerk(perk)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${
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

                {/* BỘ ẢNH XE THẬT CHÍNH CHỦ (3 - 5 ẢNH) */}
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-xs font-bold text-[#1d1d1f] dark:text-white flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-[#0071e3]" />
                        <span>Bộ ảnh xe thật chính chủ</span>
                        <span className="text-[10px] font-mono font-bold text-[#0071e3]">
                          ({validPhotosCount}/5 ảnh)
                        </span>
                      </h4>
                      <p className="text-[11px] text-[#86868b]">
                        Tối thiểu 3 góc ảnh thực tế để đạt huy hiệu <strong>"Xe thật chính chủ"</strong>
                      </p>
                    </div>

                    {isVerifiedCar ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Đạt chuẩn xe thật (+10đ Karma)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                        Cần thêm {Math.max(0, 3 - validPhotosCount)} ảnh nữa
                      </span>
                    )}
                  </div>

                  {/* Lưới 5 ô ảnh Squircle */}
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
                            className="hidden"
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
                                  title="Thay ảnh này"
                                  className="w-11 h-11 rounded-full bg-white/90 text-slate-800 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer shadow-md"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(index)}
                                  title="Xóa ảnh"
                                  className="w-11 h-11 rounded-full bg-rose-500/90 text-white flex items-center justify-center hover:scale-110 transition-transform cursor-pointer shadow-md"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="absolute bottom-1.5 left-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] text-white truncate font-medium">
                                {slot.label}
                              </div>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[index]?.click()}
                              className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-2"
                            >
                              <div className="w-11 h-11 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-[#86868b] group-hover:text-[#0071e3] group-hover:scale-110 transition-all mb-1">
                                <Camera className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-semibold text-[#1d1d1f] dark:text-slate-200">
                                {slot.label}
                              </span>
                              <span className="text-[10px] text-[#86868b]">{slot.sub}</span>
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
                <p className="text-xs font-semibold text-[#1d1d1f] dark:text-white">Bạn đang ở vai trò Người đi cùng (Khách ghép chuyến)</p>
                <p className="text-[11px] text-[#86868b] mt-1 max-w-sm mx-auto">
                  Nếu bạn sở hữu ô tô và muốn đăng chuyến chia sẻ chi phí xăng dầu, hãy bật công tắc bên trên để cấu hình xe.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TÍN NHIỆM & GIẤY TỜ (DYNAMIC TRUST & REPUTATION ENGINE) */}
        {activeTab === 'trust' && (
          <div className="space-y-4 pt-1">
            {/* Điểm Tín nhiệm Gauge */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Chỉ số Tín nhiệm Cộng đồng
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                    <h3 className="text-3xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                      {trustCalc.score}
                    </h3>
                    <span className="text-sm font-semibold text-emerald-600/70 font-mono">/ 100 điểm</span>
                    {trustCalc.isCapApplied && (
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                        🔒 Đạt {trustCalc.rawScore}đ (Bị khóa trần {trustCalc.capLimit}đ)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#515154] dark:text-slate-300 mt-1">
                    {trustCalc.level.description} • Áp dụng theo vai trò <strong>{hasCar ? 'Chủ xe' : 'Người đi cùng'}</strong>
                  </p>
                </div>

                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldCheck className="w-8 h-8" />
                </div>
              </div>

              {/* Progress Bar with Tier Marks */}
              <div className="space-y-1.5 pt-1">
                <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, Math.min(100, trustCalc.score))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>50đ (Cơ bản)</span>
                  <span>65đ (Trần ko avatar)</span>
                  <span>80đ (Tín nhiệm)</span>
                  <span>90đ (Tinh hoa)</span>
                  <span>100đ (Tuyệt đối)</span>
                </div>
              </div>
            </div>

            {/* Cảnh báo trần điểm khi thiếu ảnh đại diện (Missing Avatar Invariant) */}
            {trustCalc.isCapApplied && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 flex items-start gap-3.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-300">
                    Điểm số thực tế của bạn là {trustCalc.rawScore}đ, nhưng bị giới hạn ở trần {trustCalc.capLimit}đ
                  </p>
                  <p className="text-[11.5px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    Theo Bất biến Tín nhiệm CarMate, thành viên chưa cập nhật ảnh đại diện chính diện sẽ không thể vượt qua {trustCalc.capLimit} điểm nhằm đảm bảo an toàn tuyệt đối và loại bỏ tài khoản ẩn danh trên toàn sàn.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('profile');
                      setTimeout(() => avatarInputRef.current?.click(), 100);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-all mt-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Cập nhật ảnh đại diện ngay (+5đ & Mở trần 100đ)
                  </button>
                </div>
              </div>
            )}

            {/* Danh sách tiêu chí đã đạt */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase font-bold text-slate-400">
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
                      <span className="text-xs font-bold text-[#1d1d1f] dark:text-white">
                        {item.title}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-600">
                      +{item.points}đ
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gợi ý hành vi kế tiếp để tăng điểm (Stanford B=MAP) */}
            {trustCalc.pendingCriteria.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-mono uppercase font-bold text-slate-400">
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
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {item.title}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-sky-600 bg-sky-50 dark:bg-sky-950 px-1.5 py-0.5 rounded">
                            +{item.points}đ
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 cursor-pointer text-center"
                        >
                          Tải ảnh ngay
                        </button>
                      )}

                      {(item.actionType === 'upload_vehicle_photos' || item.actionType === 'register_vehicle') && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('garage')}
                          className="px-3 py-1.5 rounded-lg bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold shrink-0 cursor-pointer text-center"
                        >
                          Vào Garage xe
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Các khoản khấu trừ phạt (nếu có) */}
            {trustCalc.penalties.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-1.5">
                <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                  Lịch sử ghi nhận trừ điểm ({trustCalc.penalties.length})
                </span>
                <div className="space-y-1">
                  {trustCalc.penalties.map((pen) => (
                    <div key={pen.id} className="flex items-center justify-between text-xs text-rose-700 dark:text-rose-400 font-medium">
                      <span>• {pen.title}</span>
                      <span className="font-mono font-bold">{pen.points}đ</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tôn chỉ văn hóa CarMate */}
            <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.06] text-[11px] text-[#515154] dark:text-slate-400 space-y-1 leading-relaxed">
              <p>
                💡 <strong>Tôn chỉ CarMate:</strong> Điểm tín nhiệm được xây dựng dựa trên sự minh bạch thông tin, văn hóa đúng giờ và các chuyến đi an toàn thực tế. Điểm số tuyệt đối 100/100 là phần thưởng danh dự cho những thành viên kỳ cựu mẫu mực của cộng đồng.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
