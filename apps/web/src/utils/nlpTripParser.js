import { formatTripDateDisplay } from '@carmate/shared';

const KNOWN_LOCATIONS = [
  // Miền Bắc
  'Hà Nội',
  'Hải Phòng',
  'Ninh Bình',
  'Quảng Ninh',
  'Hạ Long',
  'Nam Định',
  'Thái Bình',
  'Hưng Yên',
  'Hải Dương',
  'Bắc Ninh',
  'Bắc Giang',
  'Vĩnh Phúc',
  'Phú Thọ',
  'Thái Nguyên',
  'Lạng Sơn',
  'Hòa Bình',
  'Hà Nam',
  'Thanh Hóa',
  'Nghệ An',
  'Vinh',
  'Hà Tĩnh',
  'Mỹ Đình',
  'Giáp Bát',
  'Nước Ngầm',
  'Big C Thăng Long',
  'Cầu Giấy',
  'Long Biên',
  'Hà Đông',
  // Miền Trung & Tây Nguyên
  'Đà Nẵng',
  'Huế',
  'Hội An',
  'Quảng Nam',
  'Tam Kỳ',
  'Quảng Ngãi',
  'Bình Định',
  'Quy Nhơn',
  'Phú Yên',
  'Tuy Hòa',
  'Nha Trang',
  'Khánh Hòa',
  'Cam Ranh',
  'Phan Rang',
  'Ninh Thuận',
  'Phan Thiết',
  'Bình Thuận',
  'Mũi Né',
  'Kon Tum',
  'Gia Lai',
  'Pleiku',
  'Đắk Lắk',
  'Buôn Ma Thuột',
  'Đắk Nông',
  'Lâm Đồng',
  'Đà Lạt',
  'Bảo Lộc',
  'Đức Trọng',
  // Miền Nam
  'Sài Gòn',
  'TP.HCM',
  'TP HCM',
  'Hồ Chí Minh',
  'Bình Phước',
  'Hớn Quản',
  'Tân Khai',
  'Lộc Ninh',
  'Bù Đốp',
  'Bình Long',
  'Chơn Thành',
  'Đồng Xoài',
  'Bù Đăng',
  'Bù Gia Mập',
  'Phú Riềng',
  'Đồng Phú',
  'Bình Dương',
  'Thủ Dầu Một',
  'Bến Cát',
  'Bàu Bàng',
  'Dầu Tiếng',
  'Phú Giáo',
  'Dĩ An',
  'Thuận An',
  'Đồng Nai',
  'Biên Hòa',
  'Long Thành',
  'Vũng Tàu',
  'Bà Rịa',
  'Phú Mỹ',
  'Tây Ninh',
  'Trảng Bàng',
  'Củ Chi',
  'Long An',
  'Tân An',
  'Tiền Giang',
  'Mỹ Tho',
  'Bến Tre',
  'Vĩnh Long',
  'Trà Vinh',
  'Cần Thơ',
  'Hậu Giang',
  'Sóc Trăng',
  'Bạc Liêu',
  'Cà Mau',
  'Hàng Xanh',
  'Bến xe Miền Đông',
  'BX Miền Đông',
  'Bến xe Miền Tây',
  'BX Miền Tây',
  'Tân Sơn Nhất',
  'An Sương'
];

