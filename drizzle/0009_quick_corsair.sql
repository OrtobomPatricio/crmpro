CREATE TABLE IF NOT EXISTS `achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(50) NOT NULL,
	`unlockedAt` timestamp NOT NULL DEFAULT (now()),
	`metadata` json,
	CONSTRAINT `achievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('sales_amount','deals_closed','leads_created','messages_sent') NOT NULL,
	`targetAmount` int NOT NULL,
	`currentAmount` int NOT NULL DEFAULT 0,
	`period` enum('daily','weekly','monthly') NOT NULL DEFAULT 'monthly',
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `internal_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderId` int NOT NULL,
	`recipientId` int,
	`content` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `internal_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `app_settings` ADD `salesConfig` json;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `whatsappMessageId` varchar(128);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `messagesRead` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `kanbanOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `value` decimal(12,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `users` ADD `customRole` varchar(64);