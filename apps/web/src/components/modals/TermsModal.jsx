import React from 'react';
import { ShieldCheck, FileText, CheckCircle2, AlertTriangle, Lock, Users, Car, X } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

export default function TermsModal({ onClose }) {
  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={ShieldCheck}
      iconTone="brand"
      title="Điều Khoản Dịch Vụ & An Toàn CarMate"
      subtitle="Quy định cộng đồng · Tôn chỉ phi lợi nhuận · Pháp lý chia sẻ chuyến xe"
    >
      <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
        {/* Điều 1: Bản chất nền tảng */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <Car className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
            <span>1. Bản chất & Tôn chỉ Nền tảng CarMate</span>
          </div>
          <p>
            CarMate là nền tảng công nghệ trung gian kết nối cộng đồng <strong>đi chung xe & xe tiện chuyến</strong> tại Việt Nam. CarMate hoạt động theo nguyên tắc:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Không phải hãng vận tải:</strong> CarMate không sở hữu phương tiện, không tuyển dụng tài xế taxi hay xe hợp đồng chuyên nghiệp.</li>
            <li><strong>Chia sẻ chi phí xăng xe phi lợi nhuận:</strong> Số tiền đóng góp giữa hành khách và chủ xe được thỏa thuận nhằm bù đắp chi phí nhiên liệu và phí cầu đường BOT của chuyến đi.</li>
            <li><strong>Kết nối Zalo trực tiếp:</strong> Nền tảng không thu bất kỳ phí sàn, hoa hồng hay phí trung gian nào từ người dùng.</li>
          </ul>
        </div>

        {/* Điều 2: Trách nhiệm & Cam kết của Chủ xe */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>2. Cam kết của Chủ xe (Lái xe văn minh)</span>
          </div>
          <ul className="list-disc pl-4 space-y-1">
            <li>Có Giấy phép lái xe (GPLX) hợp lệ, phương tiện có đầy đủ giấy đăng ký, bảo hiểm trách nhiệm dân sự và đăng kiểm còn hạn.</li>
            <li>Tuyệt đối không sử dụng rượu bia, chất kích thích khi điều khiển phương tiện theo Nghị định 100/2019/NĐ-CP & Luật TTATGT đường bộ.</li>
            <li>Giữ đúng cam kết về giá vé chia sẻ, không tự ý tăng giá dọc đường, không đón quá số ghế đăng kiểm cho phép.</li>
            <li>Gửi định vị GPS thực tế qua Zalo cho hành khách để xác nhận điểm đón an toàn.</li>
          </ul>
        </div>

        {/* Điều 3: Trách nhiệm của Hành khách */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <Users className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>3. Cam kết của Hành khách</span>
          </div>
          <ul className="list-disc pl-4 space-y-1">
            <li>Có mặt đúng giờ tại điểm đón đã hẹn. Nếu có phát sinh chậm trễ, phải chủ động nhắn tin qua Zalo trước 30 phút.</li>
            <li>Không mang theo hàng cấm, vũ khí, chất cháy nổ hoặc hàng hóa trái quy định pháp luật.</li>
            <li>Thanh toán trực tiếp chi phí chia sẻ đã thống nhất cho chủ xe khi kết thúc chặng đi.</li>
            <li>Ứng xử văn minh, giữ gìn vệ sinh chung trên xe.</li>
          </ul>
        </div>

        {/* Điều 4: Bảo mật thông tin & Miễn trừ trách nhiệm */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>4. Bảo mật dữ liệu & Miễn trừ trách nhiệm</span>
          </div>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Bảo vệ số điện thoại:</strong> Số điện thoại chỉ được dùng cho mục đích gọi điện/nhắn tin Zalo phục vụ chuyến đi, không bao giờ cung cấp cho bên thứ ba cho mục đích tiếp thị.</li>
            <li><strong>Hộ chiếu tín nhiệm (Karma Rating):</strong> Hệ thống tự động ghi nhận lịch sử báo trễ, huỷ chuyến và đánh giá 2 chiều để loại bỏ các thành viên có hành vi bom xe hoặc thiếu văn minh.</li>
            <li><strong>Miễn trừ trách nhiệm:</strong> Mọi thỏa thuận, giao dịch tài chính và phát sinh trên hành trình do hai bên trực tiếp trao đổi và chịu trách nhiệm pháp lý theo quy định của pháp luật Việt Nam.</li>
          </ul>
        </div>
      </div>

      <div className="pt-2 flex items-center justify-end">
        <Button variant="primary" size="sm" onClick={onClose}>
          Tôi đã hiểu & đồng ý
        </Button>
      </div>
    </Modal>
  );
}
