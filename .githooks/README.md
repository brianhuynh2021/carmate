# Git hooks

Thư mục này chứa hook được commit vào repo, thay cho `.git/hooks/`
(thư mục đó không được git theo dõi nên sẽ mất khi clone lại).

## Kích hoạt

```bash
npm run hooks:install
```

Lệnh này trỏ `core.hooksPath` sang `.githooks`. Chỉ cần chạy một lần
cho mỗi bản clone.

## `pre-push`

Chặn push lên `main` nếu bộ E2E chưa xanh: tự dựng server ở cổng 4999,
chạy `npm test`, chỉ cho phép push khi toàn bộ test đạt.

Đây là lớp thay thế cho branch protection của GitHub — tính năng đó
không dùng được trên private repo ở gói Free.

Bỏ qua một lần khi thật sự cần:

```bash
git push --no-verify
```
