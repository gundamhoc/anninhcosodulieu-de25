# Backend API - ghi chú

Đây là phần API của project quản lý bệnh nhân. Mình dùng Express + `mysql2`, database là `clinic_db`.

Mật khẩu hash bằng `scrypt` có sẵn trong `crypto` của Node, khỏi cài thêm bcrypt. JWT dùng để đăng nhập, hạn 1 giờ.

## Chức năng

- Đăng nhập, xem tài khoản, đổi mật khẩu.
- Admin tạo/xem/khóa tài khoản, đổi email.
- Bệnh nhân xem và sửa hồ sơ cá nhân, đặt lịch, hủy lịch, xem bệnh án và đơn thuốc của mình.
- Bác sĩ xem lịch hẹn của mình, xác nhận/hoàn tất/hủy lịch, tạo và sửa bệnh án, kê đơn thuốc.
- Admin quản lý danh mục thuốc, tồn kho và trạng thái sử dụng thuốc.
- Bệnh nhân chỉ thấy dữ liệu của mình. Bác sĩ chỉ thấy bệnh nhân có lịch hẹn với mình.
- Admin không đọc hồ sơ bệnh án và đơn thuốc.
- Các thao tác đăng nhập, sửa dữ liệu, truy cập bị từ chối đều ghi vào `audit_logs`.

## Cấu trúc

```text
backend/
├─ scripts/
│  ├─ check-db.js          # kiểm tra kết nối MySQL
│  └─ smoke-test.js        # test API và phân quyền
├─ src/
│  ├─ config/              # đọc .env, tạo pool MySQL
│  ├─ middleware/          # auth, validate, xử lý lỗi
│  ├─ routes/              # auth, users, patients, doctors, appointments, medicines, records, prescriptions, audit-logs
│  ├─ services/            # ghi audit log
│  ├─ utils/               # password, JWT, datetime, phân trang, kiểm tra quyền
│  ├─ validation/          # schema Zod
│  ├─ app.js
│  └─ server.js
├─ .env                    # không commit
├─ .env.example
└─ package.json
```

## Cài đặt

### 1. Database

Từ thư mục gốc project:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-db.ps1
```

Script hỏi mật khẩu root, sau đó tạo database, 9 bảng và dữ liệu mẫu.

### 2. User MySQL cho app

App dùng user riêng, không dùng root:

```sql
CREATE USER IF NOT EXISTS 'clinic_app'@'127.0.0.1'
  IDENTIFIED BY '<mat-khau-manh>';
GRANT SELECT, INSERT, UPDATE, DELETE ON clinic_db.*
  TO 'clinic_app'@'127.0.0.1';
```

User này không có quyền `CREATE`, `ALTER`, `DROP`, `GRANT`. Khi cần tạo bảng hoặc nạp lại seed thì dùng root.

### 3. File `.env`

Máy hiện tại đã cấu hình sẵn `backend/.env`. Nếu làm lại từ đầu:

```powershell
Copy-Item .env.example .env
```

Rồi điền:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=clinic_db
DB_USER=clinic_app
DB_PASSWORD=<mat-khau-cua-clinic_app>
JWT_SECRET=<chuoi-ngau-nhien-dai>
JWT_EXPIRES_IN=1h
CORS_ORIGIN=*
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=20
```

Không đưa file này lên GitHub hoặc vào báo cáo.

### 4. Chạy

```powershell
cd backend
npm install
npm run check-db
npm start
```

API ở `http://localhost:3000`. Kiểm tra bằng `GET /health`.
Muốn code tự reload khi sửa thì chạy `npm run dev`.

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

`patient4` không có lịch hẹn. Mục đích là để test IDOR: bác sĩ không có lịch hẹn với bệnh nhân này thì không được xem hồ sơ.

## API

### Không cần đăng nhập

| Method | Đường dẫn | Việc làm |
|---|---|---|
| GET | `/` | Xem thông tin API |
| GET | `/health` | Kiểm tra API và database |
| POST | `/api/auth/login` | Đăng nhập, trả JWT |

