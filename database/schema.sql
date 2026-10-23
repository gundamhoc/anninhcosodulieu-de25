-- Clinic database schema (MySQL 8.0)
-- 9 tables: users, patients, doctors, appointments, medical_records,
-- medicines, prescriptions, prescription_items, audit_logs

CREATE DATABASE IF NOT EXISTS clinic_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE clinic_db;

CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  `role` ENUM('admin','doctor','patient') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS patients (
  patient_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  date_of_birth DATE NULL,
  gender ENUM('male','female','other') NULL,
  phone VARCHAR(20) NULL,
  address TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_patients_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS doctors (
  doctor_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  specialty VARCHAR(100) NULL,
  license_number VARCHAR(50) NULL UNIQUE,
  phone VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_doctors_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointments (
  appointment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  scheduled_at DATETIME NOT NULL,
  status ENUM('pending','confirmed','completed','cancelled')
    NOT NULL DEFAULT 'pending',
  reason TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id)
    REFERENCES patients(patient_id) ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_doctor FOREIGN KEY (doctor_id)
    REFERENCES doctors(doctor_id) ON DELETE RESTRICT,
  INDEX idx_appointments_doctor_time (doctor_id, scheduled_at),
  INDEX idx_appointments_patient_time (patient_id, scheduled_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medical_records (
  record_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id BIGINT UNSIGNED NOT NULL UNIQUE,
  diagnosis TEXT NULL,
  treatment TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_records_appointment FOREIGN KEY (appointment_id)
    REFERENCES appointments(appointment_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medicines (
  medicine_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medicine_code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  active_ingredient VARCHAR(200) NULL,
  unit VARCHAR(30) NOT NULL,
  stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  is_prescription_only TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_medicines_name (name),
  INDEX idx_medicines_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescriptions (
  prescription_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  record_id BIGINT UNSIGNED NOT NULL UNIQUE,
  note TEXT NULL,
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prescriptions_record FOREIGN KEY (record_id)
    REFERENCES medical_records(record_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescription_items (
  item_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prescription_id BIGINT UNSIGNED NOT NULL,
  medicine_id BIGINT UNSIGNED NOT NULL,
  medicine_name VARCHAR(150) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  frequency VARCHAR(100) NOT NULL,
  duration_days SMALLINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  instruction VARCHAR(255) NULL,
  CONSTRAINT fk_prescription_items_prescription FOREIGN KEY (prescription_id)
    REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
  CONSTRAINT fk_prescription_items_medicine FOREIGN KEY (medicine_id)
    REFERENCES medicines(medicine_id) ON DELETE RESTRICT,
  UNIQUE KEY uq_prescription_medicine (prescription_id, medicine_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  `action` VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NULL,
  entity_id VARCHAR(50) NULL,
  ip VARCHAR(45) NULL,
  result VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE RESTRICT,
  INDEX idx_audit_user_time (user_id, created_at),
  INDEX idx_audit_action_time (`action`, created_at)
) ENGINE=InnoDB;
