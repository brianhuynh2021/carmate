import { getTimeSlotLabel } from '@carmate/shared';
import QRCode from 'qrcode';

/**
 * ticketCanvas.js — Trình kết xuất Thẻ Thông Tin Chuyến Đi thành file ảnh PNG độ nét cao (HD 1080x1350)
 * Thiết kế theo chuẩn Boarding Pass hàng không / hành trình cao cấp:
 * - Chuẩn tỷ lệ 4:5 tối ưu tuyệt đối cho Zalo Story, Facebook Feed và ảnh gửi nhóm chat.
 * - 100% Canvas 2D API thuần, tải 0ms, không phụ thuộc thư viện ngoài nặng nề.
 */
export async function generateTicketImage(trip, lang = 'vi') {
  if (!trip) return null;

  const width = 1080;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Nền Deep Obsidian Gradient sang trọng
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.5, '#0f172a');
  bgGrad.addColorStop(1, '#050811');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Hiệu ứng Ambient Glow mềm mại phía sau
  const glow = ctx.createRadialGradient(850, 200, 10, 850, 200, 500);
  glow.addColorStop(0, 'rgba(14, 165, 233, 0.22)');
  glow.addColorStop(0.6, 'rgba(59, 130, 246, 0.08)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(200, 1100, 10, 200, 1100, 450);
  glow2.addColorStop(0, 'rgba(16, 185, 129, 0.16)');
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // 2. Viền ngoài thẻ Ticket (Boarding Pass Card)
  const cardX = 60;
  const cardY = 60;
  const cardW = width - 120;
  const cardH = height - 120;
  const radius = 40;

  // Vẽ bóng đổ card
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;

  ctx.fillStyle = '#111827';
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Viền tinh xảo
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.stroke();

  // 3. Header Ticket (Logo + Tên thương hiệu + Huy hiệu)
  // Logo Mark
  const logoX = cardX + 50;
  const logoY = cardY + 50;
  drawCarMateLogo(ctx, logoX, logoY, 64);

  // Text CarMate
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px system-ui, -apple-system, sans-serif';
  ctx.fillText('CarMate', logoX + 84, logoY + 44);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('Xe Gia Đình Tiện Tuyến · 0% Phí Sàn', logoX + 84, logoY + 74);

  // Huy hiệu THẺ THÔNG TIN CHUYẾN ĐI
  const badgeW = 270;
  const badgeH = 46;
  const badgeX = cardX + cardW - 50 - badgeW;
  const badgeY = cardY + 52;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 23);
  ctx.stroke();

  ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 23);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THẺ THÔNG TIN CHUYẾN ĐI', badgeX + badgeW / 2, badgeY + 29);
  ctx.textAlign = 'left';

  // Đường phân cách mờ
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 50, cardY + 140);
  ctx.lineTo(cardX + cardW - 50, cardY + 140);
  ctx.stroke();

  // 4. LỘ TRÌNH (ROUTE SECTION)
  const routeY = cardY + 200;

  // Điểm ĐÓN (From)
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(cardX + 65, routeY + 15, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('ĐIỂM XUẤT PHÁT (ĐÓN)', cardX + 95, routeY);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  const fromText = truncateText(ctx, trip.from || 'Điểm đón', cardW - 160);
  ctx.fillText(fromText, cardX + 95, routeY + 40);

  // Đường nối lộ trình
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(cardX + 65, routeY + 40);
  ctx.lineTo(cardX + 65, routeY + 120);
  ctx.stroke();
  ctx.setLineDash([]);

  // Điểm ĐẾN (To)
  const destY = routeY + 130;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cardX + 65, destY + 15, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('ĐIỂM ĐẾN (TRẢ KHÁCH)', cardX + 95, destY);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  const toText = truncateText(ctx, trip.to || 'Điểm đến', cardW - 160);
  ctx.fillText(toText, cardX + 95, destY + 40);

  // 5. THÔNG TIN CHI TIẾT (Grid 2 cột)
  const infoBoxY = destY + 90;
  const boxW = (cardW - 130) / 2;
  const boxH = 120;

  // Ô 1: Thời gian xuất phát
  drawInfoBox(
    ctx,
    cardX + 50,
    infoBoxY,
    boxW,
    boxH,
    'THỜI GIAN XUẤT PHÁT',
    `${getTimeSlotLabel(trip, lang)}`,
    trip.date || 'Hôm nay',
    '#38bdf8'
  );

  // Ô 2: Số chỗ trống
  const isDriver = trip.type === 'driver_offer';
  const seatsLabel = isDriver ? `Cần ${trip.availableSeats || 3} người` : `Cần ${trip.seatsNeeded || 1} chỗ`;
  drawInfoBox(
    ctx,
    cardX + 70 + boxW,
    infoBoxY,
    boxW,
    boxH,
    'NHU CẦU GHÉP XE',
    seatsLabel,
    trip.carType || 'Xe du lịch 5-7 chỗ',
    '#fbbf24'
  );

  // 6. KHỐI QUÉT MÃ QR & CAM KẾT AN TÂM (Thay thế 2 ô Chi phí & SĐT đã gỡ bỏ)
  const qrBoxY = infoBoxY + boxH + 20;
  const qrBoxW = cardW - 100;
  const qrBoxH = 190;
  const qrBoxX = cardX + 50;

  // Khung chứa nền kính mờ sang trọng
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 24);
  ctx.fill();
  ctx.stroke();

  // Vẽ mã QR thực tế chuẩn quốc tế ở bên trái khối
  const qrSize = 146;
  const qrX = qrBoxX + 22;
  const qrY = qrBoxY + 22;
  const qrUrl = getTripShareUrl(trip);
  drawRealQRCode(ctx, qrX, qrY, qrSize, qrUrl);

  // Khối nội dung thông tin bên phải mã QR
  const textLeft = qrX + qrSize + 28;

  // Tiêu đề
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('QUÉT MÃ GIỮ CHỖ 0Đ TRỰC TUYẾN', textLeft, qrBoxY + 44);

  // Hướng dẫn quét 1 chạm
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '500 16px system-ui, -apple-system, sans-serif';
  ctx.fillText('Chạm giữ ảnh trên Zalo/FB hoặc quét camera để xem lộ trình', textLeft, qrBoxY + 74);

  // Các huy hiệu bảo đảm an tâm
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('🛡️ 0đ tiền cọc · 0% phí sàn · Đổi ý linh hoạt', textLeft, qrBoxY + 108);
  ctx.fillText('👤 Chủ xe đã đối soát CCCD & Giấy phép lái xe', textLeft, qrBoxY + 134);
  ctx.fillText('💬 Thỏa thuận điểm đón trả tận nơi qua Zalo / App', textLeft, qrBoxY + 160);

  // 7. TIỆN ÍCH & ĐẶC BIỆT (Gửi hàng / Bưu phẩm)
  const perksY = qrBoxY + qrBoxH + 24;
  const hasParcel =
    trip.acceptsParcel || (Array.isArray(trip.perks) && trip.perks.some((p) => /hàng|đồ|bưu phẩm/i.test(p)));

  if (hasParcel) {
    // Banner nhận gửi hàng tiện chuyến
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, cardX + 50, perksY, cardW - 100, 54, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('📦 NHẬN GỬI KÈM HÀNG HÓA, BƯU PHẨM & GIẤY TỜ TIỆN CHUYẾN', cardX + 80, perksY + 34);
  }

  // 7. Vết đục lỗ xé vé (Perforated ticket cutouts)
  const tearY = cardY + cardH - 240;

  // Nửa hình tròn lõm hai bên
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.arc(cardX, tearY, 26, -Math.PI / 2, Math.PI / 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cardX + cardW, tearY, 26, Math.PI / 2, -Math.PI / 2);
  ctx.fill();

  // Đường gạch đứt xé vé
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(cardX + 40, tearY);
  ctx.lineTo(cardX + cardW - 40, tearY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 8. PHẦN CUỐI VÉ (FOOTER STUB)
  const stubY = tearY + 40;

  // Text hướng dẫn
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  ctx.fillText('Đặt chỗ 0đ trực tuyến tại carmate.vn', cardX + 50, stubY + 30);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('Mã hành trình: #' + (trip.maskedCode || trip.id?.slice(0, 8) || 'CX-8837'), cardX + 50, stubY + 65);
  ctx.fillText('Chia sẻ chi phí xăng xe phi lợi nhuận · Không có giá trị vé vận tải', cardX + 50, stubY + 98);

  // Nút truy cập nổi bật
  const linkBtnW = 280;
  const linkBtnH = 64;
  const linkBtnX = cardX + cardW - 50 - linkBtnW;
  const linkBtnY = stubY + 30;

  const btnGrad = ctx.createLinearGradient(linkBtnX, linkBtnY, linkBtnX + linkBtnW, linkBtnY);
  btnGrad.addColorStop(0, '#0284c7');
  btnGrad.addColorStop(1, '#2563eb');
  ctx.fillStyle = btnGrad;
  drawRoundedRect(ctx, linkBtnX, linkBtnY, linkBtnW, linkBtnH, 32);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('carmate.vn', linkBtnX + linkBtnW / 2, linkBtnY + 40);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}

