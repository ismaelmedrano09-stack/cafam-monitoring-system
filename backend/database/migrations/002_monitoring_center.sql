SET NAMES utf8mb4;
USE cafam_monitoring;

CREATE TABLE IF NOT EXISTS sites (
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

ALTER TABLE sensors
  ADD COLUMN site_id INT NULL AFTER id,
  ADD COLUMN technology VARCHAR(80) NULL AFTER type,
  ADD COLUMN firmware_version VARCHAR(40) NULL AFTER technology,
  ADD COLUMN battery_level DECIMAL(5,2) NULL AFTER firmware_version,
  ADD COLUMN power_status ENUM('normal','battery','offline') NOT NULL DEFAULT 'normal' AFTER battery_level,
  ADD COLUMN latitude DECIMAL(10,7) NULL AFTER power_status,
  ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude,
  ADD COLUMN last_seen_at DATETIME NULL AFTER longitude,
  ADD INDEX idx_sensors_site (site_id),
  ADD CONSTRAINT fk_sensors_site FOREIGN KEY (site_id) REFERENCES sites(id);

ALTER TABLE readings
  ADD COLUMN battery_level DECIMAL(5,2) NULL AFTER humidity;

CREATE TABLE IF NOT EXISTS notification_contacts (
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

CREATE TABLE IF NOT EXISTS notification_logs (
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

CREATE TABLE IF NOT EXISTS device_files (
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

INSERT INTO sites (code, name, address, city, latitude, longitude) VALUES
('CAFAM-CENTRAL', 'Clínica Cafam Central', 'Av. Carrera 68 # 90-88', 'Bogotá', 4.6923940, -74.0753710),
('CAFAM-CALLE93', 'Centro Médico Cafam Calle 93', 'Calle 93 # 14-20', 'Bogotá', 4.6760120, -74.0498260);

UPDATE sensors
SET site_id = (SELECT id FROM sites WHERE code = 'CAFAM-CENTRAL'),
    technology = CASE WHEN type IN ('SHT35','SHT85') THEN 'LoRa / WiFi' ELSE 'WiFi' END,
    firmware_version = CASE id % 3 WHEN 0 THEN '2.4.1' WHEN 1 THEN '2.3.8' ELSE '2.4.0' END,
    battery_level = 72 + (id * 4),
    power_status = 'normal',
    latitude = 4.6923940 + (id * 0.00018),
    longitude = -74.0753710 + (id * 0.00015),
    last_seen_at = NOW();

UPDATE sensors
SET site_id = (SELECT id FROM sites WHERE code = 'CAFAM-CALLE93'),
    latitude = 4.6760120,
    longitude = -74.0498260
WHERE code = 'MA-01';

INSERT INTO notification_contacts (site_id, name, email, phone, channels, levels) VALUES
((SELECT id FROM sites WHERE code = 'CAFAM-CENTRAL'), 'Regente Farmacia Central', 'regente@cafam.test', '+57 300 555 0101', JSON_ARRAY('email','sms'), JSON_ARRAY('advertencia','critica')),
(NULL, 'Mantenimiento Biomédico', 'biomedica@cafam.test', '+57 300 555 0103', JSON_ARRAY('email','call'), JSON_ARRAY('informativa','advertencia','critica'));

INSERT INTO device_files (sensor_id, name, category, file_url, notes, uploaded_by)
SELECT id, CONCAT('Certificado de calibración - ', code), 'calibration', NULL,
       'Registro documental inicial del equipo.', 1
FROM sensors;

INSERT INTO notification_logs (alarm_id, contact_id, channel, destination, status, provider_message, sent_at)
SELECT a.id, nc.id, 'email', nc.email, 'sent', 'Notificación inicial registrada por la plataforma', NOW()
FROM alarms a
JOIN sensors s ON s.id = a.sensor_id
JOIN notification_contacts nc ON nc.status = 'active'
  AND (nc.site_id IS NULL OR nc.site_id = s.site_id)
WHERE a.status IN ('abierta','en_atencion')
  AND nc.email IS NOT NULL
  AND JSON_CONTAINS(nc.levels, JSON_QUOTE(a.level));
