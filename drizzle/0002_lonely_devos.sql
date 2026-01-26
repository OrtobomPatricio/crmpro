CREATE TABLE `integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('n8n','chatwoot','zapier','webhook') NOT NULL,
	`webhookUrl` varchar(500) NOT NULL,
	`whatsappNumberId` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`events` json,
	`lastTriggeredAt` timestamp,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`)
);
