# CarMate — Accepted Connection Flow

## Scope

CarMate helps passengers and drivers find each other by route, direction and time window. Searching, posting a trip and connecting are free. The driver sets the price; the two parties contact each other directly and agree on the pickup. A station is a search landmark; pickup can be at the station, door-to-door, or a combination, depending on the driver's conditions and the confirmation of both parties.

This document describes the behavior contract of the new flow. It does not claim that real-world pickups or the production login configuration have been verified.

## 1. Passenger not logged in

1. Choose the origin, destination, date/time and number of people.
2. View real trips, the driver's listed price or “Liên hệ” (Contact), pickup availability and how fresh the information is.
3. Call or open Zalo if the driver has agreed to publish the contact number. Do not use login/seat reservation to lock a number that is already public.
4. If the passenger wants drivers to find them, they actively choose **Đăng nhu cầu tìm xe** (“Post a ride request”). Searching or tapping contact does not automatically post a request and does not automatically reserve a seat.
5. Log in at the post-request action or when sending a request within CarMate. The form is preserved; the exact action continues after a successful login.

The passenger sets how long they still need a ride. When it expires, or when they end it themselves, the system stops showing them as someone waiting. Publishing the passenger's contact number is a separate choice, not inferred from login.

## 2. Driver not logged in

1. **Đăng chuyến** (“Post a trip”) opens the same form on both desktop and mobile.
2. Enter the route, date/time, total vehicle seats and seats offered to passengers; choose `listed` or `contact` pricing.
3. Choose the pickup method, detour limit and notes; enter the real vehicle model and license plate.
4. Tap **Xem trước chuyến** (“Preview trip”). Only now are posted requests that still fit checked; no trip is written and no silent login happens.
5. The request preview contains only abbreviated route information, time, number of people and the compatibility reason. It does not contain the passenger's phone, personal name or home address. A result with no passengers must say so explicitly; a load error must not be turned into 0.
6. Enter the contact number and confirm permission to publish it on the trip listing, then tap **Đăng chuyến miễn phí** (“Post trip for free”).
7. If not logged in, open authentication. Closing the authentication window keeps the draft. On success, publishing continues exactly once; only a successful server response puts the trip into the list.

The real trip is the primary source of supply. Do not create an additional duplicate driver intent after a trip is posted, which would double the supply or capacity.

## 3. Two ways to communicate

### Directly, off-platform

The two parties can call/Zalo and decide on their own. Tapping call only proves that contact was opened. CarMate does not infer from this action that the pickup was accepted, payment was made or the passenger boarded.

### Recording the appointment in CarMate

If they want the platform to store and track the commitment:

1. Send a request to create a conversation (`inquiring`); no seat is reserved yet.
2. One party proposes the pickup/drop-off point, time window, number of people and total price (`pre_confirmed`).
3. The other party confirms exactly that proposal version. The server checks permissions, deadline and per-segment capacity before moving to `confirmed`.
4. A change of terms must create a new proposal. Do not apply an old confirmation to a different price, time or vehicle.
5. Boarding and completion statuses must be recorded accordingly; logging in or confirming the pickup does not by itself prove the passenger was transported successfully.

Login is used to tie actions to the responsible person; it is not a condition for viewing contact information that the listing owner has agreed to publish.

## 4. Suggestions and handling changes

- Filter for feasibility first: correct direction and route segment, overlapping time window, seats available, compatible pickup conditions.
- Ranking is only a suggested order among the existing candidates. A price that has not been given is unknown; do not treat `null` as free.
- Stations support space–time projection. A flexible pickup point requires the driver's agreement; if coordinates are missing, do not invent a detour distance or time to the passenger's home.
- Inserting a passenger mid-route must check capacity on each segment and preserve appointments that are already confirmed.
- On cancellation, release the seat exactly once. If the passenger still needs a ride and the original deadline is still valid, reopen the request with the original requested time/deadline.
- A replacement vehicle is a suggestion for both parties to review and confirm. Do not automatically move the passenger to another vehicle, and do not automatically keep the old price without agreement.
- When there is no candidate, say so clearly and let the passenger search again. Do not display fallback vehicles or fake pickup times.

## 5. Login and privacy

Unified UI callback:

```js
onRequireAuth({
  title,
  subtitle,
  contextNotice,
  onSuccess: (authenticatedUser) => continueSavedAction(authenticatedUser),
  onCancel: () => keepDraft()
});
```

The callback is taken out and cleared before it runs. Cancelling authentication clears the pending action; there is no silent publish after the user closes the dialog. Firebase phone OTP, Google Identity Services and Telegram Widget must authenticate through the server; the UI must not forge tokens for a quick login.

The server takes identity from the authenticated session and does not trust a `userId` sent by the browser. The data source must distinguish public listings, the owner's own data, and conversations visible only to the two parties.

## 6. Verification

- Test data invariants, permissions, confirming the same version, per-segment capacity and repeated cancellation.
- Test both roles in a browser: input before login, closing/opening auth, continuing the exact action, network errors, empty data and flexible pickup points.
- Test the real login configuration separately; do not send OTPs or perform external logins in a pure test.
- Measure waiting time, contact rate, pickup rate and no-show rate in the real world before announcing a service level. Code tests do not prove that a vehicle is always available.

### Runnable test suite

`npm test` runs the new tests for connection, appointment confirmation, driver activation and passenger display; each test has its own database where needed.

The old tests remain under `npm run test:legacy` for reference during the transition. They check behaviors that have been removed, such as formula pricing, automatic shadow-vehicle transfer and one-sided seat reservation, so they are no longer the acceptance criteria for the new flow; some require a separate server. Do not run the old suite against real data.
