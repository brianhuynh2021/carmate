import { getVirtualHubById, describeHub, normalizeTravelDate, getTravelWindow, normalizeConnectionTerms, projectToCorridorFrenet, getStationStationKm, computeEtaDistribution, etaQuantileSeconds } from '@carmate/shared';
import { getTrips, getBookings } from '../db/sqliteStore.js';
import { getActiveCockpitSessions, getStationQueue } from './stationQueueService.js';
import { evaluateConnection, connectionSegment } from './connectionMatching.js';
import { getTripAvailableSeatsForSegment } from './bookingCommitment.js';
import { getTripOperatorAttribution } from './operatorProfiles.js';

export const MATRIX_CONFIG = Object.freeze({ NEIGHBOR_WINDOW_MINUTES: 30, SLOT_WIDTH_MINUTES:30, MAX_SHADOW_SLOTS:0, MAX_FORMING_P80_MINUTES:120 });
export const TIMELINE_CONFIG = Object.freeze({MIN_TRIPS_FOR_TIMELINE:3, PERIODS:[
  {id:'early',label:'Sáng sớm',fromHour:0,toHour:6}, {id:'morning',label:'Buổi sáng',fromHour:6,toHour:12},
  {id:'afternoon',label:'Buổi chiều',fromHour:12,toHour:18}, {id:'evening',label:'Buổi tối',fromHour:18,toHour:24}
]});
const clock = ms => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms));
const maskPlate = value => String(value||'').replace(/[0-9]{2}$/,'xx');

function publicSlot(trip,match,request,bookings,live=null) {
  const terms=normalizeConnectionTerms(trip);
  const departureLabel=clock(Date.parse(match.pickupStartAt));
  const [h,m]=departureLabel.split(':').map(Number);
  const publicPhone=trip.publicContactConsent===true ? (trip.phoneReal||trip.phone||null) : null;
  const photos=(trip.carPhotos||trip.photos||[]).map(p=>typeof p==='string'?p:p?.url).filter(Boolean);
  return {
    ...getTripOperatorAttribution(trip),
    id:trip.id,tripId:trip.id,tier:live?'FORMING':'CONFIRMED',availabilityStatus:live?'moving':'listed',
    departureLabel,departureMinutes:h*60+m,departureDate:request.date,pickupStartAt:match.pickupStartAt,pickupEndAt:match.pickupEndAt,
    seatsAvailable:getTripAvailableSeatsForSegment(trip,request,bookings),totalSeats:Number(trip.capacity||0),
    driverName:trip.publicContactName||trip.publicName||'Chủ xe',vehicleModel:trip.carType||'',
    plateMasked:maskPlate(trip.licensePlate||trip.plateMask),plateType:trip.plateType||null,isServiceVehicle:trip.isServiceVehicle===true,
    publicContactPhone:publicPhone,publicContactName:publicPhone?(trip.publicContactName||'Chủ xe'):null,
    publicContactConsent:trip.publicContactConsent===true,maskedCode:trip.maskedCode||null,userId:trip.userId||null,
    photos,carPhotoUrl:photos[0]||null,carImage:photos[0]||null,amenities:trip.amenities||[],
    fromLocation:trip.from||'',toLocation:trip.to||'',originHubId:trip.originHubId,destinationHubId:trip.destinationHubId,
    requestedOriginHubId:request.originHubId,requestedDestinationHubId:request.destinationHubId,
    ...terms,pricePerSeat:terms.basePricePerSeat,totalPrice:match.totalPrice,totalPriceUnknown:terms.pricingMode==='contact',
    lastUpdatedAt:live?.lastPingAt||trip.updatedAt||trip.createdAt||null,etaUpdatedAt:live?.lastPingAt||null,
    certainty:null,assurance:{level:'UNCONFIRMED',label:'Cần xác nhận',score:null,canPromiseTime:false},
    promise:live?'Dự kiến qua điểm đón; chờ hai bên xác nhận.':'Chủ xe đã đăng lịch; chờ hai bên xác nhận.',
    note:match.reason,action:'REQUEST_PICKUP',actionLabel:'Gửi yêu cầu đón',requiresPickupAgreement:match.requiresPickupAgreement,
    rankingScore:match.score,platformFee:0,bookingConfirmed:false
  };
}