export const SMART_TRIP_TEMPLATES = {
  driver: [
    // Chiều đi (Outbound: Tỉnh ➔ Sài Gòn / Tỉnh ➔ Tỉnh)
    {
      id: 'drv-family-7',
      role: 'driver',
      category: 'driver',
      direction: 'outbound',
      badge: 'Gia đình 7 chỗ',
      title: 'Bù Đốp ➔ Sài Gòn (Chở vợ con)',
      desc: 'Xe 7 chỗ chở người nhà, còn 1 ghế sau, phụ xăng 120k',
      text: 'Chiều nay 17h mình chở vợ con từ Bù Đốp về Sài Gòn xe 7 chỗ còn 1 ghế sau đón QL13 phụ xăng 120k sđt 0984883750'
    },
    {
      id: 'drv-sedan-5',
      role: 'driver',
      category: 'driver',
      direction: 'outbound',
      badge: 'Xe 4–5 chỗ tiện chuyến',
      title: 'Bình Long ➔ Sài Gòn (Vios 5 chỗ)',
      desc: 'Xe 5 chỗ còn 3 ghế êm ái, đón dọc QL13, phụ xăng 150k',
      text: 'Sáng mai 7h mình từ Bình Long về Sài Gòn xe Vios 5 chỗ còn 3 ghế êm ái đón dọc QL13 phụ xăng 150k sđt 0900000013'
    },
    {
      id: 'drv-suv-7',
      role: 'driver',
      category: 'driver',
      direction: 'outbound',
      badge: 'MPV 7 chỗ rộng rãi',
      title: 'Đồng Xoài ➔ Sài Gòn (Xpander 7 chỗ)',
      desc: 'Xe 7 chỗ còn 4 chỗ rộng rãi, nhận gửi kèm bưu phẩm',
      text: 'Trưa nay 11h mình chạy Xpander 7 chỗ từ Đồng Xoài về Sài Gòn còn 4 chỗ cốp rộng nhận gửi kèm hàng hoá sđt 0988112233'
    },
    {
      id: 'drv-central',
      role: 'driver',
      category: 'driver',
      direction: 'outbound',
      badge: 'Tuyến Miền Trung',
      title: 'Đà Nẵng ➔ Huế (Xe 5 chỗ)',
      desc: 'Xe 5 chỗ còn 2 ghế, đón Nguyễn Văn Linh, phụ xăng 100k',
      text: 'Chiều nay 14h xe 5 chỗ chạy Đà Nẵng ra Huế còn 2 ghế đón Nguyễn Văn Linh phụ 100k sđt 0905556677'
    },
    {
      id: 'drv-pickup-bp',
      role: 'driver',
      category: 'driver',
      direction: 'outbound',
      badge: 'Bán tải chở hàng',
      title: 'Đồng Xoài ➔ Sài Gòn (Bán tải thùng rộng)',
      desc: 'Bán tải thùng rỗng nhận chở đồ/nông sản + 2 ghế khách',
      text: 'Sáng mai 8h mình lái xe bán tải Ford Ranger từ Đồng Xoài về Sài Gòn thùng sau còn rỗng nhận chở nông sản chuyển trọ kèm 2 ghế khách sđt 0988223344'
    },
    {
      id: 'drv-truck-n2',
      role: 'driver',
      category: 'driver',
      direction: 'outbound',
      badge: 'Xe tải Tuyến N2',
      title: 'Chơn Thành ➔ Kiên Giang (Xe tải chở xe máy)',
      desc: 'Xe tải nhẹ 2.5T quay đầu Tuyến N2 nhận chở xe máy/nông sản + 1 ghế phụ',
      text: 'Trưa mai 12h mình chạy xe tải nhẹ 2.5T từ Chơn Thành về Rạch Giá Kiên Giang Tuyến N2 thùng rỗng nhận chở xe máy nông sản kèm 1 ghế phụ sđt 0912334455'
    },
    // Chiều về (Return: Sài Gòn ➔ Tỉnh / Huế ➔ Đà Nẵng)
    {
      id: 'drv-ret-budop-7',
      role: 'driver',
      category: 'driver',
      direction: 'return',
      badge: 'Chiều về Bù Đốp',
      title: 'Sài Gòn ➔ Bù Đốp (Xe 7 chỗ)',
      desc: 'Xe 7 chỗ từ Sài Gòn về Bù Đốp, còn 3 ghế, đón Hàng Xanh QL13',
      text: 'Chiều nay 18h mình từ Sài Gòn về Bù Đốp xe 7 chỗ còn 3 ghế đón Hàng Xanh QL13 phụ xăng 120k sđt 0984883750'
    },
    {
      id: 'drv-ret-binhlong-5',
      role: 'driver',
      category: 'driver',
      direction: 'return',
      badge: 'Chiều về Bình Long',
      title: 'Sài Gòn ➔ Bình Long (Mazda 5 chỗ)',
      desc: 'Xe Mazda 5 chỗ từ Sài Gòn về Bình Long, còn 2 ghế, phụ xăng 150k',
      text: 'Sáng mai 8h mình chạy xe Mazda 5 chỗ từ Sài Gòn về Bình Long còn 2 ghế đón Bến xe Miền Đông phụ xăng 150k sđt 0900000013'
    },
    {
      id: 'drv-ret-dongxoai-7',
      role: 'driver',
      category: 'driver',
      direction: 'return',
      badge: 'Chiều về Đồng Xoài',
      title: 'Sài Gòn ➔ Đồng Xoài (Xpander 7 chỗ)',
      desc: 'Xe 7 chỗ từ Sài Gòn về Đồng Xoài, cốp rộng, nhận gửi kèm đồ',
      text: 'Trưa nay 13h mình chạy Xpander 7 chỗ từ Sài Gòn về Đồng Xoài còn 3 ghế nhận gửi kèm bưu phẩm phụ 130k sđt 0988112233'
    },
    {
      id: 'drv-ret-locninh-5',
      role: 'driver',
      category: 'driver',
      direction: 'return',
      badge: 'Chiều về Lộc Ninh',
      title: 'Sài Gòn ➔ Lộc Ninh (Vios 5 chỗ)',
      desc: 'Xe 5 chỗ từ Sài Gòn về Lộc Ninh đón dọc QL13, phụ xăng 140k',
      text: 'Tối nay 19h mình lái xe Vios 5 chỗ từ Sài Gòn về Lộc Ninh đón dọc QL13 còn 2 chỗ phụ xăng 140k sđt 0977223344'
    },
    {
      id: 'drv-ret-pickup',
      role: 'driver',
      category: 'driver',
      direction: 'return',
      badge: 'Chiều về Bán tải',
      title: 'Sài Gòn ➔ Đồng Xoài (Bán tải quay đầu)',
      desc: 'Bán tải từ Sài Gòn về Đồng Xoài thùng rỗng nhận chở hàng + 2 ghế khách',
      text: 'Chiều nay 17h mình chạy xe bán tải từ Sài Gòn về Đồng Xoài thùng xe nhận chở hàng chuyển trọ kèm 2 ghế khách sđt 0988223344'
    },
    {
      id: 'drv-ret-central',
      role: 'driver',
      category: 'driver',
      direction: 'return',
      badge: 'Huế ➔ Đà Nẵng',
      title: 'Huế ➔ Đà Nẵng (Xe 5 chỗ)',
      desc: 'Xe 5 chỗ từ Huế về Đà Nẵng, còn 2 ghế, phụ xăng 100k',
      text: 'Chiều mai 15h xe 5 chỗ chạy từ Huế về Đà Nẵng còn 2 ghế đón trung tâm Huế phụ 100k sđt 0905556677'
    }
  ],
  passenger: [
    // Chiều đi (Outbound: Tỉnh ➔ Sài Gòn)
    {
      id: 'pax-single-urgent',
      role: 'passenger',
      category: 'passenger',
      direction: 'outbound',
      badge: 'Khách đi 1 mình',
      title: 'Bù Đốp ➔ BV Chợ Rẫy (1 người)',
      desc: 'Cần 1 ghế sáng mai đi khám bệnh, đón QL13, phụ 120k',
      text: 'Sáng mai 8h em cần tìm xe ghép 1 người từ Bù Đốp đi Bệnh viện Chợ Rẫy Sài Gòn đón ở ngã tư Bình Phước phụ xăng 120k sđt 0984883750'
    },
    {
      id: 'pax-family-3',
      role: 'passenger',
      category: 'passenger',
      direction: 'outbound',
      badge: 'Gia đình 2-3 người',
      title: 'Đồng Xoài ➔ BX Miền Đông (3 ghế)',
      desc: 'Nhà 2 người lớn 1 bé cần tìm xe chiều nay, phụ 300k',
      text: 'Chiều nay 16h nhà mình 2 người lớn 1 bé cần tìm xe từ Đồng Xoài về Bến xe Miền Đông đón tận nơi phụ 300k sđt 0912345678'
    },
    {
      id: 'pax-parcel',
      role: 'passenger',
      category: 'passenger',
      direction: 'outbound',
      badge: 'Gửi hàng / Bưu phẩm',
      title: 'Lộc Ninh ➔ Thủ Đức (Gửi bưu phẩm)',
      desc: 'Thùng sầu riêng 10kg gửi kèm xe chiều nay, phụ 80k',
      text: 'Trưa nay em có thùng trái cây 10kg cần gửi từ Lộc Ninh về Thủ Đức ai tiện xe cho em gửi phụ xăng 80k sđt 0977223344'
    },
    {
      id: 'pax-airport',
      role: 'passenger',
      category: 'passenger',
      direction: 'outbound',
      badge: 'Đi sân bay',
      title: 'Biên Hòa ➔ Sân bay Tân Sơn Nhất',
      desc: 'Cần ghép 1 ghế sáng sớm, hành lý gọn, phụ 150k',
      text: 'Sáng sớm mai 5h mình cần tìm xe ghép 1 ghế từ Biên Hòa lên sân bay Tân Sơn Nhất phụ 150k sđt 0905112233'
    },
    {
      id: 'pax-motorcycle-n2',
      role: 'passenger',
      category: 'passenger',
      direction: 'outbound',
      badge: 'Gửi xe máy về quê',
      title: 'Chơn Thành ➔ Kiên Giang (Gửi xe máy)',
      desc: 'Cần gửi 1 xe máy Wave về Rạch Giá Tuyến N2 phụ 550k',
      text: 'Sáng mai em cần gửi 1 xe máy Wave từ Chơn Thành về Rạch Giá Kiên Giang dọc Tuyến N2 ai tiện xe tải cho em gửi phụ 550k sđt 0984883750'
    },
    // Chiều về (Return: Sài Gòn ➔ Tỉnh)
    {
      id: 'pax-ret-budop',
      role: 'passenger',
      category: 'passenger',
      direction: 'return',
      badge: 'Về Bù Đốp',
      title: 'Sài Gòn ➔ Bù Đốp (1 người)',
      desc: 'Cần tìm xe ghép chiều nay từ Sài Gòn về Bù Đốp, phụ 120k',
      text: 'Chiều nay 16h em cần tìm xe ghép 1 người từ Sài Gòn về Bù Đốp đón ở Bến xe Miền Đông hoặc QL13 phụ xăng 120k sđt 0984883750'
    },
    {
      id: 'pax-ret-binhlong',
      role: 'passenger',
      category: 'passenger',
      direction: 'return',
      badge: 'Về Bình Long',
      title: 'Sài Gòn ➔ Bình Long (2 người)',
      desc: 'Nhà 2 người cần xe từ Sài Gòn về Bình Long sáng mai, phụ 300k',
      text: 'Sáng mai 9h nhà mình 2 người lớn cần tìm xe từ Sài Gòn về Bình Long đón ở Ngã tư Bình Phước phụ 300k sđt 0912345678'
    },
    {
      id: 'pax-ret-dongxoai',
      role: 'passenger',
      category: 'passenger',
      direction: 'return',
      badge: 'Gửi hàng về tỉnh',
      title: 'Thủ Đức ➔ Đồng Xoài (Gửi bưu phẩm)',
      desc: 'Kiện hàng 5kg gửi từ Thủ Đức về Đồng Xoài chiều nay, phụ 70k',
      text: 'Chiều nay em có kiện hàng 5kg cần gửi từ Thủ Đức về Đồng Xoài ai tiện xe cho em gửi phụ xăng 70k sđt 0977223344'
    },
    {
      id: 'pax-ret-produce',
      role: 'passenger',
      category: 'passenger',
      direction: 'return',
      badge: 'Gửi hàng về quê',
      title: 'Sài Gòn ➔ Lộc Ninh (Thùng nông sản)',
      desc: 'Thùng xốp 15kg gửi từ Sài Gòn về Lộc Ninh, phụ xăng 90k',
      text: 'Chiều nay em có thùng xốp 15kg cần gửi từ Sài Gòn về Lộc Ninh ai tiện xe cho em gửi phụ xăng 90k sđt 0977223344'
    },
    {
      id: 'pax-ret-airport',
      role: 'passenger',
      category: 'passenger',
      direction: 'return',
      badge: 'Sân bay về',
      title: 'Tân Sơn Nhất ➔ Biên Hòa (1 người)',
      desc: 'Hạ cánh 20h cần ghép xe về Biên Hòa, hành lý gọn, phụ 150k',
      text: 'Tối nay 20h mình hạ cánh sân bay Tân Sơn Nhất cần tìm xe ghép 1 người về Biên Hòa hành lý gọn phụ 150k sđt 0905112233'
    }
  ]
};

