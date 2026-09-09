# Connection request flow — API contract repair

## Problem

The entire connections surface is non-functional against the running server. Every
call the mobile app makes fails:

| Call from `mobile/src/services/api.ts` | Result |
|---|---|
| `POST /connections/requests` `{broadcasterAnonId}` | 400 `viewerUserId and broadcasterAnonId are required` |
| `GET /connections/requests/incoming` | 404 (server route is `/incoming/:userId`) |
| `GET /connections/requests/outgoing` | 404 |
| `GET /connections` | 400 `userId is required` |
| `GET /connections/:id` | 400 |
| `DELETE /connections/:id` | 400 |

Verified by curl against a live server on 2026-09-09. Underneath the contract
mismatch sits a second defect: even when `viewerUserId` is supplied,
`connections.ts:88` passes `broadcasterAnonId` straight into
`sendRequest(viewerUserId, broadcasterUserId)`, which writes it to
`connection_requests.broadcaster_user_id UUID`. Postgres rejects it with
`22P02 invalid input syntax for type uuid`. Nothing anywhere resolves an
anonymous id to a user id, so the request path could never have worked.

Third, the acting user is read from client-supplied input everywhere — `?userId=`
on the list endpoints, `viewerUserId` in the request body — and
`accept`/`decline`/`cancel` take no acting user at all. Any authenticated user can
list another user's connections, delete them, or accept a request addressed to
someone else, just by knowing an id.

The 26 existing service-level tests and the 3 route test files added in PR #2 all
pass, because they mock `connectionService`. A mock accepts the string
`"anon-close"` where Postgres will not.

## Goals

- Every connections endpoint works when called exactly as `api.ts` calls it today.
- `broadcasterAnonId` resolves to a real user id before it reaches the database.
- The acting user comes from `req.userId` on every endpoint. No endpoint reads an
  actor identity from the body, query string, or path.
- `accept` / `decline` / `cancel` succeed only for the participant entitled to
  perform them.
- The failure is caught by tests that would have caught it originally.

## Non-goals

- **The missing send-request UI.** `sendConnectionRequest` has no caller anywhere
  in `mobile/`. This spec makes the endpoint correct and callable; wiring a button
  into the feed is a separate change with its own design decision about placement.
- **DM thread stability.** `anonymous_id` is regenerated per broadcast
  (`broadcastService.ts:23`), so DM threads keyed by anon id break when a
  broadcast ends. Pre-existing, unrelated to this fix, tracked under Open questions.
- **A stable per-user pseudonym.** Considered and rejected under Approach.
- **Schema changes.** Nothing in this spec alters a migration.

## Approach

Resolve `broadcasterAnonId` through the `broadcasts` table at send time:
`SELECT user_id FROM broadcasts WHERE anonymous_id = $1`. If no row matches, the
broadcast has ended and the request is refused with 404. This needs no schema
change and holds the anonymity guarantee: a viewer can only request someone whose
broadcast they can currently see.

The alternative was a stable per-user anonymous id — a column on `users` that
persists across broadcasts, making anon ids resolvable at any time and fixing DM
threads as a side effect. Rejected: a pseudonym that survives across sessions and
locations is linkable, which is exactly what `anonymousIdNonTraceability.test.ts`
exists to prevent. The per-broadcast rotation is a deliberate privacy property,
not an oversight.

For identity, `authMiddleware` already resolves the bearer token and sets
`req.userId` on every route in this router (`index.ts:49`). Every handler reads
from there. The `?userId=` and `viewerUserId` parameters are removed rather than
kept as a fallback — mobile is the only client, and a parameter that must be
validated against `req.userId` to be safe carries no information `req.userId`
does not already have.

## Design

### Routes (`server/src/routes/connections.ts`)

Actor is `req.userId` throughout; no handler reads an actor from input.

