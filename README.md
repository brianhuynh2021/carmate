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

## 💾 5. Sao Lưu & Khôi Phục Dữ Liệu (Bắt Buộc Trước Khi Go-Live)

Dữ liệu nằm trong SQLite tại `apps/api/data/carmate.sqlite`. Container bị xoá hoặc cấu hình volume sai là **mất toàn bộ chuyến đi và thành viên**. Hãy bật sao lưu trước khi có người dùng thật.

```bash
npm run backup          # tạo 1 bản sao lưu ngay
npm run backup:setup    # cài lịch tự động 02:00 hằng ngày
npm run restore         # liệt kê các bản sao lưu hiện có
```

**Sao lưu an toàn khi server đang chạy.** Script dùng SQLite Online Backup API, không phải `cp` — copy file thường trong lúc có giao dịch đang ghi sẽ tạo bản sao hỏng hoặc thiếu phần dữ liệu còn nằm trong WAL. Mỗi bản đều được `integrity_check` rồi mới nén gzip; bản lỗi bị xoá ngay thay vì âm thầm lưu lại.

Mặc định giữ 14 bản gần nhất trong `apps/api/data/backups/` (đã thêm vào `.gitignore`).

```bash
node scripts/backup-db.js --out /mnt/backup --keep 30
```

### Khôi phục

```bash
# 1. DỪNG server trước — ghi đè khi đang chạy sẽ hỏng dữ liệu
# 2. Khôi phục bản mới nhất
npm run restore -- --latest
# 3. Khởi động lại server
```

DB hiện tại luôn được giữ lại thành `carmate.sqlite.before-restore-<timestamp>` để quay lui nếu cần.

> **Kiểm chứng định kỳ:** một bản sao lưu chưa từng khôi phục thử thì chưa phải là bản sao lưu. Nên chạy thử `--latest` trên máy local mỗi vài tháng.

### Lưu ý triển khai

- Volume Docker `carmate-data` phải trỏ đúng `/app/apps/api/data`, nếu không dữ liệu sẽ mất sau mỗi lần redeploy.
- Backup nằm **cùng volume** với DB. Với dữ liệu thật, hãy đồng bộ thêm ra nơi khác (S3, Google Drive, máy khác) — cùng ổ đĩa thì hỏng ổ là mất cả hai.
- Yêu cầu **Node >= 22** (`better-sqlite3` sẽ segfault trên Node 20).

---

## ☁️ 6. Triển Khai Production (Fly.io + Cloudflare)

### Vì sao Fly.io

Backend dùng `better-sqlite3` (native C++) và ghi SQLite xuống ổ đĩa, nên **không chạy được trên nền tảng serverless/edge** — Cloudflare Workers, Vercel Functions và tương tự đều không có Node.js đầy đủ lẫn ổ đĩa ghi được. Fly.io chạy thẳng Docker, có volume bền và region **Singapore (`sin`)** — độ trễ tới Việt Nam khoảng 30ms.

Cloudflare vẫn được dùng, nhưng đúng vai trò của nó: DNS + CDN + SSL miễn phí đặt trước Fly.

```
Người dùng VN → Cloudflare (DNS/CDN/SSL) → Fly.io Singapore (app + SQLite)
```

### Bước 1: Cài flyctl và đăng nhập

```bash
brew install flyctl     # hoặc: curl -L https://fly.io/install.sh | sh
fly auth signup         # hoặc: fly auth login
```

### Bước 2: Tạo app và volume

Repo đã có sẵn [`fly.toml`](fly.toml), nên **không chạy `fly launch`** (lệnh đó sẽ ghi đè cấu hình).

```bash
fly apps create carmate                              # đổi tên nếu đã có người dùng
fly volumes create carmate_data --region sin --size 1 # 1GB, đủ cho giai đoạn đầu
```

### Bước 3: Đặt biến bí mật

Server **từ chối khởi động** nếu thiếu — đây là cơ chế fail-closed có chủ đích, không phải lỗi.

```bash
fly secrets set \
  JWT_SECRET="$(openssl rand -hex 32)" \
  CARMATE_ADMIN_PASSCODE="<mật-khẩu-mạnh-của-bạn>"
```

Tuỳ chọn — bật xác thực 2 lớp cho cổng admin, và AI Concierge:

```bash
fly secrets set CARMATE_ADMIN_MFA_CODE="<mã-mfa>"
fly secrets set GEMINI_API_KEY="<khoá-gemini>"
```

### Bước 4: Triển khai

```bash
fly deploy
fly logs          # theo dõi khởi động
fly status        # kiểm tra máy và volume
```

Kiểm tra nhanh:
```bash
curl https://carmate.fly.dev/api/health
```

### Bước 5: Trỏ tên miền `carmate.vn`

```bash
fly certs add carmate.vn
fly certs add www.carmate.vn
fly ips list        # lấy IPv4 (A) và IPv6 (AAAA)
```

Tại Cloudflare (hoặc PA Việt Nam):
1. Thêm bản ghi **A** `@` → IPv4 vừa lấy, và **AAAA** `@` → IPv6
2. Thêm **CNAME** `www` → `carmate.vn`
3. Nếu dùng Cloudflare proxy (mây cam), đặt SSL/TLS mode là **Full (strict)**

Cuối cùng, cập nhật `ALLOWED_ORIGINS` trong `fly.toml` cho khớp domain thật rồi `fly deploy` lại.

### Những điểm dễ sai

| Vấn đề | Hậu quả |
|---|---|
| Quên tạo volume, hoặc mount sai `/app/apps/api/data` | **Mất toàn bộ dữ liệu sau mỗi lần deploy** |
| Chạy nhiều hơn 1 máy | Hai tiến trình ghi cùng file SQLite → **hỏng dữ liệu**. `fly.toml` đã ghim 1 máy, đừng `fly scale count 2` |
| Quên `TRUST_PROXY=true` | Rate limiter thấy mọi request đến từ cùng một IP → chặn nhầm người dùng thật |
| Chạy `fly launch` khi đã có `fly.toml` | Ghi đè cấu hình volume và region |

### Vận hành

```bash
fly ssh console                                    # vào máy
fly ssh console -C "node scripts/backup-db.js"     # sao lưu thủ công
fly logs                                           # xem log
fly status                                         # trạng thái máy
```

**Sao lưu:** backup nằm trên cùng volume với DB, nên chỉ cứu được khi xoá nhầm dữ liệu — không cứu được khi mất volume. Khi đã có người dùng thật, kéo bản sao về máy của bạn:

```bash
fly ssh sftp get /app/apps/api/data/backups/<tên-file>.gz
```

**Chi phí ước tính:** ~$2-3/tháng (`shared-cpu-1x` 512MB + volume 1GB).

**Trần chịu tải:** SQLite một máy phục vụ tốt tới vài nghìn người dùng/ngày. Vượt mốc đó mới cần tính tới Postgres.

