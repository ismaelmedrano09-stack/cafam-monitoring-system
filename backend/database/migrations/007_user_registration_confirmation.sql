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

CALL add_col_safe('users', 'confirmed_at', 'DATETIME NULL AFTER status');
CALL add_col_safe('users', 'confirm_token', 'VARCHAR(64) NULL AFTER confirmed_at');

DROP PROCEDURE IF EXISTS add_col_safe;