```
GET    /connections                        -> { connections: ConnectionListItem[] }
GET    /connections/:id                    -> { connection: ConnectionDetail } | 404
DELETE /connections/:id                    -> { success: true } | 404
POST   /connections/requests               body { broadcasterAnonId } -> { request } | 404 | 409
POST   /connections/requests/:id/accept    -> { connection } | 403 | 404 | 409
POST   /connections/requests/:id/decline   -> { success: true } | 403 | 404 | 409
POST   /connections/requests/:id/cancel    -> { success: true } | 403 | 404 | 409
GET    /connections/requests/incoming      -> { requests: ConnectionRequest[] }
GET    /connections/requests/outgoing      -> { requests: ConnectionRequest[] }
```

`/requests/incoming` and `/requests/outgoing` lose their `:userId` segment. Both
must be declared before `GET /:id`, or Express matches `/:id` first.

### Service (`server/src/services/connectionService.ts`)

```ts
/** Resolve a live broadcast's anonymous id to its broadcaster. Null if the broadcast has ended. */
export async function resolveAnonId(anonymousId: string): Promise<string | null>;

/** Existing signature unchanged; callers must now pass a resolved UUID. */
export async function sendRequest(
  viewerUserId: string,
  broadcasterUserId: string,
): Promise<{ id: string; status: string; expiresAt: number }>;

/** Gain an actor parameter. Each verifies the actor is the party entitled to act. */
export async function acceptRequest(requestId: string, actingUserId: string): Promise<Connection>;
export async function declineRequest(requestId: string, actingUserId: string): Promise<void>;
export async function cancelRequest(requestId: string, actingUserId: string): Promise<void>;

/** Listings move from a caller-supplied id to the authenticated one; signatures unchanged. */
export async function getIncomingRequests(userId: string): Promise<ConnectionRequest[]>;
export async function getOutgoingRequests(userId: string): Promise<ConnectionRequest[]>;
```

`getIncomingRequests` / `getOutgoingRequests` are new service functions; the two
inline `pool.query` blocks currently sitting in the route handlers
(`connections.ts:120–160`, complete with a lazy `await import('../db/connection')`)
move into the service alongside `formatRequest`, matching how every other endpoint
in this router is structured.

### Mobile (`mobile/src/services/api.ts`)

No call-site changes — the client is already shaped for the corrected contract.
Only `sendConnectionRequest` needs its return type narrowed if the 404 case is to
be distinguished; otherwise the existing `if (!res.ok) throw` is sufficient.

### Cleanup

`connectionService.ts:8` is an empty import (`import { } from './spotifyProfileFetcher'`)
left over from a refactor. Remove it.

## Behavior

**Happy path.** Ada sees a broadcast in her feed carrying `anonymousId: "a1b2…"`.
She sends `POST /connections/requests {"broadcasterAnonId":"a1b2…"}`. The server
takes her id from `req.userId`, resolves the anon id to Ben's user id, and inserts
a pending request with a 24h expiry. Ben polls `GET /connections/requests/incoming`
and sees it. He posts `/accept`; the server confirms he is the broadcaster on that
request, flips it to `accepted`, inserts the `connections` row, and returns both
Spotify profiles. Both now appear in each other's `GET /connections`.

**Broadcast ended before send.** `resolveAnonId` returns null → 404
`{ error: 'That broadcast is no longer active' }`. Ada's feed entry is stale; a
refresh drops it. No row is written.

**Acting on someone else's request.** Ada posts `/accept` on a request where she is
the viewer, not the broadcaster → 403. Ben posts `/cancel` on a request he received
rather than sent → 403. Cancel is the sender's verb, accept and decline the
recipient's.

**Non-pending request.** Accepting an already-accepted, declined, cancelled, or
expired request → 409. Today `acceptRequest` throws a bare `Error`, which the route
maps to a 500; the distinction between "not yours" (403), "no such request" (404),
and "wrong state" (409) is new.

**Duplicate request.** Ada requests Ben twice while the first is pending → 409
rather than a second pending row.

**Self-request.** Ada's own broadcast is excluded from her feed, so this needs no
UI guard, but the anon id is guessable. `resolveAnonId` returning her own id → 400.