export function parseNaturalTrip(text) {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  if (raw.length < 5) return null;

  const lower = raw.toLowerCase();

  // 1. Phân loại vai trò (Chủ xe hay Khách)
  const isPassenger =
    /(tìm xe|cần xe|cần ghép|tìm xe ghép|ai có xe|cần đi|xin ghép|cho em ghép|cho e ghép|khách cần|cần tìm|cần \d+\s*(?:ghế|chỗ|người|vé)|cần 1 ghế|cần 1 chỗ|em cần 1|mình cần 1|nhà mình cần|khách đi|cho mình ké|xin đi nhờ|cần gửi|gửi hàng|gửi bưu phẩm|cho em gửi|cho e gửi|thùng|kiện hàng|gửi đồ)/i.test(
      lower
    );
  const role = isPassenger ? 'passenger' : 'driver';

  // 2. Số điện thoại Zalo (10 số, đầu 03, 05, 07, 08, 09)
  let phoneReal = '';
  const phoneMatch = raw.match(/(?:0|\+84)[35789][0-9]{8}|(?:0|\+84)[35789][0-9]{1,2}[.\s]?[0-9]{3}[.\s]?[0-9]{3,4}/);
  if (phoneMatch) {
    phoneReal = phoneMatch[0].replace(/[^0-9]/g, '');
    if (phoneReal.startsWith('84')) phoneReal = '0' + phoneReal.slice(2);
  }

  // 3. Giá tiền (VD: 150k, 150.000, 200k, 180 nghìn, 150000, phụ xăng 120k, phụ 100k)
  // Lưu ý: Dùng k(?!g) để tránh bắt nhầm 10kg hàng hóa thành 10k giá tiền
  let price = null;
  const priceKMatch = lower.match(/(?:phụ xăng|tiền xăng|phụ|chia sẻ|giá|vé)?\s*(\d{2,3})\s*(?:k(?!g)|nghìn|ngàn)/i);
  if (priceKMatch) {
    price = parseInt(priceKMatch[1], 10) * 1000;
  } else {
    const priceFullMatch = raw.match(/(\d{2,3})[.,](\d{3})/);
    if (priceFullMatch) {
      price = parseInt(priceFullMatch[1] + priceFullMatch[2], 10);
    } else {
      const priceRawMatch = raw.match(/(\d{5,6})\s*(?:đ|vnd|đồng)?/i);
      if (priceRawMatch) {
        price = parseInt(priceRawMatch[1], 10);
      }
    }
  }

  // 4. Số ghế trống hoặc cần tìm (VD: còn 3 ghế, còn 1 ghế sau, chỉ nhận 1 khách, dư 2 chỗ...)
  // Stanford NLP: Xử lý tổ hợp gia đình người lớn + trẻ em/bé (VD: 2 người lớn 1 bé -> 3 ghế)
  let seats = null;
  const familyComboMatch = lower.match(/(\d+)\s*(?:người\s*lớn|lớn)\s*(?:và|\+|,)?\s*(\d+)\s*(?:trẻ\s*em|bé|nhỏ|con)/i);
  if (familyComboMatch) {
    seats = parseInt(familyComboMatch[1], 10) + parseInt(familyComboMatch[2], 10);
  } else {
    const seatsMatch =
      lower.match(
        /(?:còn|trống|cần|ghép|chỉ nhận|nhận|dư|còn lại|chở thêm|chỉ chở)\s*([1-7])\s*(?:ghế\s*sau|ghế|chỗ|người|vé|khách)/i
      ) ||
      lower.match(
        /(?:xe\s*(?:mazda|vios|kia|hyundai|honda|toyota|ford|vinfast|xpander|innova|veloz)?\s*)?([1-7])\s*(?:ghế\s*sau|ghế|chỗ|người|vé|khách)(?:\s+|$|[.,;])/i
      );
    if (seatsMatch) {
      seats = parseInt(seatsMatch[1], 10);
    }
  }

  // 5. Loại xe & Phân loại Biển Trắng / Biển Vàng & Xe Gia Đình Có Người Thân
  const hasRelatives = /(vợ con|vợ|con nhỏ|người nhà|gia đình mình|chở vợ|chở con)/i.test(lower);
  let carCategory = 'family_car';
  let carType = 'Xe 5-7 chỗ';

  if (/(tiện chuyến|biển vàng|xe dịch vụ|xe ghép)/i.test(lower)) {
    carCategory = 'convenient_trip';
  } else if (hasRelatives || /(xe nhà|xe gia đình|biển trắng)/i.test(lower)) {
    carCategory = 'family_car';
  }

  let vehicleType = 'standard';
  let hasCargoBed = false;

  if (/bán tải|ranger|hilux|triton|navara|d-?max/i.test(lower)) {
    carType = 'Xe bán tải (Ford Ranger / Hilux)';
    vehicleType = 'pickup';
    hasCargoBed = true;
  } else if (/xe tải|tải nhẹ|k250|k200|porter|h150|qkr/i.test(lower)) {
    carType = 'Xe tải nhẹ 1T–3.5T (Tuyến N2 / Chành xe)';
    vehicleType = 'truck_light';
    hasCargoBed = true;
  } else if (/xpander/i.test(lower)) carType = 'Mitsubishi Xpander (Xe 7 chỗ)';
  else if (/veloz/i.test(lower)) carType = 'Toyota Veloz Cross (Xe 7 chỗ)';
  else if (/innova/i.test(lower)) carType = 'Toyota Innova (Xe 7 chỗ)';
  else if (/carnival/i.test(lower)) carType = 'Kia Carnival (Xe 7 chỗ)';
  else if (/cx-?8/i.test(lower)) carType = 'Mazda CX-8 (Xe 7 chỗ)';
  else if (/cx-?5/i.test(lower)) carType = 'Mazda CX-5 (Xe 5 chỗ)';
  else if (/mazda\s*2/i.test(lower)) carType = 'Mazda 2 (Xe 5 chỗ)';
  else if (/mazda\s*3/i.test(lower)) carType = 'Mazda 3 (Xe 5 chỗ)';
  else if (/mazda\s*6/i.test(lower)) carType = 'Mazda 6 (Xe 5 chỗ)';
  else if (/mazda/i.test(lower)) carType = 'Mazda (Xe 5 chỗ)';
  else if (/vios/i.test(lower)) carType = 'Toyota Vios (Xe 5 chỗ)';
  else if (/accent/i.test(lower)) carType = 'Hyundai Accent (Xe 5 chỗ)';
  else if (/city/i.test(lower)) carType = 'Honda City (Xe 5 chỗ)';
  else if (/cerato|k3/i.test(lower)) carType = 'Kia K3 (Xe 5 chỗ)';
  else if (/vf\s*9/i.test(lower)) carType = 'VinFast VF9 (Xe 7 chỗ)';
  else if (/vf\s*8/i.test(lower)) carType = 'VinFast VF8 (Xe 5 chỗ)';
  else if (/vf\s*5/i.test(lower)) carType = 'VinFast VF5 (Xe 5 chỗ)';
  else if (/vf\s*3/i.test(lower)) carType = 'VinFast VF3 (Xe 4 chỗ)';
  else if (/vinfast/i.test(lower)) carType = 'VinFast (Xe 5 chỗ)';
  else if (/cross|corolla/i.test(lower)) carType = 'Toyota Corolla Cross (Xe 5 chỗ)';
  else if (/fortuner/i.test(lower)) carType = 'Toyota Fortuner (Xe 7 chỗ)';
  else if (/everest/i.test(lower)) carType = 'Ford Everest (Xe 7 chỗ)';
  else if (/santafe|santa fe/i.test(lower)) carType = 'Hyundai Santa Fe (Xe 7 chỗ)';
  else if (/sorento/i.test(lower)) carType = 'Kia Sorento (Xe 7 chỗ)';
  else if (/crv|cr-v/i.test(lower)) carType = 'Honda CR-V (Xe 7 chỗ)';
  else if (/7\s*chỗ/i.test(lower)) carType = hasRelatives ? 'Xe 7 chỗ gia đình (chở người thân)' : 'Xe 7 chỗ rộng rãi';
  else if (/5\s*chỗ|4\s*chỗ/i.test(lower))
    carType = hasRelatives ? 'Xe 5 chỗ gia đình (chở người thân)' : 'Xe 5 chỗ cá nhân';
  else if (hasRelatives) carType = 'Xe gia đình (chở người thân)';

  // 6. Thời gian & Khung giờ (Được tính toán theo ngày dương lịch thực tế)
  let scheduleDay = formatTripDateDisplay('Hôm nay');
  if (/ngày mai|sáng mai|chiều mai|tối mai/i.test(lower)) scheduleDay = formatTripDateDisplay('Ngày mai');
  else if (/cuối tuần/i.test(lower)) scheduleDay = formatTripDateDisplay('Cuối tuần');
  else if (/thứ 2|thứ hai/i.test(lower)) scheduleDay = formatTripDateDisplay('Thứ 2');
  else if (/thứ 3|thứ ba/i.test(lower)) scheduleDay = formatTripDateDisplay('Thứ 3');
  else if (/thứ 4|thứ tư/i.test(lower)) scheduleDay = formatTripDateDisplay('Thứ 4');
  else if (/thứ 5|thứ năm/i.test(lower)) scheduleDay = formatTripDateDisplay('Thứ 5');
  else if (/thứ 6|thứ sáu/i.test(lower)) scheduleDay = formatTripDateDisplay('Thứ 6');
  else if (/thứ 7|thứ bảy/i.test(lower)) scheduleDay = formatTripDateDisplay('Thứ 7');
  else if (/chủ nhật|cn/i.test(lower)) scheduleDay = formatTripDateDisplay('Chủ nhật');

  let timeSlot = '07:00-09:00';
  let exactTime = '';
  const hourMatch = lower.match(/(\d{1,2})\s*(?:h|:|giờ)(\d{2})?\s*(sáng|trưa|chiều|tối|đêm|khuya)?/);
  if (hourMatch) {
    let h = parseInt(hourMatch[1], 10);
    const m = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0;
    const period = hourMatch[3];
    if ((period === 'chiều' || period === 'tối') && h < 12) h += 12;
    if ((period === 'đêm' || period === 'khuya') && h < 12 && h >= 6) h += 12;

    exactTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    if (h >= 3 && h < 5) timeSlot = '03:00-05:00';
    else if (h >= 5 && h < 7) timeSlot = '05:00-07:00';
    else if (h >= 7 && h < 9) timeSlot = '07:00-09:00';
    else if (h >= 9 && h < 11) timeSlot = '09:00-11:00';
    else if (h >= 11 && h < 13) timeSlot = '11:00-13:00';
    else if (h >= 13 && h < 15) timeSlot = '13:00-15:00';
    else if (h >= 15 && h < 17) timeSlot = '15:00-17:00';
    else if (h >= 17 && h < 19) timeSlot = '17:00-19:00';
    else if (h >= 19 && h < 21) timeSlot = '19:00-21:00';
    else if (h >= 21 && h < 23) timeSlot = '21:00-23:00';
    else timeSlot = '23:00-03:00';
  } else if (/rạng sáng|đi viện|bệnh viện|sân bay sớm/i.test(lower)) {
    timeSlot = '03:00-05:00';
  } else if (/sáng sớm/i.test(lower)) {
    timeSlot = '05:00-07:00';
  } else if (/trưa|buổi trưa/i.test(lower)) {
    timeSlot = '11:00-13:00';
  } else if (/tan tầm|tan ca/i.test(lower)) {
    timeSlot = '17:00-19:00';
  } else if (/khuya|xuyên đêm|nửa đêm|đêm muộn|bay đêm/i.test(lower)) {
    timeSlot = '23:00-03:00';
  }

  // 7. Điểm xuất phát (from) & Điểm đến (to)
  let fromLocation = '';
  let toLocation = '';

  // Cách A: Tìm các từ khoá chuyển tiếp (từ A đi/về/đến B)
  const routePatterns = [
    /(?:từ|chạy từ|đón tại|xuất phát từ)\s+([^,.\n]+?)\s+(?:đi|về|đến|tới|sang)\s+([^,.\n]+)/i,
    /([^,.\n]+?)\s*(?:->|=>|➔|⇄|–|-)\s*([^,.\n]+)/i,
    /(?:chạy|đi|tuyến)\s+([^,.\n]+?)\s+(?:về|đi|đến|tới|sang)\s+([^,.\n]+)/i,
    /([A-Za-zÀ-ỹ0-9\s]{2,30}?)\s+(?:đi|về|đến|tới|sang)\s+([A-Za-zÀ-ỹ0-9\s]{2,30}?)(?:\s+(?:xe|còn|giá|sđt|zalo|lúc|đón|trả|phụ|khoảng)|$|[.,;])/i
  ];

  for (const pattern of routePatterns) {
    const match = raw.match(pattern);
    if (match && match[1] && match[2]) {
      let candidateFrom = match[1].trim();
      let candidateTo = match[2].trim();
      // Khử tiền tố thời gian / từ xưng hô thừa ở đầu điểm xuất phát
      candidateFrom = candidateFrom
        .replace(/^[0-9:.\s-]+/g, '')
        .replace(/^(?:hôm nay|ngày mai|sáng mai|chiều mai|tối mai|chiều nay|sáng nay|trưa nay|tối nay|thứ\s*\d|chủ nhật|mình|tôi|em|anh|chúng tôi)\s+/gi, '')
        .trim();
      if (candidateFrom.length >= 2 && candidateTo.length >= 2) {
        fromLocation = candidateFrom;
        toLocation = candidateTo;
        break;
      }
    }
  }

  // Cách B: Quét theo danh bạ địa danh nếu chưa tìm thấy
  if (!fromLocation || !toLocation) {
    const foundLocations = [];
    for (const loc of KNOWN_LOCATIONS) {
      const idx = lower.indexOf(loc.toLowerCase());
      if (idx !== -1) {
        foundLocations.push({ name: loc, index: idx });
      }
    }
    foundLocations.sort((a, b) => a.index - b.index);

    if (foundLocations.length >= 2) {
      if (!fromLocation) fromLocation = foundLocations[0].name;
      if (!toLocation) toLocation = foundLocations[1].name;
    } else if (foundLocations.length === 1) {
      if (!fromLocation) fromLocation = foundLocations[0].name;
    }
  }

  // Tiện đón dọc đường hoặc điểm hẹn đón cụ thể (Waypoints & Pickup/Dropoff Spots)
  let waypointNote = '';
  let pickupSpot = '';
  let dropoffSpot = '';

  const pickupMatch = raw.match(
    /(?:đón tại|đón ở|đón dọc|đón ngã tư|đón cây xăng|đón tận nơi|tiện đường|dọc theo|dọc|đón)\s+([^,.\n]+?)(?:\s+(?:trả|giá|sđt|zalo|phụ|còn|xe|\d+\s*k|\d+\s*nghìn|\d+\s*đ)|\s*$)/i
  );
  if (pickupMatch) {
    let rawPickup = pickupMatch[1].trim();
    rawPickup = rawPickup.replace(/\s+(?:phụ|giá|sđt|zalo|tiền|còn|xe).*/i, '').trim();
    pickupSpot = rawPickup;
    waypointNote = rawPickup.toLowerCase().startsWith('dọc') ? rawPickup : `Đón tại ${rawPickup}`;
  }

  const dropoffMatch = raw.match(
    /(?:trả tại|trả ở|trả dọc|trả tận nơi|trả khách ở|trả khách tại|trả)\s+([^,.\n]+?)(?:\s+(?:giá|sđt|zalo|phụ|còn|xe|đón|\d+\s*k|\d+\s*nghìn|\d+\s*đ)|\s*$)/i
  );
  if (dropoffMatch) {
    let rawDropoff = dropoffMatch[1].trim();
    rawDropoff = rawDropoff.replace(/\s+(?:phụ|giá|sđt|zalo|tiền|còn|xe).*/i, '').trim();
    dropoffSpot = rawDropoff;
  }

  // 8. Tiện ích & Nhu cầu đặc thù do chủ xe / hành khách nêu trong câu
  const acceptsParcel =
    /(gửi hàng|gửi đồ|chuyển đồ|nhận đồ|nhận hàng|chở đồ|kèm hàng|bưu phẩm|kiện hàng|thùng|cần gửi)/i.test(lower);
  const noSmoking = /(không khói thuốc|không hút thuốc|cấm hút thuốc|ko thuốc|ko hút thuốc|không thuốc)/i.test(lower);
  const acOn = /(máy lạnh|bật điều hòa|điều hòa|mát rượi|mát mẻ)/i.test(lower);
  const largeTrunk = /(cốp rộng|khoang đồ rộng|để nhiều đồ|vali to|nhiều hành lý|chở nhiều đồ)/i.test(lower);
  const botIncluded = /(bao vé|bao phí|bao cầu đường|trọn gói vé|đã gồm phí cầu đường|đã gồm vé|miễn phí bot)/i.test(
    lower
  );
  const pickupHighway = /(đón dọc ql|đón dọc đường|đón cao tốc|đón ql13|đón ngã tư|đón cây xăng)/i.test(lower);
  const hasChild = /(trẻ nhỏ|con nhỏ|bé nhỏ|có bé|có con)/i.test(lower);
  const frontSeatPreference = /(ngồi ghế trước|chống say xe|say xe|ghế phụ|say tàu xe)/i.test(lower);
  const compactLuggage = /(hành lý gọn|đồ gọn gàng|chỉ có balo|vali nhỏ)/i.test(lower);

  const isDriver = role === 'driver';
  let capacity = undefined;
  if (isDriver) {
    if (vehicleType === 'truck_light') {
      capacity = 2;
    } else if (vehicleType === 'pickup') {
      capacity = 5;
    } else if (
      /(?:7\s*chỗ|xpander|veloz|innova|carnival|santafe|santa fe|fortuner|everest|custin|sorento|crv|cr-v|cx-?8|vf\s*9)/i.test(
        lower
      ) ||
      (seats && seats > 4)
    ) {
      capacity = 7;
    } else if (
      /(?:5\s*chỗ|4\s*chỗ|vios|city|accent|cerato|k3|mazda|civic|elantra|morning|i10|fadil|cx-?5|cx-?30|vf\s*3|vf\s*5|vf\s*6|vf\s*7|vf\s*8)/i.test(
        lower
      )
    ) {
      capacity = 5;
    } else {
      capacity = 5;
    }
  }

  const carAndGarbageRegex =
    /(?:\s+|-|,|\/)?\s*(?:xe\s*)?(?:mazda\s*\d*|vios|xpander|innova|veloz|kia\s*\w*|hyundai\s*\w*|honda\s*\w*|toyota\s*\w*|ford\s*\w*|vinfast\s*\w*|carnival|accent|city|cerato|k3|cx-?\d+|sedan|suv|mpv|nhà|oto|ô tô|hơi|ghép|gia đình|\d+\s*chỗ|chỗ|còn\s*\d*|giá|sđt|zalo|lúc|khoảng|đón|trả|phụ|ai tiện|ai có|\d+\s*k|\d+\s*nghìn|\d+\s*đ).*/i;

  const cleanFromLoc = fromLocation
    .replace(/^(mình|tôi|em|anh|chúng tôi)\s+/i, '')
    .replace(carAndGarbageRegex, '')
    .trim();

  const cleanToLoc = toLocation
    .replace(carAndGarbageRegex, '')
    .trim();

  return {
    role,
    fromLocation: cleanFromLoc,
    toLocation: cleanToLoc,
    waypointNote,
    pickupSpot,
    dropoffSpot,
    scheduleDay,
    timeSlot,
    exactTime,
    seats: seats || (isDriver ? (vehicleType === 'truck_light' ? 1 : hasRelatives ? 1 : 3) : 1),
    price: price || (isDriver ? (vehicleType === 'truck_light' ? 350000 : 150000) : 120000),
    phoneReal,
    capacity,
    vehicleType: isDriver ? vehicleType : undefined,
    hasCargoBed: isDriver ? hasCargoBed : undefined,
    carCategory: isDriver ? carCategory : undefined,
    carType: isDriver ? carType : undefined,
    hasRelatives: isDriver ? hasRelatives : false,
    acceptsParcel: isDriver ? (hasCargoBed ? true : acceptsParcel) : acceptsParcel,
    detectedPerks: {
      noSmoking,
      acOn,
      largeTrunk,
      botIncluded,
      pickupHighway,
      hasChild,
      frontSeatPreference,
      compactLuggage,
      acceptsParcel
    },
    rawText: raw
  };
}

