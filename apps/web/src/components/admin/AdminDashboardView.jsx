import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Cpu,
  Server,
  Eye,
  EyeOff,
  Trash2,
  Ban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Car,
  Users,
  Search,
  Lock,
  LogOut,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  BarChart3,
  TrendingUp,
  Compass,
  Send
} from 'lucide-react';
import api from '../../api/client.js';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import { formatVND } from '@carmate/shared';

const ADMIN_TOKEN_KEY = 'carmate_admin_token';

export default function AdminDashboardView({ onExitAdmin }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(sessionStorage.getItem(ADMIN_TOKEN_KEY));
  });
  const [passcode, setPasscode] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSessionId, setMfaSessionId] = useState('');
  const [requireMfa, setRequireMfa] = useState(false);
  const [mfaViaTelegram, setMfaViaTelegram] = useState(false);
  const [mfaCountdown, setMfaCountdown] = useState(180); // 3 phút
  const [isResendingMfa, setIsResendingMfa] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [activeTab, setActiveTab] = useState('trips'); // 'trips' | 'users' | 'reports' | 'ai' | 'analytics'

  // Data states
  const [metrics, setMetrics] = useState(null);
  const [trips, setTrips] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState(null);
  const [aiIntelligence, setAiIntelligence] = useState(null);
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusNotice, setStatusNotice] = useState(null);

  // Đếm ngược thời gian hết hạn OTP 3 phút
  useEffect(() => {
    let timer;
    if (requireMfa && mfaCountdown > 0) {
      timer = setInterval(() => {
        setMfaCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [requireMfa, mfaCountdown]);

  const showNotice = (msg) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  // 1. Xác thực đăng nhập Admin (Hỗ trợ MFA 2 lớp qua Telegram)
  const handleLogin = async (e) => {
    e?.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setIsLoading(true);

    try {
      const res = await api.adminAuth(passcode.trim(), mfaCode.trim(), mfaSessionId);
      if (res.requireMfa) {
        setRequireMfa(true);
        setMfaSessionId(res.mfaSessionId || '');
        setMfaViaTelegram(Boolean(res.viaTelegram));
        setMfaCountdown(180);
        setIsLoading(false);
        return;
      }
      if (res.success && res.token) {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, res.token);
        setIsAuthenticated(true);
        loadAllAdminData();
      }
    } catch (err) {
      setAuthError(err.message || 'Mã bảo mật không đúng');
    } finally {
      setIsLoading(false);
    }
  };

  // Gửi lại mã OTP qua Telegram
  const handleResendOtp = async () => {
    if (!mfaSessionId || isResendingMfa) return;
    setIsResendingMfa(true);
    setAuthError('');
    try {
      const res = await api.resendAdminMfa(mfaSessionId);
      if (res.success) {
        setMfaCountdown(180);
        setAuthNotice('Đã gửi lại mã OTP mới qua Telegram!');
        setTimeout(() => setAuthNotice(''), 4000);
      }
    } catch (err) {
      setAuthError(err.message || 'Không thể gửi lại mã OTP');
    } finally {
      setIsResendingMfa(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setIsAuthenticated(false);
    setPasscode('');
    setMfaCode('');
    setMfaSessionId('');
    setRequireMfa(false);
    setAuthNotice('');
  };

  // 2. Nạp toàn bộ dữ liệu quản trị
  const loadAllAdminData = async () => {
    setIsLoading(true);
    try {
      const [metricsRes, tripsRes, usersRes, reportsRes, aiRes, analyticsRes] = await Promise.allSettled([
        api.getAdminMetrics(),
        api.getAdminTrips(),
        api.getAdminUsers(),
        api.getAdminReports(),
        api.getAdminAiIntelligence(),
        api.getAdminAnalyticsSummary()
      ]);

      if (metricsRes.status === 'fulfilled' && metricsRes.value?.success) {
        setMetrics(metricsRes.value.data);
      }
      if (tripsRes.status === 'fulfilled' && tripsRes.value?.success) {
        setTrips(tripsRes.value.data || []);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value?.success) {
        setUsers(usersRes.value.data || []);
      }
      if (reportsRes.status === 'fulfilled' && reportsRes.value?.success) {
        setReports(reportsRes.value.data || null);
      }
      if (aiRes.status === 'fulfilled' && aiRes.value?.success) {
        setAiIntelligence(aiRes.value.data || null);
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.success) {
        setAnalyticsSummary(analyticsRes.value.data || null);
      }
    } catch (err) {
      console.warn('[Admin] Lỗi nạp dữ liệu:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadAllAdminData();
    }
  }, [isAuthenticated]);

  // 3. Các thao tác can thiệp quản trị
  const handleToggleHideTrip = async (tripId, currentHidden) => {
    const nextHidden = !currentHidden;
    try {
      await api.toggleHideTrip(tripId, nextHidden);
      setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, isHidden: nextHidden } : t)));
      showNotice(nextHidden ? 'Đã ẩn bài đăng khỏi bảng tin công khai' : 'Đã khôi phục hiển thị bài đăng');
      // Tải lại metrics
      api.getAdminMetrics().then((res) => res?.success && setMetrics(res.data));
    } catch (err) {
      alert('Lỗi thao tác: ' + err.message);
    }
  };

  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xoá vĩnh viễn bài đăng ${tripId}? Thao tác này không thể hoàn tác.`)) {
      return;
    }
    try {
      await api.deleteAdminTrip(tripId);
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
      showNotice('Đã xoá vĩnh viễn bài đăng chuyến xe');
      api.getAdminMetrics().then((res) => res?.success && setMetrics(res.data));
    } catch (err) {
      alert('Lỗi xoá: ' + err.message);
    }
  };

  const handleToggleVerify = async (user, field) => {
    const nextVal = !user[field];
    try {
      await api.updateUserStatus(user.id, { [field]: nextVal });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, [field]: nextVal } : u)));
      showNotice(`Đã cập nhật xác minh ${field === 'isCccdVerified' ? 'CCCD' : 'GPLX'} thành công`);
      api.getAdminMetrics().then((res) => res?.success && setMetrics(res.data));
    } catch (err) {
      alert('Lỗi cập nhật: ' + err.message);
    }
  };

  const handleToggleBan = async (user) => {
    const nextBan = !user.isBanned;
    const actionText = nextBan ? 'CẤM (Khoá)' : 'MỞ KHOÁ';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản ${user.name} (${user.phone})?`)) {
      return;
    }

    try {
      await api.updateUserStatus(user.id, { isBanned: nextBan });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isBanned: nextBan } : u)));
      showNotice(`Đã ${actionText.toLowerCase()} tài khoản thành công`);
      api.getAdminMetrics().then((res) => res?.success && setMetrics(res.data));
    } catch (err) {
      alert('Lỗi cập nhật: ' + err.message);
    }
  };

  const handleConvertCarCategory = async (tripId, bookingId, targetCategory = 'convenient_trip') => {
    try {
      const res = await api.adminConvertCarCategory(tripId, targetCategory, bookingId);
      if (res?.success) {
        showNotice(res.message || 'Đã chuyển loại xe sang Biển vàng thành công');
        loadAllAdminData();
      } else {
        alert(res?.error || 'Có lỗi khi chuyển loại xe');
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleResolveMismatch = async (bookingId, status, note = '') => {
    try {
      const res = await api.adminResolveMismatch(bookingId, status, note);
      if (res?.success) {
        showNotice('Đã cập nhật trạng thái báo cáo');
        loadAllAdminData();
      } else {
        alert(res?.error || 'Có lỗi khi cập nhật');
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  // MÀN HÌNH ĐĂNG NHẬP ADMIN NẾU CHƯA XÁC THỰC
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#16171d] border border-slate-200/90 dark:border-white/10 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 inline-flex items-center justify-center mb-1">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">Cổng Quản Trị CarMate</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nhập mã bảo mật quản trị viên để điều hành sàn ghép xe
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {requireMfa ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/50 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-bold">
                    <Send className="w-4 h-4 text-sky-500 shrink-0" />
                    <span>Mã OTP đã được gửi đến Telegram</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11.5px] leading-relaxed">
                    {mfaViaTelegram
                      ? 'Vui lòng kiểm tra ứng dụng Telegram trên điện thoại của bạn để lấy mã xác thực 6 số.'
                      : 'Mật mã chính xác. Vui lòng nhập mã xác thực OTP 6 số để hoàn tất đăng nhập.'}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>Thời hạn mã:</span>
                    <span className={`font-bold ${mfaCountdown < 30 ? 'text-rose-500 animate-pulse' : 'text-sky-600 dark:text-sky-400'}`}>
                      {Math.floor(mfaCountdown / 60)}:{(mfaCountdown % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1.5">
                    Mã Xác Thực 6 Số (MFA OTP)
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="VD: 123456"
                    className="w-full h-12 px-4 text-center tracking-[0.4em] font-mono text-xl font-black rounded-xl bg-slate-50 dark:bg-[#1e1f29] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRequireMfa(false);
                      setMfaCode('');
                      setMfaSessionId('');
                      setAuthError('');
                      setAuthNotice('');
                    }}
                    className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer font-medium"
                  >
                    ← Nhập lại mật mã
                  </button>

                  <button
                    type="button"
                    disabled={isResendingMfa || mfaCountdown > 150}
                    onClick={handleResendOtp}
                    className="text-sky-600 dark:text-sky-400 hover:underline font-semibold disabled:opacity-40 disabled:no-underline cursor-pointer"
                  >
                    {isResendingMfa ? 'Đang gửi...' : 'Gửi lại mã OTP'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1.5">
                  Mã Bảo Mật Admin
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Nhập mã bảo mật quản trị"
                  className="w-full h-11 px-4 rounded-xl text-sm font-semibold bg-slate-50 dark:bg-[#1e1f29] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </div>
            )}

            {authNotice && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{authNotice}</span>
              </p>
            )}

            {authError && (
              <p className="text-xs text-rose-500 font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{authError}</span>
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              disabled={isLoading}
              className="rounded-xl font-bold shadow-md shadow-primary-600/20"
            >
              {isLoading ? 'Đang xác thực...' : requireMfa ? 'Xác Nhận Mã OTP ➔' : 'Truy Cập Quản Trị ➔'}
            </Button>
          </form>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onExitAdmin}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại trang chính</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MÀN HÌNH CHÍNH CỔNG QUẢN TRỊ ADMIN (CURSOR / LINEAR STYLE)
  const filteredTrips = trips.filter((t) => {
    if (!searchTerm.trim()) return true;
    const kw = searchTerm.toLowerCase();
    return (
      t.id?.toLowerCase().includes(kw) ||
      t.maskedCode?.toLowerCase().includes(kw) ||
      t.from?.toLowerCase().includes(kw) ||
      t.to?.toLowerCase().includes(kw) ||
      t.publicName?.toLowerCase().includes(kw) ||
      t.phoneReal?.toLowerCase().includes(kw)
    );
  });

  const filteredUsers = users.filter((u) => {
    if (!searchTerm.trim()) return true;
    const kw = searchTerm.toLowerCase();
    return (
      u.name?.toLowerCase().includes(kw) ||
      u.phone?.toLowerCase().includes(kw) ||
      u.hometown?.toLowerCase().includes(kw)
    );
  });

  const overview = metrics?.overview || {};
  const sysHealth = metrics?.systemHealth || {};

  return (
    <div className="space-y-6 max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Bar Quản Trị */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white/95 dark:bg-[#16171d]/95 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600 text-white inline-flex items-center justify-center font-black text-base shadow-md shadow-primary-600/30">
            CM
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold font-display text-slate-900 dark:text-white">
                Cổng Quản Trị Hệ Thống (CarMate Admin)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300">
                v1.0 Solo
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#107c41] shrink-0" />
              <span>Node.js Unified Engine: Hoạt động bình thường</span>
              <span>·</span>
              <span className="font-mono">RAM: {sysHealth.heapUsedMB || 28} MB</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadAllAdminData}
            title="Làm mới dữ liệu"
            className="h-9 px-3 rounded-full border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Tải lại</span>
          </button>
          <button
            type="button"
            onClick={onExitAdmin}
            className="h-9 px-3 rounded-full border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Xem Web</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            title="Đăng xuất Admin"
            className="h-9 px-3 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Thoát</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 anim-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* 4 Thẻ KPI Đo Lường Toàn Diện */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#16171d] border border-slate-200/90 dark:border-white/10 shadow-xs space-y-1">
          <p className="text-[11px] font-mono font-bold uppercase text-slate-400">Chuyến Xe Đang Mở</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-black text-slate-900 dark:text-white tabular-nums">
              {overview.activeTripsCount || 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">/ {overview.totalTripsCount || 0} tổng</span>
          </div>
          {overview.hiddenTripsCount > 0 && (
            <p className="text-[10.5px] text-amber-600 dark:text-amber-400 font-semibold">
              ⚠️ Có {overview.hiddenTripsCount} bài đang bị ẩn/khoá
            </p>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#16171d] border border-slate-200/90 dark:border-white/10 shadow-xs space-y-1">
          <p className="text-[11px] font-mono font-bold uppercase text-slate-400">Tài Xế & Thành Viên</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {overview.verifiedDriversCount || 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">đã duyệt CCCD/GPLX</span>
          </div>
          <p className="text-[10.5px] text-slate-400">Tổng {overview.totalMembersCount || 0} hồ sơ trong hệ thống</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#16171d] border border-slate-200/90 dark:border-white/10 shadow-xs space-y-1">
          <p className="text-[11px] font-mono font-bold uppercase text-slate-400">Lượt Chốt Zalo</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-black text-primary-600 dark:text-primary-400 tabular-nums">
              {overview.totalBookingsCount || 0}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              ({overview.completedBookingsCount || 0} hoàn tất)
            </span>
          </div>
          <p className="text-[10.5px] text-slate-400">Kết nối trực tiếp 0% phí sàn</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#16171d] border border-slate-200/90 dark:border-white/10 shadow-xs space-y-1">
          <p className="text-[11px] font-mono font-bold uppercase text-slate-400">Uptime & Tài Nguyên</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono font-black text-slate-900 dark:text-white tabular-nums">
              {Math.floor((sysHealth.uptimeSeconds || 0) / 60)}p
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">100% Ổn định</span>
          </div>
          <p className="text-[10.5px] text-slate-400 font-mono">
            Heap: {sysHealth.heapUsedMB || 28}MB / Node {sysHealth.nodeVersion || 'v20'}
          </p>
        </div>
      </div>

      {/* Tabs Quản Trị & Bộ Tìm Kiếm */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-200/60 dark:bg-[#151c2e] border border-black/5 dark:border-white/[0.08] flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('trips')}
            className={`h-9 px-4 rounded-full text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 ${
              activeTab === 'trips'
                ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Car className="w-3.5 h-3.5 text-[#0071e3]" />
            <span>Chuyến xe ({trips.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`h-9 px-4 rounded-full text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span>Thành viên ({users.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`h-9 px-4 rounded-full text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 ${
              activeTab === 'reports'
                ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Báo cáo sự cố</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`h-9 px-4 rounded-full text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI Trajectories ({aiIntelligence?.summary?.totalQueries || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`h-9 px-4 rounded-full text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Phễu & Analytics</span>
            {analyticsSummary?.totalEvents > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {analyticsSummary.totalEvents}
              </span>
            )}
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm tên, SĐT, tuyến, mã..."
            className="w-full h-9 pl-9 pr-3 rounded-full text-xs font-semibold bg-white dark:bg-[#151c2e] border border-slate-200/90 dark:border-white/[0.08] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
      </div>

      {/* ── TAB 1: QUẢN LÝ CHUYẾN XE ── */}
      {activeTab === 'trips' && (
        <div className="rounded-2xl bg-white dark:bg-[#0f1422] border border-slate-200/90 dark:border-white/[0.08] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-[#1a1c24] border-b border-slate-200/80 dark:border-white/10 text-slate-500 font-mono uppercase text-[10.5px]">
                <tr>
                  <th className="py-3 px-4">Mã & Vai Trò</th>
                  <th className="py-3 px-4">Lộ Trình</th>
                  <th className="py-3 px-4">Chủ Xe / SĐT Thật</th>
                  <th className="py-3 px-4">Giá / Ghế</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                {filteredTrips.map((t) => (
                  <tr
                    key={t.id}
                    className={`hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors ${
                      t.isHidden ? 'opacity-60 bg-amber-50/30 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">{t.maskedCode}</div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {t.type === 'driver_offer' ? '🚗 Chủ xe' : '👥 Khách tìm xe'}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {t.from} ➔ {t.to}
                      </div>
                      <span className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold">
                        {t.routeCategory}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {t.publicName || 'Chủ xe ' + t.maskedCode}
                      </div>
                      <a
                        href={`https://zalo.me/${t.phoneReal || t.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        <span>{t.phoneReal || t.phone}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {formatVND(t.basePricePerSeat || t.expectedPrice || 180000)}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {t.availableSeats ? `Còn ${t.availableSeats} chỗ` : 'Cần ghế'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {t.isHidden ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-[10.5px] font-bold inline-flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Đã ẩn
                        </span>
                      ) : t.status === 'full' ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10.5px] font-bold">
                          Đã đủ
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10.5px] font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Đang mở
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleHideTrip(t.id, t.isHidden)}
                        title={t.isHidden ? 'Khôi phục hiển thị bài' : 'Ẩn bài đăng này khỏi bảng tin'}
                        className={`p-1.5 rounded-lg border cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1 text-[11px] font-semibold ${
                          t.isHidden
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300'
                        }`}
                      >
                        {t.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>{t.isHidden ? 'Hiện lại' : 'Ẩn bài'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteTrip(t.id)}
                        title="Xoá vĩnh viễn"
                        className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1 text-[11px] font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xoá</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: THÀNH VIÊN & XÁC MINH ── */}
      {activeTab === 'users' && (
        <div className="rounded-2xl bg-white dark:bg-[#16171d] border border-slate-200/90 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-[#1a1c24] border-b border-slate-200/80 dark:border-white/10 text-slate-500 font-mono uppercase text-[10.5px]">
                <tr>
                  <th className="py-3 px-4">Họ Tên & Quê Quán</th>
                  <th className="py-3 px-4">Số Điện Thoại Zalo</th>
                  <th className="py-3 px-4">Phương Tiện / Biển Số</th>
                  <th className="py-3 px-4">Xác Minh CCCD</th>
                  <th className="py-3 px-4">Xác Minh GPLX</th>
                  <th className="py-3 px-4 text-right">Khoá / Mở Khoá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className={`hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors ${
                      u.isBanned ? 'opacity-60 bg-rose-50/20 dark:bg-rose-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {u.isBanned && (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-rose-600 text-white">
                            BANNED
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {u.hometown || 'Bình Phước'} · {u.role === 'driver' ? 'Tài xế' : 'Khách'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <a
                        href={`https://zalo.me/${u.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>{u.phone}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {u.carModel || 'Mitsubishi Xpander (7 chỗ)'}
                      </div>
                      <span className="text-[10.5px] font-mono text-slate-400">
                        Biển: {u.licensePlate || '93A-289.xx'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleVerify(u, 'isCccdVerified')}
                        title="Bấm để đổi trạng thái duyệt CCCD"
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1 ${
                          u.isCccdVerified
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300/60'
                            : 'bg-slate-100 text-slate-500 border-slate-300'
                        }`}
                      >
                        {u.isCccdVerified ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : '○'}
                        <span>{u.isCccdVerified ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleVerify(u, 'isGplxVerified')}
                        title="Bấm để đổi trạng thái duyệt GPLX"
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1 ${
                          u.isGplxVerified
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300/60'
                            : 'bg-slate-100 text-slate-500 border-slate-300'
                        }`}
                      >
                        {u.isGplxVerified ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : '○'}
                        <span>{u.isGplxVerified ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleBan(u)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1 ${
                          u.isBanned
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}
                      >
                        <Ban className="w-3 h-3" />
                        <span>{u.isBanned ? 'Mở khoá' : 'Khoá cấm'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: BÁO CÁO & SỰ CỐ ── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* KHU VỰC ĐẶC BIỆT: BÁO CÁO SAI LỆCH LOẠI XE (BIỂN VÀNG / BIỂN TRẮNG) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#16171d] border border-rose-200/80 dark:border-rose-900/40 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Báo Cáo Sai Lệch Loại Xe (Biển Vàng / Biển Trắng)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                      {reports?.vehicleMismatchReports?.length || 0} phản ánh
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bảo vệ tính trung thực: Xử lý 1-chạm đổi loại xe sang Biển vàng hoặc khóa tài khoản vi phạm
                  </p>
                </div>
              </div>
            </div>

            {!reports?.vehicleMismatchReports || reports.vehicleMismatchReports.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50/60 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/10 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                  Tất cả các chuyến xe đều trung thực với loại biển số đã đăng ký!
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Không có phản ánh nào về xe biển vàng núp bóng xe gia đình.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.vehicleMismatchReports.map((report) => {
                  const isResolved = report.status === 'resolved_converted' || report.status === 'dismissed';
                  return (
                    <div
                      key={report.id || report.bookingId}
                      className={`p-4 rounded-2xl border transition-all ${
                        isResolved
                          ? 'bg-slate-50/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 opacity-75'
                          : 'bg-rose-50/30 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/50 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {report.bookingId}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                              {report.mismatchTitle}
                            </span>
                            {report.actualPlate && (
                              <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300/60 text-[10.5px]">
                                Biển thực tế: {report.actualPlate}
                              </span>
                            )}
                            <span className="text-[10.5px] text-slate-400">
                              {report.reportedAt ? new Date(report.reportedAt).toLocaleString('vi-VN') : ''}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                            <div>
                              <span className="text-slate-400">Tài xế: </span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {report.driverName}
                              </span>
                              <span className="font-mono text-slate-500 ml-1">({report.driverPhone})</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Người báo: </span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {report.reporterName}
                              </span>
                              <span className="font-mono text-slate-500 ml-1">({report.reporterPhone})</span>
                            </div>
                          </div>

                          {report.passengerNote && (
                            <p className="text-xs text-rose-900 dark:text-rose-200 italic p-2 rounded-xl bg-rose-100/60 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 mt-1">
                              &ldquo;{report.passengerNote}&rdquo;
                            </p>
                          )}

                          {report.resolvedAction && (
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium pt-0.5">
                              ✓ {report.resolvedAction} ({new Date(report.resolvedAt).toLocaleTimeString('vi-VN')})
                            </p>
                          )}
                        </div>

                        {/* Thao tác 1-chạm */}
                        <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-1 sm:pt-0">
                          {!isResolved ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleConvertCarCategory(report.tripId, report.bookingId, 'convenient_trip')
                                }
                                className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                                title="1-chạm đổi loại xe thành Biển vàng"
                              >
                                <span>⚡ Chuyển thành Biển vàng</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResolveMismatch(report.bookingId, 'dismissed', 'Bỏ qua')}
                                className="px-2.5 py-1 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                              >
                                Bỏ qua
                              </button>
                            </>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              ✓ Đã xử lý
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Lịch sử báo trễ */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#16171d] border border-slate-200/90 dark:border-white/10 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Ghi nhận Báo trễ chuyến ({reports?.delayed?.length || 0})</span>
              </h3>
              {!reports?.delayed || reports.delayed.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Chưa có chuyến xe nào ghi nhận báo trễ.</p>
              ) : (
                <div className="space-y-2">
                  {reports.delayed.map((item) => (
                    <div
                      key={item.escrowId}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#1e1f29] border border-slate-100 dark:border-white/5 text-xs"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="font-mono text-primary-600">{item.escrowId}</span>
                        <span className="text-amber-600 font-mono">Trễ ~{item.delayedMinutes || 15} phút</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-1">
                        Lý do: &ldquo;{item.delayNote || 'Kẹt xe dọc tuyến'}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lịch sử huỷ chuyến văn minh */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#16171d] border border-slate-200/90 dark:border-white/10 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Ghi nhận Huỷ chuyến ({reports?.cancelled?.length || 0})</span>
              </h3>
              {!reports?.cancelled || reports.cancelled.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Chưa có chuyến xe nào bị huỷ.</p>
              ) : (
                <div className="space-y-2">
                  {reports.cancelled.map((item) => (
                    <div
                      key={item.escrowId}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#1e1f29] border border-slate-100 dark:border-white/5 text-xs"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="font-mono text-primary-600">{item.escrowId}</span>
                        <span className="text-rose-600">Đã huỷ</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-1">
                        Lý do: &ldquo;{item.cancelReason || 'Thay đổi kế hoạch gia đình'}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: AI OBSERVABILITY & NHẬT KÝ LUỒNG ĐIỀU PHỐI ── */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* Telemetry KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#0071e3]" />
                Lượt tương tác AI
              </span>
              <p className="text-2xl font-bold font-display tabular text-[#1d1d1f] dark:text-white">
                {aiIntelligence?.summary?.totalQueries || 0}
              </p>
              <p className="text-[11px] text-[#86868b]">Truy vấn ngôn ngữ tự nhiên</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Tỷ lệ giải quyết mục tiêu
              </span>
              <p className="text-2xl font-bold font-display tabular text-emerald-600 dark:text-emerald-400">
                {aiIntelligence?.summary?.resolutionRate ?? 100}%
              </p>
              <p className="text-[11px] text-[#86868b]">Khớp chuyến thành công</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-500" />
                Độ trễ trung bình
              </span>
              <p className="text-2xl font-bold font-display tabular text-[#0071e3]">
                {aiIntelligence?.summary?.avgLatencyMs || 0} ms
              </p>
              <p className="text-[11px] text-[#86868b]">Thời gian phản hồi luồng AI</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Nhu cầu khát xe (Unmet)
              </span>
              <p className="text-2xl font-bold font-display tabular text-amber-600 dark:text-amber-400">
                {aiIntelligence?.summary?.unmetDemandCount || 0}
              </p>
              <p className="text-[11px] text-[#86868b]">Lượt khách tìm nhưng thiếu xe</p>
            </div>
          </div>

          {/* Radar Tuyến Đường Khát Xe (Unmet Demand Radar) */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-bold text-sm text-[#1d1d1f] dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>Radar Tuyến Đường Khát Xe (Unmet Demand Discovery)</span>
                </h3>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Phát hiện tự động các tuyến đường hành khách hỏi tìm nhiều nhất qua AI nhưng hiện tại chưa có chủ xe
                  nào đăng bài
                </p>
              </div>
              <Badge tone="warning" className="text-xs font-semibold">
                Cơ hội mở rộng cộng đồng
              </Badge>
            </div>

            {!aiIntelligence?.unmetDemandRoutes || aiIntelligence.unmetDemandRoutes.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#f5f5f7] border border-black/[0.04] text-center text-xs text-[#86868b]">
                Hiện tại tất cả các yêu cầu tìm xe đều được đáp ứng hoặc có chuyến xe chạy ngang thuận tiện.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiIntelligence.unmetDemandRoutes.map((routeItem, idx) => (
                  <div
                    key={routeItem.route || idx}
                    className="p-4 rounded-2xl bg-[#f5f5f7] border border-black/[0.06] flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <p className="text-sm font-bold text-[#1d1d1f] dark:text-white">{routeItem.route}</p>
                      </div>
                      <p className="text-xs text-[#86868b]">
                        Gợi ý: Đăng bài thông báo vào nhóm Zalo địa phương để kêu gọi thêm chủ xe tuyến này.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300/60 tabular">
                        {routeItem.count} lượt tìm
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hộp Đen Quỹ Đạo Suy Luận Thời Gian Thực (Live Trajectory Stream) */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-[#1d1d1f] dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0071e3]" />
                  <span>Nhật ký luồng xử lý AI (AI Execution Trajectory Log)</span>
                </h3>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Nhật ký xử lý đa bước tự động [Lập kế hoạch ➔ Rà soát chuyến ➔ Kiểm tra định mức ➔ Đề xuất]
                </p>
              </div>
              <span className="text-xs text-[#86868b] tabular font-medium">
                {aiIntelligence?.recentTrajectories?.length || 0} lượt gần nhất
              </span>
            </div>

            {!aiIntelligence?.recentTrajectories || aiIntelligence.recentTrajectories.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#f5f5f7] border border-black/[0.04] text-center text-xs text-[#86868b]">
                Chưa có dữ liệu quỹ đạo nào được lưu. Hãy thử trò chuyện với Trợ lý CarMate AI để xem luồng suy luận
                xuất hiện tại đây.
              </div>
            ) : (
              <div className="space-y-3">
                {aiIntelligence.recentTrajectories.map((traj) => (
                  <div key={traj.id} className="p-4 rounded-2xl bg-[#f5f5f7] border border-black/[0.06] space-y-2.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#0071e3]">{traj.id}</span>
                          {traj.requestedRoute && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-900 border border-blue-200">
                              {traj.requestedRoute}
                            </span>
                          )}
                          {traj.unmetDemand ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              Khát xe (0 chuyến)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
                              {traj.suggestionsCount} xe phù hợp
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-[#1d1d1f] dark:text-white pt-1">
                          &ldquo;{traj.userGoal}&rdquo;
                        </p>
                      </div>

                      <div className="text-right text-[11px] text-[#86868b] tabular shrink-0">
                        <span className="font-bold text-[#1d1d1f]">{traj.executionTimeMs}ms</span>
                        <span className="mx-1">·</span>
                        <span>
                          {new Date(traj.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Chuỗi reasoning steps */}
                    {Array.isArray(traj.reasoningSteps) && traj.reasoningSteps.length > 0 && (
                      <div className="p-3 rounded-xl bg-white dark:bg-[#12131a] border border-black/[0.04] space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b] block">
                          Chuỗi lập luận ({traj.reasoningSteps.length} bước):
                        </span>
                        <div className="space-y-1 font-mono text-[11px]">
                          {traj.reasoningSteps.map((step, sIdx) => {
                            const isVerify = step.startsWith('[VERIFY]');
                            const isReflect = step.startsWith('[REFLECT]');
                            const isReplan = step.startsWith('[REPLAN]');
                            return (
                              <div
                                key={sIdx}
                                className={`p-1.5 rounded-lg leading-relaxed ${
                                  isVerify
                                    ? 'bg-blue-50/80 text-blue-900 border border-blue-200/60'
                                    : isReflect
                                      ? 'bg-amber-50/80 text-amber-900 border border-amber-200/60'
                                      : isReplan
                                        ? 'bg-emerald-50/80 text-emerald-900 border border-emerald-200/60'
                                        : 'text-[#515154] bg-black/[0.02]'
                                }`}
                              >
                                {step}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 5: PHỄU & ANALYTICS CHUYỂN ĐỔI (ZERO-COST FUNNEL STORE) ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* 4 Thẻ KPI Phễu */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-1">
              <p className="text-[11px] font-mono font-bold uppercase text-slate-400">Tổng Sự Kiện Đã Lưu</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                {analyticsSummary?.totalEvents || 0}
              </p>
              <p className="text-[10.5px] text-slate-400">SQLite In-Memory + Persistent Disk (0đ)</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-1">
              <p className="text-[11px] font-mono font-bold uppercase text-slate-400">Lượt Xem Chuyến Đi</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-blue-600 dark:text-blue-400 tabular-nums">
                {analyticsSummary?.funnel?.view_trip || 0}
              </p>
              <p className="text-[10.5px] text-slate-400">Khách xem chi tiết bài đăng ghép xe</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-1">
              <p className="text-[11px] font-mono font-bold uppercase text-slate-400">Lượt Chốt Qua Zalo</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {analyticsSummary?.funnel?.open_zalo ?? analyticsSummary?.funnel?.open_zalo_chat ?? 0}
              </p>
              <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Tỷ lệ mở Zalo: {(() => {
                  const zaloCount = analyticsSummary?.funnel?.open_zalo ?? analyticsSummary?.funnel?.open_zalo_chat ?? 0;
                  const pageViews = analyticsSummary?.funnel?.page_view || 0;
                  return pageViews > 0 ? ((zaloCount / pageViews) * 100).toFixed(1) : '0';
                })()}%
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-1">
              <p className="text-[11px] font-mono font-bold uppercase text-slate-400">Bác Tài Đã Nhận Đón</p>
              <p className="text-2xl sm:text-3xl font-mono font-black text-teal-600 dark:text-teal-400 tabular-nums">
                {analyticsSummary?.funnel?.driver_confirm || 0}
              </p>
              <p className="text-[10.5px] text-slate-400">Xác nhận 1-chạm Magic Link</p>
            </div>
          </div>

          {/* Sơ Đồ Phễu Chuyển Đổi Tuyến Đi (Ridesharing Conversion Funnel) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-bold text-base text-[#1d1d1f] dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  <span>Phễu Chuyển Đổi Hành Khách (6 Tầng Vận Hành)</span>
                </h3>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Đo lường từng điểm rơi (drop-off) từ lúc khách vào web đến khi bác tài bấm nhận đón trên Zalo
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 self-start sm:self-auto">
                Tự động lưu SQLite 0đ
              </span>
            </div>

            {/* Các bước trong phễu */}
            {(() => {
              const funnel = analyticsSummary?.funnel || {};
              const stages = [
                { key: 'page_view', name: '1. Xem Trang (Page View)', count: funnel.page_view || 0, desc: 'Khách truy cập website CarMate' },
                { key: 'search_route', name: '2. Tìm Tuyến Xe (Search Route)', count: funnel.search_route || 0, desc: 'Khách gõ điểm đi / điểm đến tìm chuyến' },
                { key: 'view_trip', name: '3. Xem Chi Tiết Vé (View Trip)', count: funnel.view_trip || 0, desc: 'Khách bấm xem chi tiết giá & thông tin bác tài' },
                { key: 'initiate_booking', name: '4. Bấm Đặt Chỗ (Initiate Booking)', count: funnel.initiate_booking || 0, desc: 'Khách chọn số ghế & bấm tiếp tục' },
                { key: 'open_zalo', name: '5. Mở Chat Zalo (Open Zalo Chat)', count: (funnel.open_zalo ?? funnel.open_zalo_chat ?? 0), desc: 'Khách chuyển sang app Zalo nhắn tin cho bác tài' },
                { key: 'driver_confirm', name: '6. Bác Tài Nhận Đón (Driver Confirmed)', count: funnel.driver_confirm || 0, desc: 'Bác tài bấm xác nhận nhận cuốc qua Magic Link' }
              ];
              const baseCount = Math.max(stages[0].count, 1);

              return (
                <div className="space-y-4">
                  {stages.map((stg, sIdx) => {
                    const pctOfBase = Math.min(100, Math.round((stg.count / baseCount) * 100));
                    const prevCount = sIdx === 0 ? stg.count : stages[sIdx - 1].count;
                    const stepConversion = prevCount > 0 ? Math.round((stg.count / prevCount) * 100) : 0;

                    return (
                      <div key={stg.key} className="space-y-1.5 p-3 sm:p-4 rounded-2xl bg-[#f5f5f7] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06]">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 text-[#1d1d1f] dark:text-white text-xs font-bold flex items-center justify-center border border-black/[0.08] dark:border-white/[0.1] shadow-xs">
                              {sIdx + 1}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-[#1d1d1f] dark:text-white">{stg.name}</p>
                              <p className="text-[11px] text-[#86868b]">{stg.desc}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="text-sm sm:text-base font-mono font-bold text-[#1d1d1f] dark:text-white tabular">
                                {stg.count}
                              </span>
                              <span className="text-xs text-[#86868b] ml-1">lượt</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] text-indigo-600 dark:text-indigo-400 min-w-[52px] text-center">
                              {pctOfBase}%
                            </span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
                            style={{ width: `${Math.max(pctOfBase, stg.count > 0 ? 3 : 0)}%` }}
                          />
                        </div>

                        {sIdx > 0 && prevCount > 0 && (
                          <div className="text-right">
                            <span className="text-[10.5px] text-[#86868b]">
                              Chuyển đổi từ bước trước: <strong className="text-[#1d1d1f] dark:text-white">{stepConversion}%</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Hai Khối Song Song: Top Tuyến Được Tìm Kiếm & Nhật Ký Sự Kiện Trực Tiếp */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top Tuyến Đường Tìm Kiếm */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-4">
              <h3 className="font-bold text-sm text-[#1d1d1f] dark:text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-500" />
                <span>Top Tuyến Đường Tìm Kiếm Nhiều Nhất</span>
              </h3>

              {(() => {
                const routesList = analyticsSummary?.topRoutes || analyticsSummary?.topSearchedRoutes || [];
                if (!routesList || routesList.length === 0) {
                  return (
                    <div className="p-6 rounded-2xl bg-[#f5f5f7] dark:bg-white/[0.03] border border-black/[0.04] text-center text-xs text-[#86868b]">
                      Chưa có dữ liệu tìm kiếm tuyến. Khi khách gõ tìm xe trên trang chủ, dữ liệu sẽ tự động tổng hợp tại đây.
                    </div>
                  );
                }
                return (
                  <div className="space-y-2.5">
                    {routesList.map((rt, rIdx) => (
                      <div
                        key={rIdx}
                        className="p-3 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center">
                            {rIdx + 1}
                          </span>
                          <span className="text-xs font-bold text-[#1d1d1f] dark:text-white">{rt.route}</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                          {rt.count} lượt
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Dòng Sự Kiện Thời Gian Thực (Live Event Stream) */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#16171d] border border-black/[0.06] shadow-2xs space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-[#1d1d1f] dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span>Dòng Sự Kiện Trực Tiếp (Live Event Log)</span>
                </h3>
                <span className="text-xs text-[#86868b]">
                  {analyticsSummary?.recentEvents?.length || 0} sự kiện gần nhất
                </span>
              </div>

              {!analyticsSummary?.recentEvents || analyticsSummary.recentEvents.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#f5f5f7] dark:bg-white/[0.03] border border-black/[0.04] text-center text-xs text-[#86868b]">
                  Chưa có sự kiện nào được ghi nhận.
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {analyticsSummary.recentEvents.map((ev) => {
                    const isError = ev.event_name.startsWith('error');
                    const isBooking = ev.event_name.includes('booking') || ev.event_name.includes('zalo');
                    const isSearch = ev.event_name.includes('search');

                    return (
                      <div
                        key={ev.id}
                        className="p-2.5 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono text-[10.5px] font-bold ${
                              isError
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : isBooking
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : isSearch
                                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {ev.event_name}
                          </span>
                          <span className="text-[10.5px] text-slate-400 font-mono">
                            {new Date(ev.created_at).toLocaleTimeString('vi-VN')}
                          </span>
                        </div>
                        {ev.properties && (
                          <p className="text-[11px] text-[#86868b] font-mono truncate">
                            {JSON.stringify(ev.properties)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
