# CarMate — Connection Operations Workflow

Full reference: [Connection flow](CONNECTION_FLOW.md). A station is a landmark for organizing data; the final pickup point depends on real-world conditions and the confirmation of both parties.

## Before a trip exists

- The driver enters the route, date/time, free seats, price or “Liên hệ” (Contact), pickup method and the real vehicle.
- The preview checks for real requests. No requests and data that could not be loaded must be distinguished.
- Log in before publishing to manage ownership. Contact information is made public only with the listing owner's consent.
- Passengers can search and view information without logging in. A search must not be counted as the passenger having posted a request.

## When the two parties find each other

- The passenger can contact the driver directly through the number that has been made public.
- The two parties agree on the pickup/drop-off point, time window, number of people and price. CarMate does not apply a fare table or collect money as an intermediary.
- If an appointment in CarMate is used, state the proposal clearly and wait for the other party to confirm the same version. Until then, show only “in discussion” or “awaiting confirmation”.
- A passenger must not be directed to a station based on a suggestion that has no vehicle accepting the pickup.

## Before and during pickup

- Track real vehicle information, appointment time and update notifications.
- A station, a home or a nearby spot all need a specific, agreed location. Do not assume every gas station allows pickup/drop-off or has full amenities.
- A change of time, location, price or vehicle requires a new proposal. Do not silently edit a confirmed appointment.
- When taking additional passengers on a mid-route segment, check the free seats on the exact segment the passenger travels and the impact on other appointments.
- The statuses “driver has accepted”, “passenger has boarded” and “completed” are separate events. A lone GPS signal is not enough to prove all of these events.

## When something goes wrong

| Incident | How to handle |
| --- | --- |
| Cannot reach the other party or no one has accepted yet | Show as not confirmed; let the passenger look for other candidates. |
| Cancellation before pickup | Release the seat once; ask/record whether the passenger still needs a ride or has ended the request. |
| Passenger still needs a ride and the deadline is still valid | Reopen the search with the original requested time and deadline; do not extend the deadline automatically. |
| Another suitable vehicle is available | Present the suggestion, state the new conditions clearly and wait for confirmation; do not assign a vehicle automatically. |
| No replacement vehicle | Say clearly that there is no option yet; show still-valid reference information if available. |
| Report of a no-show pickup or incorrect information | Store the report and evidence according to access rights. Do not treat a one-sided complaint as an automatic conclusion. |
| Incident after boarding | Handle as a journey incident; do not pretend to return to the “not yet picked up” status. |

Trip payment is handled directly by the two parties. Do not set a default bank account, PIN, vehicle or pickup time to stand in for missing data.

## Commitment boundaries

CarMate supports lookup, recording conditions and finding the next option. The platform must not promise that a vehicle is always available, that a pickup is guaranteed, that it will call back within a fixed time, or that a replacement vehicle keeps the same price without the corresponding data and confirmation.

ETA parameters, time windows and vehicle frequency need to be calibrated with field data. A research name, a number of tests or a GPS indicator is not a substitute for evidence of service quality.
