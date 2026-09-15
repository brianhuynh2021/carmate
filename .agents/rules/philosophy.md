# CarMate — Nguyên tắc triển khai

Hợp đồng sản phẩm hiện hành nằm trong `AGENTS.md` và `docs/CONNECTION_FLOW.md`. Những giả định của mô hình chia sẻ chi phí trước đây không được ghi đè hướng kết nối hiện tại.

## Dữ liệu và toán học

- Chiếu hành trình vào hành lang và thời gian để tìm giao nhau khả thi; kiểm tra hướng đi, cửa sổ đón, sức chứa từng đoạn và điều kiện đi vòng trước khi xếp hạng.
- Giá do chủ xe niêm yết hoặc để “Liên hệ”. Công thức chi phí cũ chỉ là tham khảo, không đặt giá hay chứng minh cơ chế không thể bị thao túng.
- Chỉ chốt khi hai bên xác nhận cùng phiên bản điểm, giờ, xe, số người và tổng giá. Bảo vệ cuộc hẹn đã chốt khi chèn khách mới.
- Hủy, xác nhận và nhả ghế phải an toàn khi gọi lặp lại; giữ thời gian yêu cầu và hạn ban đầu khi tìm thay thế.
- Xếp hạng ứng viên hiện tại không chứng minh rằng lúc nào cũng có xe, không kẹt xe hoặc phương án tương lai luôn tệ hơn.

## Trải nghiệm

- Cho xem và nhập trước khi đăng nhập. Đăng nhập để xuất bản, lưu cuộc hẹn và theo dõi phản hồi; giữ nguyên bản nháp.
- Tìm kiếm không tự đăng nhu cầu. Chỉ công khai liên hệ khi người sở hữu đồng ý.
- Trạm là mốc, hỗ trợ đón tại trạm, tận nơi hoặc kết hợp sau khi hai bên thống nhất.
- Không dữ liệu thì nói rõ; lỗi mạng không được chuyển thành khách, xe, giá, PIN hay trạng thái giả.
- Hành động hủy phải nêu cuộc hẹn bị ảnh hưởng. Dùng thông báo và hộp thoại trong ứng dụng, không dùng `window.alert`, `window.confirm`, `window.prompt`.

## Giao diện

- Giữ màu chính `#0071e3`, bo góc và bố cục sáng/tối hiện hành; phân tầng chữ và trạng thái rõ ràng.
- Hộp thoại dùng portal, thứ tự lớp bảo đảm biểu mẫu vẫn còn khi mở đăng nhập.
- Gọi vai trò là “Chủ xe” và “Khách”; cách gọi không thay thế việc đánh giá hoạt động thực tế.
