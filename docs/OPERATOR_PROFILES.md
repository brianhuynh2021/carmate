# Hồ sơ nhà xe và quyền quản lý

## Ba việc khác nhau

1. **Hồ sơ tham khảo:** ghi nhà xe/chủ xe, khu vực phục vụ, lịch và giá công bố, nguồn và ngày rà soát. Không tạo tài khoản, chuyến đang chạy, ghế còn trống hay cuộc hẹn.
2. **Quyền quản lý:** một tài khoản thật gửi yêu cầu đại diện. CarMate đối chiếu quyền qua kênh liên hệ đã được kiểm tra độc lập rồi duyệt. Đăng nhập Google/Telegram và nhập số điện thoại không tự chứng minh quyền đại diện.
3. **Chuyến cụ thể:** người quản lý đã duyệt đăng ngày, giờ, xe, ghế, giá hoặc Liên hệ và điều kiện đón. Nhập hộ chuyến phải lưu sự đồng ý cho chính chuyến đó. Hai bên vẫn xác nhận điều kiện theo luồng kết nối hiện hành.

## Khách dùng ngay

Khách xem danh bạ và liên hệ không cần đăng nhập. Mỗi hồ sơ công khai có nguồn, thời điểm kiểm tra và hạn rà soát lại. Lịch công bố không được dùng làm nguồn ghế cho bộ ghép chuyến. Giá quá hạn hoặc chưa được rà soát phải được trình bày kèm cảnh báo, không đưa vào xếp hạng chuyến như giá hiện hành.

Khách có thể báo sai hoặc yêu cầu gỡ thông tin mà không đăng nhập. Mã phản ánh và mã tra cứu riêng cho phép xem tiến độ; giữ mã này như thông tin riêng tư. Máy chủ chỉ lưu bản băm của mã tra cứu. Liên hệ người phản ánh và bằng chứng nội bộ không xuất hiện trong danh bạ hoặc kết quả tra cứu công khai.

## Nhập hồ sơ trong quản trị

- Hồ sơ mới mặc định là bản nháp. Không tạo tài khoản đứng tên nhà xe.
- Nguồn gồm website, Facebook, trao đổi với chủ xe hoặc nguồn khác. Đường dẫn chỉ nhận HTTP(S). Người nhập phải ghi đúng nguồn đã kiểm tra; hệ thống không tự xác thực nội dung website.
- Số liên hệ doanh nghiệp cần căn cứ nguồn kinh doanh chính thức hoặc sự đồng ý của chủ thể. Số cá nhân cần bằng chứng chủ số đồng ý công khai. Ghi chú bằng chứng là nội bộ.
- Công khai cần ngày kiểm tra thực tế và hạn rà soát lại; không được ghi ngày đã kiểm tra ở tương lai.
- Danh bạ cũ được nhập một lần thành bản nháp, giữ thông tin để rà soát. Cờ `verified` cũ không được chuyển thành bằng chứng mới.
- Đổi danh tính, số hoặc nguồn khi đã xuất bản phải nhập lại bằng chứng và mốc rà soát. Có thể ẩn hồ sơ để xử lý phản ánh.

## Nhận quyền quản lý

Khách đăng nhập chỉ ở bước gửi yêu cầu nhận quyền. Nội dung yêu cầu và xác nhận có thẩm quyền được lưu vào hàng chờ. Quản trị đối chiếu với kênh đã có của nhà xe, ghi số đã đối chiếu, kênh, thời điểm và bằng chứng đại diện. Không lấy một số mới do người xin quyền đưa ra làm bằng chứng độc lập.

Mỗi hồ sơ hiện hỗ trợ một tài khoản quản lý. Hai yêu cầu không thể cùng được duyệt cho hai tài khoản. Các quyết định đã kết luận có tính lặp an toàn và không bị đổi kết luận qua cùng yêu cầu.

Người đã nhận quyền có thể sửa khu vực phục vụ, lịch, giá và ghi chú đón. Những sửa đổi này làm ngày kiểm tra hết hiệu lực để yêu cầu rà soát lại; không tự gia hạn nhãn thông tin còn mới. Đổi số, tên và nguồn thực hiện qua yêu cầu sửa để quản trị đối chiếu.

## Nhập hộ chuyến

Chỉ hồ sơ đã xuất bản và có tài khoản quản lý còn hợp lệ mới có thể nhập hộ chuyến. Bản ghi chuyến thuộc tài khoản đó, để chủ xe tiếp tục quản lý liên hệ và cuộc hẹn. Quản trị cần ghi nhận sự đồng ý trong 7 ngày gần nhất cho đúng nội dung chuyến và việc công khai liên hệ. Đây là giới hạn nghiệp vụ của sản phẩm, không phải chứng nhận pháp lý.

API lưu bằng chứng riêng trong `operator_trip_authorizations`, không trộn vào dữ liệu chuyến công khai. Gửi lại cùng `requestId` và nội dung trả về cùng chuyến; thay nội dung cần mã thao tác mới. Chuyến vẫn phải thỏa các điều kiện ngày giờ, sức chứa, xe thực tế và giá do chủ xe cung cấp. Không tự sinh chuyến hằng ngày từ lịch tham khảo.

## Báo sai và yêu cầu gỡ

Phản ánh đi qua `pending → reviewing → resolved/rejected`; có thể kết luận trực tiếp từ pending nếu đã xử lý. Mỗi lần xử lý cần ghi chú, lưu lịch sử. Đánh dấu đã xử lý không tự sửa hoặc ẩn hồ sơ: quản trị phải thực hiện thay đổi tương ứng và ghi rõ kết quả. Người phản ánh có thể tra cứu kết quả bằng mã riêng kể cả sau khi hồ sơ bị ẩn.

## Ranh giới vận hành

- Xác minh quyền quản lý không phải chứng nhận tài xế an toàn, giấy phép hay bảo đảm đón khách.
- Giai đoạn này duyệt quyền và xử lý phản ánh là công việc vận hành thủ công; chưa có người trực thì không nên hứa thời gian xử lý.
- Chưa có nguồn đủ bằng chứng thì danh bạ công khai có thể trống. Không dùng tài khoản, đối tác hoặc số ghế giả để lấp chỗ trống.
- Thay đổi này không thu thập bài đăng Facebook, không liên hệ nhà xe, không xuất bản dữ liệu doanh nghiệp mới và không triển khai lên dịch vụ thật.

## Kiểm chứng

`npm run test:operator-profiles` kiểm tra dữ liệu, quyền, độ mới, hàng chờ và khôi phục SQLite. `npm run test:operator-http` kiểm tra API thực qua cổng nội bộ với dữ liệu tạm, gồm nhập hộ chuyến, xác thực và giới hạn phản ánh. Bộ HTTP chặn kết nối ra ngoài; không gửi OTP hay tin nhắn thật.