export function buildTimeSlotMatrix({originHubId,destinationHubId,date=null,timeSlot='all',seatsNeeded=1,corridor='Tuyến QL13',matchingPreference='balanced',nowMs=Date.now()}={}) {
  const origin=getVirtualHubById(originHubId),destination=getVirtualHubById(destinationHubId);
  if(!origin||!destination||originHubId===destinationHubId) return {success:false,error:'Chọn hai điểm đi và đến khác nhau.'};
  const seats=Number(seatsNeeded);
  if(!Number.isInteger(seats)||seats<1||seats>54) return {success:false,error:'Số người phải từ 1 đến 54.'};
  const request={originHubId,destinationHubId,date:normalizeTravelDate(date,nowMs),timeSlot:timeSlot||'all',seats,matchingPreference};
  const window=getTravelWindow(request,nowMs);
  if(!window) return {success:false,error:'Ngày hoặc khung giờ không hợp lệ.'};
  const bookings=getBookings();
  const trips=getTrips({type:'drivers',includeHidden:false,includeExpired:true}).filter(t=>!t.isHidden&&!t.isBanned&&['active','full'].includes(t.status||'active'));
  const slots=new Map();
  for(const trip of trips) {
    const match=evaluateConnection(trip,request,{nowMs,bookings});
    if(match) slots.set(trip.id,publicSlot(trip,match,request,bookings));
  }
  // Only recent telemetry tied to a real published trip can add an en-route result.
  if(request.date===normalizeTravelDate(null,nowMs)) for(const live of getActiveCockpitSessions()) {
    const ping=Number(live.lastPing||live.lastPingAt||live.updatedAt||live.lastTelemetryAt||0);
    if(live.isBanned||!ping||nowMs-ping>120000||ping>nowMs+10000) continue;
    const trip=trips.find(t=>t.id===live.tripId);
    if(!trip||!connectionSegment(trip,request)) continue;
    const current=projectToCorridorFrenet(live.lat,live.lng,live.corridor);
    const pickup=getStationStationKm(originHubId),dropoff=getStationStationKm(destinationHubId);
    if(!current.isOnCorridor||pickup==null||dropoff==null) continue;
    const direction=Math.sign(dropoff-pickup);
    if((pickup-current.s)*direction<0) continue;
    const eta=computeEtaDistribution({currentS:Math.min(current.s,pickup),targetS:Math.max(current.s,pickup),currentSpeedKmh:live.speed,nowMs});
    if(!eta.valid) continue;
    const etaStart=nowMs+Math.max(0,eta.muSeconds)*1000;
    const etaEnd=nowMs+etaQuantileSeconds(eta,0.8)*1000;
    if(etaEnd<window.start||etaStart>window.end||etaEnd-nowMs>MATRIX_CONFIG.MAX_FORMING_P80_MINUTES*60000) continue;
    if(getTripAvailableSeatsForSegment(trip,request,bookings)<seats) continue;
    const terms=normalizeConnectionTerms(trip);
    const match={pickupStartAt:new Date(Math.max(window.start,etaStart)).toISOString(),pickupEndAt:new Date(Math.min(window.end,etaEnd)).toISOString(),
      totalPrice:terms.basePricePerSeat==null?null:terms.basePricePerSeat*seats,requiresPickupAgreement:terms.pickupMode!=='station',
      score:(etaStart-nowMs)/60000+(terms.basePricePerSeat==null?50:terms.basePricePerSeat*seats/10000),reason:'Xe đang di chuyển; giờ qua điểm đón là dự kiến từ cập nhật vị trí gần nhất.'};
    slots.set(trip.id,publicSlot(trip,match,request,bookings,{...live,lastPingAt:ping}));
  }
  const all=[...slots.values()].sort((a,b)=>a.rankingScore-b.rankingScore||String(a.tripId).localeCompare(String(b.tripId)));
  const queue=getStationQueue(originHubId);
  return {success:true,origin:describeHub(origin),destination:describeHub(destination),corridor,date:request.date,seatsNeeded:seats,
    desiredTimeLabel:timeSlot&&timeSlot!=='all'?timeSlot:null,windowMinutes:0,tariff:null,backupCount:0,
    station:{waitingCount:queue.waitingCount||0,estimatedWaitMinutes:null},slots:all,
    counts:{confirmed:all.filter(s=>s.tier==='CONFIRMED').length,forming:all.filter(s=>s.tier==='FORMING').length,shadow:0,total:all.length},
    isEmpty:all.length===0,updatedAt:nowMs,rankingExplanation:'Các phương án hiện có được xếp theo thời gian và tổng giá; hai bên vẫn cần xác nhận.'};
}

export function buildCorridorTimeline(options={}) {
  const matrix=buildTimeSlotMatrix({...options,timeSlot:'all'});
  if(!matrix.success)return matrix;
  const periods=TIMELINE_CONFIG.PERIODS.map(p=>({...p,hint:`${p.fromHour}h–${p.toHour}h`,trips:matrix.slots.filter(s=>s.departureMinutes>=p.fromHour*60&&s.departureMinutes<p.toHour*60)})).map(p=>({...p,count:p.trips.length}));
  return {...matrix,periods,totalTrips:matrix.slots.length,isDense:matrix.slots.length>=3,minTripsForTimeline:3};
}
