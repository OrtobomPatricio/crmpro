-- Pro Upgrade Pack: Kanban ordering, custom roles, campaign read tracking

-- users.customRole
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='customRole');
SET @stmt := IF(@col = 0, 'ALTER TABLE users ADD COLUMN customRole VARCHAR(64) NULL AFTER role', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- leads.kanbanOrder
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='leads' AND COLUMN_NAME='kanbanOrder');
SET @stmt := IF(@col = 0, 'ALTER TABLE leads ADD COLUMN kanbanOrder INT NOT NULL DEFAULT 0 AFTER pipelineStageId', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- campaign_recipients.whatsappMessageId
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='campaign_recipients' AND COLUMN_NAME='whatsappMessageId');
SET @stmt := IF(@col = 0, 'ALTER TABLE campaign_recipients ADD COLUMN whatsappMessageId VARCHAR(128) NULL AFTER whatsappNumberId', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- campaigns.messagesRead
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='campaigns' AND COLUMN_NAME='messagesRead');
SET @stmt := IF(@col = 0, 'ALTER TABLE campaigns ADD COLUMN messagesRead INT NOT NULL DEFAULT 0 AFTER messagesDelivered', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Initialize kanbanOrder for existing leads (stable ordering)
UPDATE leads SET kanbanOrder = id WHERE kanbanOrder = 0 OR kanbanOrder IS NULL;
