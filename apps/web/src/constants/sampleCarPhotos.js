/**
 * Thư viện bộ ảnh mẫu 3-5 góc xe thực tế (Đã che biển số bảo mật)
 * Dành cho chủ xe muốn tăng độ tín nhiệm nhanh trong 1 chạm
 */

export const SAMPLE_CAR_PHOTO_SETS = [
  {
    id: 'xpander',
    name: 'Mitsubishi Xpander (Xe 7 chỗ gia đình)',
    plateMask: '93A - ***.86',
    photos: [
      {
        angle: 'front',
        label: 'Góc Trước (Đầu xe)',
        url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
        caption: 'Đầu xe sáng đẹp, đèn LED hiện đại'
      },
      {
        angle: 'back',
        label: 'Góc Sau (Đuôi xe & Cốp)',
        url: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80',
        caption: 'Đuôi xe sạch sẽ, cốp rộng để hành lý'
      },
      {
        angle: 'side',
        label: 'Góc Thân xe (Bên hông)',
        url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
        caption: 'Thân xe nguyên bản, không trầy xước'
      },
      {
        angle: 'interior',
        label: 'Nội thất & Ghế ngồi',
        url: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80',
        caption: 'Nội thất bọc da êm ái, máy lạnh 2 giàn'
      },
      {
        angle: 'trunk',
        label: 'Khoang cốp để đồ',
        url: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&q=80',
        caption: 'Khoang hành lý rộng rãi, có thể hạ hàng ghế 3'
      }
    ]
  },
  {
    id: 'veloz',
    name: 'Toyota Veloz Cross (Xe 7 chỗ)',
    plateMask: '60A - ***.52',
    photos: [
      {
        angle: 'front',
        label: 'Góc Trước (Đầu xe)',
        url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80',
        caption: 'Mặt trước thể thao, đèn chiếu sáng sắc nét'
      },
      {
        angle: 'back',
        label: 'Góc Sau (Đuôi xe & Cốp)',
        url: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=800&q=80',
        caption: 'Cốp sau rộng, mở nhẹ nhàng'
      },
      {
        angle: 'side',
        label: 'Góc Thân xe (Bên hông)',
        url: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=800&q=80',
        caption: 'Dáng xe cao ráo, gầm thoáng'
      },
      {
        angle: 'interior',
        label: 'Nội thất & Ghế ngồi',
        url: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=800&q=80',
        caption: 'Ghế da phối nỉ êm ái, sạch sẽ không mùi thuốc'
      }
    ]
  },
  {
    id: 'carnival',
    name: 'Kia Carnival (Xe 7 chỗ cao cấp)',
    plateMask: '51K - ***.99',
    photos: [
      {
        angle: 'front',
        label: 'Góc Trước (Đầu xe)',
        url: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80',
        caption: 'Đầu xe bề thế sang trọng'
      },
      {
        angle: 'back',
        label: 'Góc Sau (Đuôi xe & Cốp)',
        url: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80',
        caption: 'Cốp điện mở rộng, chứa được nhiều vali lớn'
      },
      {
        angle: 'side',
        label: 'Góc Thân xe (Bên hông)',
        url: 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=800&q=80',
        caption: 'Cửa lùa điện tự động hai bên'
      },
      {
        angle: 'interior',
        label: 'Nội thất hạng thương gia',
        url: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=80',
        caption: 'Ghế thương gia ngả lưng thoải mái, sạc điện thoại từng ghế'
      }
    ]
  },
  {
    id: 'vf8',
    name: 'VinFast VF8 (Xe điện 5 chỗ hiện đại)',
    plateMask: '93A - ***.38',
    photos: [
      {
        angle: 'front',
        label: 'Góc Trước (Đầu xe)',
        url: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80',
        caption: 'Đầu xe nhận diện cánh chim LED VinFast'
      },
      {
        angle: 'back',
        label: 'Góc Sau (Đuôi xe & Cốp)',
        url: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80',
        caption: 'Đuôi xe sang trọng, cốp sau rộng rãi'
      },
      {
        angle: 'side',
        label: 'Góc Thân xe (Bên hông)',
        url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
        caption: 'Thiết kế Pininfarina Ý thanh lịch'
      },
      {
        angle: 'interior',
        label: 'Nội thất thông minh',
        url: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=800&q=80',
        caption: 'Êm ái không tiếng ồn động cơ, màn hình trung tâm 15.6 inch'
      }
    ]
  }
];

export const findSampleCarPhotos = (carTypeQuery) => {
  if (!carTypeQuery) return SAMPLE_CAR_PHOTO_SETS[0].photos;
  const q = String(carTypeQuery).toLowerCase();
  if (q.includes('veloz')) return SAMPLE_CAR_PHOTO_SETS[1].photos;
  if (q.includes('carnival')) return SAMPLE_CAR_PHOTO_SETS[2].photos;
  if (q.includes('vf') || q.includes('vinfast') || q.includes('điện')) return SAMPLE_CAR_PHOTO_SETS[3].photos;
  return SAMPLE_CAR_PHOTO_SETS[0].photos;
};
