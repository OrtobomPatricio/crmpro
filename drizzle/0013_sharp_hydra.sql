CREATE TABLE `smtp_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`host` varchar(255) NOT NULL,
	`port` int NOT NULL,
	`secure` boolean NOT NULL DEFAULT false,
	`user` varchar(255) NOT NULL,
	`password` text,
	`fromEmail` varchar(255),
	`fromName` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`isDefault` boolean NOT NULL DEFAULT false,
	`lastTested` timestamp,
	`testStatus` enum('untested','success','failed') NOT NULL DEFAULT 'untested',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smtp_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `templates` ADD `attachments` json;