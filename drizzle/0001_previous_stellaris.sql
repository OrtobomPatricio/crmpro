CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50),
	`entityId` int,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`leadId` int NOT NULL,
	`whatsappNumberId` int,
	`status` enum('pending','sent','delivered','failed','read') NOT NULL DEFAULT 'pending',
	`sentAt` timestamp,
	`deliveredAt` timestamp,
	`readAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_recipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`status` enum('draft','scheduled','running','paused','completed','cancelled') NOT NULL DEFAULT 'draft',
	`scheduledAt` timestamp,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`totalRecipients` int NOT NULL DEFAULT 0,
	`messagesSent` int NOT NULL DEFAULT 0,
	`messagesDelivered` int NOT NULL DEFAULT 0,
	`messagesFailed` int NOT NULL DEFAULT 0,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(320),
	`country` varchar(50) NOT NULL,
	`status` enum('new','contacted','qualified','negotiation','won','lost') NOT NULL DEFAULT 'new',
	`source` varchar(100),
	`notes` text,
	`commission` decimal(10,2) DEFAULT '0.00',
	`assignedToId` int,
	`whatsappNumberId` int,
	`lastContactedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`whatsappNumberId` int NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`content` text NOT NULL,
	`status` enum('pending','sent','delivered','read','failed') NOT NULL DEFAULT 'pending',
	`sentAt` timestamp,
	`deliveredAt` timestamp,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_numbers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phoneNumber` varchar(20) NOT NULL,
	`displayName` varchar(100),
	`country` varchar(50) NOT NULL,
	`countryCode` varchar(5) NOT NULL,
	`status` enum('active','warming_up','blocked','disconnected') NOT NULL DEFAULT 'warming_up',
	`warmupDay` int NOT NULL DEFAULT 0,
	`warmupStartDate` timestamp,
	`dailyMessageLimit` int NOT NULL DEFAULT 20,
	`messagesSentToday` int NOT NULL DEFAULT 0,
	`totalMessagesSent` int NOT NULL DEFAULT 0,
	`lastConnected` timestamp,
	`isConnected` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_numbers_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_numbers_phoneNumber_unique` UNIQUE(`phoneNumber`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `hasSeenTour` boolean DEFAULT false NOT NULL;