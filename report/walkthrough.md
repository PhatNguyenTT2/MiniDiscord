# Walkthrough — Video Call & Display Name Support Implementation

Đã hoàn thành xuất sắc toàn bộ lộ trình triển khai tính năng **Gọi Video (Video Call)**, đồng bộ hóa trạng thái camera, khắc phục hiển thị **Display Name** và hoàn thiện giao diện kéo giãn DmCallView cùng tự động ẩn User Panel trên MiniDiscord.

---

## 1. Đồng bộ hiển thị nút bật/tắt Camera & Màu nền (Phase 9 & 11)
- **Tệp sửa đổi:** [VoiceChannelView.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/VoiceChannelView.tsx), [DmCallView.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/DmCallView.tsx)
- **Giải pháp:**
  - Nhập khẩu thành công icon `VideoOff` từ `lucide-react`.
  - Khi `isVideoOn` là `true` (camera đang hoạt động): Hiển thị icon camera xanh `<Video className="h-5 w-5" />` với nền xanh lá `bg-[#23a55a]`.
  - Khi `isVideoOn` là `false` (camera đang tắt - mặc định): Hiển thị icon camera có gạch chéo `<VideoOff className="h-5 w-5" />` với nền đỏ `bg-[#ed4245] hover:bg-[#c93b3e] text-white` giống như nút Mute/Deafen.

---

## 2. Thiết lập mặc định bật camera cho Video Call (Phase 11)
- **Tệp sửa đổi:** [page.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/app/%28main%29/channels/me/%5BuserId%5D/page.tsx), [voiceStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/voiceStore.ts)
- **Quy tắc:**
  - Khi nhấn **Gọi Video** trong trang DM: gán `isVideoOn: true` và bắt đầu gọi.
  - Khi nhấn **Gọi Thoại** (Phone Call) trong trang DM: reset `isVideoOn: false` trước khi gọi.
  - Khi **Nhận cuộc gọi** hoặc **Tham gia Voice Channel**: reset `isVideoOn: false` mặc định tắt camera.

---

## 3. Tự động ẩn User Panel khi có cuộc gọi DM (Phase 11)
- **Tệp sửa đổi:** [page.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/app/%28main%29/channels/me/%5BuserId%5D/page.tsx)
- **Giải pháp:** 
  - Vùng điều khiển Column 4 (DmUserPanel) tự động co về chiều rộng `0px` khi có cuộc gọi đang diễn ra (`activeCallRoomId === roomId`).
  - Nút bấm Toggle User Panel trên Header bar cũng sẽ tự động ẩn đi để tránh tương tác thừa khi cuộc gọi đang chạy.

---

## 4. Cho phép kéo điều chỉnh kích thước DmCallView (Phase 11 & 12)
- **Tệp sửa đổi:** [page.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/app/%28main%29/channels/me/%5BuserId%5D/page.tsx), [DmCallView.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/DmCallView.tsx)
- **Giải pháp:**
  - Tăng kích thước mặc định hiển thị của cuộc gọi DM từ `260px` lên `360px` để trải nghiệm người dùng tối ưu hơn.
  - Cung cấp prop `height` cho `DmCallView` (mặc định `360px`) và gán inline style của container để hỗ trợ kích thước tùy biến.
  - Bổ sung thanh kéo phân chia `<div className="h-1 bg-[#1f2023]/60 cursor-row-resize hover:bg-[#5865f2] ..."` ngay bên dưới cuộc gọi.
  - Kéo chuột lên/xuống tương tác kéo giãn vùng gọi trong phạm vi an toàn từ `180px` đến `600px`, các thành phần chat tự động co giãn tương thích.

---

