# Chat with a connection

## Problem

Once two people connect, the connection profile only offers "open on spotify"
and "remove connection". There's no way to keep talking. Today's DMs can't
carry it: they're addressed to anonymous **session** IDs, which stop
resolving once a session ends and its plays leave the 6h window. A
connection is meant to last, and both people already know who the other is.

## Goals

- A `message` action on the connection profile opens a chat with that person.
- The chat lasts as long as the connection does, across sessions and days.
- Only the two people in the connection can read or send.
- It reuses the existing bubbles and composer (`Conversation.tsx`).

## Non-goals

- Carrying over the anonymous DM thread that led to the connection. There's
  no reliable link between those session IDs and the connection.
- Real-time delivery or push for new messages. The chat polls while it's open.
- Read receipts, typing indicators, media, and unread counts on `people`.

## Approach

A new `connection_messages` table keyed by `connection_id` and the sender's
**real** user ID. Anonymity is over once two people connect, so there's
nothing to protect with session IDs here.

*Alternative considered:* reuse `direct_messages` with each user's latest
anonymous ID. That lost because those IDs expire, and the thread would
splinter every time either person started a new session.

**Removing a connection deletes its chat** (`ON DELETE CASCADE`). This
matches "remove connection → anonymous again": nothing identifying is left
behind.

## Design

Migration `005_connection_messages.sql`:

```
connection_messages
  id              UUID PK
  connection_id   UUID → connections ON DELETE CASCADE
  sender_user_id  UUID → users ON DELETE CASCADE
  text            TEXT NOT NULL
  created_at      TIMESTAMPTZ DEFAULT NOW()
  INDEX (connection_id, created_at)
```

Routes (`routes/connections.ts`), participants only:

| Route | Behavior |
|---|---|
| `GET /connections/:id/messages` | `{ messages: [{ id, text, mine, createdAt }] }`, oldest first. 404 if the caller isn't in the connection |
| `POST /connections/:id/messages` `{ text }` | 400 if text is empty. 404 if not a participant → `{ message }` |

`mine` is computed on the server, so the client never sees the other
person's user ID.

Mobile:
- `api.ts`: `getConnectionMessages(id)` and `sendConnectionMessage(id, text)`.
- `app/chat.tsx` (`/chat?connectionId=X`, header title is the person's
  name): bubbles plus composer. Polls every 5s while focused.
- `ConnectionDetailScreen`: a `message` primary button. "open on spotify"
  becomes the outline button underneath.

## Behavior

- Either person sends a message, and the other sees it within ~5s while the
  chat is open, or when they next open it.
- The connection is removed: the chat is gone for both. An open chat screen
  gets a 404 on its next poll, says "this connection was removed.", and
  stops polling.
- Account deletion: the user's messages cascade with them, and the
  connection cascades too.

## Verification

1. Route tests: participant-only access (403/404 paths), empty text gives
   400, and `mine` is correct for each side.
2. Integration test: two users and a connection exchange messages and both
   read the same thread. An outsider gets 404. Removing the connection
   deletes the messages.
3. Simulator: open the connection with `seedfeed-a`, send a message, reply
   as `seedfeed-a` through the API, and see it arrive within 5s.

## Milestones

1. ✅ Migration, service, routes, and tests.
2. ✅ Chat screen and the `message` button. Verified in the simulator.

## Status

Built as specified. 5 route tests and `connectionChat.itest.ts` (shared
thread with correct `mine` on each side, outsider gets null, removal
deletes the chat). 152 unit and 59 integration tests passing. In the
simulator, a reply sent as `seedfeed-a` through the API appeared in the open
chat through the 5s poll, under a header loaded from the connection.
