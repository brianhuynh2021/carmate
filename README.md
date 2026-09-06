# 🚗 CarMate — Nền Tảng Đi Chung Xe Tiện Chuyến & Đồng Hương

> **Website chính thức:** [https://carmate.vn](https://carmate.vn)  
> **Kiến trúc Monorepo:** `@carmate/shared` • `@carmate/web` • `@carmate/api`  
> **Triết lý sản phẩm:** Tối giản & Tinh gọn (Lean 0đ) • Tối ưu hiệu năng tải trang (< 85KB gzipped) • Bảo mật cao cấp (Fail-closed, OWASP Top 10) • Thấu cảm sâu sắc văn hoá kết nối bản địa.

---

## 🌟 1. Mô Hình Hoạt Động & Cơ Chế Kết Nối Trực Tiếp (0% Chiết Khấu Sàn)

CarMate được tạo ra để kết nối những người **CÙNG ĐƯỜNG, TIỆN TUYẾN**: Chủ xe có ghế trống (dù là đi làm hàng tuần, về thăm gia đình dòng họ, đi công tác hay việc riêng) chia sẻ chỗ cho hành khách đi cùng hướng để san sẻ chi phí xăng xe và vé cầu đường văn minh, tiết kiệm. (Nếu có duyên cùng quê hay gần nhà thì càng vui và ấm áp hơn, nhưng cốt lõi là **tiện đường đi chung**).

### Cơ chế Kết Nối Trực Tiếp (Sáng Kiến Đi Chung Xe CarMate + Zalo Organic KYC):
1. **Không thu phí cọc sàn:** Hành khách không cần nạp tiền hay trả phí trung gian qua sàn (loại bỏ tâm lý e ngại lừa đảo và không rủi ro pháp lý cho Founder).
2. **Cam kết qua Zalo trong 30 phút:** Sau khi bấm ghép chuyến, hai bên có 30 phút để nhắn tin Zalo cho nhau chốt điểm đón. Profile Zalo thật (avatar, số điện thoại, quê quán) là bộ lọc danh tính tự nhiên tốt nhất. Quá 30 phút không nhắn, hệ thống tự động nhả ghế.
3. **Thanh toán trực tiếp:** Tiền cước xăng dầu & vé cầu đường trả bằng tiền mặt hoặc chuyển khoản trực tiếp cho tài xế khi bước lên xe.
4. **Vé hành trình thông minh (Boarding Pass):** Tự động tạo thẻ vé ảnh sang trọng kèm link rút gọn để tài xế 1-chạm chia sẻ vào các Group Zalo / Facebook đồng hương (QL13, QL51...) kéo khách tự nhiên.

---

## 🏛️ 2. Cấu Trúc Mã Nguồn Monorepo

```text
carmate/
├── package.json                        # Root Workspace cấu hình ["apps/*", "packages/*"]
├── ARCHITECTURE.md                     # Tài liệu kiến trúc chuyên sâu & Lộ trình 4 pha
├── README.md                           # Hướng dẫn khởi chạy & kiểm thử local
│
├── packages/
│   └── shared/                         # @carmate/shared (Dùng chung cho Web & API)
│       ├── package.json
│       └── src/
│           ├── index.js                # Xuất khẩu toàn bộ module tập trung
│           ├── constants/
│           │   ├── routes.js           # 10 tuyến quốc lộ chính & định mức giá
│           │   ├── timeSlots.js        # Khung giờ di chuyển linh hoạt
│           │   ├── policies.js         # Quy chế nền tảng: 0% phí, hai bên tự thoả thuận
│           │   └── mockData.js         # Dữ liệu mẫu tích hợp nhãn đồng hương
│           └── utils/
│               ├── pricing.js          # Thuật toán tính giá trọn gói (xăng + cầu đường)
│               └── zalo.js             # Helper mở Zalo chat 1-chạm & sinh nội dung vé
│
└── apps/
    ├── web/                            # @carmate/web (React 19 + Vite + TailwindCSS)
    │   ├── package.json
    │   ├── vite.config.js              # Build siêu tốc < 160ms, Gzip ~85KB
    │   └── src/
    │       ├── App.jsx                 # Bộ điều phối state & tabs (~220 dòng sạch sẽ)
    │       └── components/
    │           ├── market/             # FilterBar (Chip quốc lộ), TripCard (0đ Zalo)
    │           ├── post/               # PostTripForm (Chọn ngày T3-T4, lặp lại hàng tuần)
    │           ├── radar/              # MatchRadarView (Khớp lệnh toạ độ 2 chiều)
    │           ├── booked/             # BookedTripList (Nút Nhắn Zalo & Gọi Ngay)
    │           └── modals/             # TicketShareModal, EscrowBookingModal, PolicyModal
    │
    └── api/                            # @carmate/api (Backend REST API Node.js)
        ├── package.json
        └── src/
            └── index.js                # Port 4000: /api/trips, /api/escrows, /api/health
```

---

## 💻 3. Hướng Dẫn Khởi Chạy 1 Lệnh Dưới Máy Local (Devbox & 1-Command Startup)

Hệ thống đã được tích hợp bộ điều phối thông minh: **chỉ cần đúng 1 lệnh duy nhất là tự động dựng cả Web lẫn Backend API cùng lúc!**

* 🌐 **Giao diện Web:** [http://localhost:5173](http://localhost:5173)
* 🔌 **Backend API:** [http://localhost:4000](http://localhost:4000) (Kiểm tra sức khoẻ: [http://localhost:4000/api/health](http://localhost:4000/api/health))

### 🚀 Cách 1: Chạy 1 Lệnh Ngay Bằng npm (Khuyên Dùng Trên Mac Hiện Tại)
Không cần cài đặt thêm bất kỳ công cụ nào ngoài Node.js có sẵn trên máy:
```bash
# Cài thư viện (chỉ cần chạy lần đầu):
npm install

# ĐÚNG 1 LỆNH DUY NHẤT: Dựng đồng thời Web (5173) & API (4000)
npm run dev
# hoặc:
npm start
```
* Bảng điều khiển sẽ hiển thị luồng log màu: `[WEB:5173]` và `[API:4000]`.
* Khi muốn tắt, chỉ cần bấm **`Ctrl + C`** là cả 2 server đều tự động tắt sạch sẽ.

---

### 📦 Cách 2: Khởi Chạy Bằng Devbox (Nếu Dùng Môi Trường Devbox / Nix)
Dự án đã có sẵn file cấu hình chuẩn [`devbox.json`](file:///Users/huynhnguyen/Desktop/carmate/devbox.json).

1. Nếu máy chưa có Devbox, cài đặt nhanh bằng Homebrew hoặc cURL:
```bash
brew install devbox
# hoặc: curl -fsSL https://get.jetpack.io/devbox | bash
```

2. Khởi chạy toàn bộ hệ thống bằng 1 lệnh qua Devbox:
```bash
devbox run dev
```
*(Hoặc vào môi trường devbox bằng `devbox shell` rồi gõ `npm run dev`).*

---

### 🛠️ Các Lệnh Riêng Lẻ Khác (Khi Cần Thiết):
```bash
npm run dev:web   # Chỉ chạy riêng Web (5173)
npm run dev:api   # Chỉ chạy riêng API (4000)
npm run build     # Build kiểm tra đóng gói Cloudflare (< 100ms)
```

---

## 🧪 4. Kịch Bản Kiểm Thử Trực Tiếp Trên Trình Duyệt (Step-by-Step Test)

Mở trình duyệt truy cập vào **`http://localhost:5173`** và trải nghiệm theo 5 bước:

1. **Test Lọc Tuyến 1-Chạm:**
   * Bấm vào các chip: `Tất cả`, `QL13`, `QL51`, `QL20`, `CT Long Thành`.
   * Danh sách chuyến xe lọc tức thì trong 1ms.
2. **Test Xuất Vé Hành Trình (Viral Boarding Pass):**
   * Trên bất kỳ thẻ chuyến xe nào, bấm vào **biểu tượng nút Share** (cạnh nút Ghép Chuyến).
   * Thẻ vé Boarding Pass sang trọng hiện lên kèm nút **"Sao Chép Bài Đăng Zalo / Facebook"**.
3. **Test Quy Trình Ghép Chuyến & Kết Nối Trực Tiếp (Mô Hình CarMate):**
   * Bấm nút **"Ghép Chuyến"** trên thẻ chuyến đi của Chủ Xe (hoặc **"Đón Đi Cùng"** trên bài của khách).
   * Popup kết nối hiện ra với lựa chọn mặc định: **"Kết Nối Trực Tiếp (Chốt Zalo 30 Phút) — Khuyên Dùng"** (Không thu phí sàn).
   * Bấm **"Xác Nhận Ghép Chuyến & Nhắn Zalo Bác Tài"** ➔ Hệ thống lập tức ghi nhận kết nối thành công mà không bắt nạp tiền.
4. **Test Danh Sách Chuyến Đã Ghép & Kết Nối Zalo:**
   * Chuyển sang tab **"Chuyến Đã Ghép"**.
   * Xem chuyến vừa kết nối: Có nhãn thông báo đếm ngược 30 phút, thông tin SĐT thật.
   * Bấm nút màu xanh **"Nhắn Zalo"** ➔ Tự động mở đường link `https://zalo.me/[sdt]` dẫn thẳng vào khung chat Zalo của đối phương.
   * Bấm nút **"Gọi Ngay"** ➔ Mở popup cuộc gọi trực tiếp.
5. **Test Đăng Chuyến Lịch Trình Cá Nhân (Thứ 3 đi, Thứ 4 về):**
   * Chuyển sang tab **"Đăng Chuyến"**.
   * Bấm chọn nhanh ngày di chuyển: **[Sáng Thứ 3]** hoặc **[Chiều Thứ 4]**.
   * Tích chọn: **☑️ Lặp lại hàng tuần (Lịch đi làm cố định)**.
   * Bấm Đăng tin ➔ Chuyến đi xuất hiện ngay lập tức trên sàn và bật sẵn thẻ vé để đi chia sẻ!

---

## ☁️ 5. Hướng Dẫn Triển Khai Lên `carmate.vn` Qua Cloudflare (Khi Sẵn Sàng)

Khi anh đã test mượt mà dưới máy local và sẵn sàng đưa lên tên miền thật:

### Bước 1: Build gói web tĩnh
```bash
npm run build
```
Thư mục sản phẩm siêu nhẹ sẽ được tạo ra tại: `apps/web/dist`.

### Bước 2: Đẩy lên Cloudflare Pages (Miễn phí 100%)
1. Đăng nhập [dash.cloudflare.com](https://dash.cloudflare.com).
2. Vào **Workers & Pages** ➔ **Create application** ➔ chọn tab **Pages** ➔ **Upload assets**.
3. Kéo thả toàn bộ thư mục `apps/web/dist` lên. Bấm **Deploy**.
4. Website của anh lập tức có link chạy online toàn cầu (dạng `carmate-xxx.pages.dev`).

### Bước 3: Cấu hình tên miền `carmate.vn` tại PA Việt Nam
1. Đăng nhập trang quản lý PA Việt Nam: [https://support.pavietnam.vn](https://support.pavietnam.vn).
2. Vào mục **Quản lý tên miền** ➔ chọn **`carmate.vn`**.
3. Có 2 cách trỏ:
   * **Cách 1 (Dễ nhất):** Thêm bản ghi **CNAME** với tên `@` và `www` trỏ về địa chỉ `carmate-xxx.pages.dev` của Cloudflare.
   * **Cách 2 (Xịn nhất):** Đổi cặp NameServer của PA Việt Nam sang cặp NameServer do Cloudflare cấp (ví dụ: `alan.ns.cloudflare.com` & `zoe.ns.cloudflare.com`). Toàn bộ việc quản lý DNS, chống tấn công DDoS, bật SSL miễn phí sẽ do Cloudflare lo trọn gói!
