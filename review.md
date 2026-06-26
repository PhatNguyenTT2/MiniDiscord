Dòng này chứng tỏ thư viện huggingface_hub đang cố gắng tự đi tìm danh sách các model mặc định (Auto-router) thay vì dùng đúng model bạn chỉ định. Điều này xảy ra khi hàm thực thi API (như chat_completion) không nhận được tham số model, hoặc token của bạn thực sự vẫn đang rỗng (None) bên trong Docker.

Để dứt điểm 100% tình trạng này, chúng ta sẽ "trói chặt" cấu hình bằng cách truyền thẳng tham số vào lệnh gọi cuối cùng, đồng thời in log ra để kiểm tra token.

🛠️ Phẫu thuật file main.py
Bạn hãy mở file main.py, tìm đến endpoint /ai/chat và thay thế hoàn toàn bằng đoạn code dưới đây:

Python
@app.post("/ai/chat")
def ai_chat(payload: dict):
    try:
        user_prompt = payload.get("prompt", "")
        
        # 1. BẮT LỖI TOKEN TẬN GỐC
        hf_token = os.getenv("HF_ACCESS_TOKEN")
        if not hf_token:
            log.error("THẢM HỌA: Docker không nhận được HF_ACCESS_TOKEN. Token đang rỗng!")
            raise HTTPException(status_code=500, detail="Missing HF Token")
        
        # In ra 5 ký tự đầu của token để xác nhận Docker đã đọc được file .env
        log.info(f"Đã nhận Token bắt đầu bằng: {hf_token[:5]}***")

        # 2. KHỞI TẠO CLIENT CHỈ VỚI TOKEN
        client = InferenceClient(token=hf_token)
        
        system_prompt = "You are a helpful and friendly AI Assistant in a Discord-like server named MiniDiscord. Keep responses concise and friendly."
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        # 3. TRUYỀN ĐÍCH DANH MODEL VÀO ĐÚNG HÀM CHẠY
        log.info("Đang gọi Hugging Face API (Bypass Auto-router)...")
        response = client.chat_completion(
            model="Qwen/Qwen2.5-7B-Instruct", # GHIM CỨNG TẠI ĐÂY
            messages=messages,
            max_tokens=256
        )
        
        return {"response": response.choices[0].message.content}

    except Exception as e:
        log.error(f"Hugging Face Inference Chat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
🚀 3 Bước Triển Khai Chắc Thắng
Một lỗi cực kỳ phổ biến là sửa code nhưng quên lưu file, khiến Docker build lại bản code cũ. Hãy làm đúng trình tự sau:

Lưu file main.py: (Ctrl + S hoặc tương đương trên trình soạn thảo của bạn).

Khởi động lại toàn bộ:

Bash
cd /opt/minidiscord
# Xóa sạch image cũ để đảm bảo không kẹt cache
docker image rm minidiscord-music-extractor:latest 2>/dev/null

# Build lại từ đầu
docker compose -f docker-compose.prod.yml build --no-cache music-extractor
docker compose -f docker-compose.prod.yml up -d music-extractor
Theo dõi Log:

Bash
docker compose -f docker-compose.prod.yml logs -f --tail 100 music-extractor
💡 Tiên lượng kết quả:

Nếu bạn thấy log báo "THẢM HỌA: Docker không nhận được..." → Lỗi 100% nằm ở file .env hoặc cấu hình docker-compose.prod.yml của bạn chưa truyền biến môi trường vào.

Nếu bạn thấy log in ra "Đã nhận Token bắt đầu bằng: hf_..." và tiếp theo là mã 200 → Lỗi Auto-router đã bị tiêu diệt hoàn toàn!