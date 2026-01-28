-- Migration: Add unique constraints for data integrity
-- Created: 2026-01-28
-- Purpose: F2 fix - Add missing unique constraints to prevent duplicates

-- Step 1: Clean duplicate leads by phone (keep oldest)
DELETE l1 FROM leads l1
INNER JOIN leads l2 
WHERE l1.id > l2.id AND l1.phone = l2.phone AND l1.phone IS NOT NULL AND l1.phone != '';

-- Step 2: Add unique index on leads.phone
ALTER TABLE leads 
  ADD UNIQUE INDEX unique_leads_phone (phone);

-- Step 3: Clean duplicate campaign recipients (keep oldest)
DELETE cr1 FROM campaign_recipients cr1
INNER JOIN campaign_recipients cr2 
WHERE cr1.id > cr2.id 
  AND cr1.campaignId = cr2.campaignId 
  AND cr1.leadId = cr2.leadId;

-- Step 4: Add unique index on campaign_recipients (campaignId, leadId)
ALTER TABLE campaign_recipients
  ADD UNIQUE INDEX unique_campaign_recipient (campaignId, leadId);

-- Verification queries (run after migration):
-- SELECT phone, COUNT(*) as count FROM leads WHERE phone IS NOT NULL GROUP BY phone HAVING count > 1;
-- SELECT campaignId, leadId, COUNT(*) as count FROM campaign_recipients GROUP BY campaignId, leadId HAVING count > 1;
