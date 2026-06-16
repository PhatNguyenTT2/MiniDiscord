# 🎵 Music Ghost Bot — Detailed Implementation Plan

Tính năng phát nhạc trong kênh Voice sử dụng chiến lược **Ghost Bot** (Bot ảo giả lập thành viên), không sử dụng WebRTC để stream audio mà phát trực tiếp qua thẻ `<audio>` HTML5 trên mỗi client.

> [!IMPORTANT]
> Plan này bao gồm cả tính năng **Per-member Volume & Mute** (chỉnh âm lượng và tắt tiếng từng thành viên riêng lẻ) — một tính năng chưa tồn tại trong hệ thống hiện tại và sẽ được triển khai song song.

---

## Proposed Changes

### Backend: Messaging Service (Spring Boot)

#### [NEW] `MusicTrack.java`
**Path:** [backend/messaging-service/src/main/java/com/discordmini/messaging/model/dto/MusicTrack.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/model/dto/MusicTrack.java)

DTO chứa metadata của bài hát trong hàng đợi:
```java
public class MusicTrack {
    String trackId;       // UUID
    String title;         // "Lofi Chill Sleep"
    String directUrl;     // Direct audio stream URL (.m4a/.webm)
    int duration;         // Duration in seconds
    String thumbnail;     // YouTube thumbnail URL
    String requestedBy;   // userId of requester
    String requestedByName; // displayName of requester
}
```

---

#### [NEW] `MusicCommandDTO.java`
**Path:** [backend/messaging-service/src/main/java/com/discordmini/messaging/model/dto/MusicCommandDTO.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/model/dto/MusicCommandDTO.java)

DTO nhận lệnh slash từ client qua STOMP:
```java
public class MusicCommandDTO {
    String roomId;
    String channelId;
    String command;  // "play", "skip", "stop", "queue"
    String args;     // URL hoặc từ khóa tìm kiếm
}
```

---

#### [NEW] [MusicExtractionService.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/service/MusicExtractionService.java)
**Path:** [backend/messaging-service/src/main/java/com/discordmini/messaging/service/MusicExtractionService.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/service/MusicExtractionService.java)

