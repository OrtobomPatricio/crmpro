-- Performance Indexes Migration
-- Created: 2026-02-02
-- Purpose: Add indexes to frequently queried columns for better performance

-- ==== LEADS TABLE ====
-- These columns are used in JOINs and WHERE clauses very frequently
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assignedToId);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads(pipelineStageId);
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_number ON leads(whatsappNumberId);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(createdAt);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- ==== CONVERSATIONS TABLE ====
-- Optimize chat queries by agent assignment
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON conversations(assignedToId);
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_number ON conversations(whatsappNumberId);
CREATE INDEX IF NOT EXISTS idx_conversations_facebook_page ON conversations(facebookPageId);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(lastMessageAt DESC);

-- ==== CHAT_MESSAGES TABLE ====
-- Critical for loading chat history quickly
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversationId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_whatsapp_number ON chat_messages(whatsappNumberId);
CREATE INDEX IF NOT EXISTS idx_chat_messages_facebook_page ON chat_messages(facebookPageId);

-- ==== CAMPAIGNS TABLE ====
-- Optimize campaign worker queries
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduledAt);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns(createdById);

-- ==== CAMPAIGN_RECIPIENTS TABLE ====
-- Critical for batch processing
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaignId, status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_lead ON campaign_recipients(leadId);

-- ==== APPOINTMENTS TABLE ====
-- Optimize scheduling queries
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointmentDate);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_created_by ON appointments(createdById);
CREATE INDEX IF NOT EXISTS idx_appointments_lead ON appointments(leadId);

-- ==== ACCESS_LOGS TABLE ====
-- For security audit queries
CREATE INDEX IF NOT EXISTS idx_access_logs_user ON access_logs(userId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON access_logs(createdAt);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action);

-- ==== ACTIVITY_LOGS TABLE ====
-- For activity tracking
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(userId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(createdAt);

-- ==== WORKFLOW_LOGS TABLE ====
-- For automation debugging
CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow ON workflow_logs(workflowId);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_created ON workflow_logs(createdAt);

-- ==== SESSIONS TABLE ====
-- For session management (when implemented)
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(sessionToken);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expiresAt);

-- ==== USERS TABLE ====
-- Optimize user lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(isActive);

-- Verification queries to confirm indexes were created
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND INDEX_NAME LIKE 'idx_%'
ORDER BY TABLE_NAME, INDEX_NAME;
