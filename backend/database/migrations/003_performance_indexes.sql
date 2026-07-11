-- Índices de rendimiento para consultas frecuentes
DROP PROCEDURE IF EXISTS add_index_if_missing;
DELIMITER $$
CREATE PROCEDURE add_index_if_missing(tbl VARCHAR(64), idx VARCHAR(64), cols VARCHAR(256))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = tbl AND index_name = idx) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD INDEX `', idx, '` (', cols, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL add_index_if_missing('readings', 'idx_readings_created_at', 'created_at');
CALL add_index_if_missing('readings', 'idx_readings_sensor_created', 'sensor_id, created_at');
CALL add_index_if_missing('readings', 'idx_readings_status', 'calculated_status');
CALL add_index_if_missing('alarms', 'idx_alarms_started_at', 'started_at');
CALL add_index_if_missing('alarms', 'idx_alarms_status', 'status');
CALL add_index_if_missing('alarms', 'idx_alarms_level', 'level');
CALL add_index_if_missing('alarms', 'idx_alarms_sensor_status', 'sensor_id, status');
CALL add_index_if_missing('corrective_actions', 'idx_ca_alarm_id', 'alarm_id');
CALL add_index_if_missing('corrective_actions', 'idx_ca_created_at', 'created_at');
CALL add_index_if_missing('audit_logs', 'idx_audit_created_at', 'created_at');
CALL add_index_if_missing('audit_logs', 'idx_audit_user_id', 'user_id');

DROP PROCEDURE IF EXISTS add_index_if_missing;