Service gọi API bên ngoài (Cobalt API hoặc Node.js script nội bộ) để phân giải URL YouTube thành Direct Audio URL:
- [extractTrack(String urlOrKeyword)](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/service/MusicExtractionService.java#22-63) → `MusicTrack`
- Sử dụng `WebClient` (non-blocking) để gọi `http://localhost:3001/extract?q={query}`
- Xử lý timeout (5s) và fallback lỗi

---

#### [NEW] `MusicQueueService.java`
**Path:** [backend/messaging-service/src/main/java/com/discordmini/messaging/service/MusicQueueService.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/service/MusicQueueService.java)

Service quản lý hàng đợi nhạc và trạng thái Bot trên Redis:

**Redis Keys:**
| Key Pattern | Type | Purpose |
|---|---|---|
| `room:music_queue:{roomId}` | List | Hàng đợi bài hát (JSON) |
| `room:music_state:{roomId}` | Hash | `isBotActive`, `currentTrackJson`, `startTime` (UTC ms) |

**Methods:**
- `addToQueue(roomId, MusicTrack)` — `RPUSH` bài mới vào queue
- `popNext(roomId)` → `MusicTrack` — `LPOP` bài tiếp theo
- `getQueue(roomId)` → `List<MusicTrack>` — `LRANGE 0 -1` danh sách chờ
- `setPlaying(roomId, MusicTrack)` — Ghi `startTime = System.currentTimeMillis()` vào Hash
- `clearState(roomId)` — Xóa Hash state và Queue
- `getState(roomId)` → `MusicState` — Đọc trạng thái hiện tại cho Late Joiner

---

#### [MODIFY] [VoiceWebSocketController.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/controller/VoiceWebSocketController.java)

Thêm endpoint STOMP mới:

```java
@MessageMapping("/voice.music.command")
public void handleMusicCommand(@Payload MusicCommandDTO dto, Principal principal) {
    // 1. Validate user is in voice channel
    // 2. Switch on dto.command:
    //    "play"  → extractTrack → addToQueue → if !isBotActive: popNext, setPlaying, broadcast MUSIC_PLAY
    //    "skip"  → popNext → if hasNext: setPlaying, broadcast MUSIC_PLAY; else: clearState, broadcast MUSIC_STOP
    //    "stop"  → clearState → broadcast MUSIC_STOP
    //    "queue" → getQueue → send to user only (convertAndSendToUser)
    // 3. Broadcast MUSIC_PLAY/MUSIC_STOP to /topic/room.{roomId}
}

@MessageMapping("/voice.music.trackEnded")
public void handleTrackEnded(@Payload Map<String, String> payload, Principal principal) {
    // Auto-next: pop next track from queue, broadcast MUSIC_PLAY or MUSIC_STOP if empty
}
```

---

#### [MODIFY] [VoiceStateService.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/service/VoiceStateService.java)

Mở rộng `getAllVoiceStates()` để trả về thêm `MusicState` kèm theo trạng thái phòng để hỗ trợ Late Joiner đồng bộ thời gian nhạc.

---

### Backend: Node.js Audio Extractor (Microservice mới)

#### [NEW] `music-extractor/` (Docker container)
**Path:** `backend/music-extractor/`

Microservice Node.js cực nhỏ (~50 LOC) sử dụng thư viện `play-dl`:

```
music-extractor/
├── package.json
├── Dockerfile
└── index.js          // Express server, 1 endpoint: GET /extract?q=...
```

**Endpoint:** `GET /extract?q={youtubeUrl|keyword}`
**Response:**
```json
{
  "trackId": "uuid",
  "title": "Lofi Chill Sleep",
  "directUrl": "https://rr6---sn-...",
  "duration": 180,
  "thumbnail": "https://i.ytimg.com/vi/.../hqdefault.jpg"
}
```

#### [MODIFY] `docker-compose.yml`
Thêm service `music-extractor` vào file compose hiện tại.

---

### Frontend: Stores & Hooks (Next.js / Zustand)

#### [MODIFY] [voiceStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/voiceStore.ts)

Bổ sung state và actions mới cho Music Bot:

```typescript
// New state fields
currentMusicTrack: MusicTrackInfo | null;
musicBotActive: boolean;

// New per-member volume control
memberVolumes: Record<string, number>;     // userId → volume (0-100)
memberMuted: Record<string, boolean>;      // userId → local mute

// New actions
setMusicTrack: (track: MusicTrackInfo | null) => void;
setMusicBotActive: (active: boolean) => void;
setMemberVolume: (userId: string, volume: number) => void;
toggleMemberMute: (userId: string) => void;
```

**Interface `MusicTrackInfo`:**
```typescript
interface MusicTrackInfo {
  trackId: string;
  title: string;
  directUrl: string;
  duration: number;
  thumbnail: string;
  requestedBy: string;
  requestedByName: string;
  startTime: number; // UTC ms
}
```

**Per-member Volume Logic:**
- `memberVolumes` lưu cục bộ trên Zustand (không đồng bộ qua server).
- Được sử dụng để điều khiển `gain` node trên Web Audio API hoặc `HTMLAudioElement.volume` cho từng remote stream.
- Cho Music Bot (`userId = "music-bot"`) → điều khiển `audioRef.current.volume`.
- Cho người dùng thật → điều khiển `GainNode` trên `AudioContext` nối với `remoteStream`.

---

#### [MODIFY] [useWebSocket.ts](file:///e:/UIT/cv/MiniDiscord/frontend/hooks/useWebSocket.ts)

Thêm xử lý 2 event mới trong `handleRoomMessage()`:

```typescript
if (eventType === "MUSIC_PLAY") {
  const track = data.data;
  useVoiceStore.getState().setMusicTrack({
    ...track,
    startTime: track.startTime,
  });
  useVoiceStore.getState().setMusicBotActive(true);
  
  // Inject phantom bot into channel participants
  const channelId = data.channelId;
  const participants = useVoiceStore.getState().channelParticipants[channelId] || [];
  if (!participants.find(p => p.userId === "music-bot")) {
    useVoiceStore.getState().handleVoiceStateUpdate({
      channelId,
      userId: "music-bot",
      username: "Music Bot",
      displayName: "Music Bot",
      avatarUrl: null, // sẽ dùng icon đĩa than
      action: "JOIN",
      muted: false,
      deafened: false,
    });
  }
  return;
}

if (eventType === "MUSIC_STOP") {
  useVoiceStore.getState().setMusicTrack(null);
  useVoiceStore.getState().setMusicBotActive(false);
  
  // Remove phantom bot
  useVoiceStore.getState().handleVoiceStateUpdate({
    channelId: data.channelId,
    userId: "music-bot",
    action: "LEAVE",
  });
  return;
}
```

---

#### [MODIFY] [MessageInput.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/chat/MessageInput.tsx)

Chặn slash commands tại hàm `submitMessage()` (dòng ~195):

```typescript
// Trước khi xử lý mentions, thêm check:
const trimmed = message.trim();
if (/^\/(play|skip|stop|queue)\b/.test(trimmed)) {
  // Gửi STOMP command thay vì chat message
  const match = trimmed.match(/^\/(\w+)\s?(.*)?$/);
  if (match) {
    publishMusicCommand({
      roomId, channelId,
      command: match[1],
      args: match[2] || "",
    });
  }
  setMessage("");
  return;
}
```

Thêm hàm `publishMusicCommand()` gửi payload lên `/app/voice.music.command`.

---

### Frontend: UI Components (React)

#### [NEW] `MusicPlayerBar.tsx`
**Path:** `frontend/components/voice/MusicPlayerBar.tsx`

Component thanh phát nhạc nhỏ gọn, hiển thị khi `musicBotActive === true`:

**UI Layout:**
```
┌──────────────────────────────────────────────┐
│  🎵  Lofi Chill Sleep                    🔊━━│
│      ordered by @PhatNguyen                  │
│  <audio ref={audioRef} autoPlay hidden />    │
└──────────────────────────────────────────────┘
```

**Thành phần:**
- Icon đĩa than xoay (CSS animation `spin`)
- Tên bài hát (marquee nếu quá dài)
- "Ordered by @{requesterName}"
- Volume Slider (0-100) → `audioRef.current.volume = value / 100`
- Nút Mute/Unmute Bot cục bộ

**Logic đồng bộ thời gian:**
```typescript
useEffect(() => {
  if (!currentTrack?.directUrl || !audioRef.current) return;
  audioRef.current.src = currentTrack.directUrl;
  const offset = (Date.now() - currentTrack.startTime) / 1000;
  audioRef.current.currentTime = Math.max(0, offset);
  audioRef.current.play().catch(console.error);
}, [currentTrack?.directUrl]);
```

**Auto-next logic:**
```typescript
audioRef.current.onended = () => {
  // Gửi STOMP signal trackEnded để Backend pop bài tiếp theo
  stompClient.publish({
    destination: "/app/voice.music.trackEnded",
    body: JSON.stringify({ roomId, channelId }),
  });
};
```

---

#### [NEW] `MemberVolumePopover.tsx`
**Path:** `frontend/components/voice/MemberVolumePopover.tsx`

Popover điều chỉnh âm lượng từng thành viên, hiển thị khi right-click/click vào avatar participant:

**UI Layout:**
```
┌───────────────────────────────┐
│  🔊 PhatNguyen          100% │
│  ━━━━━━━━━━━━━━━━━━━●━━━━━━  │
│                               │
│  🔇 Tắt tiếng thành viên     │
└───────────────────────────────┘
```

**Thành phần:**
- Tên thành viên + Avatar nhỏ
- Volume Slider (range 0-200%, mặc định 100%)
- Nút "Mute member" toggle (cục bộ, không đồng bộ server)

**Logic hoạt động:**
- Cho **người dùng thật**: Tạo `AudioContext` → `createMediaStreamSource(remoteStream)` → `GainNode` → `destination`. Gán `gainNode.gain.value = volume / 100`.
- Cho **Music Bot**: Điều khiển `audioRef.current.volume` trong `MusicPlayerBar`.
- State lưu trong `voiceStore.memberVolumes[userId]` (persist cục bộ, không sync server).

---

#### [MODIFY] [VoiceChannelView.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/VoiceChannelView.tsx)

- Tích hợp `<MusicPlayerBar />` ngay trên thanh control console (dòng ~325):
  ```tsx
  {musicBotActive && <MusicPlayerBar roomId={roomId} channelId={channelId} />}
  ```
- Tích hợp `<MemberVolumePopover />` vào `SquareParticipantCard` — mở khi right-click vào avatar participant.
- Thêm nhận diện đặc biệt cho participant có `userId === "music-bot"`: Hiển thị icon đĩa than thay vì avatar, viền nhấp nháy xanh lá liên tục (giả lập `isSpeaking = true`).

---

#### [MODIFY] [VoiceParticipantGrid.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/VoiceParticipantGrid.tsx)

- Tương tự `VoiceChannelView.tsx`: Tích hợp `<MemberVolumePopover />` vào `ParticipantCard`.
- Nhận diện `music-bot` userId để render icon đặc biệt và trạng thái speaking cố định.

---

### Localization (i18n)

#### [MODIFY] [en.json](file:///e:/UIT/cv/MiniDiscord/frontend/dictionaries/en.json) & [vi.json](file:///e:/UIT/cv/MiniDiscord/frontend/dictionaries/vi.json)

```json
{
  "music": {
    "nowPlaying": "Now Playing",
    "orderedBy": "Ordered by {name}",
    "botName": "Music Bot",
    "volume": "Volume",
    "muteMember": "Mute this member",
    "unmuteMember": "Unmute this member",
    "memberVolume": "Member Volume",
    "noTrack": "No track is currently playing",
    "queueEmpty": "Queue is empty",
    "addedToQueue": "Added to queue: {title}",
    "skipped": "Skipped current track",
    "stopped": "Music playback stopped",
    "slashPlay": "Use /play <url or keyword> to play music",
    "slashStop": "Use /stop to stop playback",
    "slashSkip": "Use /skip to skip to next track",
    "slashQueue": "Use /queue to view the queue"
  }
}
```

---

## Verification Plan

### Automated Tests
- `npx tsc --noEmit` — Frontend compile check
- Docker build test cho `music-extractor` service

### Manual Verification
1. Gõ `/play lofi chill` trong chat → Bot gia nhập kênh Voice, nhạc phát trên tất cả client
2. Người dùng mới join Voice → nhạc đồng bộ đúng vị trí thời gian (Late Joiner sync)
3. `/skip` → chuyển bài tiếp theo trongg queue
4. `/stop` → Bot rời kênh, nhạc tắt
5. `/queue` → hiển thị danh sách hàng đợi
6. Right-click vào participant → popover chỉnh volume hoạt động
7. Tắt tiếng từng member hoạt động cục bộ (không ảnh hưởng user khác)
8. Volume slider trên `MusicPlayerBar` điều chỉnh âm lượng Bot cục bộ

---

## Proposed Changes (Addendum: Slash Command Picker)

### Frontend: Chat Components

#### [NEW] [CommandPicker.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/chat/CommandPicker.tsx)
New popup component, similar to `MentionPicker.tsx`:
- Defines `COMMANDS` list: `/play`, `/skip`, `/stop`, `/queue`.
- Filters available commands based on the slash trigger query text.
- Supports keyboard navigation (ArrowUp, ArrowDown, Enter, Escape).
- Automatically focuses and selects on click or enter.

#### [MODIFY] [MessageInput.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/chat/MessageInput.tsx)
- Integrate `CommandPicker` inside input rendering area.
- Detect `/` at the beginning of the text input and open/close `CommandPicker` dynamically.
- Handle autocomplete text replacement (e.g. replacing `/pl` with `/play ` and positioning cursor).

---

## Verification Plan (Addendum: Slash Command Picker)
- Type `/` at the start of the message input and verify the list matches the screenshots.
- Filter key terms (e.g. `/pl`) and verify the list filters correctly.
- Select via click or Arrow Keys + Enter and verify correct autocomplete behaviour.

---

## Proposed Changes (Addendum: Slash Command Real-time Chat Feedback)

### Backend: Messaging Service (Spring Boot)

#### [MODIFY] [VoiceWebSocketController.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/controller/VoiceWebSocketController.java)
- Implement `sendBotFeedback(String roomId, String channelId, String content)` sending a text message as `music-bot` sender.
- Call `sendBotFeedback` upon receiving `/play`, `/skip`, and `/stop` commands to write bot progress and status updates to the database (`history-service`) and broadcast them to text chat clients.

---

## Proposed Changes (Addendum: Typing Indicator Sync)

### Frontend: Typing Indicator Integration

#### [MODIFY] [Channel Page](file:///e:/UIT/cv/MiniDiscord/frontend/app/%28main%29/channels/%5BserverId%5D/%5BchannelId%5D/page.tsx)
- Select `typingUsers` from `useChatStore` for the current `channelId`.
- Pass `typingUsers` as a prop to the `MessageInput` component.

#### [MODIFY] [DM Chat Page](file:///e:/UIT/cv/MiniDiscord/frontend/app/%28main%29/channels/me/%5BuserId%5D/page.tsx)
- Select `typingUsers` from `useChatStore` for the current `channelId`.
- Pass `typingUsers` as a prop to the `MessageInput` component.

---

## Verification Plan (Addendum: Slash Command Real-time Chat Feedback & Typing Indicators)
- Execute `/play lofi` in chat and verify a "Music Bot" message appears confirming if the track has been successfully extracted and played, or appended to the queue status.
- Press skip/stop and verify the bot posts confirmation feedback in the chat channel.
- Verify through Playwright E2E testing or simulate typing events to confirm typing indicators are rendered below the message input box.

---

## Proposed Changes (Phase 29: Message Deletion Sync & Server Owner Deletion)

> [!IMPORTANT]
> Phương án đã chốt:
> - Ai cũng có quyền xóa tin nhắn. Tin nhắn bản thân → xóa cho mọi người (`EVERYONE`). Tin nhắn người khác → chỉ xóa phía tôi (`FOR_ME`).
> - Admin trong server → xóa tin nhắn member khác cho mọi người (`EVERYONE`).
> - Tin nhắn `isDeleted: true` vẫn hiện placeholder *"Tin nhắn đã bị xóa"* sau reload trang.
> - Owner là thành viên duy nhất → cho phép xóa màu chủ hoàn toàn (cascade delete).

---

### 📍 Phase 29.1: Backend — Hiển thị tin nhắn đã xóa (chat-history-service)

#### [MODIFY] [MessageRepository.java](file:///e:/UIT/cv/MiniDiscord/backend/chat-history-service/src/main/java/com/discordmini/chathistory/repository/MessageRepository.java)

Xóa bỏ `'isDeleted': false` khỏi **tất cả 4 truy vấn** để Backend trả về cả tin nhắn `isDeleted = true`:

```diff
 // Line 16 — First page query
-@Query("{ 'roomId': ?0, 'channelId': ?1, 'isDeleted': false, 'deletedForUsers': { '$nin': [?2] } }")
+@Query("{ 'roomId': ?0, 'channelId': ?1, 'deletedForUsers': { '$nin': [?2] } }")

 // Line 21 — Before cursor query
-@Query("{ 'roomId': ?0, 'channelId': ?1, 'isDeleted': false, 'deletedForUsers': { '$nin': [?2] }, '_id': { '$lt': { '$oid': ?3 } } }")
+@Query("{ 'roomId': ?0, 'channelId': ?1, 'deletedForUsers': { '$nin': [?2] }, '_id': { '$lt': { '$oid': ?3 } } }")

 // Line 27 — After cursor query
-@Query("{ 'roomId': ?0, 'channelId': ?1, 'isDeleted': false, 'deletedForUsers': { '$nin': [?2] }, '_id': { '$gte': { '$oid': ?3 } } }")
+@Query("{ 'roomId': ?0, 'channelId': ?1, 'deletedForUsers': { '$nin': [?2] }, '_id': { '$gte': { '$oid': ?3 } } }")

 // Line 35 — Text search query
-@Query("{ 'roomId': ?0, 'channelId': ?1, 'isDeleted': false, '$text': { '$search': ?2 } }")
+@Query("{ 'roomId': ?0, 'channelId': ?1, 'isDeleted': false, 'deletedForUsers': { '$nin': [?2] }, '$text': { '$search': ?3 } }")
```

> [!NOTE]
> Riêng truy vấn `searchByContent` (text search) **vẫn giữ** `isDeleted: false` vì không cần tìm kiếm nội dung tin nhắn đã xóa. Nhưng cần bổ sung `deletedForUsers` filter và sửa tham số binding.

---

#### [MODIFY] [MessageResponse.java](file:///e:/UIT/cv/MiniDiscord/backend/chat-history-service/src/main/java/com/discordmini/chathistory/model/dto/MessageResponse.java)

Bổ sung trường `isDeleted` vào DTO:

```diff
+    @com.fasterxml.jackson.annotation.JsonProperty("isDeleted")
+    private boolean isDeleted;
```

Cập nhật hàm `from(Message)` để ánh xạ `isDeleted` và **sanitize dữ liệu nhạy cảm**:

```diff
 public static MessageResponse from(Message message) {
-    return MessageResponse.builder()
+    MessageResponseBuilder builder = MessageResponse.builder()
             .id(message.getId())
             .messageId(message.getMessageId())
             .nonce(message.getNonce())
             .roomId(message.getRoomId())
             .channelId(message.getChannelId())
             .senderId(message.getSenderId())
             .senderName(message.getSenderName())
             .senderAvatar(message.getSenderAvatar())
             .type(message.getType())
-            .content(message.getContent())
-            .fileKey(message.getFileKey())
-            .fileName(message.getFileName())
-            .fileSize(message.getFileSize())
             .isEdited(message.isEdited())
             .isPinned(message.isPinned())
             .isForwarded(message.isForwarded())
+            .isDeleted(message.isDeleted())
             .createdAt(message.getCreatedAt())
             .updatedAt(message.getUpdatedAt())
-            .replyTo(message.getReplyTo())
-            .mentions(message.getMentions())
-            .stickerIds(message.getStickerIds())
-            .reactions(...)
-            .build();
+            .replyTo(message.getReplyTo());
+
+    if (message.isDeleted()) {
+        builder.content("")
+               .fileKey(null).fileName(null).fileSize(null)
+               .reactions(List.of()).mentions(List.of()).stickerIds(List.of());
+    } else {
+        builder.content(message.getContent())
+               .fileKey(message.getFileKey())
+               .fileName(message.getFileName())
+               .fileSize(message.getFileSize())
+               .mentions(message.getMentions())
+               .stickerIds(message.getStickerIds())
+               .reactions(message.getReactions() != null ? message.getReactions().stream()
+                   .map(r -> ReactionResponse.builder()
+                       .emoji(r.getEmoji())
+                       .userIds(r.getUserIds() != null ? r.getUserIds() : List.of())
+                       .count(r.getUserIds() != null ? r.getUserIds().size() : 0)
+                       .build())
+                   .collect(Collectors.toList()) : List.of());
+    }
+    return builder.build();
 }
```

---

#### [MODIFY] [MessageService.java](file:///e:/UIT/cv/MiniDiscord/backend/chat-history-service/src/main/java/com/discordmini/chathistory/service/MessageService.java)

Sửa hàm `advancedSearch` (line 94-96) xóa `isDeleted: false` khỏi `Criteria`:

```diff
-        Criteria criteria = Criteria.where("roomId").is(roomId)
-                .and("channelId").is(channelId)
-                .and("isDeleted").is(false);
+        Criteria criteria = Criteria.where("roomId").is(roomId)
+                .and("channelId").is(channelId)
+                .and("isDeleted").is(false)
+                .and("deletedForUsers").nin(userId);
```

> [!NOTE]
> `advancedSearch` giữ `isDeleted: false` (vì kết quả search không nên trả về placeholder *"đã xóa"*), nhưng cần bổ sung `deletedForUsers` filter.

---

### 📍 Phase 29.2: Frontend — Khôi phục "Delete For Me" & Phân quyền xóa

#### [MODIFY] [MessageItem.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/chat/MessageItem.tsx)

**Thay đổi 1:** Mở khóa `canDelete` để tất cả tin nhắn đều có nút Xóa (line 597):

```diff
-          canDelete={isOwnMessage || canDeletePermission}
+          canDelete={true}
```

**Thay đổi 2:** Hàm `handleDelete` (line 195-200) đã đúng logic routing:
```typescript
// Giữ nguyên — không cần sửa
function handleDelete() {
  if (channelId) {
    const type = (message.senderId === currentUserId || canDeletePermission) ? "EVERYONE" : "FOR_ME";
    deleteMessage(channelId, apiId, type);
  }
}
```

Logic hiện tại:
- Tin nhắn **của bản thân** (bất kỳ context nào: DM, Server) → `"EVERYONE"` → đánh dấu `isDeleted = true` trong DB.
- Tin nhắn **của người khác** khi là Admin/Owner có quyền `DELETE_ANY_MESSAGE` → `"EVERYONE"`.
- Tin nhắn **của người khác** khi không có quyền → `"FOR_ME"` → thêm userId vào `deletedForUsers[]`, chỉ ẩn ở phía người yêu cầu.

---

### 📍 Phase 29.3: Backend — Cascade Delete Room cho Owner duy nhất (group-channel-service)

#### [MODIFY] [MembershipService.java](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/service/MembershipService.java)

Cập nhật hàm `leaveRoom` (line 351-374) để kiểm tra số thành viên trước khi chặn Owner:

```diff
 @Transactional
 public void leaveRoom(UUID roomId, UUID userId) {
     Room room = roomRepository.findById(roomId)
             .orElseThrow(() -> new RoomNotFoundException("Room not found"));

     if (room.getOwnerId().equals(userId)) {
-        throw new BaseException("Owner cannot leave the room", HttpStatus.BAD_REQUEST, "BAD_REQUEST");
+        long memberCount = participantRepository.countByRoomId(roomId);
+        if (memberCount == 1) {
+            // Owner là thành viên duy nhất → Cascade delete room
+            roomService.deleteRoomCascade(roomId);
+            return;
+        }
+        throw new BaseException("Owner cannot leave the room without transferring ownership", HttpStatus.BAD_REQUEST, "BAD_REQUEST");
     }
     // ... phần còn lại giữ nguyên
 }
```

> [!WARNING]
> `MembershipService` đã inject `RoomService` (thông qua constructor). Nếu bị circular dependency, cần inject `RoomService` qua `@Lazy`.

---

#### [MODIFY] [RoomService.java](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/service/RoomService.java)

Thêm hàm `deleteRoomCascade` mới. Service này đã inject sẵn:
- `channelRepository`, `participantRepository`, `roleRepository`, `rolePermissionRepository`
- Cần inject thêm: `InviteLinkRepository`, `RoomBanRepository`

```java
@Transactional
public void deleteRoomCascade(UUID roomId) {
    Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new RoomNotFoundException("Room not found"));

    // 1. Xóa tất cả dữ liệu phụ thuộc
    channelRepository.deleteByRoomId(roomId);
    participantRepository.deleteByRoomId(roomId);
    inviteLinkRepository.deleteByRoomId(roomId);
    roomBanRepository.deleteByRoomId(roomId);

    // 2. Xóa permissions & roles
    List<Role> roles = roleRepository.findByRoomId(roomId);
    for (Role role : roles) {
        rolePermissionRepository.deleteByRoleId(role.getId());
    }
    roleRepository.deleteByRoomId(roomId);

    // 3. Xóa Room
    roomRepository.delete(room);

    log.info("Room {} cascade deleted", roomId);
}
```

> [!IMPORTANT]
> Cần bổ sung các phương thức `deleteByRoomId(UUID roomId)` vào các Repository: `ChannelRepository`, `RoomParticipantRepository`, `InviteLinkRepository`, `RoomBanRepository`, `RoleRepository`. Và bổ sung `deleteByRoleId(UUID roleId)` vào `RolePermissionRepository`.

---

### 📍 Phase 29.4: Frontend — Nâng cấp UX Modal cho Owner rời Server

#### [MODIFY] [ChannelList.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/sidebar/ChannelList.tsx)

**Thay đổi 1:** Thêm state mới cho modal xác nhận xóa server (line ~274):
```diff
   const [isOwnerWarningOpen, setIsOwnerWarningOpen] = useState(false);
+  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
```

**Thay đổi 2:** Cập nhật logic onClick nút Leave (line 408-416):
```diff
 onClick={() => {
   setIsDropdownOpen(false);
   const isOwner = room?.ownerId === currentUserId;
+  const currentMembers = members[displayRoomId!] || [];
   if (isOwner) {
-    setIsOwnerWarningOpen(true);
+    if (currentMembers.length <= 1) {
+      setIsDeleteConfirmOpen(true);
+    } else {
+      setIsOwnerWarningOpen(true);
+    }
   } else {
     setIsLeaveOpen(true);
   }
 }}
```

**Thay đổi 3:** Thêm `ConfirmModal` mới cho hành vi xóa server (sau dòng 537):
```tsx
{isDeleteConfirmOpen && displayRoomId && (
  <ConfirmModal
    title={t("leaveServerModal.deleteServerTitle")}
    description={t("leaveServerModal.deleteServerDesc")}
    confirmText={t("leaveServerModal.deleteServerConfirm")}
    onClose={() => setIsDeleteConfirmOpen(false)}
    onConfirm={async () => {
      try {
        await leaveRoom(displayRoomId);
        router.push("/channels/me");
      } catch (err: any) {
        console.error("Failed to delete server:", err);
      }
    }}
    variant="danger"
  />
)}
```

> [!NOTE]
> API gọi vẫn là `leaveRoom(roomId)` (tức `DELETE /api/rooms/{roomId}/members/me`). Backend sẽ tự phát hiện Owner là thành viên cuối cùng và thực hiện cascade delete.

---

#### [MODIFY] [en.json](file:///e:/UIT/cv/MiniDiscord/frontend/dictionaries/en.json) & [vi.json](file:///e:/UIT/cv/MiniDiscord/frontend/dictionaries/vi.json)

Bổ sung i18n keys:
```json
{
  "leaveServerModal": {
    "deleteServerTitle": "Delete Server",
    "deleteServerDesc": "You are the last member. Leaving will permanently delete this server and all its data. This action cannot be undone.",
    "deleteServerConfirm": "Delete Server"
  }
}
```

---

## Verification Plan (Phase 29)

### Automated Tests
- `npx tsc --noEmit` — Frontend compile check
- Docker rebuild `chat-history-service` và `group-channel-service`

### Manual Verification
1. Xóa tin nhắn bản thân → hiện placeholder *"Tin nhắn đã bị xóa"* → reload trang → placeholder vẫn hiện
2. Xóa tin nhắn người khác (không phải Admin) → tin nhắn chỉ ẩn ở phía tôi → người kia vẫn thấy
3. Admin xóa tin nhắn member → hiện placeholder cho mọi người → reload → placeholder vẫn hiện
4. Trong DM: Xóa tin nhắn đối phương → ẩn phía tôi, đối phương vẫn thấy bình thường
5. Owner là thành viên duy nhất → click "Leave Server" → hiện modal "Xóa máy chủ" → xác nhận → server bị xóa hoàn toàn
6. Owner có > 1 member → click "Leave Server" → hiện cảnh báo "Phải chuyển nhượng quyền"
7. Member thường → click "Leave Server" → xác nhận rời → chuyển hướng về `/channels/me`

