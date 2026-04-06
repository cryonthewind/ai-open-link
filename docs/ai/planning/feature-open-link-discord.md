---
phase: planning
title: Lập kế hoạch dự án & Phân rã công việc
description: Chia nhỏ công việc thành các task có thể thực hiện và ước tính timeline.
---

# Lập kế hoạch dự án & Phân rã công việc: open-link-discord

## Cột mốc (Milestones)
**Các điểm kiểm tra (checkpoint) lớn là gì?**

- [ ] Cột mốc 1: Thiết lập nền tảng Desktop App (Electron+React) và đọc được file Chrome Profiles.
- [ ] Cột mốc 2: Tích hợp Discord Self-bot, kết nối thành công, đọc tin nhắn và ghép nối từ khóa.
- [ ] Cột mốc 3: Hoàn thiện UI và nối các luồng (từ việc nhận Discord message -> qua UI Setting -> tự động mở Chrome Profile).

## Phân rã Task (Task Breakdown)
**Cần làm những công việc cụ thể nào?**

### Giai đoạn 1: Nền tảng (Electron + Chrome Profile Parsing)
- [ ] Task 1.1: Khởi tạo dự án bằng Vite (React + TypeScript + Electron) mẫu mặc định.
- [ ] Task 1.2: Thiết lập hệ thống `electron-store` để lưu JSON cài đặt nội bộ (Settings).
- [ ] Task 1.3: Viết script trong Node.js để đọc tệp `Local State` trong thư mục Chrome trên Mac, để trả về danh sách Profile có (ID thư mục) và Tên (ví dụ: "Gin (Bic-6)").
- [ ] Task 1.4: Viết hàm tiện ích mở URL bằng Chrome theo profile được chỉ định (tạo tiến trình `child_process.exec`).

### Giai đoạn 2: Tích hợp Discord Core
- [ ] Task 2.1: Cài đặt `discord.js-selfbot-v13`.
- [ ] Task 2.2: Xây dựng Module lắng nghe tin nhắn Discord: Nhận token, đăng nhập, nạp danh sách Servers/Guilds và Kênh (Channels).
- [ ] Task 2.3: Viết logic lọc tin nhắn trên kênh đã chọn. Tìm URL (bằng regex `https?://\S+`) nằm trong text khi tin nhắn chứa một trong các `keywords` khai báo.
- [ ] Task 2.4: Gắn kết (Bridging) module Discord với hàm mở URL Chrome ở Task 1.4.

### Giai đoạn 3: UI & Giao tiếp (IPC)
- [ ] Task 3.1: Định nghĩa bộ IPC interface (Main - Renderer): lưu thiết lập, lấy Profile Chrome, trạng thái Discord (login/error).
- [ ] Task 3.2: Xây dựng trang UI Cài đặt Discord: Nhập Token -> Hiện danh sách Server -> Hiện danh sách Kênh trong cấu hình.
- [ ] Task 3.3: Xây dựng Form UI Cài đặt Keyword: Thêm, xóa, hiện danh sách từ khóa đa chọn.
- [ ] Task 3.4: Xây dựng UI Cài đặt Cấu hình Chrome: Hiển thị dropdown các profile (Ví dụ "Gin (Bic-6)").

### Giai đoạn 4: Hoàn thiện và Build
- [ ] Task 4.1: Kiểm tra tính ổn định (Reconnection) của Discord token.
- [ ] Task 4.2: Đóng gói (Packaging) ứng dụng ra định dạng MacOS (`.app` hoặc `.dmg`).

## Bị phụ thuộc (Dependencies)
**Điều gì cần phải xảy ra theo thứ tự nào?**

- Task 2.1 - 2.4 phụ thuộc vào việc tìm ra giải pháp dùng `discord.js-selfbot-v13` ổn định (NPM có thể cần phiên bản riêng/fork vì thư viện này thường xuyên bị fix).
- Task 3.2 yêu cầu module Discord ở 2.2 hoàn thành chức năng lấy list Kênh.
- Task 1.3 là tiền đề bắt buộc trước khi làm UI chọn profile Chrome (3.4).

## Dòng thời gian & Ước tính
**Khi nào công việc hoàn tất?**

- Giai đoạn 1: Dự kiến mất 1 phiên code (2-3 giờ) để hoàn thành việc quét Profile và dựng khung.
- Giai đoạn 2: Khoảng 2-3 giờ xử lý Discord API + parsing Message.
- Giai đoạn 3: UI sẽ tốn khoảng 3-4 giờ để có đủ giao diện thiết bị và nối IPC.
- Tổng ước tính triển khai ban đầu: ~1-2 ngày làm việc.

## Rủi ro & Cách giảm thiểu
**Sẽ có trục trặc gì xảy ra?**

- **Rủi ro công nghệ (Discord TOS)**: Tài khoản có thể bị khóa. **Giảm thiểu**: Cảnh báo user, đảm bảo không có logic spam. Selfbot chỉ ở trạng thái "Lắng nghe" (listen), không "Gửi" tin nhắn nào, giúp giảm rủi ro đáng kể.
- **Rủi ro cấu trúc Chrome**: Google thay đổi cấu trúc file `Local State`, làm thuật toán parse hồ sơ hỏng. **Giảm thiểu**: Đề phòng try/catch cho thư mục `Local State` và cho phép fallback nhập "bằng tay" tên thư mục profile (vd "Profile 5") nếu list không hoạt động.

## Nguồn lực cần thiết
**Những thứ chúng ta cần để thành công?**

- Thư viện: Electron, React, Vite, `discord.js-selfbot-v13`
- Tài khoản Discord nháp để làm test token (chống ban tài khoản chính).
- Trình duyệt Google Chrome có nhiều profile đang hiện hành để test script quét thư mục.
