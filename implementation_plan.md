# Voice Channel Security: Restrict (Mute) & Ban Implementation

Triển khai hệ thống bảo mật và kiểm duyệt cho Voice Channel gồm 3 Phase: Voice Guard (chặn mic), Kill Switch (ép ngắt WebRTC khi Ban), và Auto-Release (tự gỡ phạt khi hết thời hạn).

## User Review Required

> [!IMPORTANT]
> **Backend chưa có endpoint Unmute riêng.** Phase 1 sẽ tái sử dụng API `POST /rooms/{roomId}/members/{userId}/mute` với `durationMinutes: 0` để xóa `mutedUntil`. Nếu bạn muốn thiết kế endpoint riêng (ví dụ: `DELETE /rooms/{roomId}/members/{userId}/mute`), cần thêm code Backend.

> [!WARNING]
> **Ban Kill Switch** hiện tại dùng `window.location.href` để redirect (gây full-page reload). Plan này sẽ thay bằng lệnh teardown WebRTC trực tiếp + `router.push()` để ngắt kết nối nhanh hơn và mượt hơn.

---

## Proposed Changes

### Phase 1: Voice Guard & Unmute Toggle

Khóa nút Mic khi user bị Restrict, và cho phép Admin gỡ phạt sớm.

---

#### [MODIFY] [voiceStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/voiceStore.ts)

