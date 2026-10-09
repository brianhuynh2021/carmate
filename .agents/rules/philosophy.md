# CarMate — Implementation principles

The current product contract lives in `AGENTS.md` and `docs/CONNECTION_FLOW.md`. The assumptions of the earlier cost-sharing model must not override the current connection direction.

## Data and mathematics

- Project routes onto the corridor and time to find feasible intersections; check direction, pickup window, per-segment capacity and detour conditions before ranking.
- Prices are listed by the driver or left as “Liên hệ” (Contact). The legacy cost formulas are reference only; they do not set prices or prove that the mechanism cannot be manipulated.
- Only confirm when both parties confirm the same version of the point, time, vehicle, number of people and total price. Protect an already confirmed appointment when inserting a new passenger.
- Cancel, confirm and seat-release must be safe when called repeatedly; keep the original request time and deadline when searching for a replacement.
- The current candidate ranking does not prove that a vehicle is always available, that there is no congestion, or that a future alternative is never worse.

## Experience

- Allow viewing and entering data before login. Log in to publish, save an appointment and follow responses; keep the draft intact.
- A search does not automatically post a ride request. Only publish contact details when the owner consents.
- Stations are reference points, supporting pickup at a station, at the door, or a combination once both parties agree.
- If there is no data, say so clearly; a network error must not be turned into fake passengers, vehicles, prices, PINs or statuses.
- A cancel action must name the affected appointment. Use in-app notifications and dialogs; do not use `window.alert`, `window.confirm`, `window.prompt`.

## UI

- Keep the primary color `#0071e3`, the rounded corners and the current light/dark layout; keep a clear hierarchy of text and status.
- Dialogs use a portal, and layer ordering ensures the form remains when login is opened.
- Call the roles “Chủ xe” (driver) and “Khách” (passenger); the naming does not replace an assessment of the actual activity.
