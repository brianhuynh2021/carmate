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
├── package.json                    # Workspace ["apps/*", "packages/*"], yêu cầu Node >= 22
├── fly.toml                        # Cấu hình triển khai Fly.io (region Singapore)
├── Dockerfile                      # Build 2 stage: build web -> chạy server Node
├── .github/workflows/ci.yml        # CI: build + chạy toàn bộ E2E mỗi lần push
├── ARCHITECTURE.md                 # Tài liệu kiến trúc & lộ trình
│
├── scripts/
│   ├── test-local-e2e.js           # Bộ E2E (API, phân quyền, PII, XSS, AI agent)
│   ├── backup-db.js                # Sao lưu SQLite an toàn khi server đang chạy
│   ├── restore-db.js               # Khôi phục từ bản sao lưu
│   └── setup-backup-cron.sh        # Cài lịch sao lưu tự động hằng ngày
│
├── packages/
│   └── shared/                     # @carmate/shared — dùng chung Web & API
│       └── src/
│           ├── constants/          # routes, timeSlots, policies, mockData, site
│           └── utils/              # pricing, zalo, geo, date
│
└── apps/
    ├── web/                        # @carmate/web (React 19 + Vite + Tailwind)
    │   └── src/
    │       ├── App.jsx             # Điều phối state & tab
    │       ├── api/client.js       # Lớp gọi API, tự đính kèm JWT
    │       ├── i18n/               # Song ngữ Việt / Anh
    │       ├── utils/              # ticketCanvas, nlpTripParser, vietnamLocations
    │       └── components/
    │           ├── market/         # FilterBar, TripCard, RouteBenchmarkBar, Hero
    │           ├── post/           # PostTripForm, SmartTripComposer, MyTripsView
    │           ├── radar/          # MatchRadarView — ghép 2 chiều
    │           ├── booked/         # BookedTripList — nút Zalo & Gọi ngay
    │           ├── admin/          # AdminDashboardView
    │           ├── agent/          # AiConciergeModal — trợ lý AI
    │           ├── modals/         # Auth, Ticket, Review, Policy, Cancel...
    │           ├── profile/        # TrustProfileView
    │           ├── common/         # Header, Footer, BottomNav, ErrorBoundary
    │           └── ui/             # Button, Modal, Field, Badge, Chip...
    │
    └── api/                        # @carmate/api (Express 5 + SQLite)
        ├── data/                   # carmate.sqlite + backups (không commit)
        └── src/
            ├── index.js            # Máy chủ hợp nhất: phục vụ cả web lẫn /api
            ├── routes/api.js       # Khai báo toàn bộ endpoint
            ├── controllers/        # trip, booking, auth, admin, match, agent...
            ├── middlewares/        # security (rate limit, CORS, XSS), authMiddleware
            ├── db/sqliteStore.js   # Truy cập SQLite (WAL, prepared statement)
            ├── agent/              # Trợ lý AI + tool calling
            └── utils/token.js      # Ký & xác thực JWT