### Cần đăng nhập

| Method | Đường dẫn | Ai được dùng | Việc làm |
|---|---|---|---|
| GET | `/api/auth/me` | Tất cả | Xem tài khoản và hồ sơ cá nhân |
| PATCH | `/api/auth/me/password` | Tất cả | Đổi mật khẩu |
| GET | `/api/doctors` | Tất cả | Danh sách bác sĩ đang hoạt động |
| GET | `/api/doctors/:id` | Tất cả | Xem thông tin bác sĩ |
| GET | `/api/patients/me` | Bệnh nhân | Xem hồ sơ của mình |
| PATCH | `/api/patients/me` | Bệnh nhân | Sửa hồ sơ của mình |
| GET | `/api/patients/:id` | Admin, bác sĩ có lịch hẹn, chính bệnh nhân | Xem hồ sơ bệnh nhân |
| GET | `/api/doctors/me` | Bác sĩ | Xem hồ sơ bác sĩ của mình |
| PATCH | `/api/doctors/me` | Bác sĩ | Sửa hồ sơ bác sĩ của mình |
| GET | `/api/appointments` | Tất cả | Admin xem hết; bác sĩ/bệnh nhân xem của mình |
| POST | `/api/appointments` | Bệnh nhân | Đặt lịch |
| GET | `/api/appointments/:id` | Admin hoặc người sở hữu | Xem chi tiết lịch hẹn |
| PATCH | `/api/appointments/:id/status` | Theo vai trò | Bác sĩ xác nhận/hoàn tất/hủy; bệnh nhân chỉ được hủy |
| GET | `/api/records` | Bác sĩ, bệnh nhân | Danh sách bệnh án được phép xem, kèm cờ `has_prescription` |
| GET | `/api/records/:id` | Bác sĩ/bệnh nhân sở hữu | Xem một bệnh án |
| POST | `/api/records` | Bác sĩ phụ trách | Tạo bệnh án cho lịch hẹn đã hoàn tất |
| PATCH | `/api/records/:id` | Bác sĩ phụ trách | Sửa bệnh án |
| GET | `/api/records/:id/prescription` | Bác sĩ phụ trách hoặc bệnh nhân của bệnh án | Xem đơn thuốc |
| POST | `/api/records/:id/prescription` | Bác sĩ phụ trách | Kê đơn cho bệnh án đã hoàn tất |
| GET | `/api/medicines` | Admin, bác sĩ | Admin xem tất cả; bác sĩ chỉ xem thuốc đang hoạt động |
| POST | `/api/medicines` | Admin | Thêm thuốc vào danh mục |
| PATCH | `/api/medicines/:id` | Admin | Sửa thông tin, tồn kho hoặc khóa/mở thuốc |
| GET | `/api/audit-logs` | Admin | Xem audit log |
| GET | `/api/users` | Admin | Danh sách tài khoản |
| POST | `/api/users` | Admin | Tạo tài khoản |
| GET | `/api/users/:id` | Admin | Xem tài khoản và hồ sơ liên quan |
| PATCH | `/api/users/:id` | Admin | Đổi email hoặc khóa/mở tài khoản |
| DELETE | `/api/users/:id` | Admin | Khóa tài khoản (soft delete) |
| GET | `/api/patients` | Admin | Danh sách bệnh nhân |
| PATCH | `/api/patients/:id` | Admin | Sửa hồ sơ hành chính của bệnh nhân |
| PATCH | `/api/doctors/:id` | Admin | Sửa hồ sơ bác sĩ |

Mấy chỗ cần nhớ:

- Admin chỉ xem thông tin hành chính và kho thuốc, không gọi được `/api/records` hay đơn thuốc.
- Bác sĩ chỉ xem hồ sơ bệnh nhân nếu có lịch hẹn với bệnh nhân đó.
- Bệnh nhân không tự đổi `role`, `user_id`, `patient_id`, `doctor_id` qua body được.

### Quy tắc đơn thuốc

