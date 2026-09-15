import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carmate-commitment-'));
process.env.CARMATE_DATA_DIR = testDir;
process.env.SEED_DEMO_DATA = 'false';
const store = await import('../apps/api/src/db/sqliteStore.js');
const lifecycle = await import('../apps/api/src/services/bookingCommitment.js');
const station = await import('../apps/api/src/services/stationQueueService.js');
const watchdog = await import('../apps/api/src/services/departureWatchdog.js');
await store.initDB();
let db = store.getRawDB();
const NOW = Date.now();
const driver = { id: 'driver-a', phone: '0931234567' };
const driverB = { id: 'driver-b', phone: '0931234568' };
const passenger = { id: 'passenger-a', phone: '0931234569' };
const other = { id: 'other-person', phone: '0931234570' };
const A = 'hub_ql13_tan_khai', B = 'hub_ql13_nga4_chon_thanh', C = 'hub_ql13_hang_xanh';
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`✓ ${name}`); };
const iso = (offset) => new Date(NOW + offset * 60_000).toISOString();

function seedTrip(id, owner = driver, extra = {}) {
  const trip = { id, type: 'driver_offer', status: 'active', userId: owner.id, phoneReal: owner.phone,
    originHubId: A, destinationHubId: C, from: 'Tân Khai', to: 'Hàng Xanh',
    availableSeats: 2, pricingMode: 'listed', basePricePerSeat: 100000, pickupMode: 'station', maxDetourKm: 0,
    date: iso(0).slice(0,10), ...extra };
  db.prepare('INSERT INTO trips (id,type,status,seats,userId,phoneReal,createdAt,payload) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, trip.type, trip.status, trip.availableSeats, owner.id, owner.phone, NOW, JSON.stringify(trip));
  return trip;
}
async function seedBooking(id, tripId, extra = {}) {
  return store.addBooking({ escrowId: id, tripId, requestId: id, passengerId: passenger.id, userId: passenger.id,
    driverId: driver.id, driverPhone: driver.phone, passengerPhone: passenger.phone,
    from: 'Tân Khai', to: 'Chơn Thành', originHubId: A, destinationHubId: B, seats: 2,
    pickupStartAt: iso(30), pickupEndAt: iso(40), totalDeal: 200000,
    originalRequestedAt: NOW-600000, originalDeadlineAt: NOW+3*3600000,
    status: 'inquiring', needStatus: 'open', seatReserved: false, bothConfirmed: false, ...extra });
}
const propose = (bookingId, user = driver, options = {}) => lifecycle.proposeAppointment({ bookingId, user, nowMs: NOW, ...options });
const confirm = (bookingId, proposal, user = passenger) => lifecycle.confirmAppointment({ bookingId, user, proposalVersion: proposal.proposalVersion, nowMs: NOW+1 });

try {
  seedTrip('vehicle-a'); seedTrip('vehicle-b', driverB);
  await seedBooking('first', 'vehicle-a');
  check('A pending inquiry does not reserve seats', () => assert.equal(lifecycle.getTripAvailableSeatsForSegment(store.getTripById('vehicle-a'), { originHubId:A,destinationHubId:B }),2));
  check('An outsider cannot propose even with a copied phone', () => assert.throws(() => propose('first',{...other,phone:driver.phone}),{status:403}));
  const first = propose('first');
  check('The proposer cannot confirm both sides', () => assert.throws(() => confirm('first',first,driver),{status:409}));
  check('An obsolete proposal cannot be accepted', () => assert.throws(() => lifecycle.confirmAppointment({bookingId:'first',user:passenger,proposalVersion:'old',nowMs:NOW}),{status:409}));
  const committed = confirm('first',first);
  check('Counterparty confirms exactly the offered terms', () => { assert.equal(committed.bothConfirmed,true); assert.deepEqual(committed.committedTerms,first.proposalTerms); });
  check('Retry confirmation does not consume another seat', () => { confirm('first',first); assert.equal(store.getTripById('vehicle-a').availableSeats,0); });
  check('Confirmed appointments cannot be silently reproposed', () => assert.throws(() => propose('first'),{status:409}));
  await seedBooking('overlap','vehicle-a',{originHubId:A,destinationHubId:C,seats:1});
  check('An overlapping segment cannot exceed capacity', () => assert.throws(() => propose('overlap'),{status:409}));
  await seedBooking('after-dropoff','vehicle-a',{originHubId:B,destinationHubId:C,seats:2});
  const second = propose('after-dropoff'); confirm('after-dropoff',second);
  check('The same seats can serve the next nonoverlapping segment', () => assert.equal(store.getBookings().filter(b=>b.tripId==='vehicle-a'&&b.bothConfirmed).length,2));
  await seedBooking('same-request','vehicle-b',{requestId:'first',driverId:driverB.id,driverPhone:driverB.phone,seats:1});
  const duplicated = propose('same-request',driverB);
  check('One request cannot confirm two vehicles', () => assert.throws(()=>confirm('same-request',duplicated),{status:409}));
  const cancelled = lifecycle.cancelAppointment({bookingId:'first',user:driver,reason:'Vehicle unavailable',nowMs:NOW+120000});
  check('Driver cancellation keeps original clock and unresolved need',()=>{
    assert.equal(cancelled.originalRequestedAt,NOW-600000); assert.equal(cancelled.originalDeadlineAt,NOW+3*3600000);
    assert.equal(cancelled.needsReplacement,true); assert.equal(cancelled.bothConfirmed,false); assert.equal(cancelled.supportDispatched,false);
  });
  lifecycle.cancelAppointment({bookingId:'first',user:driver,nowMs:NOW+130000});
  check('Repeated cancellation releases only its own segment once',()=>{
    assert.equal(lifecycle.getTripAvailableSeatsForSegment(store.getTripById('vehicle-a'),{originHubId:A,destinationHubId:B}),2);
    assert.equal(lifecycle.getTripAvailableSeatsForSegment(store.getTripById('vehicle-a'),{originHubId:B,destinationHubId:C}),0);
  });
  const replacement = propose('first',driverB,{replacementTripId:'vehicle-b',terms:{totalPrice:210000}});
  check('Replacement proposal alone is not dispatched or confirmed',()=>{assert.equal(replacement.bothConfirmed,false);assert.equal(replacement.tripId,'vehicle-a');assert.equal(replacement.proposalTerms.tripId,'vehicle-b');});
  const recovered = confirm('first',replacement);
  check('Replacement needs the passenger and uses its explicit new price',()=>{assert.equal(recovered.tripId,'vehicle-b');assert.equal(recovered.totalDeal,210000);assert.equal(recovered.needsReplacement,false);assert.equal(recovered.originalDeadlineAt,NOW+3*3600000);});
  lifecycle.cancelAppointment({bookingId:'first',user:passenger,nowMs:NOW+140000});
  check('Passenger no-longer-going stops recovery and closes sibling proposals',()=>{
    assert.equal(store.getBookingById('first').needStatus,'closed');assert.equal(store.getBookingById('same-request').needStatus,'closed');
  });
  seedTrip('contact',driver,{pricingMode:'contact',basePricePerSeat:null});
  await seedBooking('no-price','contact',{totalDeal:null});
  check('Contact-price proposals require an explicit total, not an algorithm fare',()=>assert.throws(()=>propose('no-price'),{status:400}));
  check('A recovery proposal cannot reset the original pickup deadline',()=>assert.throws(()=>propose('no-price',driver,{terms:{totalPrice:0,pickupStartAt:iso(200),pickupEndAt:iso(210)}}),{status:409}));
  const noPrice = propose('no-price',driver,{terms:{totalPrice:0}});
  check('A legitimately agreed zero fare is valid',()=>assert.equal(noPrice.proposalTerms.totalPrice,0));
  await seedBooking('pending-watch','contact',{pickupStartAt:iso(20),pickupEndAt:iso(25)});
  check('Watchdog does not turn an unconfirmed request into a threatened appointment',()=>assert.equal(watchdog.evaluateDepartureCheckpoints({nowMs:NOW}).some(a=>a.booking.escrowId==='pending-watch'),false));
  await watchdog.activateRescueMode({bookingId:'after-dropoff',reason:'NO_GPS_SIGNAL',lifebuoys:[],nowMs:NOW});
  check('Missing GPS raises a flag without fabricating replacement acceptance',()=>{const b=store.getBookingById('after-dropoff');assert.equal(b.status,'confirmed');assert.equal(b.rescueMode,true);assert.equal(b.supportDispatched,false);});

  // Real station acceptance uses the same SQLite reservation ledger.
  seedTrip('station-car',driver,{availableSeats:1});
  const stationPassenger={id:'station-passenger',phone:'0931234571'};
  const checked = station.riderCheckIn({hubId:A,destinationHubId:B,seatsNeeded:1,userId:stationPassenger.id,phone:stationPassenger.phone,
    name:'Station test',pickupEndAt:iso(170)});
  assert.equal(checked.success,true);
  const rider = checked.intent;
  const ping=station.telemetryPing({tripId:'station-car',driverPhone:driver.phone,destinationHubId:C,seatsAvailable:1,lat:11.565,lng:106.633,speed:50});
  check('Telemetry proposes an actual feasible remaining route',()=>{assert.equal(ping.success,true);assert.equal(ping.proximityAlert?.intentId,rider.intentId);});
  const accepted = station.driverAcceptOffer({tripId:'station-car',intentId:rider.intentId,user:driver});
  check('Driver acceptance still waits for passenger acceptance',()=>{assert.equal(accepted.success,true,accepted.error);assert.equal(accepted.rider.pin,undefined);assert.equal(rider.status,'OFFERED');assert.equal(store.getTripById('station-car').availableSeats,1);});
  const riderAccepted=station.riderAcceptStationOffer({intentId:rider.intentId,proposalVersion:rider.proposalVersion,user:stationPassenger});
  check('Passenger acceptance persists a confirmed appointment and seat',()=>{assert.equal(riderAccepted.success,true,riderAccepted.error);assert.equal(rider.status,'ARRIVING');assert.equal(store.getTripById('station-car').availableSeats,0);});
  const onboard=station.driverVerifyPin({tripId:'station-car',intentId:rider.intentId,pin:rider.pin,user:driver});
  check('PIN confirms only this assigned vehicle and is idempotent',()=>{
    assert.equal(onboard.success,true,onboard.error);
    assert.equal(station.driverVerifyPin({tripId:'vehicle-b',intentId:rider.intentId,pin:rider.pin,user:driverB}).success,false);
    assert.equal(station.driverVerifyPin({tripId:'station-car',intentId:rider.intentId,pin:rider.pin,user:driver}).alreadyBoarded,true);
  });
  const pinBeforeRestart = rider.pin;
  store.closeDB(); await store.initDB(); db = store.getRawDB();
  check('Restart restores the rider, PIN, and onboard appointment',()=>{
    const restored=station.getRiderPass(rider.intentId);
    assert.equal(restored.success,true); assert.equal(restored.intent.status,'BOARDED'); assert.equal(restored.intent.pin,pinBeforeRestart);
    assert.equal(restored.intent.originalRequestedAt,rider.originalRequestedAt);
  });
  check('Restart never treats old vehicle telemetry as fresh',()=>{
    assert.equal(station.getActiveCockpitSessions().some(s=>s.tripId==='station-car'),false);
    const saved=JSON.parse(db.prepare("SELECT payload FROM station_state WHERE kind='session' AND id='station-car'").get().payload);
    assert.equal(saved.lat,undefined);assert.equal(saved.lng,undefined);assert.equal(saved.lastPing,undefined);
  });
  station.telemetryPing({tripId:'station-car',driverPhone:driver.phone,destinationHubId:C,seatsAvailable:0,lat:11.4791,lng:106.6694,speed:0});
  const dropped=station.driverCompleteDropoff({tripId:'station-car',intentId:rider.intentId,user:driver});
  check('Drop-off releases the segment and keeps the vehicle running',()=>{assert.equal(dropped.success,true,dropped.error);assert.equal(store.getTripById('station-car').availableSeats,1);assert.equal(station.getActiveCockpitSessions().find(s=>s.tripId==='station-car').status,'ACTIVE_SCANNING');});
  const kept=station.riderCheckIn({hubId:A,destinationHubId:B,seatsNeeded:1,userId:stationPassenger.id,phone:stationPassenger.phone,pickupEndAt:iso(170)}).intent;
  const oldTime=kept.originalRequestedAt;
  station.cancelRiderIntent(kept.intentId,'Change vehicle',{user:stationPassenger,keepNeed:true});
  check('Station recovery preserves the original request time',()=>{assert.equal(kept.status,'WAITING');assert.equal(kept.originalRequestedAt,oldTime);});
  check('A station-only vehicle cannot be proposed for doorstep pickup',()=>assert.throws(()=>propose('no-price',driver,{terms:{totalPrice:0,pickupMode:'doorstep'}}),{status:400}));
  check('A proposed passenger segment must follow the vehicle direction',()=>assert.throws(()=>propose('no-price',driver,{terms:{totalPrice:0,originHubId:B,destinationHubId:A}}),{status:400}));
  const beforeVehicleChange=propose('no-price',driver,{terms:{totalPrice:0}});
  await store.updateTrip('contact',{licensePlate:'TEST-CHANGED'});
  check('Changing a vehicle after proposal requires a new confirmation',()=>assert.throws(()=>confirm('no-price',beforeVehicleChange),{status:409}));
  const { expireUnansweredInquiries } = await import('../apps/api/src/services/scheduler.js');
  await seedBooking('expires-inquiry','contact',{ requestId:'intent-expiry', inquiryExpiresAt: NOW-1 });
  const waitingIntent={id:'intent-expiry',role:'passenger',status:'proposed',userId:passenger.id,originalRequestedAt:NOW-600000,originalDeadlineAt:NOW+3*3600000,expiresAt:NOW+3*3600000};
  db.prepare('INSERT INTO intents (id,role,status,payload) VALUES (?,?,?,?)').run(waitingIntent.id,'passenger','proposed',JSON.stringify(waitingIntent));
  await expireUnansweredInquiries(NOW);
  check('Unanswered inquiries expire and rerank without resetting the clock',()=>{
    const booking=store.getBookingById('expires-inquiry'),intent=store.getIntentById('intent-expiry');
    assert.equal(booking.status,'expired');assert.equal(booking.needsReplacement,false);assert.equal(booking.needStatus,'closed');assert.equal(intent.status,'pending');
    assert.equal(intent.originalRequestedAt,NOW-600000);assert.equal(intent.originalDeadlineAt,NOW+3*3600000);assert.ok(intent.declinedTripIds.includes('contact'));
  });
  await seedBooking('direct-expiry','contact',{inquiryExpiresAt:NOW-1});
  await expireUnansweredInquiries(NOW);
  const expiredOnce=store.getBookingById('direct-expiry');
  await expireUnansweredInquiries(NOW+1000);
  check('A direct inquiry keeps one recovery record without a timeout loop',()=>{
    const b=store.getBookingById('direct-expiry');
    assert.equal(b.status,'inquiring');assert.equal(b.needStatus,'open');assert.equal(b.needsReplacement,true);
    assert.equal(b.inquiryExpiresAt,null);assert.equal(b.expiredAt,expiredOnce.expiredAt);
    assert.equal(b.originalRequestedAt,NOW-600000);assert.equal(b.originalDeadlineAt,NOW+3*3600000);
  });
  await seedBooking('expire-deadline','contact',{inquiryExpiresAt:NOW-1,originalDeadlineAt:NOW-1});
  await expireUnansweredInquiries(NOW);
  check('A passed original deadline closes recovery honestly',()=>{const b=store.getBookingById('expire-deadline');assert.equal(b.needStatus,'closed');assert.equal(b.needsReplacement,false);});
  station.resetAllStationData({clearPersisted:true});
  const {getVirtualHubById}=await import('@carmate/shared');
  const hub=getVirtualHubById(A);
  const customRequest={hubId:A,destinationHubId:B,userId:'hybrid-passenger',phone:passenger.phone,pickupEndAt:iso(170),pickupMode:'hybrid',pickupPoint:'Điểm riêng cách trạm'};
  check('A custom hybrid pickup requires real coordinates',()=>{
    assert.equal(station.riderCheckIn(customRequest).success,false);
    assert.equal(station.riderCheckIn({...customRequest,clientLat:null,clientLng:null}).success,false);
    assert.equal(station.riderCheckIn({...customRequest,clientLat:'',clientLng:''}).success,false);
  });
  const hybridRider=station.riderCheckIn({...customRequest,clientLat:hub.lat+0.001,clientLng:hub.lng+0.001});
  assert.equal(hybridRider.success,true,hybridRider.error);
  seedTrip('hybrid-no-detour',driver,{pickupMode:'hybrid',maxDetourKm:0});
  const noDetour=station.telemetryPing({tripId:'hybrid-no-detour',driverPhone:driver.phone,destinationHubId:C,seatsAvailable:2,lat:11.565,lng:106.633,speed:50});
  check('Hybrid pickup outside the allowed detour is not offered',()=>assert.equal(noDetour.proximityAlert,null));
  seedTrip('hybrid-car',driver,{pickupMode:'hybrid',maxDetourKm:5});
  const hybridPing=station.telemetryPing({tripId:'hybrid-car',driverPhone:driver.phone,destinationHubId:C,seatsAvailable:2,lat:11.565,lng:106.633,speed:50});
  check('Hybrid pickup includes the custom point and actual detour in the proposal',()=>{
    assert.equal(hybridPing.proximityAlert?.intentId,hybridRider.intent.intentId);
    assert.equal(hybridPing.proximityAlert.proposalTerms.pickupPoint,customRequest.pickupPoint);
    assert.ok(hybridPing.proximityAlert.proposalTerms.detourKm>0);
  });
  console.log(`\n${passed} booking and station invariants passed.`);
} finally {
  station.resetAllStationData(); store.closeDB(); fs.rmSync(testDir,{recursive:true,force:true});
}
