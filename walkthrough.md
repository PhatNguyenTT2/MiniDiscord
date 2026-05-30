🎧 Audio System: Hoàn tất Phase 1 đến Phase 5
Tôi đã thiết lập xong toàn bộ kiến trúc âm thanh và gắn vào các sự kiện trên UI:

Kiến trúc Lõi (SoundEngine.ts): Sử dụng Web Audio API (AudioContext), lazy initialization an toàn cho Next.js SSR, tự động trích xuất trạng thái .getState() từ Zustand store để xử lý cài đặt theo thời gian thực (tránh gotcha state mismatch).
Store (soundStore.ts): Quản lý cài đặt masterVolume và bật/tắt category âm thanh (lưu persist vào localStorage).
Hook (useSound.ts): Preload 11 file âm thanh (đang dùng beep_short.ogg của Google dán tạm vào đuôi mp3 để làm placeholder không lỗi) vào bộ nhớ RAM khi root layout (app/(main)/layout.tsx) được mount.
Tích hợp (useWebSocket.ts): Tự động kêu âm báo tin nhắn mới khi có STOMP message mới bắn về (nếu tab mất focus hoặc đang click ở channel khác).
Tích hợp (UserPanel.tsx): Kêu âm báo click (mute/unmute và deafen/undeafen) khi ấn vào icon Mic và Headphone.
Tích hợp (ChannelList.tsx): Kêu voice_join khi click vào một phòng Voice Channel.
Vì chúng ta đang dùng placeholder, bạn có thể thay thế các file thực sự chuẩn Discord vào thư mục public/sounds/ trên máy tính bằng tên tương ứng (ví dụ: message_notification.mp3) là nó sẽ tự động chạy đúng điệu. Hiện tại bạn bật/tắt mic hoặc nhắn một tin nhắn khác channel thử, nó sẽ kêu lên!

(Bạn có muốn tôi xây thêm phần UI cấu hình Settings để chỉnh volume/toggles không, hay chỉ cần backend store thế này là đủ MVP?)