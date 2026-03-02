# Open Link Discord

Open Link Discord là một công cụ tự động hóa trên Desktop (phát triển với Electron, React và TypeScript) được thiết kế đặc biệt để tối ưu hóa việc theo dõi, trích xuất và xử lý các liên kết (URL) từ Discord. 

**Các tính năng nổi bật:**
- **Lọc thông minh:** Tự động giám sát các kênh Discord và trích xuất URL từ các tin nhắn có chứa từ khóa (keywords) đã được thiết lập.
- **Xử lý tin nhắn phức tạp:** Hỗ trợ đọc tin nhắn thông thường, tin nhắn chuyển tiếp (forwarded) và tin nhắn trích dẫn (quoted).
- **Tự động hóa:** Tự động mở các liên kết quan trọng ngay khi nhận được.
- **Nhật ký (Logging):** Hỗ trợ ghi log các liên kết đã mở và gửi thông báo qua Discord Webhook cá nhân.
- **Tích hợp mạnh mẽ:** Có khả năng trích xuất và xuất dữ liệu thông minh, tích hợp liền mạch với quy trình làm việc.


## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```