# Chữ trên giao diện CarMate

Dùng Inter cho nội dung, tiêu đề và điều khiển. `font-display` dùng cùng họ chữ với `font-sans`; hệ thống chỉ dùng font dự phòng khi Inter chưa tải được. Font monospace dành cho mã, PIN và thông tin kỹ thuật cần giữ từng ký tự.

| Vai trò | Class | Cỡ | Độ đậm |
| --- | --- | --- | --- |
| Tiêu đề trang lớn | `type-page-title` | 24px | 700 |
| Tiêu đề màn hình / hộp thoại | `type-title` | 20px | 700 |
| Tiêu đề khối / thẻ | `type-heading` | 16px | 600 |
| Nội dung | `type-body` | 14px | 400 |
| Nội dung nhấn mạnh | `type-body-strong` | 14px | 600 |
| Nhãn trường | `type-label` | 14px | 500 |
| Nút hành động | `type-button` | 14px | 600 |
| Nút gọn / bộ lọc | `type-button-sm` | 13px | 600 |
| Ô nhập và lựa chọn | `type-input` | 16px | 400 |
| Giải thích phụ | `type-caption` | 13px | 400 |
| Thời điểm / chú thích nhỏ | `type-footnote` | 12px | 400 |
| Nhãn trạng thái / số đếm | `type-badge` | 12px | 600 |
| Điều hướng di động | `type-nav` | 12px | 500 |
| Số liệu nổi bật | `type-metric` | 24px | 700 |

Cỡ chữ khai báo bằng `rem`, bảng tính với cỡ gốc 16px. Mỗi class định nghĩa cả cỡ, độ đậm, chiều cao dòng và khoảng cách chữ. Dùng một vai trò trên mỗi phần tử; không gắn thêm `text-sm`, `font-bold`, `leading-*` hoặc `tracking-*` làm lệch vai trò đó.

- Thông tin quyết định chuyến đi (giờ, chỗ, điểm đón, giá) dùng nội dung hoặc tiêu đề; không thu nhỏ thành chú thích.
- Ô nhập giữ 16px ở cả desktop và mobile; không giảm dưới 16px trên điện thoại.
- Tránh đổi cỡ chữ khi chọn tab hoặc nút; dùng màu, nền hoặc viền để thể hiện trạng thái.
- Giá và giờ dùng `tabular` nếu cần thẳng cột; không đổi sang monospace.
- Không thêm cỡ 9–11px hay cỡ lẻ riêng cho một màn hình.
- Kiểm tra chữ tiếng Việt, ngắt dòng và tràn ngang ở mobile khi thay đổi nội dung.
