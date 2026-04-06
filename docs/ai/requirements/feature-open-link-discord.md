---
phase: requirements
title: Requirements & Problem Understanding
description: Làm rõ vấn đề, thu thập các yêu cầu và xác định tiêu chí thành công
---

# Yêu cầu & Hiểu vấn đề: open-link-discord

## Phát biểu vấn đề
**Chúng ta đang giải quyết vấn đề gì?**

- Người dùng đang ở trong một nhóm Discord có kênh thông báo khẩn cấp.
- Người dùng muốn tự động đọc các thông báo trong kênh đó và mở bất kỳ liên kết nào có trong thông báo đó bằng một profile Google Chrome đã được cấu hình sẵn.
- Hiện tại, việc này có thể yêu cầu theo dõi và nhấp chuột thủ công, làm chậm quá trình và dễ xảy ra lỗi trong các tình huống khẩn cấp.

## Mục tiêu & Đích đến
**Chúng ta muốn đạt được điều gì?**

- **Mục tiêu chính**: 
  - Tự động đọc tin nhắn từ một kênh Discord cụ thể.
  - Lọc tin nhắn dựa trên các từ khóa cấu hình sẵn (hỗ trợ nhiều từ khóa).
  - Lấy danh sách (get) các profile Google hiện có trên máy và cho phép người dùng chọn profile muốn sử dụng trực tiếp từ màn hình UI.
  - Tự động mở liên kết tìm thấy trong các tin nhắn phù hợp bằng profile Google Chrome đã chọn.
  - Người dùng có thể thay đổi cấu hình profile này bất cứ lúc nào từ giao diện (UI).
  - Cung cấp giao diện UI để kết nối với Discord, chọn kênh, quản lý từ khóa, và chọn profile.
- **Mục tiêu phụ**:
  - Dễ dàng quản lý (thêm/xóa) các từ khóa thông qua UI.

## Câu chuyện người dùng (User Stories) & Tình huống sử dụng (Use Cases)
**Người dùng sẽ tương tác với giải pháp như thế nào?**

- Là người dùng, tôi muốn kết nối tài khoản/bot Discord của mình để ứng dụng có thể lắng nghe các máy chủ của tôi.
- Là người dùng, tôi muốn chọn một kênh Discord cụ thể để lắng nghe các thông báo khẩn cấp.
- Là người dùng, tôi muốn tạo, xem và xóa các từ khóa để tôi có thể lọc thông báo nào là quan trọng.
- Là người dùng, tôi muốn chọn nhiều từ khóa để hoạt động đồng thời.
- Là người dùng, tôi muốn xem danh sách tất cả các profile Google Chrome có trên máy của mình.
- Là người dùng, tôi muốn chọn một profile Google từ giao diện để cấu hình việc mở link, và có thể thay đổi profile này khi cần.
- Là người dùng, tôi muốn hệ thống kiểm tra các thư Discord gửi đến để tìm từ khóa của tôi, và nếu có sự khớp nối, hãy tự động mở bất kỳ liên kết nào trong thông báo đó bằng profile Google tôi đang chọn tại thời điểm đó.

## Tiêu chí thành công
**Làm thế nào chúng ta sẽ biết khi chúng ta đã hoàn thành?**

- Giao diện UI cho phép kết nối với Discord và chọn kênh.
- Giao diện UI cho phép thực hiện các thao tác CRUD lên các từ khóa và chọn nhiều từ khóa đang hoạt động.
- Khi một tin nhắn phù hợp đến trên kênh Discord đã chọn, liên kết sẽ được trích xuất và tự động mở trong profile vật lý tương ứng của Google Chrome.
- Các tin nhắn không gắn liền với các từ khoá sẽ bị bỏ qua.

## Các ràng buộc & Giả định
**Những giới hạn nào chúng ta cần phải làm việc trong khuôn khổ này?**

- **RỦI RO BẢO MẬT & TOS**: Người dùng yêu cầu sử dụng tài khoản Discord cá nhân (không phải Bot Profile) để đọc tin nhắn. Việc tự động hóa tài khoản người dùng (self-botting) vi phạm Điều khoản Dịch vụ (TOS) của Discord và có nguy cơ cao bị khóa tài khoản. Chúng ta sẽ tiến hành thiết kế theo yêu cầu nhưng cần ghi chú rõ rủi ro này cho người dùng.
- Việc mở một liên kết trong một profile Google cụ thể yêu cầu thực thi một dòng lệnh cục bộ (ví dụ: `open -a "Google Chrome" --args --profile-directory="Profile 1" "URL"` trên Mac). Người dùng sẽ chọn từ danh sách các profile Chrome hiện có (ví dụ: "Gin (Bic-6)", "hinata (Bic-12)", v.v.)
- Các liên kết được mở luôn là các đường dẫn URL HTTP/HTTPS tiêu chuẩn.
- Ứng dụng phải chạy như một ứng dụng máy tính hoặc màn hình nền (desktop app/local server) để có quyền thực thi các lệnh dòng lệnh dành cho Chrome trên máy cục bộ của người dùng.

## Câu hỏi & Các mục còn mở
**Những điều gì chúng ta cần làm rõ?**

- *Đã giải quyết*: Các profile của Google sẽ được lấy từ danh sách user cung cấp (ví dụ: "Gin (Bic-6)", "hinata (Bic-12)", ...). Ứng dụng cần cách để ánh xạ tên hiển thị này sang thư mục profile thực tế của Chrome (ví dụ: `Default`, `Profile 1`, `Profile 2`). Cần phải viết script để tự động phát hiện các thư mục profile này trên máy Mac.
- *Đã giải quyết*: Sử dụng token từ tài khoản cá nhân. Sẽ thực hiện theo hướng sử dụng thư viện hỗ trợ user account (ví dụ `discord.js-selfbot-v13`) thay vì `discord.js` chuẩn.
- *Đã giải quyết*: Các liên kết cần mở luôn là các đường dẫn URL HTTP/HTTPS tiêu chuẩn.
