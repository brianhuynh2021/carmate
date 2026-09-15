# CarMate — Luồng kết nối được chấp nhận

## Phạm vi

CarMate giúp khách và chủ xe tìm thấy nhau theo hành trình, hướng đi và khoảng thời gian. Tìm kiếm, đăng chuyến và kết nối miễn phí. Chủ xe quyết định giá; hai bên liên lạc trực tiếp và chốt việc đón. Trạm là mốc tìm kiếm; đón tại trạm, tận nơi hoặc kết hợp tùy điều kiện của chủ xe và xác nhận của hai bên.

Tài liệu mô tả hợp đồng hành vi của luồng mới. Nó không xác nhận rằng việc đón ngoài thực địa hoặc cấu hình đăng nhập production đã được kiểm chứng.

## 1. Khách chưa đăng nhập

1. Chọn điểm đi, điểm đến, ngày/giờ và số người.
2. Xem các chuyến thật, giá chủ xe niêm yết hoặc “Liên hệ”, khả năng đón và độ mới của thông tin.
3. Gọi hoặc mở Zalo nếu chủ xe đã đồng ý công khai số liên hệ. Không dùng đăng nhập/giữ chỗ để khóa số đã công khai.
4. Nếu muốn chủ xe tìm thấy mình, chủ động chọn **Đăng nhu cầu tìm xe**. Việc tìm kiếm hoặc bấm liên hệ không tự đăng nhu cầu và không tự giữ ghế.
5. Đăng nhập tại hành động đăng nhu cầu hoặc gửi yêu cầu trong CarMate. Biểu mẫu được giữ nguyên; tiếp tục đúng hành động sau đăng nhập thành công.

Khách xác định thời hạn còn cần xe. Khi hết hạn hoặc chủ động kết thúc, hệ thống không tiếp tục hiển thị họ như người đang chờ. Công khai số liên hệ của khách là lựa chọn riêng, không suy ra từ đăng nhập.

## 2. Chủ xe chưa đăng nhập

1. **Đăng chuyến** trên desktop và mobile đều mở cùng một biểu mẫu.
2. Nhập tuyến, ngày/giờ, tổng số chỗ xe và số chỗ nhận khách; chọn giá `listed` hoặc `contact`.
3. Chọn cách đón, giới hạn đi vòng và ghi chú; nhập dòng xe, biển số thật.
4. Bấm **Xem trước chuyến**. Chỉ lúc này mới kiểm tra các nhu cầu đã được đăng và còn phù hợp; không ghi chuyến hay đăng nhập ngầm.
5. Bản xem trước nhu cầu chỉ chứa thông tin hành trình đã rút gọn, thời gian, số người và lý do tương thích. Không chứa điện thoại, tên riêng hoặc địa chỉ nhà khách. Kết quả không có khách phải ghi rõ; lỗi tải không được biến thành số 0.
6. Nhập số liên hệ và xác nhận quyền công khai trên tin chuyến, rồi bấm **Đăng chuyến miễn phí**.
7. Nếu chưa đăng nhập, mở xác thực. Đóng cửa sổ xác thực vẫn giữ bản nháp. Thành công tiếp tục đăng đúng một lần; chỉ phản hồi thành công của máy chủ mới đưa chuyến vào danh sách.

Chuyến thật là nguồn cung chính. Không tạo thêm một ý định chủ xe trùng lặp sau khi đăng chuyến để nhân đôi nguồn cung hoặc sức chứa.

## 3. Hai cách liên lạc

### Trực tiếp ngoài nền tảng

Hai bên có thể gọi/Zalo và tự quyết định. Bấm gọi chỉ chứng minh đã mở liên hệ. CarMate không tự suy ra đã nhận đón, đã trả tiền hoặc đã lên xe từ hành động này.

### Ghi nhận cuộc hẹn trong CarMate

Nếu muốn nền tảng lưu và theo dõi cam kết:

