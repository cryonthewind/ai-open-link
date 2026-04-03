# UCHIHA Neural Link (Open Link Discord)

![UCHIHA App Icon](build/icon.png)

**UCHIHA Neural Link** là một công cụ tối ưu hóa Desktop (phát triển với Electron, React và TypeScript) được thiết kế đặc biệt để tự động hóa việc theo dõi, lọc và xử lý các liên kết (URL) từ Discord cùng với hệ thống giám sát kho hàng (Inventory) 7net.

## 🚀 Các tính năng nổi bật

- 🔴 **Neural Intercept (Discord Monitoring):** Tự động giám sát các kênh Discord và trích xuất URL từ các tin nhắn có chứa từ khóa (keywords) đã được thiết lập.
- ⚡ **Automated Injection:** Tự động mở các liên kết quan trọng trên các Chrome Profile khác nhau ngay khi nhận được.
- ◈ **7net Zaiko (Stock Monitoring):** Hệ thống quét kho hàng 7net thời gian thực, hỗ trợ tự động gia hạn phiên đăng nhập (Session Reflect) để không bị gián đoạn.
- 🔍 **Identifiers & Forbidden Sequences:** Quản lý linh hoạt danh sách từ khóa trắng (Whitelist) và danh sách đen (Blacklist) để lọc thông tin chính xác.
- 🛠️ **System OP (Profile Management):** Quản lý và triển khai tài nguyên trên nhiều trình duyệt Chrome đồng thời.
- 📋 **Integrated Logs:** Theo dõi mọi hoạt động hệ thống theo thời gian thực và gửi báo cáo qua Discord Webhook.
- 🎨 **Uchiha Aesthetics:** Giao diện Dark Mode cao cấp với phong cách Sharingan hiện đại, mang lại trải nghiệm chuyên nghiệp và mạnh mẽ.

---

## 🛠 Cài đặt và Phát triển

### Cài đặt dependencies

```bash
$ npm install
```

### Chế độ phát triển (Development)

```bash
$ npm run dev
```

### Đóng gói ứng dụng (Build)

Để đóng gói ứng dụng cho các nền tảng khác nhau (Kết quả sẽ nằm trong thư mục `dist/`):

```bash
# Cho Windows (Tạo file .exe)
$ npm run build:win

# Cho macOS (Tạo file .dmg)
$ npm run build:mac

# Cho Linux (Tạo AppImage/deb)
$ npm run build:linux
```

---

## 🏗 Cấu trúc dự án

- **`src/main`**: Xử lý logic chính (Chrome service, Discord connection, 7net scanning).
- **`src/renderer`**: Giao diện người dùng (React, TailwindCSS, Lucide Icons).
- **`src/preload`**: Cầu nối giao tiếp an toàn giữa Main và Renderer.
- **`build/`**: Chứa các tài nguyên phục vụ việc đóng gói (Icon, plist).

---

> [!IMPORTANT]
> Công cụ này được thiết kế cho mục đích tối ưu hóa quy trình làm việc cá nhân. Hãy tuân thủ các quy định và điều khoản của các nền tảng liên quan khi sử dụng.