**Connection not owned.** `GET /connections/:id` and `DELETE /connections/:id` for a
connection the caller is not part of → 404, not 403. The existing service queries
already scope by `(user_a_id = $2 OR user_b_id = $2)`, so a non-participant cannot
distinguish "not yours" from "does not exist". Keep that.

**Expiry.** Unchanged. The scheduler's `expireStaleRequests` continues to flip
pending rows past `expires_at` to `expired`; those then fail accept with 409.

## Verification

The bug survived because every existing test mocks the database. Both layers are
needed.

1. **`connectionsRoute.test.ts`** — extend the existing file. Assert the actor is
   `req.userId` and never a body or query value; assert `/requests/incoming` with
   no path segment returns 200; assert 403 on accept-by-the-wrong-party.
2. **`connectionRequest.itest.ts`** — new, under `vitest.integration.config.ts`,
   against real Postgres. This is the layer that would have caught the original
   defect: send a request using a real `anonymous_id` read back from an inserted
   broadcast, and assert a row lands in `connection_requests` with a resolved UUID.
   Then assert that passing a raw anon id where a UUID is expected fails — the
   `22P02` that mocks cannot reproduce. Cover the full send → accept → connections
   round trip.
3. **Live curl replay.** Re-run the six calls from the Problem table against a
   running server and confirm each returns 200. The `scripts/` seed used during
   diagnosis is in the session scratchpad and should be committed as
   `server/scripts/seed-demo.ts` if it stays useful.
4. `npm test`, `npm run test:integration`, and `node scripts/check-local-setup.mjs`
   all green.

## Risks / open questions

- **Race on send.** A broadcast can end between the feed render and the tap. The
  404 is correct but user-visible; the mobile error copy should say the listener
  stopped broadcasting rather than surfacing a status code. Out of scope here,
  worth a follow-up once the send button exists.
- **DM threads break on broadcast rotation.** Same root cause — anon ids are
  per-broadcast — and it affects `socialService`'s DM thread lookup, which joins on
  `sender_anon_id` / `recipient_anon_id`. Not touched by this spec. Needs its own
  decision about whether DM threads should survive a broadcast ending.
- **Assumption: mobile is the only client.** Dropping `?userId=` breaks any other
  caller. Nothing in the repo suggests one exists. If a web client is planned, the
  removal still stands — it would use the same bearer-token middleware.
- **`ConnectionRequestScreen` has not been run.** The screen calls accept, decline,
  and cancel; whether it renders correctly once those return 200 is unverified,
  since the app has not been launched against a working backend.

## Status

Implemented on branch `fix-connection-request-flow`. All four milestones landed.
Verified: 146 unit tests, 34 integration tests, mobile typecheck and tests, and a
live replay of every call in the Problem table.

Two things moved from the spec during implementation:

- The entitlement check became a shared `authorizeRequest(requestId, actingUserId,
  verb)` helper rather than inline checks in each of accept/decline/cancel. Same
  behavior, one place to read the rule.
- `getIncomingRequests` and `getOutgoingRequests` share a private `queryRequests`
  helper taking the column name as a literal, since the two queries differ only in
  the `WHERE` column.

Nothing in Design or Behavior changed. The demo seed script used during diagnosis
was left in the session scratchpad rather than committed as
`server/scripts/seed-demo.ts` — it hardcodes fixture coordinates and duplicates
what the integration tests already set up.

## Milestones

1. ~~**Service layer.**~~ ✅ Add `resolveAnonId`, `getIncomingRequests`,
   `getOutgoingRequests`; add the actor parameter and entitlement check to accept,
   decline, cancel; drop the dead import. Unit tests pass.
2. ~~**Route layer.**~~ ✅ Move every handler to `req.userId`, drop the `:userId`
   segments, reorder `/requests/*` above `/:id`, map the error cases to 403/404/409.
   Extended route tests pass.
3. ~~**Integration test.**~~ ✅ `connectionRequest.itest.ts` against real Postgres, proving
   the anon-id resolution end to end.
4. ~~**Live replay.**~~ ✅ All six calls from the Problem table return 200 against a
   running server; CI green.

Each milestone leaves the repo working; 1 and 2 must land together to keep the
route compiling.
