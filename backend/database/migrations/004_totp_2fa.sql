DROP PROCEDURE IF EXISTS add_column_if_missing;
DELIMITER $$
CREATE PROCEDURE add_column_if_missing(tbl VARCHAR(64), col VARCHAR(64), definition TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = tbl AND column_name = col) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL add_column_if_missing('users', 'totp_secret', 'VARCHAR(64) NULL DEFAULT NULL');
CALL add_column_if_missing('users', 'totp_enabled', 'TINYINT(1) NOT NULL DEFAULT 0');

DROP PROCEDURE IF EXISTS add_column_if_missing;