```

---

## 💻 3. Khởi Chạy Dưới Máy Local

**Yêu cầu: Node.js >= 22** (`better-sqlite3` sẽ lỗi trên Node 20).

Máy chủ hợp nhất phục vụ **cả web lẫn API trên một cổng duy nhất** — không cần chạy hai tiến trình:

```bash
npm install     # chỉ lần đầu
npm run dev
```

* 🌐 **Web:** [http://localhost:5173](http://localhost:5173)
* 🔌 **API:** [http://localhost:5173/api](http://localhost:5173/api)
* 🩺 **Health:** [http://localhost:5173/api/health](http://localhost:5173/api/health)

Ở chế độ dev, Vite chạy dưới dạng middleware nên sửa code là giao diện tự cập nhật ngay. Nhấn `Ctrl + C` để dừng.

### Các lệnh khác

```bash
npm test              # chạy toàn bộ bộ kiểm thử E2E
npm run build         # build web ra apps/web/dist
npm run backup        # sao lưu database ngay
npm run backup:setup  # cài lịch sao lưu tự động 02:00 hằng ngày
npm run restore       # liệt kê các bản sao lưu
```

### Biến môi trường

Ở môi trường dev, chưa cấu hình gì vẫn chạy được: JWT secret được sinh ngẫu nhiên mỗi phiên và mã admin tạm là `admin123`.

Ở **production, thiếu biến bắt buộc thì server từ chối khởi động** — đây là cơ chế fail-closed có chủ đích:

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `JWT_SECRET` | ✅ production | Khoá ký phiên đăng nhập |
| `CARMATE_ADMIN_PASSCODE` | ✅ production | Mã vào cổng quản trị |
| `ALLOWED_ORIGINS` | | Danh sách domain được gọi API, ngăn cách bằng dấu phẩy |
| `TRUST_PROXY` | | Đặt `true` khi có proxy/CDN đứng trước |
| `CARMATE_ADMIN_MFA_CODE` | | Bật xác thực 2 lớp cho cổng quản trị |
| `GEMINI_API_KEY` | | Bật trợ lý AI (thiếu thì tự chuyển sang bộ suy luận cục bộ) |
| `DISABLE_VITE_DEV` | | Đặt `true` để bỏ Vite middleware, phục vụ bản dist đã build |

> ⚠️ Không đặt khoá bí mật vào `apps/web/.env`. Vite nhúng mọi biến `VITE_*` thẳng vào bundle công khai — khoá API phải nằm ở `apps/api/.env`.

### Chạy bằng Devbox (tuỳ chọn)

```bash
brew install devbox    # hoặc: curl -fsSL https://get.jetpack.io/devbox | bash
devbox run dev
```

---

## 🧪 4. Kiểm Thử

### Tự động

```bash
npm run dev     # cửa sổ 1: chạy server
npm test        # cửa sổ 2: chạy toàn bộ E2E
```

Bộ kiểm thử bao trùm API, phân quyền (chống IDOR), che giấu thông tin cá nhân, chống XSS lưu trữ, cổng quản trị và trợ lý AI. CI cũng chạy đúng bộ này mỗi lần push.

### Thủ công trên trình duyệt

Mở **`http://localhost:5173`**:

1. **Lọc tuyến 1 chạm** — bấm các chip `Tất cả`, `QL13`, `QL51`, `QL20`, `CT Long Thành`; danh sách lọc tức thì.

2. **Xuất vé hành trình** — bấm biểu tượng chia sẻ trên thẻ chuyến; thẻ vé hiện ra kèm nút sao chép nội dung đăng Zalo / Facebook.

3. **Ghép chuyến** — bấm **"Ghép Chuyến"**. Chưa đăng nhập thì cửa sổ xác thực hiện ra trước: nhập số điện thoại, rồi nhập mã OTP. Ở môi trường dev, mã `123456` luôn hợp lệ và mã thật cũng được trả kèm trong phản hồi API để tiện thử.

   > Bước đăng nhập này là có chủ đích: số điện thoại thật của tài xế chỉ hiện ra sau khi xác thực, nhằm bảo vệ dữ liệu cá nhân.

4. **Chuyến đã ghép** — mở tab **"Chuyến Đã Ghép"**: có đồng hồ đếm ngược 30 phút và số điện thoại thật. Nút **"Nhắn Zalo"** mở `https://zalo.me/[sdt]`, nút **"Gọi Ngay"** mở trình gọi điện.

5. **Đăng chuyến** — mở tab **"Đăng Chuyến"**, chọn nhanh ngày đi, tích **"Lặp lại hàng tuần"** rồi đăng. Chuyến xuất hiện ngay trên sàn kèm thẻ vé để chia sẻ.

6. **Cổng quản trị** — vào `http://localhost:5173/#admin` (hoặc `?portal=ops`), đăng nhập bằng `CARMATE_ADMIN_PASSCODE` (dev mặc định `admin123`) để xem số liệu, quản lý chuyến và thành viên. Khi triển khai thật, cổng này cũng tự bật trên subdomain `ops.` hoặc `admin.`.

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

