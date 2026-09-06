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
  ArrowLeft
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
  const [requireMfa, setRequireMfa] = useState(false);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('trips'); // 'trips' | 'users' | 'reports'

  // Data states
  const [metrics, setMetrics] = useState(null);
  const [trips, setTrips] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusNotice, setStatusNotice] = useState(null);

  const showNotice = (msg) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  // 1. Xác thực đăng nhập Admin (Hỗ trợ MFA 2 lớp)
  const handleLogin = async (e) => {
    e?.preventDefault();
    setAuthError('');
    setIsLoading(true);

    try {
      const res = await api.adminAuth(passcode.trim(), mfaCode.trim());
      if (res.requireMfa) {
        setRequireMfa(true);
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

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setIsAuthenticated(false);
    setPasscode('');
    setMfaCode('');
    setRequireMfa(false);
  };

  // 2. Nạp toàn bộ dữ liệu quản trị
  const loadAllAdminData = async () => {
    setIsLoading(true);
    try {
      const [metricsRes, tripsRes, usersRes, reportsRes] = await Promise.allSettled([
        api.getAdminMetrics(),
        api.getAdminTrips(),
        api.getAdminUsers(),
        api.getAdminReports()
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
      setTrips((prev) =>
        prev.map((t) => (t.id === tripId ? { ...t, isHidden: nextHidden } : t))
      );
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
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, [field]: nextVal } : u))
      );
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
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isBanned: nextBan } : u))
      );
      showNotice(`Đã ${actionText.toLowerCase()} tài khoản thành công`);
      api.getAdminMetrics().then((res) => res?.success && setMetrics(res.data));
    } catch (err) {
      alert('Lỗi cập nhật: ' + err.message);
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
            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
              Cổng Quản Trị CarMate
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nhập mã bảo mật quản trị viên để điều hành sàn ghép xe
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {requireMfa ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>Xác thực 2 lớp (MFA/TOTP): Nhập mã 6 số từ ứng dụng Authenticator của bạn.</span>
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1.5">
                    Mã Xác Thực 2 Bước (MFA Code)
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="VD: 123456"
                    className="w-full h-11 px-4 text-center tracking-widest font-mono text-lg font-bold rounded-xl bg-slate-50 dark:bg-[#1e1f29] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/40"
                  />
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setRequireMfa(false); setMfaCode(''); }}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                  >
                    ← Nhập lại mật mã chính
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
              {isLoading ? 'Đang xác thực...' : requireMfa ? 'Xác Nhận Mã MFA ➔' : 'Truy Cập Quản Trị ➔'}
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
          <p className="text-[10.5px] text-slate-400 font-mono">Heap: {sysHealth.heapUsedMB || 28}MB / Node {sysHealth.nodeVersion || 'v20'}</p>
        </div>
      </div>

      {/* Tabs Quản Trị & Bộ Tìm Kiếm */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-200/60 dark:bg-[#151c2e] border border-black/5 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => setActiveTab('trips')}
            className={`h-9 px-4 rounded-full text-xs font-bold cursor-pointer transition-all ${
              activeTab === 'trips'
                ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🚗 Quản lý Chuyến xe ({trips.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`h-9 px-4 rounded-full text-xs font-bold cursor-pointer transition-all ${
              activeTab === 'users'
                ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🛡️ Thành viên & Xác minh ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`h-9 px-4 rounded-full text-xs font-bold cursor-pointer transition-all ${
              activeTab === 'reports'
                ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📋 Báo cáo Sự cố
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
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {t.maskedCode}
                      </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Lịch sử báo trễ */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#16171d] border border-slate-200/90 dark:border-white/10 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Ghi nhận Báo trễ chuyến ({reports?.delayed?.length || 0})</span>
            </h3>
            {(!reports?.delayed || reports.delayed.length === 0) ? (
              <p className="text-xs text-slate-400 italic">Chưa có chuyến xe nào ghi nhận báo trễ.</p>
            ) : (
              <div className="space-y-2">
                {reports.delayed.map((item) => (
                  <div key={item.escrowId} className="p-3 rounded-xl bg-slate-50 dark:bg-[#1e1f29] border border-slate-100 dark:border-white/5 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="font-mono text-primary-600">{item.escrowId}</span>
                      <span className="text-amber-600 font-mono">Trễ ~{item.delayedMinutes || 15} phút</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">Lý do: &ldquo;{item.delayNote || 'Kẹt xe dọc tuyến'}&rdquo;</p>
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
            {(!reports?.cancelled || reports.cancelled.length === 0) ? (
              <p className="text-xs text-slate-400 italic">Chưa có chuyến xe nào bị huỷ.</p>
            ) : (
              <div className="space-y-2">
                {reports.cancelled.map((item) => (
                  <div key={item.escrowId} className="p-3 rounded-xl bg-slate-50 dark:bg-[#1e1f29] border border-slate-100 dark:border-white/5 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="font-mono text-primary-600">{item.escrowId}</span>
                      <span className="text-rose-600">Đã huỷ</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">Lý do: &ldquo;{item.cancelReason || 'Thay đổi kế hoạch gia đình'}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
