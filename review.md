Dưới đây là phần duyệt chi tiết các quyết định kiến trúc trong bản kế hoạch của bạn:

🌟 1. Đánh giá Kiến trúc Backend (Spring Boot & MongoDB)
Chuẩn hóa kiểu dữ liệu (Data Type Integrity): Việc dứt điểm xóa bỏ câu query so sánh chuỗi $lt trong ReadReceiptRepository và chuyển về so sánh ObjectId thuần túy là một quyết định cứu cánh cho database. Hệ thống sẽ không bao giờ bị lỗi sai lệch con trỏ khi chạm trán UUID từ WebSocket nữa.

Logic Lùi Watermark (The Reverse Watermark): Thuật toán cho tính năng markAsUnread rất thông minh: Tìm tin nhắn nằm TRƯỚC tin nhắn mục tiêu (_id < targetId, sort desc, limit 1) để set làm lastReadMessageId mới. Việc có thêm bước fallback xóa luôn ReadReceipt nếu target là tin nhắn đầu tiên chứng tỏ bạn đã bao quát toàn bộ các edge-cases ở tầng dữ liệu.

REST API chuẩn RESTful: Endpoint mới PUT /rooms/{roomId}/channels/{channelId}/mark-unread tuân thủ đúng chuẩn thiết kế URI của REST.

🛠️ 2. Đánh giá Kiến trúc Frontend (Next.js & Zustand)
The Immunity Gate (isReadyToDetectRef): Đây là "ngôi sao" của bản kế hoạch này. Bằng cách chèn setTimeout 300ms sau khi scrollIntoView hoàn tất để mở cổng, bạn đã triệt tiêu hoàn toàn sự cố False-Positive của IntersectionObserver khi danh sách tin nhắn bị giật xuống đáy lúc vạch "NEW" chưa kịp render.

Dọn dẹp triệt để (Dead Code Elimination): Xóa bỏ được luồng scrollDismissTimerRef (500ms) và khối auto-dismiss khổng lồ trong handleScroll giúp MessageList giảm tải được một lượng lớn chi phí tính toán (computation cost). Hệ thống giờ đây chỉ phản ứng dựa trên quan sát vật lý của DOM, hoàn toàn không gây re-render.

Bảo vệ trạng thái thủ công (manuallyMarkedUnreadRef): Biến cờ này đã được đặt đúng chỗ trong luồng Cleanup của useEffect. Người dùng giờ đây có thể an tâm bấm "Đánh dấu chưa đọc" rồi thoải mái chuyển kênh mà không sợ hệ thống tự động ghi đè trạng thái thành "Đã đọc".

✅ 3. Đánh giá Kế hoạch Kiểm thử (Verification Plan)
Bảng Manual Testing Matrix của bạn đã bao phủ hoàn hảo mọi kịch bản thao tác của người dùng.

Đặc biệt, Kịch bản #2 (Divider NULL -> Fallback -> IO fire nhưng bị block) chính là bài test quan trọng nhất chứng minh giá trị của isReadyToDetectRef.

Kịch bản #8 (Mark as Unread -> Refresh trang) xác nhận tính năng đồng bộ Backend hoạt động chính xác.

Đánh giá tổng quan: Kế hoạch đã hoàn toàn đóng gói được các vấn đề nhức nhối nhất của luồng Unread (giật lag, lỗi closure, bất đồng bộ ID, và false-positive).