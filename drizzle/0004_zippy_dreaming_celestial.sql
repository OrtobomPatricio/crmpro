CREATE TABLE `appointment_reasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(20) DEFAULT '#3b82f6',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointment_reasons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(320),
	`reasonId` int,
	`appointmentDate` timestamp NOT NULL,
	`appointmentTime` varchar(10) NOT NULL,
	`notes` text,
	`status` enum('scheduled','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
	`leadId` int,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`whatsappNumberId` int NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`messageType` enum('text','image','video','audio','document','location','sticker','contact') NOT NULL DEFAULT 'text',
	`content` text,
	`mediaUrl` varchar(500),
	`mediaName` varchar(200),
	`mediaMimeType` varchar(100),
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`locationName` varchar(200),
	`status` enum('pending','sent','delivered','read','failed') NOT NULL DEFAULT 'pending',
	`whatsappMessageId` varchar(100),
	`sentAt` timestamp,
	`deliveredAt` timestamp,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`whatsappNumberId` int NOT NULL,
	`contactPhone` varchar(20) NOT NULL,
	`contactName` varchar(200),
	`leadId` int,
	`lastMessageAt` timestamp,
	`unreadCount` int NOT NULL DEFAULT 0,
	`status` enum('active','archived','blocked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`whatsappNumberId` int NOT NULL,
	`connectionType` enum('api','qr') NOT NULL,
	`accessToken` text,
	`phoneNumberId` varchar(50),
	`businessAccountId` varchar(50),
	`qrCode` text,
	`qrExpiresAt` timestamp,
	`sessionData` text,
	`isConnected` boolean NOT NULL DEFAULT false,
	`lastPingAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_connections_whatsappNumberId_unique` UNIQUE(`whatsappNumberId`)
);
