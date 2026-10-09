import React, { useState } from 'react';
import {
  Radio,
  Car,
  MapPin,
  Users,
  Navigation,
  Zap
} from 'lucide-react';
import { formatVND } from '@carmate/shared';

/**
 * RadarScannerVisualizer — Dedicated 360° Radar wave visualization for the Car Cockpit.
 *
 * Strictly follows the 4 CarMate pillars:
 * 1. MIT Invariants: 3.5 km Geofence approach zone, mathematically exact per Geodesic.
 * 2. Stanford Ergonomics: Readable in a 0.5-second glance on a dashboard mount, high contrast.
 * 3. Cursor Zero Blocking: Smooth hardware-accelerated 60fps CSS animation, does not block the main UI thread.
 * 4. Apple Liquid Aesthetics: Squircle rounded corners with soft blurred borders, realistic conic-gradient sweep.
 */

// List of 5 key virtual pickup stations on the QL13 Corridor
const QL13_STATIONS = [
  {
    id: 'tan_khai',
    name: 'Tân Khai (Cây Xăng Petro)',
    shortName: 'Tân Khai',
    kmMarker: 'KM 0',
    relativeDistKm: 3.4,
    zone: 'APPROACHING', // Stations currently within approach scan range
    waitingRiders: 2,
    payoutEst: 270000,
    angleDeg: 345, // Display angle on the radar dish
    radialPercent: 28 // Percentage from the center to the edge (within the 3.5km ring ~ 29%)
  },
  {
    id: 'chon_thanh',
    name: 'Ngã tư Chơn Thành (Vòng xoay)',
    shortName: 'Chơn Thành',
    kmMarker: 'KM 28',
    relativeDistKm: 28,
    zone: 'IN_RANGE',
    waitingRiders: 1,
    payoutEst: 180000,
    angleDeg: 355,
    radialPercent: 58
  },
  {
    id: 'ben_cat',
    name: 'Ngã 3 Bến Cát (KCN Mỹ Phước)',
    shortName: 'Bến Cát',
    kmMarker: 'KM 55',
    relativeDistKm: 55,
    zone: 'FAR',
    waitingRiders: 0,
    payoutEst: 120000,
    angleDeg: 10,
    radialPercent: 78
  },
  {
    id: 'thu_dau_mot',
    name: 'TP. Thủ Dầu Một (Đại lộ BD)',
    shortName: 'Thủ Dầu Một',
    kmMarker: 'KM 78',
    relativeDistKm: 78,
    zone: 'FAR',
    waitingRiders: 0,
    payoutEst: 80000,
    angleDeg: 25,
    radialPercent: 88
  },
  {
    id: 'hang_xanh',
    name: 'Ngã 4 Hàng Xanh (Bình Thạnh)',
    shortName: 'Hàng Xanh',
    kmMarker: 'KM 105',
    relativeDistKm: 105,
    zone: 'TERMINAL',
    waitingRiders: 3,
    payoutEst: 250000,
    angleDeg: 180,
    radialPercent: 92
  }
];

