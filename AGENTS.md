# CarMate Engineering & Design Guidelines

CarMate tuân thủ triệt để 4 trụ cột triết lý kỹ thuật và thiết kế:

## 1. Tư duy MIT (MIT Invariants - Bất biến Toán học & Logic)

- Mọi trạng thái hệ thống phải thỏa mãn điều kiện bất biến (Invariants). State machine không bao giờ được rơi vào trạng thái lấp lửng hay mâu thuẫn (VD: xe 5 chỗ không bao giờ vượt quá 4 ghế khách, 7 chỗ không quá 6 ghế).
- Idempotent: Các thao tác cập nhật, huỷ, xoá đều có thể gọi lặp lại an toàn mà không làm hỏng dữ liệu.
- Định giá phụ xăng dựa trên công thức toán học cự ly Geodesic Haversine × 1.28 và dữ liệu trạm thu phí BOT chính xác, cục bộ 100%, không phụ thuộc vào LLM ảo giác.

## 2. Tư duy Stanford (Stanford Ergonomics - Công thái học & Tải nhận thức = 0)

- Tối ưu hóa trải nghiệm sao cho người dùng và quản trị viên không phải suy nghĩ hoặc gõ phím thừa (Cognitive Load → 0).
- Các thao tác nhạy cảm hoặc nguy hiểm (Xoá bài, Khóa tài khoản, Huỷ chuyến) luôn hiển thị đầy đủ ngữ cảnh (mã chuyến, người liên quan, lộ trình, giá tiền) trước khi xác nhận, ngăn chặn 100% việc bấm nhầm.
- Hỗ trợ thao tác 1-chạm (One-tap action) cho các luồng thường xuyên (Preset chip giá, chọn mẫu chuyến, đảo chiều khứ hồi, tái sử dụng ảnh xe thật).

## 3. Tư duy Cursor (Cursor Ambient Intelligence & Zero Blocking)

- Trí tuệ bản địa (Edge AI / Zero-LLM) xử lý trực tiếp trên máy client trong dưới 1ms, không chờ đợi round-trip máy chủ khi gợi ý thói quen hay phân tích NLP.
- Tuyệt đối KHÔNG sử dụng các lệnh blocking thô sơ của trình duyệt (`window.alert`, `window.confirm`, `window.prompt`). Mọi phản hồi đều là Reactive, Non-blocking, mượt mà.
- Phản hồi trạng thái (Feedback Loop) tức thì thông qua Toast notification hoặc In-place notice thay vì popup hệ thống gián đoạn trải nghiệm.

## 4. Thị giác Apple (Apple Human Interface Guidelines & Liquid Aesthetics)

- Thiết kế squircle bo góc mềm mại (`rounded-2xl`, `rounded-3xl`), kính mờ bán trong suốt (`backdrop-blur-md`, `bg-white/80` và `dark:bg-[#1c1c1e]/80`).
- Typography phân tầng rõ ràng (Inter / SF Pro Display), số liệu font Mono hiển thị chuẩn xác.
- Tone màu biểu tượng có chủ đích: `danger` (rose/red) cho hành động huỷ/xoá, `warning` (amber/orange) cho trễ hẹn/lưu ý, `success` (emerald/green) cho xác thực/thành công, `primary` (Apple Blue `#0071e3`) cho hành động chính.
- Tất cả các Modal đều phải dùng React Portal (`z-[9999]`) gắn vào `document.body` để triệt tiêu vĩnh viễn lỗi đè lớp (CSS Stacking Context).

## 5. Chuẩn mực Danh xưng Bản địa (Terminology Standard)

- Luôn luôn dùng **"Chủ xe"** và **"Người đi cùng"** / **"Khách đi cùng"**.
- Tuyệt đối **KHÔNG dùng "Bác tài"** hay **"Tài xế"** để bảo toàn bản chất đi ghép xe tiện chuyến / chia sẻ chi phí lăn bánh văn minh, không phải dịch vụ taxi thương mại.

## 6. Kỷ luật Git & Quy trình Phát triển (Git Workflow Discipline)

- **Tuyệt đối KHÔNG commit hoặc push thẳng lên nhánh `main`**.
- Mọi công việc (tính năng mới, sửa lỗi, tối ưu giao diện) 100% phải được thực hiện và kiểm thử trên nhánh **`dev`**.
- Chỉ thực hiện merge từ `dev` vào `main` khi có sự xác nhận/yêu cầu trực tiếp từ người dùng.
