# CarMate Engineering & Design Guidelines

## 1. Hợp đồng sản phẩm

- CarMate kết nối khách và chủ xe theo hành trình, hướng đi và khoảng thời gian. Đăng tin, tìm kiếm và kết nối miễn phí; không giữ tiền, thu hoa hồng hoặc tự chia tiền chuyến đi.
- Chủ xe được niêm yết giá (`pricingMode: listed`) hoặc chọn “Liên hệ” (`contact`, giá `null`). Không áp giá sàn/trần, biểu cước bắt buộc hoặc tỷ lệ chủ xe nhận 90%.
- Trạm là mốc tìm kiếm. Hỗ trợ `station`, `doorstep`, `hybrid`; điểm đón cuối cùng và thay đổi điều kiện do hai bên xác nhận.
- Khách xem và liên hệ số đã được chủ tin đồng ý công khai mà không cần đăng nhập. Chỉ chủ động đăng nhu cầu/gửi yêu cầu mới tạo dữ liệu tương ứng; không biến lượt tìm thành nguồn cầu.
- Cho nhập và xem giá trị trước đăng nhập. Đăng nhập tại thao tác xuất bản/ghi nhận có quyền sở hữu; giữ bản nháp và tiếp tục hành động đúng một lần.
- Đề xuất ghép không phải cam kết nhận đón. Không tự chuyển xe hoặc sửa cuộc hẹn đã được hai bên chốt.
- Dùng “Chủ xe” và “Khách” trong giao diện. Tên gọi hay việc miễn phí không tự xác lập phân loại pháp lý cho hoạt động thực tế.
- Chi tiết tại [docs/CONNECTION_FLOW.md](docs/CONNECTION_FLOW.md).
- Hồ sơ nhà xe tham khảo là thực thể riêng, không phải tài khoản, chuyến đang nhận khách hoặc ghế trống. Công khai cần nguồn, căn cứ liên hệ và mốc rà soát; danh bạ cũ vào bản nháp chờ kiểm tra.
- Quyền quản lý hồ sơ phải được duyệt theo tài khoản thực và bằng chứng qua kênh đã biết. Không dùng trùng số điện thoại, Google/Telegram hoặc cờ `verified` cũ làm bằng chứng quyền đại diện.
- Nhập hộ chuyến cần người quản lý đã được duyệt và sự đồng ý cho chính chuyến đó; không tạo tài khoản hay giấy tờ xác minh hộ. Báo sai/gỡ thông tin có tiến độ và mã tra cứu riêng. Chi tiết tại [docs/OPERATOR_PROFILES.md](docs/OPERATOR_PROFILES.md).

## 2. Bất biến toán học và dữ liệu

- Giữ lõi chiếu hành lang, giao khoảng thời gian, ETA và sức chứa theo đoạn. Tổng khách trên mỗi đoạn không vượt chỗ nhận khách và sức chứa xe trừ ghế người lái.
- Idempotent: cập nhật, chốt, hủy, nhả ghế không được nhân đôi tác dụng khi gọi lặp lại. Phiên xác nhận phải khớp cùng phiên bản điều kiện.
- Khi mở lại nhu cầu còn hiệu lực, giữ thời điểm yêu cầu và hạn ban đầu. Không tự kéo dài `x` để làm đẹp kết quả.
- Chỉ hiển thị xe, khách, số lượng, giờ và trạng thái từ dữ liệu thật. Không dùng fallback giả, lời hứa chưa chứng minh hoặc coi lỗi mạng là không có dữ liệu.
- Công thức Haversine/chi phí lăn bánh còn lưu là ước tính tham khảo của mô hình cũ; không được ghi đè giá chủ xe hay điều kiện hiện hành.
- Xác thực từ máy chủ; bảo vệ quyền sở hữu và thông tin liên hệ. Không tạo danh tính/token giả trong giao diện.

## 3. Trải nghiệm và hiển thị

- Giảm nhập lại; dùng lựa chọn nhanh, đảo chiều và tái sử dụng thông tin thật đã có.
- Thao tác hủy/xóa/đổi điều kiện phải cho thấy chuyến, người liên quan và tác động trước khi xác nhận.
- Không dùng `window.alert`, `window.confirm`, `window.prompt`. Dùng thông báo không chặn và phản hồi tại chỗ.
- Nền toàn hệ thống `#DFE5EC`; dark mode `#0b0f19`. Thẻ trắng `#FFFFFF`, dark `#1a2232`, viền `border-slate-300/70` / `dark:border-white/10`, bóng nhẹ.
- Bo góc `rounded-2xl` / `rounded-3xl`, typography rõ, vùng chạm dễ thao tác. Màu chính `#0071e3`; đỏ cho lỗi/hủy, cam cho chờ/cảnh báo, xanh lá cho trạng thái đã được xác nhận.
- Modal dùng React Portal vào `document.body`, lớp thông thường `z-[9999]`; xác thực nằm trên biểu mẫu đang nhập. Đóng xác thực không làm mất bản nháp.
- Giữ thuật ngữ kỹ thuật và tên nghiên cứu ngoài luồng thao tác phổ thông trừ khi chúng giúp người dùng quyết định.

- Typography dùng các class `type-*` trong `apps/web/src/index.css`; xem `docs/UI_TYPOGRAPHY.md`. Một họ chữ Inter, nhãn/nút/nội dung 14px, ô nhập 16px; không tạo cỡ chữ riêng hoặc trộn class ghi đè vai trò.

## 4. Kỷ luật Git và kiểm chứng

- Không commit hoặc push thẳng lên `main`.
- Phát triển và kiểm thử trên nhánh `dev`; chỉ merge sang `main` khi người dùng yêu cầu trực tiếp.
- Kiểm thử phù hợp với thay đổi; phân biệt bài kiểm thử thuần, API với dữ liệu cô lập, trình duyệt và vận hành thật.
- Không tuyên bố kiểm thử mã chứng minh luôn có xe, xác suất ngoài thực địa hoặc tính hợp pháp của mọi hoạt động.
