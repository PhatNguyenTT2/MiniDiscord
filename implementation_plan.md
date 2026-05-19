# Fix Chat History: Sort Order + Timezone

## Bug 1: Sort Order Reversed

**Root Cause**: `MessageService.getMessages()` queries `Sort.by(DESC, "_id")` (correct for pagination — fetch newest page first). But returns results directly → frontend renders DESC (newest on top) instead of ASC (newest at bottom).

#### [MODIFY] [MessageService.java](file:///e:/UIT/cv/MiniDiscord/backend/chat-history-service/src/main/java/com/discordmini/chathistory/service/MessageService.java) (~line 38)

```diff
- return messages.stream().map(MessageResponse::from).toList();
+ // DESC for cursor pagination, then reverse for chronological display
+ return messages.stream()
+     .map(MessageResponse::from)
+     .collect(java.util.stream.Collectors.toList())
+     .reversed();
```

---

## Bug 2: Timezone — `LocalDateTime` lacks UTC marker

**Root Cause**: `LocalDateTime` has NO timezone info. Docker container runs UTC → `LocalDateTime.now()` = UTC time. Jackson serializes `"2026-05-19T17:00:00"` (no `Z`). Frontend `new Date("...")` treats it as LOCAL time → shows 17:00 VN instead of 00:00 VN (next day).

**Fix**: Change `LocalDateTime` → `Instant` throughout chat-history-service. `Instant` is UTC-aware and Jackson serializes as ISO with `Z` suffix.

#### [MODIFY] [Message.java](file:///e:/UIT/cv/MiniDiscord/backend/chat-history-service/src/main/java/com/discordmini/chathistory/model/document/Message.java)

```diff
- import java.time.LocalDateTime;
+ import java.time.Instant;

- private LocalDateTime createdAt;
- private LocalDateTime updatedAt;
- private LocalDateTime deletedAt;
+ private Instant createdAt;
+ private Instant updatedAt;
+ private Instant deletedAt;
```

#### [MODIFY] [MessageResponse.java](file:///e:/UIT/cv/MiniDiscord/backend/chat-history-service/src/main/java/com/discordmini/chathistory/model/dto/MessageResponse.java)

```diff
- import java.time.LocalDateTime;
+ import java.time.Instant;

- private LocalDateTime createdAt;
- private LocalDateTime updatedAt;
+ private Instant createdAt;
+ private Instant updatedAt;
```

#### [MODIFY] [MessageEventListener.java](file:///e:/UIT/cv/MiniDiscord/backend/chat-history-service/src/main/java/com/discordmini/chathistory/listener/MessageEventListener.java)

```diff
- .createdAt(event.getCreatedAt() != null ? event.getCreatedAt() : LocalDateTime.now())
+ .createdAt(Instant.now())
```

#### [MODIFY] [MessageService.java](file:///e:/UIT/cv/MiniDiscord/backend/chat-history-service/src/main/java/com/discordmini/chathistory/service/MessageService.java) (softDeleteMessage)

```diff
- message.setDeletedAt(LocalDateTime.now());
+ message.setDeletedAt(Instant.now());
```

---

## Also Fix: i18n date formatting (frontend)

#### [MODIFY] [i18n.ts](file:///e:/UIT/cv/MiniDiscord/frontend/lib/i18n.ts)
Add `getDateLocale()` utility → replace hardcoded `"vi-VN"` in 4 files.

---

## Verification
1. Rebuild backend → send new messages → reload → timestamps show VN local time
2. Message order: newest at BOTTOM after reload
3. Date locale switches with en/vi setting
