SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS cafam_monitoring
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cafam_monitoring;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS threshold_changes;
DROP TABLE IF EXISTS device_files;
DROP TABLE IF EXISTS notification_logs;
DROP TABLE IF EXISTS notification_contacts;
DROP TABLE IF EXISTS corrective_actions;
DROP TABLE IF EXISTS alarms;
DROP TABLE IF EXISTS readings;
DROP TABLE IF EXISTS sensors;
DROP TABLE IF EXISTS sites;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('administrador','regente_farmacia','auxiliar_farmacia','calidad','mantenimiento_biomedico','consulta_auditor') NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  confirmed_at DATETIME NULL,
  confirm_token VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE sites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(140) NOT NULL,
  address VARCHAR(220) NULL,
  city VARCHAR(100) NOT NULL DEFAULT 'Bogotá',
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE sensors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_id INT NULL,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(140) NOT NULL,
  type VARCHAR(60) NOT NULL,
  technology VARCHAR(80) NULL,
  firmware_version VARCHAR(40) NULL,
  battery_level DECIMAL(5,2) NULL,
  power_status ENUM('normal','battery','offline') NOT NULL DEFAULT 'normal',
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  last_seen_at DATETIME NULL,
  location VARCHAR(160) NOT NULL,
  area VARCHAR(120) NOT NULL,
  status ENUM('activo','inactivo','mantenimiento','desconectado') NOT NULL DEFAULT 'activo',
  reading_frequency INT NOT NULL DEFAULT 5,
  temp_min DECIMAL(6,2) NOT NULL,
  temp_max DECIMAL(6,2) NOT NULL,
  humidity_min DECIMAL(6,2) NOT NULL,
  humidity_max DECIMAL(6,2) NOT NULL,
  installed_at DATE NULL,
  last_calibration_at DATE NULL,
  responsible VARCHAR(120) NULL,
  observations TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sensors_site (site_id),
  CONSTRAINT fk_sensors_site FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE readings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sensor_id INT NOT NULL,
  temperature DECIMAL(6,2) NOT NULL,
  humidity DECIMAL(6,2) NOT NULL,
  battery_level DECIMAL(5,2) NULL,
  calculated_status ENUM('normal','advertencia','critico') NOT NULL,
  source ENUM('MQTT','simulador','manual') NOT NULL,
  mqtt_topic VARCHAR(180) NULL,
  observations TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_readings_sensor_created (sensor_id, created_at),
  INDEX idx_readings_status (calculated_status),
  CONSTRAINT fk_readings_sensor FOREIGN KEY (sensor_id) REFERENCES sensors(id)
);

CREATE TABLE notification_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_id INT NULL,
  name VARCHAR(120) NOT NULL,
  cargo VARCHAR(120) NULL,
  email VARCHAR(160) NULL,
  phone VARCHAR(40) NULL,
  channels JSON NOT NULL,
  levels JSON NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  confirmed_at DATETIME NULL,
  confirm_token VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contacts_site FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE alarms (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sensor_id INT NOT NULL,
  level ENUM('informativa','advertencia','critica') NOT NULL,
  type VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  detected_value VARCHAR(160) NULL,
  allowed_range VARCHAR(160) NULL,
  status ENUM('abierta','en_atencion','cerrada') NOT NULL DEFAULT 'abierta',
  assigned_to VARCHAR(120) NULL,
  corrective_action_id BIGINT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_alarms_sensor_status (sensor_id, status),
  INDEX idx_alarms_level (level),
  CONSTRAINT fk_alarms_sensor FOREIGN KEY (sensor_id) REFERENCES sensors(id)
);

CREATE TABLE corrective_actions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  alarm_id BIGINT NOT NULL,
  sensor_id INT NOT NULL,
  user_id INT NOT NULL,
  action_taken TEXT NOT NULL,
  evidence TEXT NULL,
  observations TEXT NULL,
  final_status VARCHAR(120) NULL,
  attachment_path VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_actions_alarm FOREIGN KEY (alarm_id) REFERENCES alarms(id),
  CONSTRAINT fk_actions_sensor FOREIGN KEY (sensor_id) REFERENCES sensors(id),
  CONSTRAINT fk_actions_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE notification_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  alarm_id BIGINT NOT NULL,
  contact_id INT NOT NULL,
  channel ENUM('email','sms','call') NOT NULL,
  destination VARCHAR(180) NOT NULL,
  status ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
  provider_message VARCHAR(255) NULL,
  sent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_alarm (alarm_id),
  CONSTRAINT fk_notifications_alarm FOREIGN KEY (alarm_id) REFERENCES alarms(id),
  CONSTRAINT fk_notifications_contact FOREIGN KEY (contact_id) REFERENCES notification_contacts(id)
);

CREATE TABLE device_files (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sensor_id INT NOT NULL,
  name VARCHAR(180) NOT NULL,
  category ENUM('calibration','manual','certificate','maintenance','other') NOT NULL DEFAULT 'other',
  file_url VARCHAR(500) NULL,
  notes TEXT NULL,
  uploaded_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_device_files_sensor FOREIGN KEY (sensor_id) REFERENCES sensors(id),
  CONSTRAINT fk_device_files_user FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE threshold_changes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sensor_id INT NOT NULL,
  user_id INT NOT NULL,
  field_changed VARCHAR(80) NOT NULL,
  old_value VARCHAR(80) NULL,
  new_value VARCHAR(80) NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_threshold_sensor FOREIGN KEY (sensor_id) REFERENCES sensors(id),
  CONSTRAINT fk_threshold_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id BIGINT NULL,
  description TEXT NULL,
  ip_address VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_action (action),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id)
);
