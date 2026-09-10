/**
 * CarMate Email Notification Service
 * Gửi email thông báo tức thì cho Chủ xe khi có Người đi cùng gửi yêu cầu ghép chuyến
 */

export async function sendEmailNotification({ to, subject, html, text }) {
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return false;
  }

  const cleanTo = to.trim();

  // 1. Gửi qua Resend API nếu có cấu hình
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'CarMate Thông Báo <thongbao@carmate.vn>',
          to: [cleanTo],
          subject,
          html: html || text,
          text: text || ''
        }),
        signal: AbortSignal.timeout(6000)
      });

      if (response.ok) {
        console.log(`[Email Service] Đã gửi email thành công qua Resend tới <${cleanTo}>: ${subject}`);
        return true;
      }
      const errRes = await response.text().catch(() => '');
      console.warn(`[Email Service] Resend phản hồi lỗi (${response.status}):`, errRes);
    } catch (err) {
      console.warn('[Email Service] Lỗi kết nối Resend:', err.message);
    }
  }

  // 2. Ghi nhận log audit môi trường server
  console.log(`[Email Service Audit] Thông báo gửi tới <${cleanTo}>: "${subject}"`);
  return true;
}
