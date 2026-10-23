# Đồ án An ninh CSDL - CSDL, Backend và Frontend

Mình làm phần 1 của đề tài: thiết kế database, viết API và thêm một frontend đơn giản cho hệ thống quản lý bệnh nhân.
Dữ liệu trong project là dữ liệu giả lập, không dùng hồ sơ thật.

## Môi trường

- MySQL Server 8.0 (service `MySQL80`, cổng 3306)
- MySQL Workbench 8.0
- Node.js 24
- MySQL Shell 8.0

Không cài thêm app nào.

## Đã làm được

- Database `clinic_db` gồm 9 bảng: `users`, `patients`, `doctors`, `appointments`, `medical_records`, `medicines`, `prescriptions`, `prescription_items`, `audit_logs`.
- Dữ liệu mẫu: 7 tài khoản, 4 bệnh nhân, 2 bác sĩ, 6 lịch hẹn, 3 bệnh án, 8 thuốc, 2 đơn thuốc.
- API đăng nhập, phân quyền, quản lý tài khoản, lịch hẹn, bệnh án, kho thuốc và đơn thuốc.
- Admin quản lý danh mục thuốc và tồn kho; bác sĩ kê đơn cho bệnh án của mình; bệnh nhân xem đơn của mình.
- Có kiểm tra quyền sở hữu dữ liệu, validate đầu vào, audit log.
- Smoke test 100 trường hợp, chạy pass hết.
- Frontend đơn giản bằng HTML/CSS/JS thuần, đủ màn hình cho admin, bác sĩ và bệnh nhân.
- ERD lưu ở `database/ERD.png`.

Frontend nằm ở `frontend/`, chạy riêng ở cổng 5500 và gọi API qua `http://localhost:3000`. Không dùng framework nên cả nhóm dễ đọc và sửa.

## File chính

```text
Anninhcosodulieu/
├─ backend/                 # API Node.js/Express
│  ├─ scripts/              # check DB, smoke test
│  ├─ src/                  # config, middleware, routes, validation, utils
│  ├─ .env                  # cấu hình thật, không commit
│  ├─ .env.example
│  └─ README.md             # danh sách API và cách chạy
├─ database/
│  ├─ schema.sql            # tạo bảng
│  ├─ seed.sql              # dữ liệu mẫu
│  ├─ ERD.png               # sơ đồ ERD
│  └─ ERD.html              # bản HTML của sơ đồ
├─ frontend/                 # giao diện HTML/CSS/JS
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js
│  ├─ config.js
│  ├─ server.js
│  └─ README.md
├─ setup-db.ps1             # tạo DB + nạp dữ liệu mẫu
└─ README.md
```

## Chạy thử

### 1. Tạo database

Mở PowerShell ở thư mục project:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-db.ps1
```

Script sẽ hỏi mật khẩu root MySQL. Mật khẩu chỉ dùng trong lúc chạy, không lưu vào file.

Sau khi chạy xong sẽ có database `clinic_db` và dữ liệu mẫu.

App không dùng tài khoản root. Mình tạo user `clinic_app` riêng, chỉ có quyền `SELECT/INSERT/UPDATE/DELETE` trên `clinic_db`. Cách tạo user và file `.env` nằm trong `backend/README.md`.

### 2. Chạy API

```powershell
cd backend
npm install
npm run check-db
npm start
```

API chạy ở `http://localhost:3000`.
Mở `http://localhost:3000/health` để kiểm tra nhanh.

Máy hiện tại đã có `backend/.env` rồi. Nếu chạy ở máy khác thì copy `.env.example` thành `.env` rồi điền thông tin database với JWT.

### 3. Chạy frontend

Mở thêm một terminal nữa, vẫn ở thư mục project:

```powershell
cd frontend
npm start
```

Mở `http://127.0.0.1:5500` để dùng giao diện.

Frontend không có thư viện ngoài nên không cần `npm install`. Nếu backend đổi cổng thì sửa `API_BASE_URL` trong `frontend/config.js`.

### 4. ERD

ERD mình để ở `database/ERD.png`, bản HTML ở `database/ERD.html` (mở trực tiếp để xem nét hơn). Nếu cần xuất lại bằng Workbench:

1. Mở MySQL Workbench, kết nối MySQL local.
2. Chọn **Database → Reverse Engineer**.
3. Chọn database `clinic_db` rồi Next/Execute.
4. Workbench vẽ ERD.
5. Chọn **File → Export → Export as PNG** và lưu đè vào `database/ERD.png`.

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

Mật khẩu lưu dạng hash scrypt, không lưu plaintext.

Mình cố ý để `patient4` không có lịch hẹn. Bác sĩ không có lịch hẹn với bệnh nhân này thì không xem được hồ sơ, dùng để test IDOR.

## Mấy chỗ bảo mật đã làm

- Hash mật khẩu bằng scrypt + salt, so sánh timing-safe.
- JWT có hạn 1 giờ. Mỗi request kiểm tra lại tài khoản còn active hay không.
- Phân quyền admin / doctor / patient.
- Kiểm tra quyền sở hữu: bệnh nhân chỉ xem dữ liệu của mình, bác sĩ chỉ xem bệnh nhân có lịch hẹn với mình.
- Admin không đọc được hồ sơ bệnh án và đơn thuốc theo mặc định.
- Đơn thuốc chỉ bác sĩ phụ trách bệnh án được tạo; mỗi bệnh án chỉ có một đơn.
- Tồn kho thuốc được trừ trong transaction, khóa dòng `FOR UPDATE` để tránh bán quá tồn.
- Validate bằng Zod, chặn gửi thừa field (mass assignment).
- Truy vấn dùng placeholder `?`, không nối chuỗi SQL.
- User database `clinic_app` chỉ có quyền DML.
- Có Helmet, CORS, giới hạn body và rate limit đăng nhập.
- Ghi audit log cho đăng nhập và các thao tác nhạy cảm.
- Frontend lưu JWT trong `sessionStorage` và escape dữ liệu trước khi render HTML.

Danh sách API với ví dụ gọi mình để trong `backend/README.md`. Hướng dẫn giao diện nằm trong `frontend/README.md`.

## Test

Chạy API trước, sau đó:

```powershell
cd backend
npm run smoke
```

Smoke test kiểm tra đăng nhập, phân quyền, IDOR, validate, đặt lịch trùng, tạo bệnh án, kho thuốc, kê đơn, trừ tồn kho, audit log và SQL injection.

Muốn test giao diện thì chạy frontend rồi đăng nhập lần lượt admin, bác sĩ, bệnh nhân. Admin sẽ không thấy mục bệnh án/đơn thuốc; bác sĩ chỉ thấy bệnh nhân có lịch hẹn với mình.

Lưu ý: test sẽ tạo thêm lịch hẹn, bệnh án, thuốc test và đơn thuốc, đồng thời trừ tồn kho. Muốn trả dữ liệu về ban đầu thì chạy lại `setup-db.ps1`.

## Lưu ý

- Đây là project demo cho môn học, không dùng cho production.
- Không đưa `backend/.env` lên GitHub hoặc vào báo cáo.
- Nếu quên mật khẩu root MySQL thì báo mình.
