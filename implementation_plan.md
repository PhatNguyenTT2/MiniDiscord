# Room-Channel Architecture Refactoring Plan (v2)

> Based on [review.md](file:///e:/UIT/cv/MiniDiscord/review.md) v2 feedback

## Architecture Decisions (Confirmed)

| Decision | Status |
|----------|--------|
| FK direction: `Channel.room_id` → Room | ✅ Keep |
| `@me` as DB entity | ❌ Rejected — frontend route only |
| DM = 1 Room(type=DM) + 1 Channel + 2 MEMBER participants | ✅ Keep |
| Lazy DM Creation (on first message, not on click) | 🆕 Adopted |

---

## Phase 1: Database Cleanup

#### PostgreSQL (Supabase — Groups & Channels Service)
```sql
TRUNCATE room_participants CASCADE;
TRUNCATE channels CASCADE;
TRUNCATE rooms CASCADE;
```

#### MongoDB (messaging-service)
```js
db.messages.drop();
db.read_receipts.drop();
```

#### ✅ Checkpoint: All tables/collections empty

---

## Phase 2: Backend Fixes

### Step 2.1 — Race Condition Fix for Root Group

#### [MODIFY] [RoomService.java](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/service/RoomService.java)

Add unique constraint or pessimistic lock to prevent duplicate root group:

```sql
ALTER TABLE rooms ADD CONSTRAINT uq_room_name_group 
  UNIQUE (name, type);
```

### Step 2.2 — Fix DM Ownership Model

#### [MODIFY] [RoomService.java](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/service/RoomService.java) → [findOrCreateDmRoom()](file:///e:/UIT/cv/MiniDiscord/frontend/stores/roomStore.ts#138-162)

```diff
- .ownerId(ownerId)
+ .ownerId(UUID.fromString("00000000-0000-0000-0000-000000000000"))

- .role(RoomRole.OWNER)   // initiator
+ .role(RoomRole.MEMBER)  // both equal
```

### Step 2.3 — Lazy DM Creation Endpoint

#### [MODIFY] [RoomController.java](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/controller/RoomController.java)

Rename/update `POST /rooms/dm` to support **lazy creation** — called only when the first message is actually sent:

```
POST /rooms/dm
Body: { targetUserId: UUID }
Response: { room, channel, participants }
```

> This endpoint stays the same, but frontend **delays calling it** until first message send.

### Step 2.4 — Verify Registration Flow

#### [VERIFY] [UserEventListener.java](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/listener/UserEventListener.java)

```
UserRegisteredEvent → getOrCreateRootGroup() → addMemberIfNotExists()
```

- ✅ New user auto-joins "MiniDiscord General" root GROUP
- ✅ DM rooms created on-demand (lazy), not at registration

#### ✅ Checkpoint: Restart backend → 1 root room, 2 channels, 0 participants

---

## Phase 3: Docker Rebuild & Smoke Test

```bash
cd backend
docker compose down
docker compose up --build
```

**Verify in Supabase:**

| Table | Expected Records |
|-------|-----------------|
| `rooms` | 1 (MiniDiscord General, type=GROUP) |
| `channels` | 2 (general + announcements) |
| `room_participants` | 0 (no users registered yet) |

---

## Phase 4: Frontend Overhaul

### Step 4.1 — Route Restructuring

**Current** → **Proposed** (Discord-like URL pattern):

| Current Route | Proposed Route | Page |
|---------------|---------------|------|
| `/dashboard` | `/channels/@me` | Friends/DM list |
| `/dm/[userId]` | `/channels/@me/[userId]` | DM Chat |
| `/channels/[channelId]` | `/channels/[serverId]/[channelId]` | Server Channel |

#### File Changes:

```
app/(main)/
├── dashboard/page.tsx         →  channels/@me/page.tsx (Friends+DM hub)
├── dm/[userId]/page.tsx       →  channels/@me/[userId]/page.tsx (DM chat)
├── channels/[channelId]/      →  channels/[serverId]/[channelId]/ (Server channel)
```

> [!NOTE]
> Since Next.js App Router uses folders for routes, `@me` needs to be a literal folder name (Next.js allows `@` in folder names when not used as parallel routes — or use `_me` as alias).

### Step 4.2 — Lazy DM Creation (On First Message)

#### [MODIFY] DM Chat Page [page.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/app/page.tsx)

**Old flow:** Click "Message" → [findOrCreateDmRoom()](file:///e:/UIT/cv/MiniDiscord/frontend/stores/roomStore.ts#138-162) → Navigate to `/dm/[userId]`

**New flow:**
1. Click "Message" → Navigate to `/channels/@me/[userId]` immediately (no API call)
2. Page loads with **empty mock state** (no roomId/channelId yet)
3. User types and sends first message → `handleSend()` triggers:
   ```
   POST /rooms/dm { targetUserId }  →  get { roomId, channelId }
   →  Subscribe STOMP topic
   →  Publish message via STOMP
   ```
4. Subsequent messages use cached roomId/channelId normally

#### [MODIFY] [roomStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/roomStore.ts) → [findOrCreateDmRoom()](file:///e:/UIT/cv/MiniDiscord/frontend/stores/roomStore.ts#138-162)

- Keep existing logic but only call it from `handleSend()`, not from "Message" button click
- Add state for `pendingDmUserId` to track DMs not yet created in DB

### Step 4.3 — Navigation Updates

#### [MODIFY] Sidebar links, Friends page "Message" button

Update all `router.push()` calls:
```diff
- router.push(`/dm/${userId}`)
+ router.push(`/channels/@me/${userId}`)
```

#### [MODIFY] ServerList component

Update server click navigation:
```diff
- router.push(`/channels/${firstChannelId}`)
+ router.push(`/channels/${serverId}/${firstChannelId}`)
```

---

## Phase 5: Full Integration Test

| # | Test Case | Expected Result |
|---|-----------|----------------|
| 1 | Register new user | Auto-joins root group, 1 room in `/rooms/my` |
| 2 | Login → Dashboard (`/channels/@me`) | Friends page loads, empty DM sidebar |
| 3 | Click "Message" on friend | Navigate to `/channels/@me/[userId]`, **no DB call** |
| 4 | Send first DM message | Lazy creation: Room + Channel created, message sent |
| 5 | Send subsequent messages | Normal STOMP flow, optimistic insert |
| 6 | Rate limit (5+ msgs/3s) | Warning banner with countdown |
| 7 | Receiver sees DM | DM appears in sidebar in real-time |
| 8 | Click server in sidebar | Navigate to `/channels/[serverId]/[channelId]` |
| 9 | Server #general | Messages flow via WebSocket |

---

## Files Summary

| Phase | File | Change Type |
|-------|------|-------------|
| 2.1 | [RoomService.java](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/service/RoomService.java) | MODIFY — unique constraint |
| 2.2 | [RoomService.java](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/service/RoomService.java) | MODIFY — DM ownership |
| 4.1 | `app/(main)/` folder structure | RESTRUCTURE — new routes |
| 4.2 | DM page [page.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/app/page.tsx) | MODIFY — lazy creation |
| 4.2 | [roomStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/roomStore.ts) | MODIFY — pending DM state |
| 4.3 | Sidebar + Friends components | MODIFY — navigation URLs |
