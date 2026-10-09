#!/bin/bash
set -e

echo ""
echo "🚀 ================================================================="
echo "🚀 CarMate: Bắt đầu quy trình phát hành chính thức (dev -> main)"
echo "🚀 ================================================================="
echo ""

# 1. Check the current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "dev" ]; then
  echo "❌ Lỗi: Bạn phải đang ở nhánh 'dev' để thực hiện release. Hiện tại đang ở: $CURRENT_BRANCH"
  exit 1
fi

# 2. Check the working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Lỗi: Có file chưa commit hoặc chưa lưu. Vui lòng commit hết trên 'dev' trước khi release."
  git status -s
  exit 1
fi

# 3. Run the tests on dev first
echo "🧪 [1/5] Đang kiểm thử chất lượng mã nguồn trên 'dev'..."
npm test

# 4. Push dev to the remote
echo "📤 [2/5] Đang đẩy cập nhật mới nhất của 'dev' lên GitHub..."
git push origin dev

# 5. Switch to main and merge dev
echo "🔀 [3/5] Chuyển sang nhánh 'main' và hợp nhất mã nguồn..."
ALLOW_MAIN_COMMIT=1 git checkout main
git pull origin main --ff-only || true
ALLOW_MAIN_COMMIT=1 git merge dev --no-edit -m "release: merge dev into main [skip ci]"

# 6. Push to main with the ALLOW_MAIN_RELEASE=1 flag
echo "📦 [4/5] Đang đẩy lên Production ('main') với khóa bảo vệ an toàn..."
ALLOW_MAIN_RELEASE=1 git push origin main

# 7. Go back to dev to continue working
echo "🔙 [5/5] Đang chuyển con trỏ Git quay lại nhánh 'dev'..."
git checkout dev

echo ""
echo "🎉 ================================================================="
echo "🎉 PHÁT HÀNH THÀNH CÔNG LÊN 'main' (Production đã được kích hoạt)!"
echo "👉 Bạn đã được chuyển lại về nhánh 'dev' để tiếp tục làm việc an toàn."
echo "🎉 ================================================================="
echo ""
