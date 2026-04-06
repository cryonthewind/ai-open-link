---
phase: testing
title: Chiến lược Kiểm thử (Testing)
description: Định nghĩa cho hệ thống Testing, test case, và chất lượng đầu ra mong muốn.
---

# Chiến lược Kiểm thử: open-link-discord

## Các Mục tiêu Test Coverage (Độ phủ mã nguồn)
**Mức test coverage mục tiêu của ta?**

Vì đây là một Desktop App với phụ thuộc mạnh vào hệ điều hành cục bộ (Mac OS + cấu trúc JSON Chrome + tài khoản bot lậu Discord), kiểm thử đơn vị tự động hóa (automated Unit Tests) sẽ tập trung vào các script tách biệt chứa logic regex và logic xử lý chữ thuần túy. Phần lớn test sẽ là **Integration/Manual E2E Testing** để đảm bảo khả năng chạy OS native.

## Nhóm Test cá nhân (Unit Tests) 
**Khối nội dung nào nào yêu cầu thử nghiệm?**

### Module: Lọc Từ Khóa & Trích xuất Links (`utils.ts` hoặc tương tự)
- [ ] Test 1: Khớp chuỗi có 1 từ khóa và 1 URL -> Trả về URL.
- [ ] Test 2: Khớp chuỗi nhiều từ khóa nhưng không có từ nào khớp -> Không trả về kết quả.
- [ ] Test 3: Trích xuất nhiều URLs trong cùng 1 tin nhắn.
- [ ] Test 4: Xử lý ký tự đặc biệt trong từ khóa cấu hình (chống lỗi regex injection khi dùng biến chuỗi làm regex tìm kiếm).

### Module: Parse thư mục Chrome `Local State` mock
- [ ] Test 1: Cung cấp 1 chuỗi JSON giả định cấu trúc Local State hợp lệ -> nhận mảng `[{id: 'Profile 1', name: 'Giám Đốc'}]`.
- [ ] Test 2: Cung cấp chuỗi JSON sai bét -> Hàm không sập và báo lỗi graceful.

## Thử nghiệm về Tính tích hợp Hệ Thống( Integration Test)	
**Thông tin kiểm định sự tương tác.** 

- [ ] Node.js Spawn / Exec Test: Khởi chạy lệnh OSX mở 1 Profile cụ thể của trình duyệt Chrome trong máy dev bằng lệnh mở. Mong đợi mở tab mới ở UI Google tương ứng.
- [ ] Discord.js Test: Dùng dummy token, gõ 1 tin nhắn ngoài Discord thật ở một server riêng tư. Mong đợi webhook Event bắt đúng ID Channel tương ứng tại console.log ở Main Process.

## End-to-End Tests E2E Test (kiểm chứng toàn bộ sản phẩm hoàn chỉnh)
**Kiểm tra tính năng vận hành ứng dụng (User flow).**	

Kịch Bản Cốt Lõi:
1. Nhập Token thật, chọn 1 Server test -> ra list Kênh -> chọn 1 kênh chung trên UI React.
2. Thêm từ khoá "KHẨN_CẤP".  Chọn account Chrome tên "Test-Profile".
3. Mở App Discord từ ĐT/PC bằng tài khoản thứ 2, thả chat vào kênh với cú pháp: `Cảnh báo KHẨN_CẤP tại link: https://google.com`
4. **Kết quả mong đợi:** Chrome Mac OS tự động popup nhảy ra 1 tab mới tại `https://google.com` bật đúng ở Profile "Test-Profile". 

## Bộ Dữ liệu cho Testing (Test Data ) 
**Phân Mảnh Các phần dùng trong ứng dụng. **	

- **Test Fixture 1**: File `local-state.json` giả lập cấu trúc của google chrome.
- **Account Test**: Phải chuẩn bị tối thiểu 1 tài khoản clone con (A) và tài khoản khác gửi tin nhắn (B). Tài khoản A chứa token. Hành động Test sẽ làm trên Server Discord giả lập chỉ có A và B.

## Đánh giá Kỹ Năng / Tính Toán Quá Trình Nhập Thủ công: ( Manual Testing)
**Cần làm thủ công.**	

- **TOS Ban Check**: Cần để service online ở máy local trong vòng 1-2 ngày không thao tác nhằm coi token có bị khóa (do Discord quét) vì có mặt của client web lạ (thư viện self bot) hay không.
- Đảm bảo ứng dụng React UI hiển thị thanh cuốn cuộn tốt nếu danh sách Chrome Profiles lớn dần lên (như ảnh cung cấp: mười mấy - hai mươi profile).

## Hệ Thống Phát Hiện Trục Trặc. Lỗi Bugs Trí : (Bug Tracking )
**Theo dõi Sự kiện thế nào?**

- Do vấn đề thay đổi cấu trúc của Chrome hoặc thay đổi API Endpoint của Discord, phần bắt lỗi (Error Catcher) cần đặt global ở nodeJS root `process.on('uncaughtException')` hiển thị log alert ra giao diện app Desktop cho user biết là Discord đang chặn Bot hoặc Chrome đang hỏng.
