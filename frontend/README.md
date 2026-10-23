# Frontend - Clinic Portal

Đây là phần giao diện để cả nhóm đăng nhập và thao tác thử với API. Mình dùng HTML/CSS/JS thuần, không dùng React/Vue, không cần build. Có thêm một server Node nhỏ để mở file tĩnh ở cổng 5500.

## Chạy frontend

Chạy backend trước, sau đó mở terminal khác:

```powershell
cd frontend
npm start
```

Mở `http://127.0.0.1:5500`.

Không cần `npm install` vì frontend không dùng thư viện ngoài.

## Tài khoản demo

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@clinic.local` | `Admin@123` |
| Bác sĩ | `doctor1@clinic.local` | `Doctor@123` |
| Bác sĩ | `doctor2@clinic.local` | `Doctor@123` |
| Bệnh nhân | `patient1@clinic.local` | `Patient@123` |
| Bệnh nhân | `patient2@clinic.local` | `Patient@123` |
| Bệnh nhân | `patient3@clinic.local` | `Patient@123` |
| Bệnh nhân | `patient4@clinic.local` | `Patient@123` |

Màn đăng nhập có nút đăng nhập nhanh cho admin, bác sĩ và bệnh nhân. `doctor2` và các bệnh nhân khác thì nhập tay.

## Chức năng theo vai trò

### Admin

- Xem danh sách tài khoản, xem chi tiết tài khoản.
- Tạo tài khoản admin / bác sĩ / bệnh nhân.
- Khóa hoặc mở lại tài khoản.
- Xem và sửa hồ sơ hành chính của bệnh nhân.
- Xem và sửa hồ sơ bác sĩ.
- Xem toàn bộ lịch hẹn, lọc theo trạng thái.
- Quản lý kho thuốc: thêm, sửa, ngừng/mở thuốc, chỉnh số lượng tồn.
- Xem audit log.
- Không có màn bệnh án/đơn thuốc, đúng với quy tắc admin không đọc hồ sơ bệnh án.

### Bác sĩ

- Xem lịch hẹn của mình.
- Xác nhận, hoàn tất hoặc hủy lịch hẹn.
- Xem hồ sơ bệnh nhân có lịch hẹn với mình.
- Tạo bệnh án cho lịch hẹn đã hoàn tất.
- Xem và sửa bệnh án của mình.
- Kê đơn thuốc cho bệnh án của mình: thêm nhiều dòng thuốc, liều dùng, tần suất, số ngày, số lượng.
- Xem đơn thuốc đã kê; mỗi bệnh án chỉ kê một lần.
- Sửa hồ sơ cá nhân.

### Bệnh nhân

- Xem lịch hẹn của mình.
- Hủy lịch đang chờ hoặc đã xác nhận.
- Đặt lịch mới: chọn bác sĩ, thời gian, lý do khám.
- Xem bệnh án và đơn thuốc của mình.
- Sửa hồ sơ cá nhân.

## Quy trình kê đơn trên giao diện

1. Admin vào **Thuốc**, thêm thuốc và nhập số lượng tồn.
2. Bác sĩ vào **Bệnh án**, bấm **Kê đơn** ở bệnh án chưa có đơn.
3. Chọn thuốc còn tồn, nhập liều dùng/tần suất/số ngày/số lượng, có thể thêm nhiều dòng.
4. Gửi đơn: backend kiểm tra quyền, trừ tồn kho trong transaction và lưu đơn.
5. Bệnh nhân vào **Bệnh án**, bấm **Đơn thuốc** để xem.
6. Nếu thuốc hết tồn, giao diện báo lỗi và không tạo đơn.

## Cấu trúc

```text
frontend/
├─ index.html       # khung trang, màn đăng nhập, modal, toast
├─ styles.css       # giao diện
├─ app.js           # gọi API, phân quyền màn hình, xử lý form
├─ config.js        # địa chỉ API
├─ server.js        # server tĩnh cổng 5500
├─ package.json
└─ README.md
```

## Ghi chú

- Địa chỉ API nằm trong `config.js`. Nếu đổi cổng backend thì sửa `API_BASE_URL` ở đây.
- Token JWT lưu trong `sessionStorage`, đóng tab là mất. Không dùng `localStorage`.
- Dữ liệu hiển thị đều được escape trước khi đưa vào HTML để tránh XSS.
- Admin không xem bệnh án/đơn thuốc. Bác sĩ chỉ xem bệnh nhân có lịch hẹn với mình. Bệnh nhân chỉ xem dữ liệu của mình.
- Tên thuốc trong đơn cũ được giữ nguyên kể cả khi admin đổi tên trong kho.
- `patient4` không có lịch hẹn, dùng để test IDOR.
- Đây là giao diện demo cho môn học, chưa tối ưu cho production.
