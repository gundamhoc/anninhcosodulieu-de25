-- Sample data for clinic_db
-- All data is fake. Passwords are hashed with scrypt (Node.js crypto).
-- Counts: 7 users, 4 patients, 2 doctors, 6 appointments, 3 records,
-- 8 medicines, 2 prescriptions, 4 prescription items, 7 audit logs.
-- Demo accounts:
--   admin@clinic.local    / Admin@123
--   doctor1@clinic.local  / Doctor@123
--   doctor2@clinic.local  / Doctor@123
--   patient1@clinic.local / Patient@123
--   patient2@clinic.local / Patient@123
--   patient3@clinic.local / Patient@123
--   patient4@clinic.local / Patient@123

USE clinic_db;
SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE prescription_items;
TRUNCATE TABLE prescriptions;
TRUNCATE TABLE medicines;
TRUNCATE TABLE medical_records;
TRUNCATE TABLE appointments;
TRUNCATE TABLE doctors;
TRUNCATE TABLE patients;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO users (user_id, email, password_hash, `role`, is_active) VALUES
(1, 'admin@clinic.local', 'scrypt$a3f90cad688af07d2f9e004a19e36d5f$ef64d866f3036794b67b867ab57bb49f7b79d9bdc972fd3faf13b2a57593678a2d5afec047d2a0086b7826f4a7ad9a6a305d33403c38efb25e3145fd3a76a536', 'admin', 1),
(2, 'doctor1@clinic.local', 'scrypt$1077f559899cd0aec669dd5ca8a22bf9$8c20cf58e0a02df07e34d630cac17c1e1a9ad924cbdcb1423babb777423d45ddf3f1773116502c17df4bf7f570942ebd43d464a3ae8acb6fb75a34524778d028', 'doctor', 1),
(3, 'doctor2@clinic.local', 'scrypt$4e559363ac585e5f3be88fd87ea69e31$fb54b9a92b4bfe24b323568c3881d8b74b93dbc4a936d2530c8dcf0256ecede848e58a372b112bd196dcf11ec82ce84f8cdfdd1867c396aebf92a40d93b0e84d', 'doctor', 1),
(4, 'patient1@clinic.local', 'scrypt$ff0ea9276588bcb3663afceb1c134815$4bc4675dd0dba5d816b4cc6c6465ef32e72afda86a2e9fa81e58406a23aa0a63800476cbbfa28fe4cc97f54c05a8e06c73ec1127abf899a86c618e188164499f', 'patient', 1),
(5, 'patient2@clinic.local', 'scrypt$5ba51e0697a2493975ec34d2ad5eac36$df80c6fc389a1770749ccb51ac78a8c5a78fd4e8c80cdff81d8d245cb11343c9ecbc834ba49e254209a0327287f673882fa403b0575b6645ad41a3d9944b70c0', 'patient', 1),
(6, 'patient3@clinic.local', 'scrypt$a6f6dd14be592709d1a4fa5d826c4b6b$4d80380a305262ab8459d02e87d7bc0f311f6a849b738674183f8bc0572b5e16d604a8fb3d7c9ea9f0cdfab28cedb76f36b98a1697fbe336bc8c33e7c4fbb3b0', 'patient', 1),
(7, 'patient4@clinic.local', 'scrypt$eb6218966174d5fa092b917063793cbf$6c4251bae695b415d9dd361b1179f9a61c3954c1b0f5f5d2edd4130dcb52ffc59cf865ec964e63ebadbe52535f050dafa3bd3ae88da3dc00e794a031b741f292', 'patient', 1);

INSERT INTO patients (patient_id, user_id, full_name, date_of_birth, gender, phone, address) VALUES
(1, 4, 'Nguyễn Văn An', '1990-05-12', 'male', '0901000001', '12 Nguyễn Trãi, Quận 1, TP.HCM'),
(2, 5, 'Trần Thị Bình', '1985-11-03', 'female', '0901000002', '45 Lê Lợi, Quận 3, TP.HCM'),
(3, 6, 'Lê Minh Châu', '2000-02-20', 'female', '0901000003', '78 Hai Bà Trưng, Quận 1, TP.HCM'),
(4, 7, 'Lê Hoàng Nam', '1998-08-15', 'male', '0901000004', '101 Võ Văn Tần, Quận 3, TP.HCM');

INSERT INTO doctors (doctor_id, user_id, full_name, specialty, license_number, phone) VALUES
(1, 2, 'BS. Phạm Quốc Bảo', 'Tim mạch', 'BS-001', '0912000001'),
(2, 3, 'BS. Hoàng Thị Lan', 'Nhi khoa', 'BS-002', '0912000002');

