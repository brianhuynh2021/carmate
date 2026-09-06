import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Navigation, Compass, CheckCircle2, Clock,
  Car, Users, MessageCircle, AlertCircle, Sparkles, X, ChevronRight, ExternalLink
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getRouteCorridor, findNearestWaypoint, calculateDistanceKm,
  formatDistance, formatVND, getZaloChatUrl, cleanPhoneNumber,
  isGoogleMapsUrl, getGoogleMapsUrl, findLocationCoords, decodeHtmlEntities
} from '@carmate/shared';
import { useI18n } from '../../i18n/index.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import { ZaloIcon } from '../ui/SocialIcons.jsx';

export default function RouteDetailModal({ trip, onClose, onBook }) {
  const { t, lang } = useI18n();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [selectedQuickStop, setSelectedQuickStop] = useState('');

  if (!trip) return null;

  const corridor = getRouteCorridor(trip.routeCategory);
  const isDriver = trip.type === 'driver_offer';
  const price = trip.basePricePerSeat || trip.expectedPrice || trip.suggestedContribution || 180000;
  const tripFrom = decodeHtmlEntities(trip.from);
  const tripTo = decodeHtmlEntities(trip.to);
  const waypointNote = decodeHtmlEntities(trip.waypointNote);

  // Tìm toạ độ 2 đầu điểm đón và điểm trả nếu không có corridor cố định
  const fromCoords = corridor ? corridor.startLandmark : findLocationCoords(tripFrom);
  const toCoords = corridor ? corridor.endLandmark : findLocationCoords(tripTo);

  // Danh sách các điểm toạ độ hiển thị trên map
  const mapWaypoints = [];
  if (corridor && corridor.waypoints) {
    mapWaypoints.push(...corridor.waypoints);
  } else {
    if (fromCoords) {
      mapWaypoints.push({ name: tripFrom, sub: 'Điểm đón ban đầu', lat: fromCoords.lat, lng: fromCoords.lng, isStart: true, type: 'pickup' });
    }
    if (toCoords) {
      mapWaypoints.push({ name: tripTo, sub: 'Điểm trả kết thúc', lat: toCoords.lat, lng: toCoords.lng, isEnd: true, type: 'dropoff' });
    }
  }

  const latLngs = mapWaypoints.map((w) => [w.lat, w.lng]);

  // Tính toán khoảng cách nếu có vị trí người dùng
  const proximityResult = userLocation
    ? findNearestWaypoint(userLocation.lat, userLocation.lng, trip)
    : null;

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Hủy map cũ nếu có
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultCenter = corridor?.center || (
      latLngs.length > 0
        ? [(latLngs[0][0] + (latLngs[1]?.[0] || latLngs[0][0])) / 2, (latLngs[0][1] + (latLngs[1]?.[1] || latLngs[0][1])) / 2]
        : [16.0, 107.0]
    );
    const defaultZoom = corridor?.zoom || (latLngs.length > 1 ? 8 : 10);

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      scrollWheelZoom: false
    });
    mapInstanceRef.current = map;

    // Lớp bản đồ CartoDB Voyager sáng sủa & mượt mà
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    // Vẽ vệt đường chạy dọc hành lang
    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: '#0284c7',
        weight: 5,
        opacity: 0.85,
        dashArray: '2, 6',
        lineCap: 'round'
      }).addTo(map);

      L.polyline(latLngs, {
        color: '#0ea5e9',
        weight: 3,
        opacity: 0.95,
        lineCap: 'round'
      }).addTo(map);
    }

    // Custom DivIcon cho điểm đón (Xanh lá)
    const createCustomIcon = (bgColor, label, iconText) =>
      L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
            <div style="background:${bgColor}; color:white; font-size:11px; font-weight:bold; padding:4px 8px; border-radius:12px; box-shadow:0 3px 8px rgba(0,0,0,0.25); white-space:nowrap; border:2px solid white; display:flex; align-items:center; gap:4px;">
              <span>${iconText}</span>
              <span>${label}</span>
            </div>
            <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:7px solid ${bgColor};"></div>
          </div>
        `,
        iconSize: [0, 0]
      });

    // Điểm bắt đầu
    if (mapWaypoints.length > 0) {
      const startWp = mapWaypoints[0];
      L.marker([startWp.lat, startWp.lng], {
        icon: createCustomIcon('#10b981', trip.from || startWp.name, '🟢')
      })
        .addTo(map)
        .bindPopup(`<b>Điểm đón chính:</b><br/>${trip.from || startWp.name}`);
    }

    // Điểm kết thúc
    if (mapWaypoints.length > 1) {
      const endWp = mapWaypoints[mapWaypoints.length - 1];
      L.marker([endWp.lat, endWp.lng], {
        icon: createCustomIcon('#ef4444', trip.to || endWp.name, '🔴')
      })
        .addTo(map)
        .bindPopup(`<b>Điểm đến chính:</b><br/>${trip.to || endWp.name}`);
    }

    // Các điểm dừng phụ dọc tuyến (nếu có corridor)
    if (mapWaypoints.length > 2) {
      mapWaypoints.slice(1, -1).forEach((wp) => {
        L.circleMarker([wp.lat, wp.lng], {
          radius: 6,
          fillColor: '#3b82f6',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        })
          .addTo(map)
          .bindPopup(`<b>${wp.name}</b><br/>${wp.sub || 'Trạm dừng đón dọc tuyến'}`);
      });
    }

    // Thêm marker người dùng nếu có
    if (userLocation) {
      L.marker([userLocation.lat, userLocation.lng], {
        icon: createCustomIcon('#f59e0b', 'Vị trí của bạn', '📍')
      })
        .addTo(map)
        .bindPopup('<b>Vị trí của bạn</b>')
        .openPopup();

      // Vẽ đường kết nối từ người dùng đến trạm gần nhất
      if (proximityResult && proximityResult.waypoint) {
        L.polyline(
          [
            [userLocation.lat, userLocation.lng],
            [proximityResult.waypoint.lat, proximityResult.waypoint.lng]
          ],
          {
            color: '#f59e0b',
            weight: 2,
            dashArray: '4, 6'
          }
        ).addTo(map);
      }
    }

    // Căn chỉnh khung hình bao quát toàn bộ
    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      if (userLocation) {
        bounds.extend([userLocation.lat, userLocation.lng]);
      }
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [corridor, trip, userLocation]);

  // Lấy toạ độ GPS thực tế của người dùng
  const handleGetLiveGPS = () => {
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          name: 'Vị trí hiện tại của bạn'
        });
      },
      (err) => {
        setLocating(false);
        setLocationError('Không thể lấy vị trí GPS. Bạn có thể chọn trạm gần bạn ở bên dưới.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Chọn nhanh trạm gần mình từ danh sách
  const handleSelectQuickStop = (wpName) => {
    setSelectedQuickStop(wpName);
    const found = mapWaypoints.find((w) => w.name === wpName);
    if (found) {
      setUserLocation({
        lat: found.lat,
        lng: found.lng,
        name: found.name
      });
      setLocationError(null);
    }
  };

  // Chuẩn bị tin nhắn Zalo chốt điểm đón
  const targetPickupName = proximityResult?.waypoint?.name || tripFrom;
  const zaloProposalMsg = `Chào bạn, tôi thấy chuyến đi ${tripFrom} ➔ ${tripTo} của bạn trên CarMate. Chỗ tôi rất gần ${targetPickupName}${proximityResult ? ` (cách ~${proximityResult.formattedDistance})` : ''}. Bạn cho tôi ghép đón tại điểm này nhé!`;
  const zaloUrl = getZaloChatUrl(trip.phoneReal, zaloProposalMsg);

  return (
    <Modal
      onClose={onClose}
      size="lg"
      icon={MapPin}
      title="Bản Đồ Lộ Trình & Điểm Đón Thực Tế"
      subtitle={
        corridor
          ? `Hành lang ${corridor.name} · Cột mốc chi tiết & Định hình độ gần`
          : `Lộ trình ${tripFrom} ➔ ${tripTo}${waypointNote ? ` (${waypointNote})` : ''} · Kết nối trực tiếp`
      }
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-xl font-bold text-[#1d1d1f] dark:text-white tracking-tight leading-none">
              {formatVND(price)}
            </span>
            <span className="text-xs text-[#86868b] dark:text-slate-400">
              /người
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={zaloUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Nhắn tin trao đổi qua Zalo"
              className="h-10 px-3.5 rounded-xl font-medium text-xs text-[#0068ff] bg-[#0068ff]/10 hover:bg-[#0068ff]/15 border border-[#0068ff]/20 inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
            >
              <ZaloIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Nhắn Zalo</span>
            </a>

            <button
              type="button"
              onClick={() => {
                onClose();
                onBook(trip);
              }}
              className="h-10 px-5 rounded-xl font-semibold text-xs text-white bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] shadow-sm shadow-[#0071e3]/20 transition-all cursor-pointer active:scale-[0.98] shrink-0"
            >
              {isDriver ? 'Ghép chuyến này' : 'Đón khách này'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Bản đồ trực quan Leaflet */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-100 dark:bg-slate-900">
          <div ref={mapContainerRef} className="w-full h-64 sm:h-80 z-0" />

          {/* Huy hiệu hành lang tuyến nổi trên map */}
          <div className="absolute top-3 left-3 z-[1000] pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-semibold shadow-md flex items-center gap-1.5">
              <Navigation className="w-3 h-3 text-primary-400" />
              <span>{corridor?.highway || trip.waypointNote || 'Lộ trình di chuyển trực tiếp'}</span>
            </span>
          </div>
        </div>

        {/* CÔNG CỤ: KIỂM TRA ĐỘ GẦN "CÓ GẦN TÔI KHÔNG?" */}
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/90 dark:border-blue-900/60 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
              <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Kiểm tra độ gần với vị trí của bạn
              </p>
            </div>
            <span className="text-[11px] font-medium text-primary-700 dark:text-primary-300">
              Định vị tiện đường
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Xem xe này chạy ngang qua cách chỗ bạn bao xa để chốt điểm hẹn đón thuận tiện nhất:
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGetLiveGPS}
              disabled={locating}
              className="h-8 px-3 rounded-full text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white shadow-2xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{locating ? 'Đang lấy toạ độ GPS...' : '📍 Lấy vị trí GPS của tôi'}</span>
            </button>

            <span className="text-xs text-slate-400 font-medium">hoặc chọn điểm gần bạn:</span>

            <select
              value={selectedQuickStop}
              onChange={(e) => handleSelectQuickStop(e.target.value)}
              className="h-8 px-2.5 rounded-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <option value="">-- Chọn trạm gần bạn --</option>
              {mapWaypoints.map((w) => (
                <option key={w.name} value={w.name}>{w.name}</option>
              ))}
            </select>
          </div>

          {locationError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              ⚠️ {locationError}
            </p>
          )}

          {/* KẾT QUẢ SO SÁNH KHOẢNG CÁCH */}
          {proximityResult && (
            <div className="mt-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 flex items-start gap-3 shadow-xs">
              <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Cách bạn chỉ {proximityResult.formattedDistance}
                  </span>
                  {proximityResult.isWalkable ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                      Đi bộ được (~3p)
                    </span>
                  ) : proximityResult.isSuperClose ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                      Cực kỳ tiện đường
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                      Có thể đón dọc tuyến
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Trạm đón gần bạn nhất: <strong>{proximityResult.waypoint.name}</strong> ({proximityResult.waypoint.sub || 'Dọc tuyến'}).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* DANH SÁCH CỘT MỐC ĐÓN TRẢ THỰC TẾ DỌC TUYẾN */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Các điểm đón & cột mốc thực tế xe đi qua
          </p>

          <div className="space-y-2">
            {/* Điểm đón */}
            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-emerald-200/80 dark:border-emerald-900/50">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950 mt-1.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Điểm đón ban đầu:
                  </p>
                  <a
                    href={getGoogleMapsUrl(tripFrom || corridor?.startLandmark?.name)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-0.5 shrink-0"
                    title="Mở điểm đón trên Google Maps"
                  >
                    <span>Xem Google Maps</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isGoogleMapsUrl(tripFrom) ? '📍 Vị trí ghim trên Google Maps' : (tripFrom || corridor?.startLandmark?.name)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {corridor ? corridor.startLandmark.address : `Khu vực ${tripFrom} (Điểm đón do chủ xe & khách tự thỏa thuận)`}
                </p>
              </div>
            </div>

            {/* Điểm trả */}
            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-rose-200/80 dark:border-rose-900/50">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100 dark:ring-rose-950 mt-1.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
                    Điểm đến kết thúc:
                  </p>
                  <a
                    href={getGoogleMapsUrl(tripTo || corridor?.endLandmark?.name)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11.5px] font-semibold text-rose-700 dark:text-rose-300 hover:underline inline-flex items-center gap-0.5 shrink-0"
                    title="Mở điểm đến trên Google Maps"
                  >
                    <span>Xem Google Maps</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isGoogleMapsUrl(tripTo) ? '📍 Vị trí ghim trên Google Maps' : (tripTo || corridor?.endLandmark?.name)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {corridor ? corridor.endLandmark.address : `Khu vực ${tripTo} (Điểm trả đích đến theo thỏa thuận)`}
                </p>
              </div>
            </div>
          </div>

          {/* Các trạm trung gian hoặc trục đường tiện đón trả */}
          {waypointNote ? (
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Trục đường tiện đón trả dọc tuyến:
              </p>
              <div className="p-2.5 rounded-xl bg-primary-50/60 dark:bg-primary-950/30 border border-primary-200/60 dark:border-primary-900/40 text-xs text-primary-900 dark:text-primary-200 font-medium flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                <span>{waypointNote}</span>
              </div>
            </div>
          ) : corridor?.waypoints && corridor.waypoints.length > 2 ? (
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Trạm dừng / Điểm đón linh hoạt dọc Quốc lộ:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {corridor.waypoints.slice(1, -1).map((wp) => (
                  <span
                    key={wp.name}
                    className="px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
                  >
                    📍 {wp.name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                💡 Đón trả linh hoạt tại các điểm thuận đường di chuyển giữa {tripFrom} và {tripTo}.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
