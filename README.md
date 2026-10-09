# CarMate — Find the right trip, connect directly

[CarMate.vn](https://carmate.vn) · Monorepo `@carmate/shared`, `@carmate/web`, `@carmate/api`

CarMate helps passengers and drivers find each other on the same corridor by direction, time and number of seats. Stations are lookup reference points; pickup can be at a station, at the door, or a combination, depending on the driver's conditions and confirmation from both parties.

**Posting trips, searching and connecting are free.** Drivers list a price or leave it as “Liên hệ” (Contact). The two parties decide on and handle the trip payment directly. CarMate does not impose a fare table, hold deposits, take commission or split money.

The new flow is being integrated on `dev`. The descriptions in this repo do not mean the production build has been updated or that pickups in the field have been verified.

## Product flow

### Passengers

- Search and view trips before logging in.
- Contact the driver directly if they have agreed to publish their number; tapping call does not mean being accepted for pickup.
- Proactively post a ride request when you want drivers to find you. A private search does not automatically create a public request.
- Log in at the moment of posting a request or sending a request in CarMate; the content already entered is preserved.
- If an appointment is recorded on the platform, both parties confirm the same point, time, number of people and price before seats are reserved.

### Drivers

- Enter the route, time, number of seats, price/“Liên hệ” (Contact), pickup method and the actual vehicle.
- Preview the trip and any ride requests looking for a vehicle that may fit, without exposing passengers' private information.
- If there are no ride requests, show the empty result accurately. A data-loading error must not be treated as having no passengers.
- Enter a contact number and consent to publish it, log in, then publish exactly once.
- Desktop and mobile share the same trip-posting flow. The mode for managing a vehicle that is currently running has its own entry point for returning drivers.

Details: [Connection flow](docs/CONNECTION_FLOW.md) · [Operational workflow](docs/OPERATIONAL_WORKFLOW.md).

## Mathematics behind trip search

The current core consists of projecting positions onto the corridor, forecasting the time to reach a station, intersecting time windows, evaluating compatibility, and per-segment capacity. These modules help generate suitable candidates; they do not by themselves prove that a vehicle is always available or replace the consent of both parties.

The cost formulas, Shapley/Nash and price tables in the legacy modules are research/estimation only and must be kept separate from the driver's price. Ranking results are suggestions based on the available data, not evidence of global optimality.

See [Architecture and model scope](ARCHITECTURE.md). The assistant flow has its own document at [NATIVE_INTENT_FLOW.md](docs/NATIVE_INTENT_FLOW.md); the assistant is not required to use the search/post-trip flows.

## Structure

```text
apps/web/src/
  App.jsx                       Navigation and action-triggered authentication
  api/client.js                 API client
  components/market/            Corridor-based trip search
  components/intent/            Proactively posting a ride request
  components/modals/            Preview, post trip, login, appointment
  components/station/           Station-based lookup and handling of ride requests
  hooks/                        State and data synchronization
apps/api/src/
  routes/api.js                 Endpoint access control
  controllers/                  Trip, intent, booking, auth
  services/connectionMatching.js Candidate evaluation
  services/bookingCommitment.js  Two-party commitment and per-segment capacity
  db/sqliteStore.js             SQLite
packages/shared/src/            Corridors, stations, time model and shared utilities
scripts/                        Tests, backups and operations tooling
```

## Running locally

Requires Node.js version 22 or later per `package.json`. Use a separate development dataset.

```bash
npm install
npm run dev
```

A single unified server serves the web app and the API; see the startup message for the actual address/port. Do not put secret keys in `VITE_*` variables because they are bundled into browser-side code. Google, Telegram and Firebase authentication need appropriate configuration; the UI does not provide fake accounts to bypass this step.

```bash
npm run build
npm run lint
node scripts/test-driver-activation.mjs
```

`test-driver-activation.mjs` checks that preview data carries no contact information, the driver-chosen price, capacity, time, and the resume-after-login callback. The other API and business-logic suites are in `scripts/`; some need a dedicated server or database. Do not run them against real user data.

## Verifying the new flow

- Passengers find real results or see a clear empty state; public contact is not locked behind login.
- Passengers/drivers can enter data before logging in; closing authentication keeps the draft; a successful login resumes exactly once.
- Drivers see only the real number of ride requests in the preview; an API error does not display a fake 0.
- A `null` price displays “Liên hệ” (Contact); the driver's price is not overwritten by the legacy formula.
- An appointment reserves seats only after confirmation of the exact version, with a capacity check on the travelled segment.
- Repeated cancellation does not release seats multiple times; searching again keeps the original deadline; a new vehicle requires new confirmation.

Code tests, browser checks, login configuration trials and real operational measurements are separate layers of verification. Do not use the number of passing tests to claim a pickup success rate.

## Data, deployment and Git

The flows for reference profiles, entering trips on an operator's behalf, claiming management rights, and reporting incorrect information/requesting removal are described in [docs/OPERATOR_PROFILES.md](docs/OPERATOR_PROFILES.md). The legacy directory is converted into drafts awaiting review; a reference profile does not create a seat source or an automatic representative account.

SQLite needs persistent storage and a tested backup/restore procedure. The repo has `scripts/backup-db.js`, `scripts/restore-db.js`, `Dockerfile` and `fly.toml`; check the target configuration before running operational tools. Do not write production data or users' private content into tests, sample logs or documentation.

Develop on `dev`. Do not commit/push directly to `main`; only merge or deploy when the user asks. UI conventions and data invariants are in [AGENTS.md](AGENTS.md).
