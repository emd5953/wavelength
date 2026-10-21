# Sending connection requests from the app

## Problem

Connecting is the payoff of Wavelength, and the app can't do it. The DM
screen's "ask to connect with this message" toggle only sets
`direct_messages.includes_connection_request`; nothing calls
`POST /connections/requests` (`sendConnectionRequest` in `api.ts` is unused).
And nothing links to `/connection-requests`, so a recipient couldn't see a
request even if one existed. The server's request flow (send, accept,
decline, cancel, expiry) works and is tested; only the wiring is missing.

## Goals

- Sending a DM with "ask to connect" on creates a real pending connection
  request to that listener.
- The sender sees whether it worked: `+ asked to connect`, or `+ already
  asked` if a request is already pending.
- The `people` screen shows a `requests` row with the incoming count, which
  opens `/connection-requests`.

## Non-goals

- A connect button on feed cards. Connecting stays conversational: you ask
  inside a DM, the same as today's toggle.
- Real-time alerts for new or accepted requests (socket or push). The
  recipient sees them next time they open `people`.
- Showing *which* conversation a request came from on the requests screen.
- The placeholder revealed profile (separate gap).
- Removing the unused `userId` props on the connection screens.

## Approach

**The server creates the request inside `POST /social/dms`** when
`includesConnectionRequest` is true, so one call does both and the DM's flag
can't claim a request that doesn't exist.

*Alternative:* the app calls `POST /connections/requests` after the DM. That
lost because it's two calls that can disagree: the DM saves, the request
fails, and the thread still says "asked to connect".

## Design

`server/src/routes/social.ts`, `POST /social/dms`:

```
recipientUserId = resolveAnonId(recipientAnonId)      // existing; 404 if null
if includesConnectionRequest:
    if recipientUserId == caller → 400 "You can't connect with yourself"
    try   sendRequest(caller, recipientUserId)        → connectionRequest = 'sent'
    catch RequestStateError (pending already exists)  → connectionRequest = 'already_pending'
dm = sendDM(myAnon, recipientAnonId, text, flag = connectionRequest != null)
→ 200 { dm, connectionRequest?: 'sent' | 'already_pending' }
```

`resolveAnonId` already runs on this route, so this adds no extra lookup.
Other errors from `sendRequest` stay 500, and no DM is written.

Mobile:
- `api.ts`: `sendDM` returns `{ dm, connectionRequest? }`. Remove the unused
  `sendConnectionRequest`; the DM path replaces it.
- `DMScreen`: the bubble footer reads `+ asked to connect`, or `+ already
  asked` when the response says `already_pending`. That value is stored on
  the message in local state only; reloaded threads show `+ asked to
  connect` from the flag.
- `ConnectionsListScreen`: a `requests` card at the top of the list with the
  incoming count (for example `requests · 2 waiting`), always visible, opening
  `/connection-requests`. It refetches on focus, so the count updates after
  you accept or decline.

## Behavior

- Toggle on, first time: a request is created, the DM shows `+ asked to
  connect`, and the recipient's `people` screen shows `requests · 1 waiting`.
- Toggle on again before they answer: the DM still sends and reads `+ already
  asked`. No second request.
- They decline, or the request expires: the next "ask to connect" creates a
  fresh request.
- The recipient's session has ended and has no play in the feed window: 404
  (as today) and nothing is written.
- Accepting creates the connection, which appears in both users' `people`
  lists. This already works.

## Verification

1. Route tests (`socialRoute.test.ts`): flag off creates no request; flag on
   gives `sent`; a duplicate gives `already_pending` and still saves the DM;
   sending to yourself gives 400 with no DM; other request errors give 500
   with no DM.
2. Integration test against Postgres: a DM with the flag creates exactly one
   pending row, and a second flagged DM creates none.
3. Mobile type check and tests.
4. Simulator, using the seeded listeners:
   - Send a flagged DM, then check the DM footer and the database row.
   - Accept as the recipient through the API.
   - The connection appears on `people`.

## Risks

- The request still has no context: the recipient sees "a listener wants to
  connect" without knowing which conversation it came from. That's acceptable
  for friends testing; revisit before launch.

## Milestones

1. ✅ Server route and tests.
2. ✅ Mobile DM footer and the `requests` entry on `people`. Verified in the
   simulator.

## Status

Built as specified. Verified:

- 5 new route tests and a new integration test
  (`routes/dmConnectionRequest.itest.ts`) that runs the real auth, session,
  and Postgres path: two flagged DMs give `sent`, then `already_pending`, and
  exactly one pending row
- 147 unit and 56 integration tests passing
- live against the dev server: a seeded listener's flagged DM produced
  `requests · 1 waiting` on `people` and the request card on
  `/connection-requests` in the simulator

Nothing moved from the spec.
