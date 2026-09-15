import crypto from 'node:crypto';
import { VIRTUAL_HUBS, ROUTE_BENCHMARKS, calculateDistanceKm, calculateDynamicTariffByDistance } from '@carmate/shared';
import { getIntents, updateIntent, createMatchingEpoch, addBooking, getTrips, getBookings, updateBookingStatus } from '../db/sqliteStore.js';
import { evaluateConnection } from './connectionMatching.js';
import { dispatchNotification } from './notificationService.js';

export const ENGINE_CONFIG = { MICRO_BATCH_WINDOW_MS: 3*60000, CURBSIDE_WINDOW_SECONDS: 300,
  MAX_DETOUR_RATIO: 0.08, MAX_DOORSTEP_RADIUS_KM: 50, DOORSTEP_SURCHARGE: 0, COMPENSATION_RATIO: 0, STANDBY_TIME_WINDOW_MINS: 45 };

export function getCorridorDistanceKm(from, to, corridor = 'Tuyến QL13') {
  const match = value => VIRTUAL_HUBS.find(h => h.id === value || h.name === value || h.shortName === value);
  const a = match(from), b = match(to);
  return a && b ? Math.round(calculateDistanceKm(a.lat,a.lng,b.lat,b.lng)*1.28) : (ROUTE_BENCHMARKS[corridor]?.distanceKm || 0);
}

// Retained as an optional cost estimate for legacy callers. Never used to set a fare.
export function calculateShapleyFairPrice({ distanceKm, corridor = 'Tuyến QL13' }) {
  const estimate = calculateDynamicTariffByDistance(Math.max(0,Number(distanceKm)||0),{corridor});
  return { basePrice: estimate.pricePerSeat, finalPrice: estimate.pricePerSeat, doorstepSurcharge:0, compensationDiscount:0,
    distanceKm, isEstimate:true, breakdown:{ratePerKm:distanceKm ? Math.round(estimate.pricePerSeat/distanceKm):0,botProportion:estimate.botFee,isDoorstep:false} };
}

export function buildShareabilityGraph(driverOffers = [], passengerRequests = [], options = {}) {
  const drivers = driverOffers.map(d=>({id:d.id,userId:d.userId,name:d.publicContactName||d.authorName||'Chủ xe',phone:d.phoneReal||d.phone,
    capacity:Number(d.bookingSeatCapacity??d.availableSeats??d.seats??0),originHub:d.originHubId,destHub:d.destinationHubId,raw:d}));
  const passengers = passengerRequests.map(p=>({...p,id:p.id,userId:p.userId,phone:p.phone,name:p.contactName||'Khách',seatsNeeded:Number(p.seatsNeeded??p.seats??1),originHub:p.originHubId,destHub:p.destinationHubId,raw:p}));
  const edges=[];
  for(const p of passengers) for(const d of drivers) {
    const match=evaluateConnection(d.raw,p.raw,options);
    if(match) edges.push({...match,driverId:d.id,passengerId:p.id,affinityScore:10000-match.score,
      pricing:{finalPrice:match.pricePerSeat,totalPrice:match.totalPrice,pricingMode:match.pricingMode}});
  }
  edges.sort((a,b)=>a.score-b.score || String(a.driverId).localeCompare(String(b.driverId)));
  return {drivers,passengers,edges};
}

// Rank pending proposals. These are suggestions, with no reserved capacity and
// no claim of global optimality. Actual acceptance rechecks seats atomically.
export function galeShapleyStableMatch(graph) {
  const groups=new Map();
  let unmatched=0;
  for(const passenger of graph.passengers) {
    const edge=graph.edges.filter(e=>e.passengerId===passenger.id).sort((a,b)=>a.score-b.score)[0];
    if(!edge){unmatched++;continue;}
    const driver=graph.drivers.find(d=>d.id===edge.driverId);
    if(!groups.has(driver.id)) groups.set(driver.id,{driver:{...driver,remainingSeats:driver.capacity},passengers:[],totalSeatsTaken:0,totalFare:0});
    const group=groups.get(driver.id);
    group.passengers.push({...passenger,pricing:edge.pricing,connection:edge});
    group.totalFare+=edge.totalPrice||0;
  }
  const matchedClusters=[...groups.values()];
  return {matchedClusters,totalMatchedDrivers:matchedClusters.length,totalMatchedPassengers:matchedClusters.reduce((n,c)=>n+c.passengers.length,0),unmatchedPassengersCount:unmatched};
}

export function findStandbyBufferOffer(request,candidateOffers=[]) {
  const bookings=getBookings();
  const input={...request,originHubId:request.originHubId||request.committedTerms?.originHubId,
    destinationHubId:request.destinationHubId||request.committedTerms?.destinationHubId,
    seats:request.seats||request.seatsNeeded||1};
  return candidateOffers.filter(t=>t.id!==request.tripId).map(trip=>({trip,match:evaluateConnection(trip,input,{bookings})}))
    .filter(row=>row.match).sort((a,b)=>a.match.score-b.match.score).map(row=>({...row.trip,connection:row.match}))[0]||null;
}

