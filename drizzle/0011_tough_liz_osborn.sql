ALTER TABLE `app_settings` ADD `singleton` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `securityConfig` json;--> statement-breakpoint
ALTER TABLE `app_settings` ADD CONSTRAINT `uniq_app_settings_singleton` UNIQUE(`singleton`);--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD CONSTRAINT `unique_campaign_lead` UNIQUE(`campaignId`,`leadId`);--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `uniq_leads_phone` UNIQUE(`phone`);--> statement-breakpoint
ALTER TABLE `access_logs` ADD CONSTRAINT `access_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `achievements` ADD CONSTRAINT `achievements_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_reasonId_appointment_reasons_id_fk` FOREIGN KEY (`reasonId`) REFERENCES `appointment_reasons`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD CONSTRAINT `campaign_recipients_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD CONSTRAINT `campaign_recipients_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD CONSTRAINT `campaign_recipients_whatsappNumberId_whatsapp_numbers_id_fk` FOREIGN KEY (`whatsappNumberId`) REFERENCES `whatsapp_numbers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_templateId_templates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `templates`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_whatsappNumberId_whatsapp_numbers_id_fk` FOREIGN KEY (`whatsappNumberId`) REFERENCES `whatsapp_numbers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_facebookPageId_facebook_pages_id_fk` FOREIGN KEY (`facebookPageId`) REFERENCES `facebook_pages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_whatsappNumberId_whatsapp_numbers_id_fk` FOREIGN KEY (`whatsappNumberId`) REFERENCES `whatsapp_numbers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_facebookPageId_facebook_pages_id_fk` FOREIGN KEY (`facebookPageId`) REFERENCES `facebook_pages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_assignedToId_users_id_fk` FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `goals` ADD CONSTRAINT `goals_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integrations` ADD CONSTRAINT `integrations_whatsappNumberId_whatsapp_numbers_id_fk` FOREIGN KEY (`whatsappNumberId`) REFERENCES `whatsapp_numbers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integrations` ADD CONSTRAINT `integrations_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `internal_messages` ADD CONSTRAINT `internal_messages_senderId_users_id_fk` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `internal_messages` ADD CONSTRAINT `internal_messages_recipientId_users_id_fk` FOREIGN KEY (`recipientId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_pipelineStageId_pipeline_stages_id_fk` FOREIGN KEY (`pipelineStageId`) REFERENCES `pipeline_stages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_assignedToId_users_id_fk` FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_whatsappNumberId_whatsapp_numbers_id_fk` FOREIGN KEY (`whatsappNumberId`) REFERENCES `whatsapp_numbers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_whatsappNumberId_whatsapp_numbers_id_fk` FOREIGN KEY (`whatsappNumberId`) REFERENCES `whatsapp_numbers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pipeline_stages` ADD CONSTRAINT `pipeline_stages_pipelineId_pipelines_id_fk` FOREIGN KEY (`pipelineId`) REFERENCES `pipelines`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_connections` ADD CONSTRAINT `whatsapp_connections_whatsappNumberId_whatsapp_numbers_id_fk` FOREIGN KEY (`whatsappNumberId`) REFERENCES `whatsapp_numbers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_logs` ADD CONSTRAINT `workflow_logs_workflowId_workflows_id_fk` FOREIGN KEY (`workflowId`) REFERENCES `workflows`(`id`) ON DELETE cascade ON UPDATE no action;