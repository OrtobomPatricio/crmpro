-- 1) app_settings singleton real (si tu DB ya tiene la col singleton)
ALTER TABLE app_settings
  ADD UNIQUE KEY uniq_app_settings_singleton (singleton);

-- 2) idempotencia real
ALTER TABLE leads
  ADD UNIQUE KEY uq_leads_phone (phone);

ALTER TABLE campaign_recipients
  ADD UNIQUE KEY uq_campaign_lead (campaignId, leadId);

-- 3) FKs críticas (ajustá nombres exactos si difieren)
ALTER TABLE campaign_recipients
  ADD CONSTRAINT fk_campaign_recipients_campaign
  FOREIGN KEY (campaignId) REFERENCES campaigns(id)
  ON DELETE CASCADE;

ALTER TABLE campaign_recipients
  ADD CONSTRAINT fk_campaign_recipients_lead
  FOREIGN KEY (leadId) REFERENCES leads(id)
  ON DELETE CASCADE;

ALTER TABLE messages
  ADD CONSTRAINT fk_messages_lead
  FOREIGN KEY (leadId) REFERENCES leads(id)
  ON DELETE CASCADE;
