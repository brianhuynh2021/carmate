import React from 'react';
import { Heart, Sparkles, ShieldCheck, Car, CheckCircle2, XCircle, ArrowRight, MapPin, Fuel, Smile } from 'lucide-react';
import Button from '../ui/Button.jsx';

export default function FounderStorySection({ onPostClick, onFindTripClick }) {
  return (
    <section className="my-10 sm:my-14 rounded-3xl bg-white/80 dark:bg-[#161b26]/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.04)] overflow-hidden transition-all">
      {/* ── HEADER PHÂN ĐOẠN ── */}
      <div className="p-6 sm:p-8 md:p-10 border-b border-black/[0.06] dark:border-white/[0.06] bg-linear-to-b from-primary-50/50 dark:from-primary-950/20 to-transparent">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] shadow-xs text-xs font-bold text-primary-600 dark:text-primary-400">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>Tâm Thư Từ Người Sáng Lập · Tinh Thần CarMate</span>
          </div>

          <h2 className="text-xl sm:text-3xl font-black text-[#1d1d1f] dark:text-white tracking-tight leading-snug">
            “Tôi làm CarMate vì chính bản thân cũng là một Chủ xe đi về Sài Gòn mỗi tuần…”
          </h2>

          <p className="text-sm sm:text-base text-[#515154] dark:text-slate-400 leading-relaxed font-normal">
            Một giải pháp đi lại văn minh, khởi nguồn từ nỗi mệt mỏi của những năm tháng chen chúc xe khách và nỗi xót xa
            khi chiếc xe 7 chỗ trống trơn mỗi chuyến lên về thành phố.
          </p>
        </div>
      </div>

      {/* ── NỘI DUNG 2 CỘT: TÂM SỰ FOUNDER & SO SÁNH TRẢI NGHIỆM ── */}
      <div className="p-6 sm:p-8 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* CỘT 1: BỨC TÂM THƯ & ẢNH CHỦ XE THỰC TẾ (7 CỘT) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Ảnh chân thật của Founder bên chiếc xe gia đình */}
            <div className="relative shrink-0 w-full sm:w-48 rounded-2xl overflow-hidden shadow-md border border-black/[0.08] group">
              <img
                src="/images/founder_story.jpg"
                alt="Chủ xe & Founder CarMate bên chiếc xe Xpander tại trạm dừng chân cao tốc"
                className="w-full h-56 sm:h-64 object-cover object-center group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3 text-white">
                <span className="text-[11px] font-bold text-primary-300">Chủ xe & Founder</span>
                <span className="text-xs font-semibold">Mitsubishi Xpander</span>
                <span className="text-[10px] text-white/80">Tuyến Bình Phước ⇄ TP.HCM</span>
              </div>
            </div>

            {/* Đoạn tâm sự gan ruột */}
            <div className="space-y-3.5 text-sm text-[#3a3a3c] dark:text-slate-300 leading-relaxed">
              <p>
                <strong className="text-[#1d1d1f] dark:text-white font-bold">Chào bạn,</strong> tôi cũng là một người con
                xa quê lập nghiệp tại TP.HCM. Nhiều năm liền, mỗi lần về quê rồi lên lại thành phố là một{' '}
                <span className="text-rose-600 dark:text-rose-400 font-semibold">“cực hình” với xe khách</span>: cảnh nhồi
                nhét ghế nhựa luồn lách giữa lối đi, mùi máy lạnh ngột ngạt gây say xe li bì, tài xế bắt khách dọc đường
                khiến chuyến đi 2 tiếng bị kéo dài thành 4-5 tiếng mệt nhoài.
              </p>

              <p>
                Đến khi tích cóp sắm được chiếc xe gia đình 7 chỗ, tôi lại đối mặt với một{' '}
                <strong className="text-[#1d1d1f] dark:text-white font-bold">“nỗi xót xa” khác</strong>: Tuần nào cũng chạy
                xe không lên Sài Gòn rồi lại chạy xe không về quê. Nhìn 4-5 chiếc ghế da êm ái bỏ trống, một mình gánh cả
                triệu đồng tiền xăng và vé trạm thu phí BOT, vừa tốn kém vừa buồn tẻ trên chặng đường dài.
              </p>

              <p className="p-3.5 rounded-2xl bg-primary-500/[0.07] dark:bg-primary-500/[0.12] border border-primary-500/20 text-[#1d1d1f] dark:text-white font-medium text-[13.5px]">
                💡 <span className="font-bold text-primary-600 dark:text-primary-400">“Tại sao không kết nối lại?”</span>{' '}
                Những chiếc xe gia đình sạch sẽ hoàn toàn có thể đón những người đồng hương cùng tiện cung đường. Bạn có
                chuyến đi khỏe khoắn như xe nhà, Chủ xe có thêm người bạn trò chuyện và san sẻ bớt tiền xăng lăn bánh!
              </p>
            </div>
          </div>

          {/* 3 Cam kết cốt lõi chuẩn tinh thần CarMate */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/60 border border-black/[0.04] dark:border-white/[0.06] text-center space-y-1">
              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-[#1d1d1f] dark:text-white">100% Không Phí Sàn</p>
              <p className="text-[11px] text-[#86868b] dark:text-slate-400">Kết nối Zalo trực tiếp, 0 đồng hoa hồng trung gian.</p>
            </div>

            <div className="p-3 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/60 border border-black/[0.04] dark:border-white/[0.06] text-center space-y-1">
              <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-600 flex items-center justify-center mx-auto">
                <Smile className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-[#1d1d1f] dark:text-white">Văn Hóa Xe Nhà</p>
              <p className="text-[11px] text-[#86868b] dark:text-slate-400">Tôn trọng, đúng hẹn, không nhồi nhét, không khói thuốc.</p>
            </div>

            <div className="p-3 rounded-2xl bg-[#f5f5f7] dark:bg-slate-800/60 border border-black/[0.04] dark:border-white/[0.06] text-center space-y-1">
              <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto">
                <Fuel className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-[#1d1d1f] dark:text-white">Chia Sẻ Công Bằng</p>
              <p className="text-[11px] text-[#86868b] dark:text-slate-400">Định giá phụ xăng chuẩn công thức cự ly & trạm BOT.</p>
            </div>
          </div>
        </div>

        {/* CỘT 2: TRỰC QUAN SO SÁNH THỰC TẾ (5 CỘT) */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-[#f5f5f7]/80 dark:bg-slate-850/80 border border-black/[0.06] dark:border-white/[0.06] p-4 sm:p-5 space-y-4">
          {/* Ảnh hành khách thoải mái thư thái */}
          <div className="relative rounded-xl overflow-hidden shadow-xs border border-black/[0.06] h-44 group">
            <img
              src="/images/passenger_comfort.jpg"
              alt="Hành khách đi cùng ngồi thư thái ngắm cảnh bên cửa sổ xe CarMate"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Trải nghiệm đi cùng CarMate</span>
            </div>
          </div>

          {/* Bảng so sánh 2 trải nghiệm đối lập */}
          <div className="space-y-2 text-xs">
            {/* Mục so sánh 1: Không gian */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.04] dark:border-white/[0.06] space-y-1">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Xe khách: 40-50 người chen chúc, dễ nhồi ghế phụ ngày cao điểm</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>CarMate: Xe gia đình 5-7 chỗ, tối đa 3-4 người ngồi rộng rãi, ghế da êm ái</span>
              </div>
            </div>

            {/* Mục so sánh 2: Sức khỏe & Không khí */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.04] dark:border-white/[0.06] space-y-1">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Xe khách: Mùi ngột ngạt khó chịu, dừng đón trả xóc nảy, say xe mệt nhoài</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>CarMate: Xe nhà sạch sẽ, thơm tho, không khói thuốc, chạy cao tốc êm ru</span>
              </div>
            </div>

            {/* Mục so sánh 3: Đón trả & Thời gian */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.04] dark:border-white/[0.06] space-y-1">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Xe khách: Phải ra tận bến xe, tài xế rà rê bắt khách dọc đường trễ giờ</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>CarMate: Đón trả tiện đường trên trục di chuyển, đúng giờ giấc đã hẹn</span>
              </div>
            </div>
          </div>

          {/* Nút hành động nhanh */}
          <div className="pt-1 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onPostClick}
              className="flex-1 h-10 px-3 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Car className="w-3.5 h-3.5" />
              <span>Tôi là Chủ xe (Đăng chuyến)</span>
            </button>

            <button
              type="button"
              onClick={onFindTripClick}
              className="flex-1 h-10 px-3 rounded-xl bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.03] text-[#1d1d1f] dark:text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <span>Tìm xe tiện chuyến</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
