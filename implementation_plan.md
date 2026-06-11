# Plan: Nonce-Based Message Synchronization & Idempotency Guard

Triệt tiêu lỗi **False-Positive FAILED** và **trùng lặp tin nhắn khi Retry** bằng cơ chế `nonce` (Client Reference ID) xuyên suốt pipeline: Frontend → STOMP → Messaging Service → RabbitMQ → Chat History Service → MongoDB.

## Proposed Changes

---

### Component 1: Common Library — Event DTO

#### [MODIFY] [MessageEvent.java](file:///e:/UIT/cv/MiniDiscord/backend/common-lib/src/main/java/com/discordmini/common/event/MessageEvent.java)

Thêm trường `nonce` để RabbitMQ event mang theo Client Reference ID.

```diff
 public class MessageEvent implements Serializable {
     private String id;
     private String messageId;
+    private String nonce;  // Client Reference ID for ACK matching
     private String roomId;
```

---

### Component 2: Messaging Service — WebSocket Endpoint

#### [MODIFY] [ChatMessage.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/model/dto/ChatMessage.java)

```diff
 public class ChatMessage {
+    private String nonce;  // Client Reference ID
     private List<String> mentions;
```

#### [MODIFY] [ChatWebSocketController.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/controller/ChatWebSocketController.java)

Map `nonce` từ [ChatMessage](file:///e:/UIT/cv/MiniDiscord/frontend/types/message.ts#40-49) sang [MessageEvent](file:///e:/UIT/cv/MiniDiscord/backend/common-lib/src/main/java/com/discordmini/common/event/MessageEvent.java#12-38) trước khi publish qua RabbitMQ.

```diff
 MessageEvent event = MessageEvent.builder()
     .id(objectId)
     .messageId(message.getMessageId())
+    .nonce(message.getNonce())
     .roomId(message.getRoomId())
```

---

### Component 3: Chat History Service — MongoDB & Idempotency

#### [MODIFY] [Message.java](file:///e:/UIT/cv/MiniDiscord/backend/chat-history-service/src/main/java/com/discordmini/chathistory/model/document/Message.java)

```diff
 public class Message {
+    @Indexed
+    private String nonce;  // Client Reference ID — indexed for idempotency lookup
     private String roomId;
```

#### [MODIFY] [MessageRepository.java](file:///e:/UIT/cv/MiniDiscord/backend/chat-history-service/src/main/java/com/discordmini/chathistory/repository/MessageRepository.java)

```diff
+Optional<Message> findByNonce(String nonce);
```

#### [MODIFY] [MessageEventListener.java](file:///e:/UIT/cv/MiniDiscord/backend/chat-history-service/src/main/java/com/discordmini/chathistory/listener/MessageEventListener.java)

> [!IMPORTANT]
> **Critical Gotcha từ review**: Khi phát hiện nonce trùng, **KHÔNG return rỗng** mà phải query lại tin nhắn cũ → build event từ dữ liệu cũ → re-broadcast qua RabbitMQ để Frontend nhận ACK với `_id` thật và timestamp gốc.

```diff
 @RabbitListener(queues = "chat-history.message.queue")
 public void onMessageEvent(MessageEvent event) {
+    // Idempotency Guard: check nonce before insert
+    if (event.getNonce() != null && !event.getNonce().isEmpty()) {
+        Optional<Message> existing = messageRepository.findByNonce(event.getNonce());
+        if (existing.isPresent()) {
+            log.info("Idempotency hit for nonce: {}. Re-broadcasting existing message.", event.getNonce());
+            // Re-broadcast existing message so Frontend clears FAILED state
+            broadcastExistingMessage(existing.get(), event);
+            return;
+        }
+    }
+
     // ... existing build + insert logic ...
+    message.setNonce(event.getNonce()); // Map nonce to document
```

Helper method `broadcastExistingMessage` sẽ build lại [MessageEvent](file:///e:/UIT/cv/MiniDiscord/backend/common-lib/src/main/java/com/discordmini/common/event/MessageEvent.java#12-38) từ [Message](file:///e:/UIT/cv/MiniDiscord/frontend/types/message.ts#3-27) entity đã lưu trong DB và publish qua RabbitMQ `chat.exchange` routing key `message.system` (hoặc gọi lại fan-out logic nếu cần).

---

### Component 4: Frontend — Nonce Matching

#### [MODIFY] [chatStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/chatStore.ts)

Thay đổi [receiveMessage](file:///e:/UIT/cv/MiniDiscord/frontend/stores/chatStore.ts#717-757) để match bằng `nonce` thay vì `senderId + content`:

```diff
-const optimisticIdx = existing.findIndex(
-  (m) => m.id.startsWith("optimistic-") && m.senderId === message.senderId && m.content === message.content
-);
+const optimisticIdx = message.nonce
+  ? existing.findIndex((m) => m.nonce === message.nonce && m.status === 'SENDING')
+  : -1;
```

#### [MODIFY] [page.tsx (Server)](file:///e:/UIT/cv/MiniDiscord/frontend/app/(main)/channels/[serverId]/[channelId]/page.tsx) & [page.tsx (DM)](file:///e:/UIT/cv/MiniDiscord/frontend/app/(main)/channels/me/[userId]/page.tsx)

Sinh `nonce` via `crypto.randomUUID()`, gán vào cả optimistic message lẫn STOMP payload:

```diff
+const nonce = crypto.randomUUID();
 const optimisticMsg: Message = {
   id: tempId,
+  nonce,
   status: client.connected ? "SENDING" : "FAILED",
   // ...
 };
 const payload = {
+  nonce,
   // ...
 };
```

#### [MODIFY] [message.ts](file:///e:/UIT/cv/MiniDiscord/frontend/types/message.ts)

```diff
 export interface Message {
+  nonce?: string;
   status?: MessageStatus;
```

---

## Verification Plan

### Automated Tests
- `mvn clean test` trên backend (đảm bảo [MessageEventListener](file:///e:/UIT/cv/MiniDiscord/backend/chat-history-service/src/main/java/com/discordmini/chathistory/listener/MessageEventListener.java#15-63) xử lý idempotency đúng)
- `npx tsc --noEmit` trên frontend

### Manual Verification
1. Gửi tin nhắn bình thường → SENDING → SENT (ACK match bằng nonce)
2. Tắt backend → gửi tin → FAILED ngay lập tức
3. Bật lại backend → bấm **Retry** → tin nhắn gửi lại, ACK đúng, **không trùng lặp** trong DB
4. Spam Retry 5 lần liên tiếp → DB chỉ chứa **1 bản ghi** nhờ idempotency guard
