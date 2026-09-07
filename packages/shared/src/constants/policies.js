// QUY CHẾ HOẠT ĐỘNG NỀN TẢNG KẾT NỐI CARMATE
// Vai trò nền tảng: chỉ cung cấp công cụ kết nối. Mọi chi tiết chuyến đi
// (giờ giấc, điểm đón, hành lý, chi phí) do chủ xe và người đi cùng tự thỏa thuận.

export const CARMATE_POLICIES = {
  platformPrinciples: {
    title: 'Tôn Chỉ Nền Tảng: Kết Nối Phi Thương Mại (0% Phí Nền Tảng)',
    summary:
      'CarMate là nền tảng công nghệ kết nối chủ phương tiện cá nhân có ghế trống với người cần đi cùng tuyến nhằm chia sẻ chi phí nhiên liệu và giảm phát thải.',
    zeroCommission:
      '0% Phí Nền Tảng: CarMate không thu hoa hồng hoặc chiết khấu trên khoản đóng góp chi phí chuyến đi. Toàn bộ tiền chia sẻ thuộc về chủ xe.',
    directConnection:
      'Kết Nối Trực Tiếp: Hai bên liên hệ và trao đổi trực tiếp qua Zalo hoặc số điện thoại. Chi phí thanh toán trực tiếp giữa hai bên.',
    selfArranged:
      'Tự Thỏa Thuận: Điểm đón trả, giờ giấc, hành lý và mọi yêu cầu riêng do hai bên tự trao đổi và thống nhất. Nền tảng không can thiệp vào nội dung thỏa thuận.'
  },

  connectionMechanism: {
    title: 'Cơ Chế Kết Nối & Trách Nhiệm Đôi Bên',
    quickConfirmation:
      'Xác Nhận Qua Zalo/SĐT: Sau khi bấm ghép chuyến, hai bên liên hệ trong vòng 15 phút để chốt chi tiết chuyến đi.',
    cancellationEtiquette:
      'Văn Hóa Báo Trước: Nếu phát sinh lịch đột xuất, vui lòng thông báo cho đối phương trước ít nhất 2 - 4 tiếng.',
    optionalGuarantee:
      'Bảo Chứng Tùy Chọn: Hai bên có thể tự nguyện chọn cơ chế cam kết hiển thị trên hệ thống để tăng mức độ an tâm.'
  },

  memberResponsibilities: {
    title: 'Trách Nhiệm & Ứng Xử Văn Minh',
    driverObligations: [
      'Phương tiện đảm bảo tiêu chuẩn kiểm định an toàn kỹ thuật và bảo hiểm bắt buộc trách nhiệm dân sự còn hiệu lực.',
      'Lái xe an toàn, tuân thủ Luật Giao thông đường bộ, tuyệt đối không sử dụng rượu bia hoặc chất kích thích.',
      'Không chở quá số người quy định, giữ xe sạch sẽ, văn minh, không hút thuốc lá trong khoang xe.'
    ],
    passengerObligations: [
      'Có mặt đúng giờ tại điểm hẹn đã thống nhất, ứng xử lịch thiệp, tôn trọng không gian xe gia đình.',
      'Không mang theo hàng cấm, vũ khí, chất dễ cháy nổ, hoặc hàng hóa có mùi nồng nặc.',
      'Đóng góp đúng phần chi phí đã thỏa thuận khi bắt đầu chuyến đi.'
    ]
  },

  platformDisclaimer: {
    title: 'Giới Hạn Trách Nhiệm Nền Tảng',
    content:
      'CarMate không phải đơn vị kinh doanh vận tải, không điều phối chuyến đi và không là một bên trong thỏa thuận giữa chủ xe và người đi cùng. Nền tảng chỉ cung cấp công cụ kết nối và hiển thị thông tin do thành viên tự đăng.'
  },

  legalFramework: {
    title: 'Căn Cứ Pháp Lý & Thỏa Thuận Dân Sự Chia Sẻ Chi Phí',
    content:
      'Theo Điều 513 Bộ Luật Dân Sự 2015 và các quy định pháp luật hiện hành: Hoạt động đi chung xe cá nhân là quan hệ thỏa thuận dân sự tương trợ tự nguyện giữa các cá nhân nhằm san sẻ chi phí nhiên liệu và khấu hao phương tiện, không vì mục đích tìm kiếm lợi nhuận kinh doanh vận tải. CarMate hoạt động dưới mô hình Bảng tin thông tin kết nối công nghệ phi thương mại (0% hoa hồng), không cung cấp dịch vụ vận tải và không can thiệp vào thỏa thuận giữa các bên.'
  }
};
