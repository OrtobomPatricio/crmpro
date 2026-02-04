-- Optimizations for Leads Table
-- 1. Faster Kanban Board loading (filter by stage + sort by order)
CREATE INDEX IF NOT EXISTS `idx_leads_kanban` ON `leads` (`pipeline_stage_id`, `kanban_order`);

-- 2. Faster Duplication Checks & Search
CREATE INDEX IF NOT EXISTS `idx_leads_phone` ON `leads` (`phone`);

-- 3. Faster Sorting by Recency
CREATE INDEX IF NOT EXISTS `idx_leads_created_at` ON `leads` (`created_at` DESC);
