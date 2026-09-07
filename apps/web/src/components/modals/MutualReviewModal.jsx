import React, { useState } from 'react';
import { Star, ShieldAlert, CheckCircle2, ThumbsUp, AlertTriangle, UserCheck, Car, Users } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

const DRIVER_POSITIVE_TAGS = [
  'Đúng giờ điểm hẹn',
  'Lịch sự văn minh',
  'Giữ vệ sinh xe',
  'Gửi tiền xăng sòng phẳng',
  'Hòa đồng vui vẻ'
];

const DRIVER_WARNING_TAGS = [
  'Leo cây không báo (Bom xe)',
  'Bắt xe chờ lâu (>15p)',
  'Thái độ thô lỗ',
  'Hút thuốc trên xe',
  'Kỳ kèo tiền xăng'
];

const PASSENGER_POSITIVE_TAGS = [
  'Lái xe an toàn',
  'Đúng giờ xuất phát',
  'Xe gia đình sạch êm',
  'Không khói thuốc',
  'Thân thiện nhiệt tình'
];

const PASSENGER_WARNING_TAGS = [
  'Phóng nhanh vượt ẩu',
  'Xe có mùi thuốc lá',
  'Trễ giờ xuất phát',
  'Nhồi nhét thêm người'
];

export default function MutualReviewModal({ booking, onClose, onSubmitReview }) {
  // Hook phải gọi trước mọi early return (Rules of Hooks)

  // Tự động nhận diện vai trò mặc định (hoặc cho phép hoán đổi)
  const defaultIsDriver = booking?.partyRole?.includes('Chủ xe đón') || false;
  const [reviewerRole, setReviewerRole] = useState(defaultIsDriver ? 'driver' : 'passenger');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState(['Đúng giờ điểm hẹn', 'Lịch sự văn minh']);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDriverReviewing = reviewerRole === 'driver';
  const targetName = booking.contactName || (isDriverReviewing ? 'Hành khách' : 'Chủ xe');

  const positiveTags = isDriverReviewing ? DRIVER_POSITIVE_TAGS : PASSENGER_POSITIVE_TAGS;
  const warningTags = isDriverReviewing ? DRIVER_WARNING_TAGS : PASSENGER_WARNING_TAGS;

  const handleToggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleRoleChange = (role) => {
    setReviewerRole(role);
    setSelectedTags(
      role === 'driver' ? ['Đúng giờ điểm hẹn', 'Lịch sự văn minh'] : ['Lái xe an toàn', 'Đúng giờ xuất phát']
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmitReview({
        escrowId: booking.escrowId,
        reviewerRole,
        rating,
        tags: selectedTags,
        comment: comment.trim()
      });
      onClose();
    } catch (err) {
      console.error('Lỗi gửi đánh giá:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLowRating = rating <= 2;
  const hasWarningTag = selectedTags.some((t) => warningTags.includes(t));

  if (!booking) return null;

  return (
    <Modal
      onClose={onClose}
      size="md"
      icon={Star}
      iconTone="brand"
      title="Đánh Giá Chuyến Đi 2 Chiều"
      subtitle="Cộng đồng bình đẳng · Cùng xây dựng văn hoá đi chung xe an minh"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Để sau
          </Button>
          <Button
            size="md"
            icon={CheckCircle2}
            onClick={handleSubmit}
            variant="primary"
            className="font-semibold shadow-xs"
          >
            {isSubmitting ? 'Đang ghi nhận...' : 'Gửi đánh giá cộng đồng'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        {/* Bộ chuyển đổi vai trò người đánh giá */}
        <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleRoleChange('driver')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              reviewerRole === 'driver'
                ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Tôi là Chủ xe (Nhận xét Khách)</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange('passenger')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              reviewerRole === 'passenger'
                ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Tôi là Người đi cùng (Nhận xét Chủ xe)</span>
          </button>
        </div>

        {/* Thông tin đối tác cần đánh giá */}
        <div className="text-center space-y-2 py-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Bạn đang đánh giá {isDriverReviewing ? 'hành khách' : 'chủ xe'}:
          </p>
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">{targetName}</h4>

          {/* Chấm sao tương tác */}
          <div className="flex items-center justify-center gap-2 pt-1">
            {[1, 2, 3, 4, 5].map((s) => {
              const isFilled = (hoverRating || rating) >= s;
              return (
                <button
                  key={s}
                  type="button"
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(s)}
                  className="p-1 cursor-pointer transition-transform hover:scale-115 active:scale-95"
                  title={`${s} sao`}
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      isFilled ? 'fill-amber-400 text-amber-400 drop-shadow-xs' : 'text-slate-200 dark:text-slate-700'
                    }`}
                  />
                </button>
              );
            })}
          </div>
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            {rating === 5 && '🌟 Tuyệt vời · Rất hài lòng'}
            {rating === 4 && '👍 Tốt · Đồng hành vui vẻ'}
            {rating === 3 && '👌 Bình thường · Cần cải thiện một chút'}
            {rating === 2 && '⚠️ Không hài lòng · Thiếu văn minh'}
            {rating === 1 && '❌ Rất tệ · Vi phạm cam kết'}
          </p>
        </div>

        {/* Cảnh báo bảo vệ cộng đồng nếu chấm sao thấp hoặc chọn cảnh báo */}
        {(isLowRating || hasWarningTag) && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">
                {isDriverReviewing ? 'Gắn cờ bảo vệ các chủ xe khác:' : 'Góp ý kiểm duyệt chủ xe:'}
              </p>
              <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                Đánh giá này sẽ lưu vào lịch sử tín nhiệm để các thành viên khác cảnh giác, đảm bảo cộng đồng không bị
                tái diễn tình trạng leo cây hoặc trễ hẹn.
              </p>
            </div>
          </div>
        )}

        {/* Thẻ tiêu chí tích cực */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Điểm cộng chuyến đi:</p>
          <div className="flex flex-wrap gap-1.5">
            {positiveTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'
                  }`}
                >
                  ✓ {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Thẻ tiêu chí cảnh báo / góp ý */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Góp ý hoặc cảnh báo (nếu có):</p>
          <div className="flex flex-wrap gap-1.5">
            {warningTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'
                  }`}
                >
                  ⚠️ {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nhận xét cụ thể */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Lời nhắn nhủ thêm (Không bắt buộc):
          </label>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              isDriverReviewing
                ? 'Ví dụ: Bạn Nam đón đúng giờ, lên xe chào hỏi vui vẻ...'
                : 'Ví dụ: Chủ xe lái rất an toàn, xe thơm mát...'
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
    </Modal>
  );
}