## 5. Hỗ trợ hiển thị Display Name tại Cột 3 & Cột 4 (Phase 10)
- **Tệp sửa đổi:** 
  - **Backend DTO:** [FriendService.java](file:///e:/UIT/cv/MiniDiscord/backend/user-service/src/main/java/com/discordmini/user/service/FriendService.java)
  - **Frontend UI:** [ActiveNowPanel.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/friends/ActiveNowPanel.tsx)
- **Giải pháp:**
  - Cập nhật backend `mapToUserResponse` để lấy chính xác và gán trường `displayName` từ đối tượng [User](file:///e:/UIT/cv/MiniDiscord/frontend/components/ui/StatusAvatar.tsx#6-7) vào `UserResponse` DTO. Bảng dữ liệu được biên dịch lại và deploy runtime container thành công.
  - Cập nhật frontend `ActiveNowPanel.tsx` hiển thị `{friend.user.displayName || friend.user.username}` thay vì hiển thị trực tiếp username cứng.

---

## 6. Đồng bộ Webcam vật lý và tải thiết bị động (Phase 12)
- **Tệp sửa đổi:** [webrtc.ts](file:///e:/UIT/cv/MiniDiscord/frontend/lib/webrtc.ts), [voiceStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/voiceStore.ts)
- **Giải pháp:**
  - Không gọi video constraints mặc định trong `getUserMedia` (gán `video: false` khi `isVideoOn` là false). Điều này bảo vệ quyền riêng tư và đảm bảo đèn camera vật lý của người dùng không tự ý bật lên khi họ mới join voice channel.
  - Khi bật camera: Gọi lấy luồng camera động ở runtime và đính kèm vào stream, add tracks vào các Peer Connections để thực hiện đàm thoại video.
  - Khi tắt camera: Gọi `videoTrack.stop()` để lập tức ra lệnh cho đầu lọc phần cứng dừng hoạt động, làm đèn báo LED tắt ngay tức khắc. Đồng thời giải phóng và remove track ra khỏi các Remote Peer Connections.

---

## 7. Khắc phục các lỗi TypeError tại Inbox Popover và Friend List (Phase 13)
- **Tệp sửa đổi:** 
  - **Backend Controllers:** [NotificationController.java](file:///e:/UIT/cv/MiniDiscord/backend/user-service/src/main/java/com/discordmini/user/controller/NotificationController.java), [FriendController.java](file:///e:/UIT/cv/MiniDiscord/backend/user-service/src/main/java/com/discordmini/user/controller/FriendController.java)
  - **Frontend Stores:** [inboxStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/inboxStore.ts), [friendStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/friendStore.ts)
- **Giải pháp:**
  - Đồng bộ chuẩn hóa dữ liệu trả về ở Spring Boot controller: bọc danh sách trả về của [getNotifications](file:///e:/UIT/cv/MiniDiscord/backend/user-service/src/main/java/com/discordmini/user/controller/NotificationController.java#24-31), `getFriends`, và `getPendingRequests` trong đối tượng `ApiResponse` để thống nhất với API Gateway và các microservices khác của của dự án.
  - Tích hợp thêm cơ chế parse phòng thủ (defensive parsing) trên frontend: Stores ([inboxStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/inboxStore.ts), [friendStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/friendStore.ts)) tự động kiểm tra `res.data` là một mảng thô hay một đối tượng ApiResponse chứa `.data` là mảng. Nếu không parse được, gán mặc định là một mảng rỗng `[]`. Điều này ngăn chặn triệt để các lỗi crash runtime `notifications.filter is not a function` hoặc `friends.find is not a function`.

---

## 8. Sửa lỗi Hook mismatch tại UserPanel (Phase 14)
- **Tệp sửa đổi:** [UserPanel.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/sidebar/UserPanel.tsx)
- **Giải pháp:** Di chuyển toàn bộ các hook như `useVoiceStore`, `useRoomStore`, [useState](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/MusicPlayerBar.tsx#86-87), `useEffect` từ phía bên dưới câu lệnh kiểm tra `if (!user)` lên phía bên trên. Điều này tuân thủ quy tắc Hook của React (Rules of Hooks), đảm bảo số lượng và thứ tự chạy hook luôn cố định, loại bỏ lỗi crash runtime `Rendered fewer hooks than expected`.

---

## 9. Sửa lỗi Avatar Fallback & Định tuyến Đàm phán lại WebRTC (Phase 15)
- **Tệp sửa đổi:** [ChannelList.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/sidebar/ChannelList.tsx), [webrtc.ts](file:///e:/UIT/cv/MiniDiscord/frontend/lib/webrtc.ts)
- **Giải pháp:**
  - Trong [ChannelList.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/sidebar/ChannelList.tsx): Thay đổi `fallback={p.username}` thành `fallback={displayName}` trong `<StatusAvatar />`. Giúp initials hiển thị đúng chữ cái đầu của Display Name (ví dụ "BA" cho baoyen) thay vì hiển thị "US" từ username nội bộ `user-xxxxx`.
  - Trong `webrtc.ts`:
    - Ở `pc.ontrack`: Khởi tạo wrapper `new MediaStream(event.streams[0].getTracks())` để đổi tham chiếu MediaStream mới khi nhận thêm track video/audio. Điều này thông báo cho React/Zustand cập nhật trigger re-render video element trên lưới.
    - Ở `pc.onnegotiationneeded`: Thêm guard kiểm tra `pc.signalingState !== "stable"` để ngăn đàm phán trùng lặp khi trạng thái kết nối bất ổn.
    - Ở `handleOffer`: Khi gặp xung đột offer (glare condition / signaling state `have-local-offer`), tiến hành `rollback` description trước khi nạp offer mới để tái sử dụng peer hiện tại sạch sẽ thay vì vứt bỏ tạo mới.

---

## Kết quả kiểm thử thành công
- Lệnh kiểm tra chất lượng mã nguồn biên dịch `npx tsc --noEmit` hoàn thành thành công 100% không cảnh báo/lỗi ở frontend.
- Cải thiện độ tin cậy và đồng bộ hóa chuẩn định dạng gói tin Response từ Backend API Controller sang Frontend Zustand Stores.
- Đã xác minh các màn hình Inbox, Friends Chat hoạt động trơn tru sau khi loại bỏ lỗi TypeError.
- Đã sửa triệt để lỗi Hook mismatch giúp thanh SidebarWrapper/UserPanel hiển thị và hoạt động ổn định 100%.
- Đồng bộ avatar initials hiển thị đúng theo Display Name trong danh sách kênh thoại.
- Luồng video stream của người dùng bật cam đã hiển thị thông suốt trên màn hình của peer kết nối thông qua xử lý đàm phán lại.

---

## 10. Triển khai Tính năng Rời Máy Chủ - Leave Server (Phase 17)
- **Tệp sửa đổi:** 
  - **Backend:** [MembershipService.java](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/service/MembershipService.java), [RoomController.java](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/controller/RoomController.java), [MemberEventListener.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/listener/MemberEventListener.java)
  - **Frontend:** [roomStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/roomStore.ts), [useWebSocket.ts](file:///e:/UIT/cv/MiniDiscord/frontend/hooks/useWebSocket.ts), [ChannelList.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/sidebar/ChannelList.tsx), [en.json](file:///e:/UIT/cv/MiniDiscord/frontend/dictionaries/en.json), [vi.json](file:///e:/UIT/cv/MiniDiscord/frontend/dictionaries/vi.json)
- **Giải pháp:**
  - **Backend:** 
    - Thêm phương thức [leaveRoom(roomId, userId)](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/service/MembershipService.java#351-375) kiểm tra và chặn cứng Owner rời nhóm (ném lỗi `BAD_REQUEST`), thực hiện xóa bản ghi `RoomParticipant` và bắn sự kiện `member.left` trên sàn RabbitMQ `room.events`.
    - [RoomController](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/controller/RoomController.java#24-233) cung cấp method `DELETE /api/rooms/{roomId}/members/me` để tiếp nhận request.
    - `MemberEventListener` bắt sự kiện từ Rabbit và truyền qua WebSocket STOMP với `eventType: MEMBER_LEFT` tới toàn bộ người dùng đang đăng ký trong phòng `/topic/room.{roomId}`.
  - **Frontend:**
    - `roomStore.ts`: Triển khai hàm [leaveRoom(roomId)](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/service/MembershipService.java#351-375) tiến hành dọn cache và xóa phòng cục bộ, đồng thời thực hiện chuyển hướng URL về `/channels/me`. Đây là nơi duy nhất lo việc chuyển hướng url nhằm ngăn ngừa Race Condition.
    - [useWebSocket.ts](file:///e:/UIT/cv/MiniDiscord/frontend/hooks/useWebSocket.ts): Lắng nghe sự kiện `MEMBER_LEFT`. Nếu là user khác rời phòng, cập nhật member list và xóa khỏi voice channel. Nếu là chính mình, chỉ dọn dẹp kết nối kênh thoại/cuộc gọi (Voice channel/Call cleanup) và fetch danh sách phòng mới mà không chuyển hướng url.
    - [ChannelList.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/sidebar/ChannelList.tsx): Thêm nút "Rời máy chủ" (Leave Server) màu đỏ ở cuối Server dropdown. Nếu user là Owner (`room.ownerId === currentUserId`), mở hộp thoại cảnh báo của [ConfirmModal](file:///e:/UIT/cv/MiniDiscord/frontend/components/ui/ConfirmModal.tsx#17-81) (với `showCancel={false}`). Nếu là User thường, hiển thị modal xác nhận rời máy chủ. Khi rời máy chủ thành công, hiển thị thông báo alert `"Rời phòng thành công!"` (tùy dịch đa ngôn ngữ) và điều hướng về trang `/channels/me`.
- **Hình ảnh minh họa xác thực:**
  - **Hộp thoại cảnh báo Chủ sở hữu:**
  ![Owner warning modal](C:\Users\ACER\.gemini\antigravity\brain\9dd91e8f-efdc-4c33-b9cd-a8747a86852a\leave_server_owner_warning_1781612272383.png)
  - **Video ghi lại luồng xác minh toàn bộ (Rời máy chủ & Cảnh báo Owner):**
  ![Leave Server Flow Verification](C:\Users\ACER\.gemini\antigravity\brain\9dd91e8f-efdc-4c33-b9cd-a8747a86852a\verify_leave_server_1781612095065.webp)

---

## 11. Cập nhật phân quyền tạo link mời & Sửa đổi InviteModal (Phase 19 & 20)
- **Tệp sửa đổi:**
  - **Backend Service:** [InviteLinkService.java](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/service/InviteLinkService.java)
  - **Frontend UI:** [InviteModal.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/server/InviteModal.tsx), [en.json](file:///e:/UIT/cv/MiniDiscord/frontend/dictionaries/en.json), [vi.json](file:///e:/UIT/cv/MiniDiscord/frontend/dictionaries/vi.json)
- **Giải pháp:**
  - **Backend:** 
    - Phân tách quyền rõ rệt: Quyền tạo ([createInviteLink](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/service/InviteLinkService.java#42-66)) và xóa ([deleteInviteLink](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/service/InviteLinkService.java#74-87)) link mời nâng cấp kiểm tra lên `MANAGE_CHANNEL` (chỉ dành cho Owner/Admin).
    - Giữ nguyên [getActiveInvites](file:///e:/UIT/cv/MiniDiscord/backend/group-channel-service/src/main/java/com/discordmini/groupchannel/controller/RoomController.java#155-165) ở mức `INVITE_MEMBER` để các thành viên thông thường có thể đọc các link mời hiện tại mà không có quyền tạo mới.
  - **Frontend:**
    - [InviteModal.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/server/InviteModal.tsx) chuyển sang cơ chế read-only đối với link mời: Khi mở modal, hệ thống chỉ gửi request GET lấy liên kết mời đang hoạt động chứ không tự tạo mới bằng lệnh POST.
    - Hiển thị thêm hộp thoại thông tin / trạng thái trống `noActiveLink` với nội dung tiếng Việt/tiếng Anh thông báo liên hệ quản trị viên nếu chưa có link mời nào được tạo từ giao diện setting.
    - Đồng bộ thành công hiển thị avatar của từng người bạn thông qua component `<StatusAvatar />` cao cấp, hỗ trợ kiểm tra trạng thái hoạt động online/offline và fallback initials chính xác.
    - Ưu tiên hiển thị và lọc tìm kiếm danh sách bạn bè dựa trên `displayName` bên cạnh `username` nội bộ.

---

## 12. Tự động kiểm tra Redirector Fallback tại Server URL (Phase 18)
- **Tệp sửa đổi:** [page.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/app/%28main%29/channels/%5BserverId%5D/page.tsx)
- **Giải pháp:**
  - Thiết lập redirector dùng hook `useRoomStore` để tự động chuyển tiếp người truy cập URL gốc của server `/channels/[serverId]` sang kênh Text có sẵn đầu tiên.
  - Nếu server không có kênh Text nhưng có kênh Voice, chuyển hướng sang kênh Voice đầu tiên.
  - Nếu server trống hoàn toàn không có kênh nào (hoặc lỗi), hiển thị giao diện báo lỗi sạch sẽ, hướng dẫn người dùng liên hệ quản trị viên thay vì bị crash hoặc vòng lặp chuyển hướng vô hạn (redirect loop).

---

## 13. Khắc phục căn lề cột tab Roles tại ServerSettingsModal (Phase 20)
- **Tệp sửa đổi:** [ServerSettingsModal.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/server/ServerSettingsModal.tsx)
- **Giải pháp:**
  - Loại bỏ thuộc tính căn lề thủ công bằng margin phải (`mr-32`) tại header của cột thành viên ("MEMBERS").
  - Chuyển đổi toàn bộ cấu trúc bảng hiển thị vai trò (Roles table) — bao gồm dòng Header và các dòng tùy chỉnh vai trò con — sang bố cục **CSS Grid** thống nhất `grid-cols-[1fr_120px_40px] items-center`.
  - Giúp cột hiển thị số lượng thành viên của mỗi vai trò luôn luôn căn lề thẳng đứng, đồng bộ chuẩn xác với tiêu đề cột "MEMBERS" bất kể độ rộng viewport thay đổi ra sao.

---

## 14. Thiết lập Music Ghost Bot & Âm lượng cục bộ (Phase 21 - 24)
- **Tệp sửa đổi:** 
  - **Vi dịch vụ:** [music-extractor/Dockerfile](file:///e:/UIT/cv/MiniDiscord/backend/music-extractor/Dockerfile), [package.json](file:///e:/UIT/cv/MiniDiscord/backend/music-extractor/package.json)
  - **Backend Controller / Service:** [VoiceWebSocketController.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/controller/VoiceWebSocketController.java), [VoiceController.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/controller/VoiceController.java), [MusicExtractionService.java](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/service/MusicExtractionService.java)
  - **Frontend UI / Store:** [voiceStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/voiceStore.ts), [useWebSocket.ts](file:///e:/UIT/cv/MiniDiscord/frontend/hooks/useWebSocket.ts), [MessageInput.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/chat/MessageInput.tsx), [VoiceChannelView.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/VoiceChannelView.tsx), [VoiceParticipantGrid.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/VoiceParticipantGrid.tsx)
- **Giải pháp:**
  - **Backend:** 
    - Thêm dịch vụ Node.js `music-extractor` sử dụng `play-dl` để phân giải các URL YouTube hoặc từ khóa tìm kiếm thành liên kết luồng âm thanh trực tiếp (Direct Audio URL) và đăng ký vào tệp docker-compose.
    - Xây dựng Redis state và queue manager trong backend `messaging-service` thông qua [VoiceWebSocketController](file:///e:/UIT/cv/MiniDiscord/backend/messaging-service/src/main/java/com/discordmini/messaging/controller/VoiceWebSocketController.java#21-393) để bắt sự kiện kết thúc bài hát (`trackEnded`), đổi bài theo hàng đợi, điều khiển qua lệnh STOMP.
    - Phát lại Late Joiner sync tại endpoint GET `/api/voice/rooms/{roomId}/music` và tự động chèn phantom participant (music-bot) vào phòng voice phục vụ biểu diễn giao diện.
  - **Frontend:**
    - Cấu trúc Zustand `voiceStore` quản lý âm lượng cục bộ (`memberVolumes`) và trạng thái mute của từng thành viên (`memberMuted`), áp dụng trực tiếp qua thẻ `<audio>` để kiểm soát âm lượng các stream độc lập.
    - Khởi tạo lắng nghe sự kiện STOMP `MUSIC_PLAY` và `MUSIC_STOP` để xử lý chèn / gỡ phantom `music-bot` và quản lý thông tin bài hát thực tế.
    - Thêm `<MusicPlayerBar />` và `<MemberVolumePopover />` để người dùng thực hiện điều khiển âm lượng, tắt tiếng, dừng phát nhạc và bỏ qua bài hát (skip).
    - Tự động nhận diện `music-bot` trong [VoiceParticipantGrid](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/VoiceParticipantGrid.tsx#237-271) và [VoiceChannelView](file:///e:/UIT/cv/MiniDiscord/frontend/components/voice/VoiceChannelView.tsx#261-401) để vẽ biểu tượng đĩa than xoay liên tục cùng glow speaking màu xanh lá nổi bật.

---

## 15. Gợi ý câu lệnh Slash - Slash Command Recommendations (Phase 25)
- **Tập sửa đổi:**
  - **Component UI:** [CommandPicker.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/chat/CommandPicker.tsx)
  - **Main Input:** [MessageInput.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/chat/MessageInput.tsx)
- **Giải pháp:**
  - Tạo mới component `<CommandPicker />` hiển thị danh sách các lệnh slash khả dụng với biểu tượng SVG đẹp mắt, nhãn mô tả chức năng, đối số gợi ý và tên bot xử lý (`Music Bot`).
  - Tích hợp logic lắng nghe phím điều hướng (Mũi tên Lên, Xuống, Enter, Escape) để điều khiển trỏ chọn trực tiếp trên bàn phím.
  - Tích hợp vào [MessageInput.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/chat/MessageInput.tsx) để kích hoạt popup khi người dùng gõ ký tự đầu tiên là `/`, cho phép lọc nhanh danh sách khớp với nội dung đã gõ (ví dụ `/pl` tự động khớp với `/play`).
  - Khi hoàn thành chọn hoặc nhấn Enter trên mục, nội dung dòng chat tự động điền đầy đủ tên lệnh kèm dấu cách `/${commandName} ` để người dùng điền tiếp tham số.

---




