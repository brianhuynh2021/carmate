// Legacy endpoints no longer publish unreviewed bundled contacts.
export function getTransitDirectoryHandler(_req, res) {
  return res.status(410).json({ success: false, error: 'Danh bạ đã chuyển sang /api/operators với nguồn, ngày rà soát và trạng thái hồ sơ.' });
}
export function getAdminTransitDirectoryHandler(_req, res) {
  return res.status(410).json({ success: false, error: 'Dùng mục Hồ sơ nhà xe trong quản trị. Danh bạ cũ được nhập một lần vào bản nháp để rà soát.' });
}
export const updateAdminTransitDirectoryHandler = getAdminTransitDirectoryHandler;