**Thay đổi hàm [toggleMute](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/controller/VoiceWebSocketController.java#115-141) (L248-298):**
- Thêm guard đầu hàm: Lấy `mutedUntil` của current user từ `useRoomStore` → nếu `mutedUntil` còn hiệu lực, **block toggle** và return sớm
- Export thêm một helper selector `getIsServerMuted(roomId)` để [VoiceControlBar](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/VoiceControlBar.tsx#14-98) dùng

```diff
 toggleMute: () => {
   resumeAudioContext();
+  // ── Server-Mute Guard ──
+  const currentUserId = useAuthStore.getState().user?.id;
+  const currentChannel = get().currentChannel;
+  if (currentChannel && currentUserId) {
+    const members = useRoomStore.getState().members[currentChannel.roomId] || [];
+    const me = members.find(m => m.userId === currentUserId);
+    if (me?.mutedUntil && new Date(me.mutedUntil).getTime() > Date.now()) {
+      return; // Blocked by server mute
+    }
+  }
   const isCurrentlyMuted = get().isMuted;
   // ... rest stays the same
```

---

#### [MODIFY] [VoiceControlBar.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/VoiceControlBar.tsx)

**Thêm UI feedback khi bị server-mute (toàn bộ file, ~98 dòng):**

1. Import thêm `useRoomStore`, `useAuthStore`, `AlertTriangle` (icon cảnh báo)
2. Derive `isServerMuted` = kiểm tra `mutedUntil` của current user trong `useRoomStore`
3. Khi `isServerMuted`:
   - Nút Mic: `disabled={true}`, icon luôn hiển thị `MicOff`, style đổi sang `bg-[#f59e0b]` (amber = server-mute, phân biệt với đỏ = self-mute)
   - Thêm Tooltip hoặc `title` attribute: `"Quản trị viên đã khóa mic của bạn"`
4. Đếm ngược `timeLeft` bằng `useEffect` + `setInterval` (tương tự logic có sẵn trong [MessageInput.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/chat/MessageInput.tsx) L68-92)

```tsx
// Derive server mute state
const currentUser = useAuthStore((s) => s.user);
const currentChannel = useVoiceStore((s) => s.currentChannel);
const members = useRoomStore((s) =>
  currentChannel ? s.members[currentChannel.roomId] || [] : []
);
const me = members.find((m) => m.userId === currentUser?.id);
const serverMutedUntil = me?.mutedUntil ? new Date(me.mutedUntil) : null;
const isServerMuted = serverMutedUntil ? serverMutedUntil.getTime() > Date.now() : false;
```

---

#### [MODIFY] [UserProfileCard.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/chat/UserProfileCard.tsx)

**Thêm nút Unmute cho Admin (L305-316 vùng Restrict button):**

1. Import `mutedUntil` từ `useRoomStore` cho target user (member đang được click)
2. Kiểm tra: Nếu `targetMember.mutedUntil > now()` → hiển thị nút **"Unmute Member"** thay vì "Mute Member"
3. Hành động Unmute: Gọi `api.post(\`/rooms/${roomId}/members/${userId}/mute\`, { durationMinutes: 0 })`
4. Cập nhật i18n keys ([vi.json](file:///e:/UIT/cv/MiniDiscord/frontend/dictionaries/vi.json) và [en.json](file:///e:/UIT/cv/MiniDiscord/frontend/dictionaries/en.json))

```diff
 {canRestrict && (
   <button
-    onClick={() => { setIsMuteModalOpen(true); ... }}
+    onClick={() => {
+      if (isTargetMuted) {
+        handleUnmute();    // Gọi API mute(duration=0)
+      } else {
+        setIsMuteModalOpen(true);
+      }
+    }}
     className="..."
   >
     <VolumeX className="h-3.5 w-3.5" />
-    <span>{t("chat.restrictMember")}</span>
+    <span>{isTargetMuted ? t("chat.unmuteMember") : t("chat.restrictMember")}</span>
   </button>
 )}
```

---

#### [MODIFY] [vi.json](file:///e:/UIT/cv/MiniDiscord/frontend/dictionaries/vi.json) & [en.json](file:///e:/UIT/cv/MiniDiscord/frontend/dictionaries/en.json)

Thêm keys mới:

| Key | VI | EN |
|-----|----|----|
| `chat.unmuteMember` | `"Gỡ hạn chế"` | `"Unmute Member"` |
| `voice.serverMuted` | `"Mic bị khóa bởi quản trị viên"` | `"Mic locked by admin"` |
| `voice.serverMutedUntil` | `"Mic bị khóa đến {time}"` | `"Mic locked until {time}"` |

---

### Phase 2: Ban Kill Switch — Ép ngắt WebRTC

Cắt toàn bộ kết nối Real-time ngay lập tức khi nhận lệnh Ban.

---

#### [MODIFY] [useWebSocket.ts](file:///e:/UIT/cv/MiniDiscord/frontend/hooks/useWebSocket.ts)

**Cập nhật handler `MEMBER_BANNED` (L252-266):**

```diff
 if (eventType === "MEMBER_BANNED") {
   if (data.roomId) {
     useRoomStore.getState().fetchMembers(data.roomId, undefined, true);
     const currentUserId = useAuthStore.getState().user?.id;
     if (data.userId === currentUserId) {
+      // ── Kill Switch: Teardown WebRTC trước khi redirect ──
+      const voiceState = useVoiceStore.getState();
+      if (voiceState.currentChannel?.roomId === data.roomId) {
+        voiceState.leaveVoiceChannel();
+      }
+      if (voiceState.activeCallRoomId === data.roomId) {
+        voiceState.endCall();
+      }
       useRoomStore.getState().fetchMyRooms(true);
-      alert("Bạn đã bị cấm...");
-      if (...) { window.location.href = "/channels/me"; }
+      // Redirect mượt không reload trang
+      if (typeof window !== "undefined") {
+        window.location.replace("/channels/me");
+      }
+    } else {
+      // Người ở lại: Xóa user bị ban khỏi participant grid
+      const voiceState = useVoiceStore.getState();
+      const channels = useRoomStore.getState().channels[data.roomId] || [];
+      channels.forEach((ch) => {
+        voiceState.handleVoiceStateUpdate({
+          channelId: ch.id,
+          userId: data.userId,
+          action: "LEAVE",
+        });
+      });
     }
   }
 }
```

---

### Phase 3: Hydration & Auto-Release

Đảm bảo trạng thái mute đồng bộ khi reconnect và tự gỡ khi hết hạn.

---

#### [MODIFY] [VoiceControlBar.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/VoiceControlBar.tsx)

**Thêm auto-release timer (cùng đợt sửa Phase 1):**

```tsx
// Auto-release: Khi countdown chạm 0 → force re-render để bỏ disabled
const [, forceUpdate] = useState(0);
useEffect(() => {
  if (!serverMutedUntil) return;
  const remaining = serverMutedUntil.getTime() - Date.now();
  if (remaining <= 0) return;
  const timer = setTimeout(() => forceUpdate((n) => n + 1), remaining);
  return () => clearTimeout(timer);
}, [serverMutedUntil]);
```

---

#### [MODIFY] [useWebSocket.ts](file:///e:/UIT/cv/MiniDiscord/frontend/hooks/useWebSocket.ts)

**Bổ sung handler `MEMBER_UNMUTED` (sau block `MEMBER_MUTED` hiện tại ở L244-249):**

```tsx
if (eventType === "MEMBER_UNMUTED") {
  console.log("[STOMP] MEMBER_UNMUTED received for room:", data.roomId);
  if (data.roomId) {
    useRoomStore.getState().fetchMembers(data.roomId, undefined, true);
  }
  return;
}
```

> [!NOTE]
> Sự kiện `MEMBER_UNMUTED` chỉ cần thiết nếu Backend broadcast event riêng khi Admin unmute. Nếu Backend tái sử dụng `MEMBER_MUTED` cho cả hai trường hợp (mutedUntil=null tức unmute), thì handler `MEMBER_MUTED` hiện tại đã đủ vì nó gọi [fetchMembers](file:///e:/UIT/cv/MiniDiscord/frontend/stores/roomStore.ts#103-144) lấy lại data mới nhất.

---

## Verification Plan

### Automated Tests
```bash
# TypeScript compile check
cd e:/UIT/cv/MiniDiscord/frontend && npx tsc --noEmit
```

### Manual Verification

| # | Kịch bản | Kỳ vọng |
|---|----------|---------|
| 1 | Admin mute member đang ở voice channel | Nút Mic người bị mute bị khóa (amber), tooltip hiển thị thời gian |
| 2 | Hết thời gian mute | Nút Mic tự sáng lại mà không cần F5 |
| 3 | Admin unmute sớm qua Profile Card | Nút Mic mở khóa ngay lập tức |
| 4 | Admin ban member đang ở voice channel | WebRTC bị ngắt + redirect về `/channels/me` |
| 5 | Người ở lại voice sau khi 1 member bị ban | Avatar của member bị ban biến mất khỏi grid |
| 6 | F5/Reconnect khi đang bị mute | `mutedUntil` được hydrate từ API → Mic vẫn bị khóa |