1. Gửi yêu cầu tạo cuộc trao đổi (`inquiring`), chưa giữ ghế.
2. Một bên đề nghị điểm đón/trả, khoảng giờ, số người và tổng giá (`pre_confirmed`).
3. Bên còn lại xác nhận đúng phiên bản đề nghị. Máy chủ kiểm tra quyền, thời hạn và sức chứa trên đoạn trước khi chuyển `confirmed`.
4. Thay đổi điều kiện phải tạo đề nghị mới. Không lấy một xác nhận cũ áp vào giá, giờ hay xe khác.
5. Trạng thái lên xe và hoàn thành cần ghi nhận tương ứng; đăng nhập hay xác nhận nhận đón không tự chứng minh đã vận chuyển thành công.

Đăng nhập dùng để gắn thao tác với người chịu trách nhiệm, không phải điều kiện để xem thông tin liên hệ đã được chủ tin đồng ý công khai.

## 4. Gợi ý và xử lý thay đổi

- Lọc khả thi trước: đúng hướng và đoạn tuyến, giao khoảng thời gian, còn ghế, điều kiện đón tương thích.
- Xếp hạng chỉ là thứ tự đề xuất giữa các ứng viên hiện có. Giá chưa báo là chưa biết; không xem `null` như miễn phí.
- Trạm hỗ trợ chiếu không gian–thời gian. Điểm đón linh hoạt cần chủ xe đồng ý; nếu thiếu tọa độ thì không tự bịa khoảng đi vòng hoặc thời gian tới nhà.
- Chèn khách giữa đường phải kiểm tra sức chứa trên từng đoạn và bảo toàn các cuộc hẹn đã chốt.
- Khi hủy, giải phóng chỗ đúng một lần. Nếu khách vẫn cần đi và thời hạn ban đầu còn hiệu lực, mở lại nhu cầu với giờ yêu cầu/thời hạn gốc.
- Xe thay thế là đề xuất để hai bên xem và xác nhận. Không tự chuyển khách sang xe khác, không tự giữ nguyên giá cũ mà chưa có đồng ý.
- Khi không có ứng viên, nói rõ và cho tìm lại. Không hiển thị xe dự phòng hoặc giờ đón giả.

## 5. Đăng nhập và quyền riêng tư

Callback giao diện thống nhất:

```js
onRequireAuth({
  title,
  subtitle,
  contextNotice,
  onSuccess: (authenticatedUser) => continueSavedAction(authenticatedUser),
  onCancel: () => keepDraft()
});
```

Callback được lấy ra và xóa trước khi chạy. Hủy xác thực xóa hành động đang chờ; không xuất bản ngầm sau khi người dùng đóng. Firebase phone OTP, Google Identity Services và Telegram Widget phải xác thực qua máy chủ; giao diện không tạo token giả để đăng nhập nhanh.

Máy chủ lấy danh tính từ phiên đã xác thực, không tin `userId` do trình duyệt gửi. Nguồn dữ liệu phải phân biệt tin công khai, dữ liệu của chính chủ và cuộc trao đổi chỉ dành cho hai bên.

## 6. Kiểm chứng

- Kiểm thử bất biến dữ liệu, quyền, chốt cùng phiên bản, sức chứa theo đoạn và hủy lặp lại.
- Kiểm tra bằng trình duyệt cả hai vai trò: nhập trước đăng nhập, đóng/mở auth, tiếp tục đúng hành động, lỗi mạng, dữ liệu trống và điểm đón linh hoạt.
- Kiểm thử cấu hình đăng nhập thật riêng; không gửi OTP hoặc thực hiện đăng nhập bên ngoài trong bài kiểm thử thuần.
- Đo thời gian chờ, tỷ lệ liên lạc được, nhận đón và bỏ đón ngoài thực tế trước khi công bố mức phục vụ. Kiểm thử mã không chứng minh rằng lúc nào cũng có xe.

### Bộ kiểm thử chạy được

`npm test` chạy các kiểm thử mới cho kết nối, chốt cuộc hẹn, kích hoạt chủ xe và hiển thị hành khách; mỗi kiểm thử có cơ sở dữ liệu riêng khi cần.

Các bài kiểm thử cũ vẫn còn dưới `npm run test:legacy` để tra cứu khi chuyển đổi. Chúng kiểm tra những hành vi đã bỏ như giá công thức, xe shadow tự chuyển và giữ ghế một phía, nên không còn là tiêu chí nghiệm thu của luồng mới; một số cần máy chủ riêng. Không chạy bộ cũ vào dữ liệu thật.
