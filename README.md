# CarMate — Tìm chuyến phù hợp, kết nối trực tiếp

[CarMate.vn](https://carmate.vn) · Monorepo `@carmate/shared`, `@carmate/web`, `@carmate/api`

CarMate giúp khách và chủ xe tìm thấy nhau trên cùng hành lang theo hướng đi, thời gian và số chỗ. Trạm là mốc tra cứu; đón tại trạm, tận nơi hoặc kết hợp theo điều kiện của chủ xe và xác nhận của hai bên.

**Đăng chuyến, tìm kiếm và kết nối miễn phí.** Chủ xe niêm yết giá hoặc để “Liên hệ”. Hai bên trực tiếp quyết định và xử lý tiền chuyến đi. CarMate không áp bảng cước, giữ cọc, thu hoa hồng hoặc phân chia tiền.

Luồng mới đang được tích hợp trên `dev`. Mô tả trong repo không đồng nghĩa bản production đã cập nhật hoặc việc đón ngoài thực địa đã được kiểm chứng.

## Luồng sản phẩm

### Khách

- Tìm và xem chuyến trước khi đăng nhập.
- Liên hệ trực tiếp nếu chủ xe đã đồng ý công khai số; bấm gọi chưa phải được nhận đón.
- Chủ động đăng nhu cầu khi muốn chủ xe tìm thấy mình. Tìm kiếm riêng tư không tự tạo nhu cầu công khai.
- Đăng nhập tại lúc đăng nhu cầu hoặc gửi yêu cầu trong CarMate; giữ nguyên nội dung đã nhập.
- Nếu ghi nhận cuộc hẹn trong nền tảng, hai bên xác nhận cùng điểm, giờ, số người và giá trước khi giữ chỗ.

### Chủ xe

- Nhập hành trình, giờ, số chỗ, giá/“Liên hệ”, cách đón và xe thật.
- Xem trước chuyến và các nhu cầu đang tìm xe có thể phù hợp, không lộ thông tin riêng của khách.
- Nếu không có nhu cầu, hiển thị đúng kết quả trống. Lỗi tải dữ liệu không được coi là không có khách.
- Nhập số liên hệ và đồng ý công khai, đăng nhập rồi xuất bản đúng một lần.
- Desktop và mobile cùng một luồng đăng chuyến. Chế độ quản lý xe đang chạy có lối riêng cho chủ xe quay lại.

Chi tiết: [Luồng kết nối](docs/CONNECTION_FLOW.md) · [Quy trình vận hành](docs/OPERATIONAL_WORKFLOW.md).

## Toán học phục vụ tìm chuyến

Lõi hiện có gồm chiếu vị trí lên hành lang, dự báo thời gian tới trạm, giao khoảng thời gian, đánh giá tương thích và sức chứa trên từng đoạn. Các mô-đun này giúp tạo ứng viên phù hợp; chúng không tự chứng minh luôn có xe hoặc thay thế sự đồng ý của hai bên.

Công thức chi phí, Shapley/Nash và bảng giá trong các mô-đun cũ chỉ là phần nghiên cứu/ước tính cần tách khỏi giá chủ xe. Kết quả xếp hạng là đề xuất trên dữ liệu hiện có, không phải bằng chứng tối ưu toàn cục.

Xem [Kiến trúc và phạm vi mô hình](ARCHITECTURE.md). Luồng trợ lý có tài liệu riêng tại [NATIVE_INTENT_FLOW.md](docs/NATIVE_INTENT_FLOW.md); trợ lý không cần thiết để dùng các luồng tìm/đăng chuyến.

## Cấu trúc

```text
apps/web/src/
  App.jsx                       Điều hướng và xác thực theo hành động
  api/client.js                 API client
  components/market/            Tìm chuyến theo hành lang
  components/intent/            Đăng nhu cầu chủ động
  components/modals/            Xem trước, đăng chuyến, đăng nhập, cuộc hẹn
  components/station/           Tra cứu và xử lý nhu cầu theo trạm
  hooks/                        State và đồng bộ dữ liệu
apps/api/src/
  routes/api.js                 Quyền truy cập endpoint
  controllers/                  Trip, intent, booking, auth
  services/connectionMatching.js Đánh giá ứng viên
  services/bookingCommitment.js  Cam kết hai bên và sức chứa theo đoạn
  db/sqliteStore.js             SQLite
packages/shared/src/            Hành lang, trạm, mô hình thời gian và tiện ích chung
scripts/                        Kiểm thử, sao lưu và công cụ vận hành
```

## Chạy cục bộ

Yêu cầu Node.js từ phiên bản 22 theo `package.json`. Dùng bản dữ liệu phát triển riêng.

```bash
npm install
npm run dev
```

Máy chủ hợp nhất phục vụ web và API; xem địa chỉ/cổng thực tế trong thông báo khởi động. Không ghi khóa bí mật vào biến `VITE_*` vì chúng được đưa vào mã phía trình duyệt. Xác thực Google, Telegram và Firebase cần cấu hình phù hợp; giao diện không cung cấp tài khoản giả để bỏ qua bước này.

```bash
npm run build
npm run lint
node scripts/test-driver-activation.mjs
```

`test-driver-activation.mjs` kiểm tra dữ liệu xem trước không mang thông tin liên hệ, giá do chủ xe chọn, sức chứa, thời gian và callback tiếp tục sau đăng nhập. Các suite API và nghiệp vụ khác nằm trong `scripts/`; một số cần máy chủ hoặc cơ sở dữ liệu riêng. Không chạy chúng trên dữ liệu người dùng thật.

## Kiểm tra luồng mới

- Khách tìm được kết quả thật hoặc thấy trạng thái trống rõ ràng; liên hệ công khai không bị khóa bởi đăng nhập.
- Khách/chủ xe nhập trước đăng nhập; đóng xác thực giữ draft; đăng nhập thành công tiếp tục một lần.
- Chủ xe chỉ thấy số nhu cầu thật trong bản xem trước; API lỗi không hiện số 0 giả.
- Giá `null` hiển thị “Liên hệ”; giá chủ xe không bị công thức cũ ghi đè.
- Cuộc hẹn chỉ giữ chỗ sau xác nhận đúng phiên bản, có kiểm tra sức chứa của đoạn đi.
- Hủy lặp lại không nhả chỗ nhiều lần; tìm lại giữ thời hạn ban đầu; xe mới cần xác nhận mới.

Kiểm thử mã, kiểm tra trình duyệt, thử cấu hình đăng nhập và đo vận hành thật là các lớp kiểm chứng riêng. Không dùng số lượng test đạt để công bố tỷ lệ đón thành công.

## Dữ liệu, triển khai và Git

Luồng hồ sơ tham khảo, nhập hộ, nhận quyền quản lý và báo sai/gỡ thông tin được mô tả tại [docs/OPERATOR_PROFILES.md](docs/OPERATOR_PROFILES.md). Danh bạ cũ được chuyển thành bản nháp chờ rà soát; hồ sơ tham khảo không tạo nguồn ghế hay tài khoản đại diện tự động.

SQLite cần lưu trữ bền vững và quy trình sao lưu/khôi phục đã kiểm tra. Repo có `scripts/backup-db.js`, `scripts/restore-db.js`, `Dockerfile` và `fly.toml`; xem cấu hình đích trước khi chạy công cụ vận hành. Không ghi dữ liệu production hoặc nội dung riêng của người dùng vào test, log mẫu hay tài liệu.

Phát triển trên `dev`. Không commit/push thẳng `main`; chỉ merge hoặc triển khai khi người dùng yêu cầu. Quy chuẩn giao diện và bất biến dữ liệu tại [AGENTS.md](AGENTS.md).
