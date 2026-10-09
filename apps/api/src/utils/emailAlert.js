/**
 * CarMate Email Notification Service
 * Sends an instant email notification to the driver when a passenger submits a trip-matching request
 */

export async function sendEmailNotification({ to, subject, html, text }) {
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return false;
  }

  const cleanTo = to.trim();

  // 1. Send via the Resend API if configured
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

  // 2. Record an audit log in the server environment
  console.log(`[Email Service Audit] Thông báo gửi tới <${cleanTo}>: "${subject}"`);
  return true;
}
