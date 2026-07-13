-- Canal WhatsApp (CallMeBot): cada contacto guarda su API key personal
DROP PROCEDURE IF EXISTS add_whatsapp_column;
DELIMITER $$
CREATE PROCEDURE add_whatsapp_column()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_contacts' AND COLUMN_NAME = 'whatsapp_apikey'
  ) THEN
    ALTER TABLE notification_contacts ADD COLUMN whatsapp_apikey VARCHAR(64) NULL AFTER phone;
  END IF;
END$$
DELIMITER ;
CALL add_whatsapp_column();
DROP PROCEDURE IF EXISTS add_whatsapp_column;
