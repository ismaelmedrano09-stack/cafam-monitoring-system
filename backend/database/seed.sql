SET NAMES utf8mb4;
USE cafam_monitoring;

INSERT INTO users (name, email, password_hash, role, status) VALUES
('Administrador Cafam', 'admin@cafam.test', '$2b$10$KPSPo66tbSGEAvvaCBmxwekXlfPFOZ1hKIe1xSPL6Jz4TAtT4ORhC', 'administrador', 'active'),
('Regente Farmacia', 'regente@cafam.test', '$2b$10$H7VB3Oaqko6n7GJNkaARFOSWLRQL6tczBLFkQU4WJnj8cI7he2XLO', 'regente_farmacia', 'active'),
('Analista Calidad', 'calidad@cafam.test', '$2b$10$HwXnSIv.3GvF3bVyEsfAL.6I4PzE8aTnIlMvSWyPVFP5moJ0upmy.', 'calidad', 'active');

INSERT INTO sites (code, name, address, city, latitude, longitude) VALUES
('CAFAM-CENTRAL', 'Clínica Cafam Central', 'Av. Carrera 68 # 90-88', 'Bogotá', 4.6923940, -74.0753710),
('CAFAM-CALLE93', 'Centro Médico Cafam Calle 93', 'Calle 93 # 14-20', 'Bogotá', 4.6760120, -74.0498260);

INSERT INTO sensors
(site_id, code, name, type, technology, firmware_version, battery_level, power_status, latitude, longitude, last_seen_at, location, area, status, reading_frequency, temp_min, temp_max, humidity_min, humidity_max, installed_at, last_calibration_at, responsible, observations)
VALUES
((SELECT id FROM sites WHERE code='CAFAM-CENTRAL'), 'NEV-01', 'Nevera de vacunas', 'SHT35', 'LoRa / WiFi', '2.4.1', 86, 'normal', 4.6925740, -74.0752210, NOW(), 'Clínica Cafam Central - Farmacia', 'Nevera de vacunas', 'activo', 5, 2, 8, 35, 70, '2026-01-15', '2026-05-15', 'Regente Farmacia', 'Cadena de frío biológicos'),
((SELECT id FROM sites WHERE code='CAFAM-CENTRAL'), 'CF-01', 'Cuarto frío principal', 'SHT85', 'LoRa / WiFi', '2.4.0', 80, 'normal', 4.6927540, -74.0750710, NOW(), 'Sótano técnico', 'Cuarto frío', 'activo', 5, 2, 8, 30, 75, '2026-01-20', '2026-05-20', 'Mantenimiento biomédico', 'Equipo principal'),
((SELECT id FROM sites WHERE code='CAFAM-CENTRAL'), 'FAR-01', 'Farmacia central', 'DHT22', 'WiFi', '2.4.1', 84, 'normal', 4.6929340, -74.0749210, NOW(), 'Piso 1', 'Farmacia', 'activo', 10, 15, 25, 35, 65, '2026-02-01', '2026-05-01', 'Regente Farmacia', 'Medicamentos generales'),
((SELECT id FROM sites WHERE code='CAFAM-CALLE93'), 'MA-01', 'Medicamentos de alto costo', 'SHT35', 'LoRa / WiFi', '2.4.1', 96, 'normal', 4.6760120, -74.0498260, NOW(), 'Piso 1 - Bodega segura', 'Medicamentos de alto costo', 'activo', 5, 15, 25, 35, 65, '2026-03-15', '2026-06-01', 'Calidad', 'Control especial');

INSERT INTO readings (sensor_id, temperature, humidity, calculated_status, source, mqtt_topic, created_at) VALUES
(1, 5.1, 62.4, 'normal', 'simulador', 'sensores/NEV-01/data', NOW() - INTERVAL 90 MINUTE),
(1, 5.5, 60.1, 'normal', 'simulador', 'sensores/NEV-01/data', NOW() - INTERVAL 60 MINUTE),
(1, 8.4, 64.2, 'critico', 'simulador', 'sensores/NEV-01/data', NOW() - INTERVAL 30 MINUTE),
(2, 4.3, 58.1, 'normal', 'simulador', 'sensores/CF-01/data', NOW() - INTERVAL 80 MINUTE),
(2, 7.4, 70.2, 'advertencia', 'simulador', 'sensores/CF-01/data', NOW() - INTERVAL 40 MINUTE),
(3, 21.6, 51.1, 'normal', 'simulador', 'sensores/FAR-01/data', NOW() - INTERVAL 70 MINUTE),
(3, 24.4, 63.2, 'advertencia', 'simulador', 'sensores/FAR-01/data', NOW() - INTERVAL 20 MINUTE),
(4, 20.2, 54.5, 'normal', 'simulador', 'sensores/MA-01/data', NOW() - INTERVAL 35 MINUTE),
(4, 26.2, 55.1, 'critico', 'simulador', 'sensores/MA-01/data', NOW() - INTERVAL 10 MINUTE);

INSERT INTO alarms (sensor_id, level, type, description, detected_value, allowed_range, status, assigned_to, started_at) VALUES
(1, 'critica', 'fuera_de_rango', 'Nevera de vacunas reporta temperatura fuera del rango permitido', 'Temperatura: 8.4 °C / Humedad: 64.2 %', 'Temperatura: 2-8 °C / Humedad: 35-70 %', 'abierta', 'Regente Farmacia', NOW() - INTERVAL 30 MINUTE),
(3, 'advertencia', 'cercano_al_limite', 'Farmacia central reporta valores cercanos al límite', 'Temperatura: 24.4 °C / Humedad: 63.2 %', 'Temperatura: 15-25 °C / Humedad: 35-65 %', 'abierta', 'Regente Farmacia', NOW() - INTERVAL 20 MINUTE);

INSERT INTO notification_contacts (site_id, name, email, phone, channels, levels) VALUES
((SELECT id FROM sites WHERE code = 'CAFAM-CENTRAL'), 'Regente Farmacia Central', 'regente@cafam.test', '+57 300 555 0101', JSON_ARRAY('email','sms'), JSON_ARRAY('advertencia','critica')),
(NULL, 'Mantenimiento Biomédico', 'biomedica@cafam.test', '+57 300 555 0103', JSON_ARRAY('email','call'), JSON_ARRAY('informativa','advertencia','critica'));

INSERT INTO device_files (sensor_id, name, category, notes, uploaded_by)
SELECT id, CONCAT('Certificado de calibración - ', code), 'calibration', 'Registro documental inicial del equipo.', 1
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

INSERT INTO audit_logs (user_id, action, entity, entity_id, description, ip_address) VALUES
(1, 'seed_database', 'system', NULL, 'Datos semilla iniciales cargados', '127.0.0.1');
