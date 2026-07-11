DROP PROCEDURE IF EXISTS add_col_safe;
DELIMITER $$
CREATE PROCEDURE add_col_safe(tbl VARCHAR(64), col VARCHAR(64), definition TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = tbl AND column_name = col) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL add_col_safe('notification_contacts', 'cargo',        'VARCHAR(120) NULL AFTER name');
CALL add_col_safe('notification_contacts', 'confirmed_at', 'DATETIME NULL AFTER status');
CALL add_col_safe('notification_contacts', 'confirm_token','VARCHAR(64) NULL AFTER confirmed_at');

DROP PROCEDURE IF EXISTS add_col_safe;