let epochRunning=false;
export async function runBatchMatchingEpoch({epochType='micro_batch',corridor=null,date=null}={}) {
  if(epochRunning) return {success:true,skipped:true};
  epochRunning=true;
  try {
    const now=Date.now();
    const allIntents=getIntents({role:'passenger'});
    const bookings=getBookings();
    for(const i of allIntents) if(['pending','proposed'].includes(i.status) && !bookings.some(b=>b.requestId===i.id&&b.bothConfirmed) && Number(i.expiresAt||i.originalDeadlineAt||0)<=now) {
      await updateIntent(i.id,{status:'expired',needStatus:'closed'});
    }
    const requests=allIntents.filter(i=>['pending','proposed'].includes(i.status) && i.needStatus!=='closed' && Number(i.expiresAt||i.originalDeadlineAt)>now && i.publishDemandConsent===true && (!corridor||i.corridor===corridor) && (!date||i.date===date));
    const offers=getTrips({type:'drivers',includeHidden:false}).filter(t=>['active','full'].includes(t.status||'active') && !t.isBanned && !t.isHidden);
    const eligible=requests.filter(i=>!bookings.some(b=>b.requestId===i.id && b.needStatus!=='closed' && !['cancelled','expired','completed'].includes(b.status)));
    const graph=buildShareabilityGraph(offers,eligible,{nowMs:now,bookings});
    const result=galeShapleyStableMatch(graph);
    for(const cluster of result.matchedClusters) for(const p of cluster.passengers) {
      const trip=cluster.driver.raw;
      const id=`CX-${crypto.randomUUID()}`;
      const booking=await addBooking({escrowId:id,tripId:trip.id,targetTripId:trip.id,driverId:trip.userId,driverPhone:trip.phoneReal||trip.phone,
        userId:p.userId,creatorId:p.userId,passengerId:p.userId,creatorPhone:p.phone,passengerPhone:p.phone,userPhone:p.phone,
        passengerName:p.name,driverName:cluster.driver.name,requestId:p.id,from:p.raw.originName,to:p.raw.destinationName,
        originHubId:p.originHub,destinationHubId:p.destHub,
        pickupPoint:p.pickupMode==='doorstep' ? (p.pickupNotes||p.doorstepAddress||p.raw.originName) : p.raw.originName,
        pickupNotes:p.pickupNotes||'',date:p.date,timeSlot:p.timeSlot,seats:p.seatsNeeded,
        originalRequestedAt:p.originalRequestedAt||p.createdAt,originalDeadlineAt:p.originalDeadlineAt||p.expiresAt,
        latestArrivalAt:p.latestArrivalAt||null,expiresAt:p.expiresAt,pickupMode:p.pickupMode||'station',
        pricingMode:p.pricing.pricingMode,totalDeal:p.pricing.totalPrice,price:p.pricing.totalPrice,finalPrice:p.pricing.finalPrice,
        pickupStartAt:p.connection.pickupStartAt,pickupEndAt:p.connection.pickupEndAt,
        status:'inquiring',inquiryExpiresAt:Math.min(now+5*60000,Number(p.expiresAt)),needStatus:'open',bothConfirmed:false,seatReserved:false,platformFee:0,platformCollected:0,createdAt:now,
        messages:[{id:crypto.randomUUID(),role:'system',text:'Có phương án phù hợp. Hai bên cần thống nhất điểm, giờ và tổng giá trước khi xác nhận.',timestamp:now}]});
      await updateIntent(p.id,{status:'proposed',matchedTripId:trip.id,matchedBookingId:booking.escrowId||booking.id});
      for(const recipient of [{phone:p.phone,userId:p.userId},{phone:trip.phoneReal||trip.phone,userId:trip.userId}]) {
        await dispatchNotification({...recipient,kind:'connection_proposal',title:'Có đề nghị chuyến đi phù hợp',body:'Mở CarMate để xem và xác nhận điều kiện cuộc hẹn.',url:'/?tab=booked',data:{bookingId:id}}).catch(()=>{});
      }
    }
    // A cancelled car keeps the original booking/request clock. Recompute only
    // candidate information; never dispatch or confirm a replacement here.
    for(const b of bookings.filter(b=>b.needsReplacement&&b.needStatus==='open')) {
      if(Number(b.originalDeadlineAt||b.expiresAt||0)<=now) {
        await updateBookingStatus(b.escrowId||b.id,'expired',{needStatus:'closed',needsReplacement:false});continue;
      }
      const candidates=offers.filter(t=>t.id!==b.tripId).map(trip=>({trip,match:evaluateConnection(trip,b,{nowMs:now,bookings})})).filter(x=>x.match).sort((a,b)=>a.match.score-b.match.score).slice(0,3);
      await updateBookingStatus(b.escrowId||b.id,b.status,{recoveryCandidates:candidates.map(({trip,match})=>({tripId:trip.id,id:trip.id,driverName:trip.publicContactName||'Chủ xe',vehicleModel:trip.carType||'',pricingMode:match.pricingMode,pricePerSeat:match.pricePerSeat,totalPrice:match.totalPrice,pickupStartAt:match.pickupStartAt,pickupEndAt:match.pickupEndAt,publicContactPhone:trip.publicContactConsent?trip.phoneReal:null})),supportDispatched:false,recoveryUpdatedAt:now});
    }
    const record=await createMatchingEpoch({epochType,corridor:corridor||'Toàn sàn',matchedCount:result.totalMatchedPassengers,driverCount:result.totalMatchedDrivers,passengerCount:eligible.length,summary:{proposalCount:result.totalMatchedPassengers,timestamp:now}});
    return {success:true,epochId:record.id,epochType,totalMatchedDrivers:result.totalMatchedDrivers,totalMatchedPassengers:result.totalMatchedPassengers,matchedClustersCount:result.totalMatchedDrivers,matchedPassengersCount:result.totalMatchedPassengers,unmatchedCount:result.unmatchedPassengersCount};
  } finally {epochRunning=false;}
}
