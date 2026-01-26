CREATE TABLE `access_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(200) NOT NULL,
	`entityType` varchar(100),
	`entityId` int,
	`ipAddress` varchar(45),
	`userAgent` text,
	`success` boolean NOT NULL DEFAULT true,
	`errorMessage` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_field_definitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('lead','contact','company') NOT NULL DEFAULT 'lead',
	`name` varchar(100) NOT NULL,
	`type` enum('text','number','date','select','checkbox') NOT NULL,
	`options` json,
	`isRequired` boolean NOT NULL DEFAULT false,
	`order` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_field_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facebook_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageId` varchar(100) NOT NULL,
	`name` varchar(200) NOT NULL,
	`accessToken` text,
	`isConnected` boolean NOT NULL DEFAULT true,
	`pictureUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `facebook_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `facebook_pages_pageId_unique` UNIQUE(`pageId`)
);
--> statement-breakpoint
CREATE TABLE `pipeline_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pipelineId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(20) DEFAULT '#e2e8f0',
	`order` int NOT NULL DEFAULT 0,
	`type` enum('open','won','lost') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pipeline_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pipelines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pipelines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminder_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`content` text NOT NULL,
	`daysBefore` int NOT NULL DEFAULT 1,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reminder_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionToken` varchar(255) NOT NULL,
	`ipAddress` varchar(45),
	`userAgent` text,
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_sessionToken_unique` UNIQUE(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(150) NOT NULL,
	`content` text NOT NULL,
	`type` enum('whatsapp','email') NOT NULL DEFAULT 'whatsapp',
	`variables` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowId` int NOT NULL,
	`entityId` int NOT NULL,
	`status` enum('success','failed') NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`triggerType` enum('lead_created','lead_updated','msg_received','campaign_link_clicked') NOT NULL,
	`triggerConfig` json,
	`actions` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chat_messages` MODIFY COLUMN `whatsappNumberId` int;--> statement-breakpoint
ALTER TABLE `conversations` MODIFY COLUMN `whatsappNumberId` int;--> statement-breakpoint
ALTER TABLE `conversations` MODIFY COLUMN `contactPhone` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `dashboardConfig` json;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `smtpConfig` json;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `storageConfig` json;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `aiConfig` json;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `mapsConfig` json;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `slaConfig` json;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `chatDistributionConfig` json;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `lastAssignedAgentId` int;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `type` enum('whatsapp','email') DEFAULT 'whatsapp' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `templateId` int;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `audienceConfig` json;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `facebookPageId` int;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `facebookMessageId` varchar(100);--> statement-breakpoint
ALTER TABLE `conversations` ADD `channel` enum('whatsapp','facebook') DEFAULT 'whatsapp' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `facebookPageId` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `pipelineStageId` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `customFields` json;--> statement-breakpoint
ALTER TABLE `users` ADD `password` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `invitationToken` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `invitationExpires` timestamp;