INSERT INTO medicines
  (medicine_id, medicine_code, name, active_ingredient, unit, stock_quantity, is_prescription_only, is_active)
VALUES
(1, 'MED001', 'Amlodipine 5mg', 'Amlodipine', 'viên', 120, 1, 1),
(2, 'MED002', 'Atorvastatin 10mg', 'Atorvastatin', 'viên', 90, 1, 1),
(3, 'MED003', 'Paracetamol 500mg', 'Paracetamol', 'viên', 200, 0, 1),
(4, 'MED004', 'Cetirizine 10mg', 'Cetirizine', 'viên', 80, 0, 1),
(5, 'MED005', 'Amoxicillin 500mg', 'Amoxicillin', 'viên', 60, 1, 1),
(6, 'MED006', 'Omeprazole 20mg', 'Omeprazole', 'viên', 70, 1, 1),
(7, 'MED007', 'Salbutamol 2mg', 'Salbutamol', 'viên', 50, 1, 1),
(8, 'MED008', 'Natri clorid 0.9%', 'Natri clorid', 'chai', 30, 1, 1);

INSERT INTO appointments (appointment_id, patient_id, doctor_id, scheduled_at, status, reason) VALUES
(1, 1, 1, '2026-10-20 09:00:00', 'completed', 'Đau ngực, khó thở'),
(2, 2, 2, '2026-10-22 10:30:00', 'completed', 'Sốt cao, ho'),
(3, 3, 1, '2026-10-18 08:30:00', 'completed', 'Tái khám huyết áp'),
(4, 1, 2, '2026-10-26 14:00:00', 'pending', 'Khám sức khỏe định kỳ'),
(5, 2, 1, '2026-10-24 15:00:00', 'cancelled', 'Đổi lịch'),
(6, 3, 2, '2026-10-28 09:30:00', 'confirmed', 'Dị ứng');

INSERT INTO medical_records (record_id, appointment_id, diagnosis, treatment, notes) VALUES
(1, 1, 'Tăng huyết áp nhẹ', 'Theo dõi, tái khám sau 2 tuần', 'Huyết áp 140/90'),
(2, 2, 'Viêm họng cấp', 'Kháng sinh 5 ngày, uống nhiều nước', 'Sốt 39 độ'),
(3, 3, 'Huyết áp ổn định', 'Tiếp tục thuốc theo đơn cũ', 'Huyết áp 125/80');

INSERT INTO prescriptions (prescription_id, record_id, note) VALUES
(1, 1, 'Uống thuốc đúng giờ, tái khám sau 2 tuần.'),
(2, 2, 'Uống đủ liều, nghỉ ngơi và uống nhiều nước.');

INSERT INTO prescription_items
  (prescription_id, medicine_id, medicine_name, unit, dosage, frequency, duration_days, quantity, instruction)
VALUES
(1, 1, 'Amlodipine 5mg', 'viên', '1 viên/lần', '1 lần/ngày', 30, 30, 'Uống buổi sáng sau ăn'),
(1, 2, 'Atorvastatin 10mg', 'viên', '1 viên/lần', '1 lần/ngày', 30, 30, 'Uống buổi tối'),
(2, 3, 'Paracetamol 500mg', 'viên', '1 viên/lần', '3 lần/ngày', 5, 15, 'Uống khi sốt, cách nhau 4-6 giờ'),
(2, 5, 'Amoxicillin 500mg', 'viên', '1 viên/lần', '2 lần/ngày', 5, 10, 'Uống sau ăn');

INSERT INTO audit_logs (user_id, `action`, entity, entity_id, ip, result, created_at) VALUES
(1, 'LOGIN_SUCCESS', 'users', '1', '127.0.0.1', 'success', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(2, 'LOGIN_SUCCESS', 'users', '2', '127.0.0.1', 'success', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(4, 'LOGIN_FAILED', 'users', '4', '127.0.0.1', 'failed', DATE_SUB(NOW(), INTERVAL 6 HOUR)),
(2, 'RECORD_VIEW', 'medical_records', '1', '127.0.0.1', 'success', DATE_SUB(NOW(), INTERVAL 5 HOUR)),
(3, 'RECORD_ACCESS_DENIED', 'medical_records', '1', '127.0.0.1', 'denied', DATE_SUB(NOW(), INTERVAL 4 HOUR)),
(4, 'RECORD_VIEW', 'medical_records', '1', '127.0.0.1', 'success', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(1, 'USER_CREATE', 'users', '6', '127.0.0.1', 'success', DATE_SUB(NOW(), INTERVAL 2 HOUR));
