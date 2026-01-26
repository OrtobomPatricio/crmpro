-- PRO upgrade: RBAC roles, settings table, chat error tracking, performance indexes

-- 1) Users: add isActive + upgrade roles
ALTER TABLE `users` ADD COLUMN `isActive` boolean NOT NULL DEFAULT true AFTER `role`;

-- Expand enum to include new roles while still allowing legacy 'user'
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','owner','supervisor','agent','viewer') NOT NULL DEFAULT 'agent';
UPDATE `users` SET `role`='agent' WHERE `role`='user';
ALTER TABLE `users` MODIFY COLUMN `role` enum('owner','admin','supervisor','agent','viewer') NOT NULL DEFAULT 'agent';

-- 2) App settings (single row)
CREATE TABLE `app_settings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyName` varchar(120) NOT NULL DEFAULT 'Imagine Lab CRM',
  `logoUrl` varchar(500),
  `timezone` varchar(60) NOT NULL DEFAULT 'America/Asuncion',
  `language` varchar(10) NOT NULL DEFAULT 'es',
  `currency` varchar(10) NOT NULL DEFAULT 'PYG',
  `permissionsMatrix` json,
  `scheduling` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `app_settings_id` PRIMARY KEY(`id`)
);

-- 3) Conversations: assignment for agents/supervisors
ALTER TABLE `conversations` ADD COLUMN `assignedToId` int;

-- 4) Chat messages: error tracking
ALTER TABLE `chat_messages` ADD COLUMN `errorMessage` text;
ALTER TABLE `chat_messages` ADD COLUMN `failedAt` timestamp;

-- 5) Useful indexes
CREATE INDEX `idx_chat_messages_conversation_created` ON `chat_messages` (`conversationId`, `createdAt`);
CREATE INDEX `idx_chat_messages_whatsapp_msgid` ON `chat_messages` (`whatsappMessageId`);
CREATE INDEX `idx_conversations_whatsapp_last` ON `conversations` (`whatsappNumberId`, `lastMessageAt`);
CREATE INDEX `idx_integrations_whatsapp_active` ON `integrations` (`whatsappNumberId`, `isActive`);
