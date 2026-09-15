# CarMate — Quy trình vận hành kết nối

Tham chiếu đầy đủ: [Luồng kết nối](CONNECTION_FLOW.md). Trạm là mốc tổ chức dữ liệu; điểm đón cuối cùng phụ thuộc điều kiện thực tế và xác nhận của hai bên.

## Trước khi có chuyến

- Chủ xe nhập hành trình, ngày/giờ, chỗ trống, giá hoặc “Liên hệ”, cách đón và xe thật.
- Bản xem trước kiểm tra nhu cầu có thật. Không có nhu cầu hoặc không tải được dữ liệu phải được phân biệt.
- Đăng nhập trước khi xuất bản để quản lý quyền sở hữu. Thông tin liên hệ chỉ công khai theo đồng ý của chủ tin.
- Khách tìm và xem thông tin không cần đăng nhập. Một lượt tìm không được tính là khách đã đăng nhu cầu.

## Khi hai bên tìm thấy nhau

- Khách có thể liên lạc trực tiếp với chủ xe qua số đã được công khai.
- Hai bên thống nhất điểm đón/trả, khoảng giờ, số người và giá. CarMate không áp bảng cước hoặc thu tiền trung gian.
- Nếu dùng cuộc hẹn trong CarMate, ghi rõ đề nghị và chờ bên kia xác nhận cùng phiên bản. Trước đó chỉ hiển thị “đang trao đổi” hoặc “đang chờ xác nhận”.
- Khách không được hướng dẫn ra trạm dựa vào một đề xuất chưa có xe nhận đón.

## Trước và trong lúc đón

- Theo dõi thông tin xe, giờ hẹn và thông báo cập nhật có thật.
- Trạm, nhà hoặc điểm gần đó đều cần địa điểm cụ thể đã thống nhất. Không mặc định mọi cây xăng đều cho phép đón/trả hoặc có đủ tiện ích.
- Đổi giờ, điểm, giá hoặc xe cần đề nghị lại. Không sửa âm thầm cuộc hẹn đã chốt.
- Khi nhận khách thêm trên đoạn giữa tuyến, kiểm tra chỗ trống trên chính đoạn khách đi và ảnh hưởng tới các cuộc hẹn khác.
- Tình trạng “chủ xe đã nhận”, “khách đã lên xe” và “hoàn thành” là các sự kiện riêng. GPS đơn lẻ không đủ chứng minh tất cả sự kiện này.

## Khi có trục trặc

| Sự việc | Cách xử lý |
| --- | --- |
| Không liên lạc được hoặc chưa có bên nhận | Hiển thị chưa xác nhận; cho tìm ứng viên khác. |
| Hủy trước lúc đón | Giải phóng chỗ một lần; hỏi/ghi nhận khách còn nhu cầu hay đã kết thúc. |
| Khách còn nhu cầu và còn thời hạn | Mở lại tìm kiếm với thời điểm yêu cầu và hạn ban đầu; không tự kéo dài thời hạn. |
| Có xe khác phù hợp | Đưa đề xuất, ghi rõ điều kiện mới và chờ xác nhận; không tự gán xe. |
| Không có xe thay thế | Nói rõ chưa có phương án; hiển thị thông tin tham khảo còn hiệu lực nếu có. |
| Báo bỏ đón hoặc thông tin sai | Lưu báo cáo và bằng chứng theo quyền truy cập. Không coi phản ánh đơn phương là kết luận tự động. |
| Sự cố sau khi đã lên xe | Xử lý như sự cố hành trình; không giả vờ quay lại trạng thái “chưa được đón”. |

Tiền chuyến đi được hai bên xử lý trực tiếp. Không đặt tài khoản ngân hàng, mã PIN, xe hoặc giờ đón mặc định để thay cho dữ liệu thiếu.

## Ranh giới cam kết

CarMate hỗ trợ tra cứu, ghi nhận điều kiện và tìm phương án tiếp theo. Nền tảng không được hứa luôn có xe, chắc chắn được đón, gọi lại trong một thời gian cố định hoặc giữ nguyên giá xe thay thế khi chưa có dữ liệu và xác nhận tương ứng.

Tham số ETA, cửa sổ thời gian và tần suất xe cần hiệu chỉnh bằng dữ liệu thực địa. Tên nghiên cứu, số lượng kiểm thử hoặc một chỉ báo GPS không thay cho bằng chứng về chất lượng phục vụ.