- Mỗi bệnh án chỉ có tối đa một đơn thuốc; không có API sửa hoặc xóa đơn.
- Chỉ bác sĩ phụ trách bệnh án được kê đơn, và lịch hẹn phải ở trạng thái `completed`.
- Mỗi loại thuốc chỉ xuất hiện một lần trong đơn; số lượng phải dương.
- Khi kê đơn, server khóa các dòng thuốc bằng `SELECT ... FOR UPDATE`, kiểm tra tồn kho rồi mới trừ; nếu thiếu tồn thì rollback toàn bộ.
- Tên thuốc và đơn vị được lưu snapshot trong `prescription_items`, nên sửa danh mục sau này không làm đổi đơn cũ.
- Admin quản lý kho thuốc nhưng không xem nội dung đơn thuốc.

## Gọi thử

```powershell
$body = @{
  email = 'patient1@clinic.local'
  password = 'Patient@123'
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri 'http://localhost:3000/api/auth/login' `
  -ContentType 'application/json' `
  -Body $body

$token = $login.data.token

Invoke-RestMethod `
  -Uri 'http://localhost:3000/api/records' `
  -Headers @{ Authorization = "Bearer $token" }
```

Đặt lịch:

```powershell
$appointment = @{
  doctor_id = 1
  scheduled_at = '2026-11-20T09:30:00+07:00'
  reason = 'Tái khám'
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri 'http://localhost:3000/api/appointments' `
  -ContentType 'application/json' `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body $appointment
```

## Bảo mật

- Mật khẩu dùng scrypt + salt, so sánh bằng `timingSafeEqual`.
- JWT hạn 1 giờ, mỗi request kiểm tra lại user còn active không.
- Phân quyền theo `role`, kiểm tra thêm dữ liệu có thuộc user đang đăng nhập không.
- Admin không đọc bệnh án và đơn thuốc. Bác sĩ chỉ đọc bệnh án của lịch hẹn mình phụ trách.
- Bệnh nhân chỉ xem đơn thuốc của bệnh án thuộc về mình; bác sĩ khác bị từ chối.
- Kê đơn dùng transaction, khóa tồn kho bằng `FOR UPDATE`, tránh hai đơn cùng lấy quá số lượng.
- Zod validate body/query/params, schema `.strict()` để chặn field lạ.
- SQL dùng placeholder `?`; tên cột khi update lấy từ danh sách cố định.
- User `clinic_app` chỉ có quyền DML.
- Có Helmet, CORS, giới hạn body 100KB, rate limit đăng nhập 20 lần/15 phút/IP.
- Audit log ghi login thành công/thất bại, thao tác dữ liệu và truy cập bị từ chối.
- Không trả `password_hash` hay token trong log.
- Khóa tài khoản/thuốc bằng `is_active = 0`, không xóa cứng.

## Test

Chạy server rồi:

```powershell
npm run smoke
```

Smoke test có 100 check: đăng nhập, phân quyền, IDOR, validate, đặt lịch trùng, tạo bệnh án, quản lý thuốc, kê đơn, trừ tồn kho, audit log, SQL injection.

Test sẽ tạo thêm lịch hẹn, bệnh án, thuốc test và đơn thuốc, đồng thời trừ tồn kho. Chạy lại seed nếu muốn dữ liệu sạch:

```powershell
powershell -ExecutionPolicy Bypass -File ..\setup-db.ps1
```

## Phần chưa làm

- Chưa có refresh token. Đổi mật khẩu xong thì token cũ vẫn dùng được tới khi hết hạn.
- Chưa mã hóa dữ liệu nhạy cảm trong database.
- Chưa có phát hiện bất thường từ audit log.
- Chưa có script backup/restore.
- Chưa có quy trình cấp phát thuốc, hủy đơn hoặc hoàn tồn kho; đơn thuốc hiện immutable sau khi tạo.
- Chưa có nhập kho theo lô/hạn sử dụng; admin chỉnh tồn kho trực tiếp.

Phần giao diện đã có riêng ở `../frontend/`, không nằm trong backend.

Mấy phần này để qua giai đoạn sau làm tiếp.
