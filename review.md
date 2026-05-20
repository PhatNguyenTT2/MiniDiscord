Lazy Create DM (Phase 4.2)
Trong Step 4.2, luồng của tin nhắn đầu tiên là: Gọi POST tạo Room ⭢ Lấy ID ⭢ Subscribe STOMP ⭢ Send Message.

Gotcha: Quá trình stompClient.subscribe() là một tiến trình Bất đồng bộ (Asynchronous). Nó phải gửi một khung (frame) lên RabbitMQ/Redis và đợi Broker xác nhận. Nếu Frontend của bạn chạy lệnh stompClient.send() ngay lập tức ở dòng code tiếp theo sau khi gọi subscribe(), tin nhắn đó có nguy cơ cực cao bị rớt (dropped) do Broker chưa kịp nối dây (bind) queue cho user đó vào channel mới.

Cách giải quyết: Bạn phải chờ thao tác subscribe hoàn tất trước khi bắn tin nhắn. Trong thư viện STOMP (ví dụ @stomp/stompjs), hàm subscribe thường trả về một object, và bạn nên đảm bảo có một khoảng trễ nhỏ hoặc sử dụng hàm callback xác nhận (Receipt) từ broker trước khi trigger hàm send cho tin nhắn đầu tiên.