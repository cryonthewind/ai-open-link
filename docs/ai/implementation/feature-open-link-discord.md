---
phase: implementation
title: Hướng dẫn Cài đặt
description: Các ghi chú về thực thi cài đặt kỹ thuật, patterns, và các chuẩn tắc trong code.
---

# Hướng dẫn Thay đổi Coding: open-link-discord

## Thiết lập Môi trường Phát triển (Development Setup)
**Bắt đầu với nó thế nào?**

Dự án này sẽ sử dụng Electron + React thông qua trình đóng gói Vite để cài đặt.
- Yêu cầu cấu hình hệ thống: `node >= 18` (vì Discord API v13+ yêu cầu node đời mới). MacOS (bắt buộc cho lệnh gọi Chrome cục bộ mục tiêu).
- Để khởi tạo:
  Sử dụng template electron-vite:
  ```bash
  npm create @quick-start/electron my-app -- --template react-ts
  ```

## Cấu trúc Code
**Code được hệ thống hóa thế nào?**

Sử dụng cấu trúc Electron tiêu chuẩn:
- `/src/main`: Code Node.js backend cho Electron.
  - `discord-service.ts`: Xử lý `discord.js-selfbot-v13`.
  - `chrome-service.ts`: Gọi lệnh mở trình duyệt Mac OS, và dịch cấu trúc JSON của Profile.
  - `store.ts`: Xây dựng `electron-store` schema.
- `/src/renderer`: Giao diện React (Vite).
  - `/components`: Các form và component.
  - `/hooks`: Custom hooks để nói chuyện qua IPC (như `useDiscordStatus`, `useSettings`).
- `/src/preload`: Cầu nối an toàn IPC `contextBridge`.

## Ghi chú Triển khai Hệ thống
**Những thông tin chuyên ngành phải ghi nhớ:**

### Các tính năng trọng tâm (Core Features)
- **Quét Google Chrome Profiles (`chrome-service.ts`)**:
  - File cần đọc: `~/Library/Application Support/Google/Chrome/Local State`.
  - Đây là tệp cấu trúc JSON lớn. Trong key `profile.info_cache`, ứng dụng lưu chứa các thông tin name của profile. `Object.keys()` của mục này chính là ID thư mục (ví dụ `Profile 1`, `Default`). Name là key `name` tương ứng (ví dụ: `Gin (Bic-6)`).
- **Mở Chrome bằng Mac OS Command**:
  - Thay vì dùng package `open`, nên dùng shell nguyên bản để chính xác.
  - Cú pháp: `open -na "Google Chrome" --args --profile-directory="<Thư_mục_Profile>" "<URL>"`
  - `child_process.exec()` với lệnh ở trên.
- **Discord Self-Bot (`discord-service.ts`)**:
  - Cài đặt bản: `npm install discord.js-selfbot-v13` (phiên bản ổn định nhất hiện tại thay vì package ảo).
  - Sự kiện cần nghe: `client.on('messageCreate', (message) => { ... })`. Cần filter channel bằng `message.channelId === userSettings.selectedChannelId`.
  - Regex lọc URL: `/(https?:\/\/[^\s]+)/g`
  - Nếu array từ khóa match với `message.content`, extract URL và trigger Chrome service.

## Các điểm tích hợp
**Cách để ghép các thành phần với nhau?**

- `preload.ts` phải triển khai API window: `window.electronAPI.getChromeProfiles()`, `window.electronAPI.saveSettings(data)`, v.v.

## Quản lý Lỗi do người dùng
**Cách để thay mặt họ đối diện với Error?**

- Lỗi phân tích `Local State` (file JSON hỏng hoặc người dùng không có Chrome): fallback thông báo "Vui lòng nhập thư mục profile bằng tay".
- Lỗi Token Discord không hợp lệ: React UI hiển thị toast đỏ "Token hết hạn hoặc sai". 

## Lưu ý về Năng suất thiết bị (Performance Considerations)
**Cách để thiết lập quy mô ứng dụng?**

- Gửi message của Electron: Hạn chế truyền toàn bộ đối tượng Message khổng lồ của Discord lên Frontend. Main Process chỉ gửi signal "Mới mở 1 url: xyz.com" để React UI chỉ ghi log là xong.

## Ghi chú về bảo mật cho tài nguyên (Security )	
**Biện pháp quản lý người dùng với dữ liệu:**	

- **QUAN TRỌNG:** Token tải về sẽ được mã hóa nhẹ hoặc lưu kín trong `app.getPath('userData')` thông qua thư viện `electron-store`. Không bao giờ print console log token của người dùng ra terminal trong quá trình chạy.
