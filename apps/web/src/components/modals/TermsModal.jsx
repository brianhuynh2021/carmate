import React from 'react';
import { ShieldCheck, FileText, CheckCircle2, AlertTriangle, Lock, Users, Car, X } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

export default function TermsModal({ onClose, zIndex = 'z-[9999]' }) {
  return (
    <Modal
      onClose={onClose}
      zIndex={zIndex}
      size="lg"
      icon={ShieldCheck}
      iconTone="brand"
      title="Điều Khoản Dịch Vụ & Pháp Lý Chia Sẻ Chi Phí CarMate"
      subtitle="Định vị Nền tảng Công nghệ Kết nối Dân sự · Nguyên tắc '3 Không' & '3 Có'"
    >
      <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
        {/* Banner định vị pháp lý */}
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 dark:text-emerald-300 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Định vị: Nền tảng Kết nối Chia sẻ Chi phí Hành trình (Carpooling)</span>
          </div>
          <p className="text-[11px] leading-normal">
            CarMate là nền tảng công nghệ trung gian theo Nghị định 52/2013/NĐ-CP và Nghị định 85/2021/NĐ-CP, kết nối các cá nhân có chung hành trình di chuyển để san sẻ chi phí nhiên liệu. <strong>CarMate tuyệt đối không phải là đơn vị kinh doanh vận tải hành khách theo Nghị định 10/2020/NĐ-CP.</strong>
          </p>
        </div>

        {/* Phần 1: Trụ cột "3 Không" */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Trụ cột "3 Không" (Chống Thương Mại Hóa Xe Cá Nhân)</span>
          </div>
          <ul className="list-disc pl-4 space-y-1.5 text-[11.5px]">
            <li>
              <strong>1. Không dùng từ ngữ vận tải thương mại:</strong> Hệ thống không sử dụng các thuật ngữ "giá cước", "tiền vé", "cuốc xe", "tài xế taxi" hay "khách hàng". Toàn bộ giao diện và truyền thông chuẩn hóa danh xưng <em>"Chủ xe cá nhân"</em>, <em>"Người đi cùng"</em> và <em>"Mức bù xăng dầu / đóng góp chi phí hành trình"</em>.
            </li>
            <li>
              <strong>2. Không biến tướng taxi dịch vụ (Chủ xe tự chủ & Tự chịu trách nhiệm):</strong> CarMate là nền tảng kết nối nhu cầu chia sẻ chi phí dân sự, không can thiệp hay giới hạn số chuyến của cá nhân. Chủ xe tự cam kết hành trình cá nhân tiện đường và tự chịu trách nhiệm về tần suất di chuyển theo quy định của Luật Giao thông đường bộ.
            </li>
            <li>
              <strong>3. Không định giá vượt định mức chi phí thực tế:</strong> Mức đóng góp được tính toán tự động dựa trên cự ly Geodesic Haversine × 1.28 và trạm thu phí BOT thực tế. Tổng mức san sẻ từ người đi cùng bảo đảm không vượt quá chi phí nhiên liệu và hao mòn xe (<em>P ≤ Xăng + BOT</em>), tuân thủ nguyên tắc dân sự phi lợi nhuận theo Điều 3 Bộ Luật Dân sự 2015.
            </li>
          </ul>
        </div>

        {/* Phần 2: Trụ cột "3 Có" */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <ShieldCheck className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
            <span>Trụ cột "3 Có" (Minh Bạch & Bảo Vệ Thành Viên)</span>
          </div>
          <ul className="list-disc pl-4 space-y-1.5 text-[11.5px]">
            <li>
              <strong>1. Có đăng ký đúng mã ngành Công Nghệ Thông Tin:</strong>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pl-1 mt-0.5">
                • Mã 6201: Hoạt động lập trình máy tính (thuật toán khớp chuyến Haversine).<br />
                • Mã 6311: Xử lý dữ liệu, cho thuê và các hoạt động liên quan.<br />
                • Mã 6312: Cổng thông tin điện tử (nền tảng kết nối nhu cầu xã hội).
              </div>
            </li>
            <li>
              <strong>2. Có đăng ký Website Thương mại Điện tử:</strong> Hoạt động minh bạch dưới hình thức nền tảng TMĐT kết nối nhu cầu theo Nghị định 52/2013/NĐ-CP và Nghị định 85/2021/NĐ-CP.
            </li>
            <li>
              <strong>3. Có Thỏa thuận Dân sự & Thẻ Pháp Lý Hành Trình:</strong> Cung cấp tính năng <em>"Thẻ Pháp Lý Hành Trình Dân Sự"</em> 1-chạm xuất trình cho CSGT / Thanh tra Giao thông, chứng minh quyền tự do giao kết dân sự tương trợ phi thương mại theo Điều 3 Bộ Luật Dân sự 2015.
            </li>
          </ul>
        </div>

        {/* Điều 3: Trách nhiệm & An toàn */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
            <Car className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Cam Kết An Toàn & Điểm Đón Quy Ước</span>
          </div>
          <ul className="list-disc pl-4 space-y-1 text-[11.5px]">
            <li>
              <strong>Xe cá nhân biển trắng:</strong> Phương tiện có đầy đủ giấy đăng ký xe, bảo hiểm TNDS bắt buộc và đăng kiểm còn hiệu lực.
            </li>
            <li>
              <strong>Điểm đón quy ước an toàn:</strong> Tuyệt đối chỉ đón trả tại các trạm xăng lớn, bến xe, điểm dừng quy ước có vỉa hè an toàn trên QL13. Không dừng đỗ tùy tiện cản trở giao thông.
            </li>
            <li>
              <strong>Không rượu bia & chất kích thích:</strong> Chủ xe và Người đi cùng tuân thủ nghiêm ngặt Luật Trật tự, An toàn giao thông đường bộ.
            </li>
          </ul>
        </div>
      </div>

      <div className="pt-3 flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.06] mt-2">
        <span className="text-[11px] text-slate-400">Điều 3 BLDS 2015 · NĐ 52/2013/NĐ-CP</span>
        <Button variant="primary" size="sm" onClick={onClose}>
          Tôi đã hiểu & Đồng ý
        </Button>
      </div>
    </Modal>
  );
}