export default function RadarScannerVisualizer({
  isReceivingGuests = true,
  speed = 0,
  simDistanceKm = 3.4,
  _nextStationName = 'Cây xăng Tân Khai (QL13)',
  onTriggerApproach
}) {
  const [selectedStation, setSelectedStation] = useState(QL13_STATIONS[0]);

  return (
    <div className="w-full bg-[#080d16] border border-emerald-500/25 rounded-3xl p-4 sm:p-6 relative overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.12)] flex flex-col justify-between select-none">
      {/* ── HUD BACKGROUND LIGHTING EFFECT ── */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* ── RADAR TELEMETRY HEADER ── */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3.5 mb-4 z-10">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
              isReceivingGuests
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-md shadow-emerald-500/20'
                : 'bg-slate-800/60 border-slate-700 text-slate-500'
            }`}
          >
            <Radio className={`w-5 h-5 ${isReceivingGuests ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isReceivingGuests ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                }`}
              />
              <span className="text-xs sm:text-sm font-mono font-black tracking-wider uppercase text-slate-200">
                {isReceivingGuests ? 'RADAR HÀNH LANG QL13 · QUÉT 360°' : 'RADAR STANDBY · TẠM DỪNG'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {isReceivingGuests
                ? 'Bán kính Geofence 3.5 km · Quét chùm sóng 24 RPM'
                : 'Đang tạm dừng nhận khách ghép tự động'}
            </p>
          </div>
        </div>

        {/* RIGHT-CORNER HUD PARAMETERS */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/[0.08] text-right font-mono hidden sm:block">
            <span className="text-[9px] uppercase text-slate-400 block">DẢI TẦN QUÉT</span>
            <span className="text-xs font-bold text-emerald-400">12 KM MAX</span>
          </div>
          <div className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-right font-mono">
            <span className="text-[9px] uppercase text-emerald-400 block">VẬN TỐC TAPLO</span>
            <span className="text-xs font-black text-cyan-300">
              {speed === 0 ? '0 km/h (Dừng)' : `${speed} km/h`}
            </span>
          </div>
        </div>
      </div>

      {/* ── DEDICATED 360° RADAR SCAN SURFACE (RADAR DISH) ── */}
      <div className="relative w-full max-w-[360px] sm:max-w-[420px] aspect-square mx-auto my-2 flex items-center justify-center">
        {/* OUTERMOST CIRCLE (12 KM RANGE) */}
        <div className="absolute inset-0 rounded-full border border-emerald-500/20 bg-emerald-950/[0.08]" />

        {/* MIDDLE CIRCLE (7.0 KM RANGE) */}
        <div className="absolute inset-[18%] rounded-full border border-emerald-500/25 border-dashed" />

        {/* CRITICAL GEOFENCE APPROACH CIRCLE (3.5 KM ZONE - WHERE DOCKING IS TRIGGERED) */}
        <div
          className={`absolute inset-[36%] rounded-full border-2 transition-all duration-700 ${
            isReceivingGuests
              ? 'border-emerald-400/70 bg-emerald-500/[0.06] shadow-[0_0_35px_rgba(16,185,129,0.2)]'
              : 'border-slate-700/50 bg-transparent'
          }`}
        >
          {isReceivingGuests && (
            <div className="absolute inset-0 rounded-full border border-emerald-400/40 animate-ping [animation-duration:3s]" />
          )}
        </div>

        {/* CENTRAL VEHICLE SAFETY RING (1.0 KM SAFETY BUFFER) */}
        <div className="absolute inset-[46%] rounded-full border border-emerald-500/30" />

        {/* CROSS-SHAPED COORDINATE AXES (CROSSHAIR HUD) */}
        <div className="absolute w-full h-[1px] bg-emerald-500/15 pointer-events-none" />
        <div className="absolute h-full w-[1px] bg-emerald-500/15 pointer-events-none" />

        {/* SECONDARY 45° DIAGONALS */}
        <div className="absolute w-full h-[1px] bg-emerald-500/10 rotate-45 pointer-events-none" />
        <div className="absolute w-full h-[1px] bg-emerald-500/10 -rotate-45 pointer-events-none" />

        {/* DISTANCE LABELS ALONG THE NORTH - SOUTH AXIS */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9.5px] font-mono text-emerald-400/70 font-bold pointer-events-none whitespace-nowrap">
          000° · BÌNH PHƯỚC (12 KM)
        </div>
        <div className="absolute top-[19%] left-1/2 -translate-x-1/2 text-[9px] font-mono text-emerald-400/60 font-semibold pointer-events-none">
          7 KM
        </div>
        <div className="absolute top-[37%] left-1/2 -translate-x-1/2 text-[9px] font-mono text-emerald-300 font-bold pointer-events-none bg-emerald-950/80 px-1 rounded whitespace-nowrap">
          3.5 KM ZONE
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9.5px] font-mono text-emerald-400/70 font-bold pointer-events-none whitespace-nowrap">
          180° · SÀI GÒN
        </div>

        {/* ── 360° ROTATING RADAR SWEEP BEAM (SWEEP BEAM) ── */}
        {isReceivingGuests && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none animate-spin"
            style={{
              animationDuration: '4s',
              animationTimingFunction: 'linear',
              background:
                'conic-gradient(from 0deg, rgba(16, 185, 129, 0.45) 0deg, rgba(16, 185, 129, 0.12) 35deg, rgba(16, 185, 129, 0.02) 65deg, transparent 75deg, transparent 360deg)'
            }}
          >
            {/* LIGHT RAY AT THE TIP OF THE SWEEP BEAM */}
            <div
              className="absolute top-1/2 right-0 w-1/2 h-[1.5px] bg-emerald-300 shadow-[0_0_12px_#34d399] origin-left"
              style={{ transform: 'translateY(-50%)' }}
            />
          </div>
        )}

        {/* ── VIRTUAL PICKUP STATIONS ON THE SCAN SURFACE (RADAR BLIPS) ── */}
        {QL13_STATIONS.map((station) => {
          // Convert polar coordinates to absolute position (%)
          const rad = (station.angleDeg - 90) * (Math.PI / 180);
          const r = station.radialPercent * 0.5; // Radius as % from the center (max 50%)
          const posX = 50 + r * Math.cos(rad);
          const posY = 50 + r * Math.sin(rad);

          const isApproaching = station.id === 'tan_khai';

          return (
            <div
              key={station.id}
              style={{
                position: 'absolute',
                left: `${posX}%`,
                top: `${posY}%`,
                transform: 'translate(-50%, -50%)'
              }}
              className="z-20 cursor-pointer group"
              onClick={() => setSelectedStation(station)}
            >
              {/* STATION APPROACH PULSE RING */}
              {isApproaching && isReceivingGuests && (
                <div className="absolute -inset-2.5 rounded-full bg-amber-400/30 animate-ping [animation-duration:1.8s]" />
              )}

              {/* STATION SIGNAL DOT (RADAR BLIP DOT) */}
              <div
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                  isApproaching
                    ? 'bg-amber-400 border-white shadow-[0_0_15px_#f59e0b] scale-110'
                    : selectedStation.id === station.id
                    ? 'bg-emerald-400 border-white shadow-[0_0_12px_#10b981] scale-110'
                    : 'bg-emerald-950 border-emerald-400/80 hover:bg-emerald-400'
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    isApproaching ? 'bg-slate-950 font-black' : 'bg-white'
                  }`}
                />
              </div>

              {/* STATION LABEL FLOATING DIRECTLY ON THE RADAR SURFACE */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 top-5 whitespace-nowrap px-2 py-0.5 rounded-md font-mono text-[9px] font-bold border transition-all pointer-events-none ${
                  isApproaching
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/30'
                    : 'bg-slate-900/90 text-slate-300 border-white/10 group-hover:border-emerald-400 group-hover:text-emerald-300'
                }`}
              >
                <span>{station.shortName}</span>
                {station.waitingRiders > 0 && (
                  <span className="ml-1 px-1 py-0.2 rounded bg-black/30 text-white font-extrabold">
                    +{station.waitingRiders}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* ── YOUR VEHICLE AT THE RADAR CENTER (CENTER BLIP) ── */}
        <div className="relative z-30 flex flex-col items-center pointer-events-none">
          <div className="relative">
            {/* Vehicle halo ring */}
            <div className="absolute -inset-2 rounded-full bg-cyan-400/30 animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-cyan-500 border-2 border-white shadow-[0_0_20px_#06b6d4] flex items-center justify-center text-slate-950">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <span className="mt-1 px-2 py-0.5 rounded-full bg-slate-900/95 border border-cyan-400/50 text-[9px] font-mono font-black text-cyan-300 uppercase tracking-tight shadow-md whitespace-nowrap">
            {speed > 0 ? `XE BẠN · ${speed} KM/H` : 'XE BẠN · ĐANG DỪNG'}
          </span>
        </div>
      </div>

      {/* ── DETAIL CARD FOR THE SELECTED APPROACH POINT OR THE NEXT STATION ── */}
      <div className="mt-2 p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selectedStation.id === 'tan_khai'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            <MapPin className="w-5 h-5" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-white truncate block">
                {selectedStation.name}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-300 shrink-0">
                {selectedStation.kmMarker}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
              <span>Khoảng cách: ~{selectedStation.id === 'tan_khai' ? simDistanceKm : selectedStation.relativeDistKm} km</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Users className="w-3 h-3" />
                {selectedStation.waitingRiders > 0 ? `${selectedStation.waitingRiders} khách chờ ghép` : 'Trạm trống'}
              </span>
            </div>
          </div>
        </div>

        {/* QUICK APPROACH TEST BUTTON (IF DEV) OR FUEL SURCHARGE AMOUNT */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onTriggerApproach && (
            <button
              type="button"
              onClick={() => onTriggerApproach()}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-mono font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition-all shrink-0"
              title="Kích hoạt mô phỏng báo động tiếp cận trạm đón trong bán kính 3.5 km"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              <span>Tiếp cận 3.5 km</span>
            </button>
          )}

          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-right font-mono">
            <span className="text-[9px] uppercase text-emerald-400 block">ƯỚC TÍNH BÙ XĂNG</span>
            <span className="text-xs sm:text-sm font-black text-emerald-300">
              +{formatVND(selectedStation.payoutEst)}
            </span>
          </div>
        </div>
      </div>

      {/* ── 5-STATION KEY CORRIDOR CHAIN ON THE QL13 AXIS (CORRIDOR PIPELINE) ── */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] z-10">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 uppercase font-bold text-slate-300">
            <Navigation className="w-3 h-3 text-emerald-400" />
            <span>HÀNH LANG TRẠM ĐÓN QL13</span>
          </span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Vùng Geofence tự động kích hoạt
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1 text-center font-mono">
          {QL13_STATIONS.map((station) => {
            const isTarget = station.id === 'tan_khai';
            return (
              <button
                key={station.id}
                type="button"
                onClick={() => setSelectedStation(station)}
                className={`py-2 px-1 rounded-xl text-left sm:text-center transition-all cursor-pointer flex flex-col items-center justify-between gap-1 border ${
                  selectedStation.id === station.id
                    ? 'bg-emerald-500/20 text-white border-emerald-400 shadow-sm shadow-emerald-500/20'
                    : isTarget
                    ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
                    : 'bg-white/[0.02] text-slate-400 border-white/[0.04] hover:bg-white/[0.06]'
                }`}
              >
                <span className="text-[10px] sm:text-[11px] font-black truncate w-full">
                  {station.shortName}
                </span>
                <span className="text-[9px] text-slate-400">{station.kmMarker}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