/**
 * generateTicketStoryImage — Trình kết xuất Thẻ Thông Tin Chuyến Đi chuẩn Zalo Story / Facebook Story / TikTok (HD 1080x1920, Tỷ lệ 9:16)
 * Thiết kế chuẩn Apple Liquid Aesthetics siêu sắc nét, 100% Canvas thuần 0ms:
 * - Tỷ lệ 9:16 chuẩn xác cho Story, màn hình điện thoại di động
 * - Lộ trình dọc trực quan, thông số minh bạch, QR code quét giữ chỗ
 */
export async function generateTicketStoryImage(trip, lang = 'vi') {
  if (!trip) return null;

  const width = 1080;
  const height = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Nền Deep Obsidian & Sapphire Glow
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#060a12');
  bgGrad.addColorStop(0.3, '#0b1329');
  bgGrad.addColorStop(0.7, '#0f172a');
  bgGrad.addColorStop(1, '#030712');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Hiệu ứng Glows
  const glowTop = ctx.createRadialGradient(880, 260, 20, 880, 260, 600);
  glowTop.addColorStop(0, 'rgba(14, 165, 233, 0.28)');
  glowTop.addColorStop(0.6, 'rgba(59, 130, 246, 0.10)');
  glowTop.addColorStop(1, 'transparent');
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, width, height);

  const glowMid = ctx.createRadialGradient(200, 950, 20, 200, 950, 550);
  glowMid.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
  glowMid.addColorStop(1, 'transparent');
  ctx.fillStyle = glowMid;
  ctx.fillRect(0, 0, width, height);

  const glowBottom = ctx.createRadialGradient(850, 1650, 20, 850, 1650, 500);
  glowBottom.addColorStop(0, 'rgba(99, 102, 241, 0.20)');
  glowBottom.addColorStop(1, 'transparent');
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, 0, width, height);

  // 2. Viền ngoài thẻ Ticket Story
  const cardX = 60;
  const cardY = 80;
  const cardW = width - 120;
  const cardH = height - 160;
  const radius = 48;

  // Đổ bóng
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;

  ctx.fillStyle = 'rgba(17, 24, 39, 0.94)';
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Viền tinh tế
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.stroke();

  // 3. Header Ticket Story (Logo + Brand + Huy hiệu)
  const logoX = cardX + 50;
  const logoY = cardY + 54;
  drawCarMateLogo(ctx, logoX, logoY, 76);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
  ctx.fillText('CarMate', logoX + 96, logoY + 48);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('Xe Tiện Chuyến Gia Đình · 0% Phí Sàn', logoX + 96, logoY + 80);

  // Huy hiệu STORY
  const badgeW = 220;
  const badgeH = 50;
  const badgeX = cardX + cardW - 50 - badgeW;
  const badgeY = cardY + 58;

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 25);
  ctx.stroke();

  ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 25);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THẺ THÔNG TIN', badgeX + badgeW / 2, badgeY + 32);
  ctx.textAlign = 'left';

  // Đường phân cách mờ
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 50, cardY + 160);
  ctx.lineTo(cardX + cardW - 50, cardY + 160);
  ctx.stroke();

  // 4. LỘ TRÌNH (HERO ROUTE SECTION TRÊN STORY)
  const routeY = cardY + 230;

  // Điểm ĐÓN (From)
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(cardX + 70, routeY + 20, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
  ctx.beginPath();
  ctx.arc(cardX + 70, routeY + 20, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('ĐIỂM XUẤT PHÁT (ĐÓN)', cardX + 115, routeY + 2);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
  const fromText = truncateText(ctx, trip.from || 'Điểm đón', cardW - 180);
  ctx.fillText(fromText, cardX + 115, routeY + 50);

  // Đường nối lộ trình dài hơn cho Story
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 5;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(cardX + 70, routeY + 55);
  ctx.lineTo(cardX + 70, routeY + 175);
  ctx.stroke();
  ctx.setLineDash([]);

  // Điểm ĐẾN (To)
  const destY = routeY + 185;
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(cardX + 70, destY + 20, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
  ctx.beginPath();
  ctx.arc(cardX + 70, destY + 20, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('ĐIỂM ĐẾN (TRẢ KHÁCH)', cardX + 115, destY + 2);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
  const toText = truncateText(ctx, trip.to || 'Điểm đến', cardW - 180);
  ctx.fillText(toText, cardX + 115, destY + 50);

  // 5. THÔNG SỐ VÉ (4 THẺ STATS LỚN)
  const infoBoxY = destY + 115;
  const boxW = (cardW - 120) / 2;
  const boxH = 145;

  // Ô 1: Thời gian xuất phát
  drawInfoBox(
    ctx,
    cardX + 50,
    infoBoxY,
    boxW,
    boxH,
    'THỜI GIAN XUẤT PHÁT',
    `${getTimeSlotLabel(trip, lang)}`,
    trip.date || 'Hôm nay',
    '#38bdf8'
  );

  // Ô 2: Ghế trống
  const isDriver = trip.type === 'driver_offer';
  const seatsLabel = isDriver ? `Cần ${trip.availableSeats || 3} người` : `Cần ${trip.seatsNeeded || 1} chỗ`;
  drawInfoBox(
    ctx,
    cardX + 70 + boxW,
    infoBoxY,
    boxW,
    boxH,
    'NHU CẦU GHÉP XE',
    seatsLabel,
    trip.carType || 'Xe du lịch 5-7 chỗ',
    '#fbbf24'
  );

  // Ô 3: Tiện nghi xe gia đình
  const perksBoxY = infoBoxY + boxH + 20;
  drawInfoBox(
    ctx,
    cardX + 50,
    perksBoxY,
    boxW,
    boxH,
    'TIỆN NGHI CHUYẾN ĐI',
    'Xe gia đình mát lạnh',
    'Không khói thuốc · Đi chung văn minh',
    '#34d399'
  );

  // Ô 4: Cam kết an tâm
  drawInfoBox(
    ctx,
    cardX + 70 + boxW,
    perksBoxY,
    boxW,
    boxH,
    'CAM KẾT AN TÂM',
    '0đ cọc · Đổi ý linh hoạt',
    'Chủ xe đã đối soát CCCD & GPLX',
    '#60a5fa'
  );

  // 6. CÁC ĐIỂM ĐÓN DỌC TUYẾN & TIỆN ÍCH
  let currentExtraY = perksBoxY + boxH + 30;

  if (trip.waypointNote) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, cardX + 50, currentExtraY, cardW - 100, 76, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('📍 CÁC ĐIỂM ĐÓN TRẢ TIỆN ĐƯỜNG:', cardX + 75, currentExtraY + 32);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '500 20px system-ui, -apple-system, sans-serif';
    const wpNoteText = truncateText(ctx, trip.waypointNote, cardW - 160);
    ctx.fillText(wpNoteText, cardX + 75, currentExtraY + 60);

    currentExtraY += 96;
  }

  const hasParcel =
    trip.acceptsParcel || (Array.isArray(trip.perks) && trip.perks.some((p) => /hàng|đồ|bưu phẩm/i.test(p)));

  if (hasParcel) {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, cardX + 50, currentExtraY, cardW - 100, 68, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('📦 NHẬN GỬI KÈM HÀNG HÓA & BƯU PHẨM TIỆN CHUYẾN', cardX + 80, currentExtraY + 42);

    currentExtraY += 88;
  }

  // 7. Vết đục xé vé Story (Perforated ticket cutouts)
  const tearY = cardY + cardH - 320;

  // Lõm tròn hai bên
  ctx.fillStyle = '#060a12';
  ctx.beginPath();
  ctx.arc(cardX, tearY, 32, -Math.PI / 2, Math.PI / 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cardX + cardW, tearY, 32, Math.PI / 2, -Math.PI / 2);
  ctx.fill();

  // Đường gạch đứt xé vé
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(cardX + 45, tearY);
  ctx.lineTo(cardX + cardW - 45, tearY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 8. PHẦN CUỐI VÉ STORY (QR CODE & KÊU GỌI ĐẶT CHỖ)
  const stubY = tearY + 45;
  const qrSize = 180;
  const qrX = cardX + 60;
  const qrY = stubY + 10;

  // Vẽ mã QR thực tế chuẩn quốc tế
  const qrUrl = getTripShareUrl(trip);
  drawRealQRCode(ctx, qrX, qrY, qrSize, qrUrl);

  // Text kế bên QR Code
  const qrTextX = qrX + qrSize + 40;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
  ctx.fillText('Giữ chỗ 0đ tại carmate.vn', qrTextX, stubY + 50);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('Mã hành trình: #' + (trip.maskedCode || trip.id?.slice(0, 8) || 'CX-8837'), qrTextX, stubY + 90);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 17px system-ui, -apple-system, sans-serif';
  ctx.fillText('Quét mã QR bằng Camera điện thoại để xem chi tiết', qrTextX, stubY + 130);
  ctx.fillText('Thỏa thuận chia sẻ chi phí nhiên liệu phi lợi nhuận · 0% phí sàn', qrTextX, stubY + 165);

  return canvas.toDataURL('image/png');
}

/**
 * Lấy đường dẫn chia sẻ sâu chuẩn cho chuyến đi (dùng cho mã QR và mạng xã hội)
 */
export function getTripShareUrl(trip) {
  if (!trip) return 'https://carmate.vn';
  const tripId = trip.id || trip.maskedCode || '';
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return `${origin}/?trip=${encodeURIComponent(tripId)}`;
    }
  }
  return `https://carmate.vn/?trip=${encodeURIComponent(tripId)}`;
}

/**
 * Vẽ mã QR thực tế chuẩn quốc tế (ISO/IEC 18004), quét được 100% bằng mọi thiết bị
 * (Camera iPhone/Android, Zalo QR, Google Lens, v.v.)
 */
export function drawRealQRCode(ctx, x, y, size, qrPayload) {
  ctx.save();

  // 1. Nền trắng mềm mại có bo góc (Quiet zone chuẩn mực)
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, x, y, size, size, 16);
  ctx.fill();

  try {
    const textToEncode = String(qrPayload || 'https://carmate.vn');
    // Mức sửa lỗi M (15%) tối ưu cho quét nhanh tức thì trên mọi camera điện thoại
    const qr = QRCode.create(textToEncode, { errorCorrectionLevel: 'M' });
    const moduleCount = qr.modules.size;

    // Viền an toàn (Quiet zone) 2 module quanh mã QR theo chuẩn
    const marginModules = 2;
    const totalModules = moduleCount + marginModules * 2;
    const cellSize = size / totalModules;
    const startX = x + marginModules * cellSize;
    const startY = y + marginModules * cellSize;

    ctx.fillStyle = '#0f172a'; // Tương phản cực cao đạt chuẩn WCAG AAA
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.modules.get(r, c)) {
          const x1 = Math.round(startX + c * cellSize);
          const x2 = Math.round(startX + (c + 1) * cellSize);
          const y1 = Math.round(startY + r * cellSize);
          const y2 = Math.round(startY + (r + 1) * cellSize);
          ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        }
      }
    }
  } catch (err) {
    console.warn('[TicketCanvas] Lỗi vẽ QR code thực tế:', err);
  }

  ctx.restore();
}

