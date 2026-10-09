# Operator profiles and management rights

## Three different things

1. **Reference profile:** records the bus operator/driver, service area, published schedule and price, source and review date. It does not create an account, a running trip, free seats or an appointment.
2. **Management rights:** a real account submits a claim to represent the operator. CarMate verifies the authority through an independently checked contact channel and then approves. Logging in with Google/Telegram and entering a phone number do not by themselves prove the right to represent the operator.
3. **A specific trip:** the approved manager posts the date, time, vehicle, seats, price or Liên hệ (Contact) and pickup conditions. Entering a trip on behalf of an operator must store consent for that specific trip. The two parties still confirm the conditions through the current connection flow.

## Passengers can use it right away

Passengers can view the directory and make contact without logging in. Each public profile has a source, a verification time and a deadline for re-review. A published schedule must not be used as a seat source for the trip matcher. A price that is overdue or has not been reviewed must be presented with a warning and must not be included in trip ranking as a current price.

Passengers can report errors or request removal of information without logging in. A report code and a separate lookup code allow them to view progress; keep this code as private information. The server stores only the hash of the lookup code. The reporter's contact and internal evidence do not appear in the public directory or in public lookup results.

## Entering profiles in admin

- A new profile is a draft by default. Do not create an account in the operator's name.
- Sources include a website, Facebook, a conversation with the driver, or another source. Links accept HTTP(S) only. The person entering the data must record the source they actually checked; the system does not automatically verify website content.
- A business contact number needs an official business source or the consent of the entity. A personal number needs evidence that the number's owner consents to publishing. The evidence note is internal.
- Publishing requires the actual verification date and a deadline for re-review; the verification date must not be in the future.
- The legacy directory is imported once as drafts, keeping its information for review. The old `verified` flag must not be carried over as new evidence.
- Changing the identity, number or source of an already published profile requires re-entering the evidence and review milestones. A profile can be hidden to handle a report.

## Claiming management rights

A passenger logs in only at the step of submitting a claim request. The content of the request and the authoritative confirmation are stored in a queue. Admin verifies against the operator's existing channel and records the verified number, the channel, the time and the evidence of representation. A new number supplied by the claimant is not taken as independent evidence.

Each profile currently supports one management account. Two requests cannot both be approved for two accounts. Decisions that have been concluded are safely repeatable and cannot have their outcome changed through the same request.

A person who has claimed rights can edit the service area, schedule, price and pickup notes. These edits invalidate the verification date so that a re-review is requested; they do not automatically renew the fresh-information label. Changing the number, name and source is done through an edit request for admin to verify.

## Entering trips on behalf of an operator

Only a published profile with a still-valid management account can have trips entered on its behalf. The trip record belongs to that account, so the driver can continue managing contacts and appointments. Admin must record consent within the last 7 days for the exact trip content and for publishing the contact. This is a business limit of the product, not a legal certification.

The API stores the evidence separately in `operator_trip_authorizations`, not mixed into public trip data. Resubmitting the same `requestId` and content returns the same trip; changing the content requires a new operation ID. The trip must still satisfy the conditions on date/time, capacity, the actual vehicle and the price provided by the driver. Do not auto-generate daily trips from the reference schedule.

## Reporting errors and takedown requests

A report moves through `pending → reviewing → resolved/rejected`; it can be concluded directly from pending if it has been handled. Each handling step needs a note and is stored in the history. Marking a report as handled does not by itself edit or hide the profile: admin must make the corresponding change and record the result. The reporter can look up the result with their private code even after the profile has been hidden.

## Operational boundaries

- Verifying management rights is not a certification of a safe driver, a license or a guarantee of pickup.
- At this stage, approving rights and handling reports are manual operational work; without someone on duty, do not promise a handling time.
- When there is no source with enough evidence, the public directory may be empty. Do not use fake accounts, partners or seat counts to fill the gap.
- This change does not collect Facebook posts, does not contact operators, does not publish new business data and does not deploy to a real service.

## Verification

`npm run test:operator-profiles` checks data, permissions, freshness, the queue and SQLite recovery. `npm run test:operator-http` checks the real API through an internal port with temporary data, including entering trips on behalf of an operator, authentication and report limits. The HTTP suite blocks outgoing connections; it does not send real OTPs or messages.
