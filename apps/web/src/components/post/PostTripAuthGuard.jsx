import React from 'react';
import { ShieldCheck, Lock, Sparkles, LogIn, ArrowLeft, Car, CheckCircle2 } from 'lucide-react';
import { ZaloIcon, GoogleIcon } from '../ui/SocialIcons.jsx';

export default function PostTripAuthGuard({ onOpenAuth, onBackToMarket }) {
  return (
    <div className="max-w-xl mx-auto py-6 sm:py-10 px-4">
      <div className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.04)] text-center space-y-6 relative overflow-hidden">
        {/* Glow ambient background effect */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#0071e3]/10 dark:bg-[#0071e3]/15 blur-3xl pointer-events-none rounded-full" />

        {/* Biểu tượng Khiên Bảo Mật CarMate Apple */}
        <div className="relative mx-auto w-18 h-18 rounded-3xl bg-linear-to-b from-[#f5f5f7] to-[#e8e8ed] dark:from-[#2c2c2e] dark:to-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.12] flex items-center justify-center shadow-[0_4px_16px_rgba(0,113,227,0.15)] ring-4 ring-[#0071e3]/10">
          <ShieldCheck className="w-9 h-9 text-[#0071e3] dark:text-[#2997ff]" strokeWidth={2.2} />
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#107c41] text-white flex items-center justify-center text-xs shadow-xs border-2 border-white dark:border-[#1c1c1e]">
            ✓
          </span>
        </div>

        {/* Tiêu đề & Thông điệp rõ ràng */}
        <div className="space-y-2 relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] text-xs font-bold tracking-wide uppercase">
            <Lock className="w-3.5 h-3.5" />
            <span>Yêu Cầu Xác Thực Chính Chủ</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Đăng Nhập Để Tạo Chuyến Xe
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            CarMate cam kết <strong className="text-slate-800 dark:text-slate-200">100% chuyến xe chính chủ</strong>.
            Vui lòng đăng nhập tài khoản chính chủ để mở chuyến xe, quản lý khách ghép và bảo mật liên hệ.
          </p>
        </div>

        {/* 3 Cam kết bảo vệ người dùng chuẩn Apple */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left pt-1">
          <div className="p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-[#252528] border border-black/[0.04] dark:border-white/[0.04]">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0071e3]" />
              <span>Xác Thực Nhanh</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
              Đăng nhập an toàn qua Google hoặc Telegram
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-[#252528] border border-black/[0.04] dark:border-white/[0.04]">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
              <Lock className="w-3.5 h-3.5 text-[#107c41]" />
              <span>Bảo Mật SĐT</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
              Chỉ người ghép xe thành công mới xem được số điện thoại
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-[#252528] border border-black/[0.04] dark:border-white/[0.04]">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quản Lý Tức Thì</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
              Đồng bộ bài đăng trên máy tính & điện thoại tiện lợi
            </p>
          </div>
        </div>

        {/* Khối nút Hành Động */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-sm transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-95 inline-flex items-center justify-center gap-2.5"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập tài khoản</span>
          </button>

          {onBackToMarket && (
            <button
              type="button"
              onClick={onBackToMarket}
              className="w-full sm:w-auto px-5 py-3.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-all cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Khám phá chuyến xe</span>
            </button>
          )}
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
          💡 Đăng nhập nhanh trong 10 giây · Không cần mật khẩu rườm rà.
        </p>
      </div>
    </div>
  );
}
