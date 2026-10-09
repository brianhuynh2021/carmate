# CarMate Engineering & Design Guidelines

## 1. Product contract

- CarMate connects passengers and drivers by route, direction and time window. Posting, searching and connecting are free; it does not hold money, take commission or split trip payments.
- Drivers may list a price (`pricingMode: listed`) or choose “Liên hệ” (Contact) (`contact`, price `null`). No price floor/ceiling, mandatory fare schedule or 90% driver share is imposed.
- Stations are search reference points. `station`, `doorstep` and `hybrid` are supported; the final pickup point and any changes to conditions are confirmed by both parties.
- Passengers can view and contact numbers that the listing owner has agreed to publish, without logging in. Only a proactive ride-request post or a submitted request creates the corresponding data; do not turn searches into demand.
- Allow entering and viewing values before login. Require login at the publish/record action that carries ownership; keep the draft and resume the action exactly once.
- A match suggestion is not a commitment to pick up. Do not automatically switch vehicles or modify an appointment that both parties have confirmed.
- Use “Chủ xe” (driver) and “Khách” (passenger) in the UI. Neither the naming nor the fact that the service is free establishes a legal classification for the actual activity.
- Details in [docs/CONNECTION_FLOW.md](docs/CONNECTION_FLOW.md).
- A reference operator profile is a separate entity, not an account, a trip currently accepting passengers or an empty seat. Publishing requires a source, a basis for contact and a review date; the legacy directory goes into drafts awaiting verification.
- Management rights over a profile must be approved against a real account and evidence via a known channel. Do not use a matching phone number, Google/Telegram, or the legacy `verified` flag as proof of representation rights.
- Entering a trip on an operator's behalf requires an approved manager and consent for that specific trip; do not create accounts or verification documents on their behalf. Reporting incorrect information/requesting removal has its own progress tracking and lookup code. Details in [docs/OPERATOR_PROFILES.md](docs/OPERATOR_PROFILES.md).

## 2. Mathematical and data invariants

- Keep the core of corridor projection, time-window intersection, ETA and per-segment capacity. The total passengers on each segment must not exceed the declared passenger seats or the vehicle capacity minus the driver's seat.
- Idempotent: update, confirm, cancel and seat-release must not double their effect when called repeatedly. A confirmation session must match the same version of the conditions.
- When reopening a ride request that is still valid, keep the original request time and deadline. Do not extend `x` on your own to make results look better.
- Only display vehicles, passengers, counts, times and statuses from real data. Do not use fake fallbacks or unproven promises, and do not treat a network error as no data.
- The Haversine/running-cost formulas that remain are reference estimates from the legacy model; they must not override the driver's price or the current conditions.
- Authenticate on the server; protect ownership and contact information. Do not create fake identities/tokens in the UI.

## 3. Experience and display

- Reduce re-entry; use quick choices, direction reversal and reuse of real information already available.
- Cancel/delete/change-of-conditions actions must show the trip, the people involved and the impact before confirmation.
- Do not use `window.alert`, `window.confirm`, `window.prompt`. Use non-blocking notifications and inline feedback.
- System-wide background `#DFE5EC`; dark mode `#0b0f19`. White cards `#FFFFFF`, dark `#1a2232`, border `border-slate-300/70` / `dark:border-white/10`, light shadow.
- Rounded corners `rounded-2xl` / `rounded-3xl`, clear typography, easy-to-tap touch targets. Primary color `#0071e3`; red for errors/cancellation, orange for pending/warnings, green for confirmed status.
- Modals use a React Portal into `document.body`, with a regular layer of `z-[9999]`; authentication sits above the form being filled in. Closing authentication does not lose the draft.
- Keep technical terms and research names out of the mainstream user flow unless they help users make a decision.

- Typography uses the `type-*` classes in `apps/web/src/index.css`; see `docs/UI_TYPOGRAPHY.md`. A single Inter font family, labels/buttons/body text 14px, inputs 16px; do not create custom font sizes or mix classes that override a role.

## 4. Git discipline and verification

- Do not commit or push directly to `main`.
- Develop and test on the `dev` branch; only merge into `main` when the user explicitly asks.
- Test appropriately for the change; distinguish pure tests, API tests with isolated data, browser tests and real operations.
- Do not claim that code tests prove a vehicle is always available, a field probability, or the legality of every activity.