/**
 * generateSmartZaloDraft — Soạn thảo tin nhắn Zalo thông minh chuẩn văn hóa Việt Nam
 * Hỗ trợ 2 chiều: Khách ghép ghế hoặc Người gửi bưu phẩm kiện hàng
 */
export function generateSmartZaloDraft({
  driverName = 'Chủ xe',
  from = '',
  to = '',
  timeSlot = '',
  date = 'Hôm nay',
  seats = 1,
  price = 0,
  pickupPoint = '',
  isParcel = false,
  hasRelatives = false,
  bookingCode = '',
  confirmUrl = ''
}) {
  const pickupText = pickupPoint ? `\n• Điểm hẹn đón: ${pickupPoint}` : '';
  const priceText = price ? `\n• Chi phí phụ xăng dự kiến: ${new Intl.NumberFormat('vi-VN').format(price)}đ/ghế` : '';
  const confirmLink = confirmUrl || (bookingCode ? `https://carmate.vn/#confirm-${bookingCode}` : '');
  const confirmText = confirmLink ? `\n👉 Chủ xe xác nhận đón: ${confirmLink}` : '';

  if (isParcel) {
    return `Chào ${driverName}, em thấy xe mình chạy tuyến ${from} ➔ ${to} lúc ${timeSlot} (${date}).
Em có 1 kiện đồ nhỏ muốn gửi kèm theo xe. Anh cho em gửi vị trí đón nhận bưu phẩm qua Zalo này nhé! Cảm ơn anh.${confirmText}`;
  }

  const relativeNote = hasRelatives ? ' (em biết xe có người nhà, em đi 1 mình gọn gàng)' : '';

  return `Chào ${driverName}, em thấy chuyến xe của anh trên CarMate:
• Lộ trình: ${from} ➔ ${to}
• Khung giờ: ${timeSlot} (${date})
• Số người đăng ký: ${seats} người${relativeNote}${pickupText}${priceText}
• Cam kết: Em cam kết có mặt đúng giờ hẹn, không hủy gấp.
Anh cho em xin điểm hẹn đón thuận tiện nhất của anh nhé!${confirmText}`;
}
