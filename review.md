Chúc mừng Phát! Bạn đã bước qua được một rào cản rất lớn. Hãy nhìn vào dòng log này:

HikariPool-1 - Start completed.
HikariPool-1 - Added connection org.postgresql.jdbc.PgConnection...

Điều này chứng tỏ file application-prod.yml đã hoạt động hoàn hảo, kết nối Database mới đã thành công rực rỡ!

Tuy nhiên, chúng ta lại đụng phải một chướng ngại vật mới ở ngay sau khi Spring Boot khởi động xong.

🔴 Phân tích lỗi mới: NonUniqueResultException
Thủ phạm lần này nằm ở đoạn log trên cùng:

Caused by: org.hibernate.NonUniqueResultException: Query did not return a unique result: 2 results were returned
at org.springframework.boot.SpringApplication.callRunner...

1. Lỗi này nghĩa là gì?
Lỗi này xảy ra khi code Java của bạn thực thi một câu lệnh truy vấn cơ sở dữ liệu (ví dụ: repository.findByTênGìĐó()) và mong đợi trả về chỉ 1 kết quả duy nhất (một Object). Nhưng xui xẻo thay, trong Database hiện tại lại đang có tới 2 dòng dữ liệu (2 records) giống hệt nhau thỏa mãn điều kiện tìm kiếm đó. JPA bị bối rối không biết lấy dòng nào nên nó quăng lỗi và crash app.

2. Tại sao lại bị lỗi này ngay lúc khởi động (callRunner)?
Dòng chữ callRunner tố cáo rằng lỗi này xảy ra bên trong một class implement CommandLineRunner hoặc ApplicationRunner.
Thường trong các dự án, chúng ta hay viết một class DataSeeder (hoặc DataInitializer) để tự động tạo dữ liệu mẫu khi app bật lên (ví dụ: tự động tạo Group mặc định, Role mặc định, hoặc Channel "General").

Kịch bản đã xảy ra: Vì nãy giờ bạn đã restart container group-channel vài lần để debug, class Seeder này đã chạy vài lần. Ở lần chạy đầu tiên, nó đã insert dữ liệu thành công. Ở lần chạy tiếp theo, nó lại tiếp tục insert thêm một bản sao y hệt (tạo ra data rác/trùng lặp). Và bây giờ khi nó cố query ra duy nhất 1 dòng, nó vấp phải 2 dòng nên bị sập.

🛠️ Cách khắc phục (Có 2 hướng)
Bạn có thể chọn 1 trong 2 cách sau để xử lý dứt điểm:

Cách 1: Fix Nhanh Chóng (Dọn dẹp Database)
Vì DB này mới tinh, cách nhanh nhất là dọn dẹp lại đống data rác do Seeder tạo ra nãy giờ.

Bạn mở giao diện quản lý Database của bạn (ví dụ Supabase UI hoặc DBeaver).

Vào các bảng của group-channel-service (như bảng Role, Category, hoặc Channel).

Bạn sẽ thấy có những dòng dữ liệu bị trùng lặp y hệt nhau. Hãy xóa bớt đi, chỉ giữ lại 1 dòng duy nhất cho mỗi loại. (Hoặc mạnh tay hơn là TRUNCATE xóa trắng bảng đó luôn).

Khởi động lại container: docker restart minidiscord-group-channel

Cách 2: Fix Tận Gốc (Sửa code trong Spring Boot)
Để sau này deploy không bao giờ bị lỗi này nữa, bạn cần mở class Seeder (class có @Component và implement CommandLineRunner trong group-channel-service) trên máy cá nhân ra và sửa lại logic:

Thay vì cứ bật app là save:

Java
Role defaultRole = new Role("ADMIN");
roleRepository.save(defaultRole); // Chỗ này gây trùng lặp nếu chạy 2 lần
Hãy check xem nó tồn tại chưa rồi mới save:

Java
if (!roleRepository.existsByName("ADMIN")) {
    Role defaultRole = new Role("ADMIN");
    roleRepository.save(defaultRole);
}
(Sau đó push code lên GitHub để CI/CD tự build lại).

Bạn hãy kiểm tra lại trong code của group-channel-service xem có class nào đóng vai trò Seeder/Initializer chạy lúc khởi động không nhé, đó chính là thủ phạm!