/** Giữ hàm tương thích ngược */
export function drawStylizedQRCode(ctx, x, y, size, seedStr = '') {
  drawRealQRCode(ctx, x, y, size, seedStr);
}

/**
 * Tải ảnh vé về máy thiết bị (Chuẩn 4:5)
 */
export function downloadTicketImage(dataUrl, tripId = 'chuyen-di') {
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.download = `carmate-the-thong-tin-${tripId}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Tải ảnh Story 9:16 về máy thiết bị (Chuẩn Zalo / FB Story / TikTok)
 */
export function downloadTicketStoryImage(dataUrl, tripId = 'story') {
  if (!dataUrl) return;
  const link = document.createElement('a');
  link.download = `carmate-story-thong-tin-${tripId}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Helpers vẽ Canvas
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawInfoBox(ctx, x, y, w, h, title, primaryText, secondaryText, accentColor) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillText(title, x + 24, y + 32);

  ctx.fillStyle = accentColor || '#ffffff';
  ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
  ctx.fillText(truncateText(ctx, primaryText, w - 48), x + 24, y + 70);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(truncateText(ctx, secondaryText, w - 48), x + 24, y + 98);
}

function drawCarMateLogo(ctx, x, y, size) {
  // Biểu tượng xe hình khiên cách điệu CarMate
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, '#38bdf8');
  grad.addColorStop(1, '#2563eb');
  ctx.fillStyle = grad;

  drawRoundedRect(ctx, x, y, size, size, 16);
  ctx.fill();

  // Biểu tượng tay lái / xe cách điệu
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 3.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function truncateText(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}
