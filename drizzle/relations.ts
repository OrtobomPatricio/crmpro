import { relations } from "drizzle-orm";
import { users, whatsappNumbers, leads, campaigns, campaignRecipients, messages, activityLogs } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  leads: many(leads),
  campaigns: many(campaigns),
  activityLogs: many(activityLogs),
}));

export const whatsappNumbersRelations = relations(whatsappNumbers, ({ many }) => ({
  leads: many(leads),
  campaignRecipients: many(campaignRecipients),
  messages: many(messages),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignedTo: one(users, {
    fields: [leads.assignedToId],
    references: [users.id],
  }),
  whatsappNumber: one(whatsappNumbers, {
    fields: [leads.whatsappNumberId],
    references: [whatsappNumbers.id],
  }),
  campaignRecipients: many(campaignRecipients),
  messages: many(messages),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [campaigns.createdById],
    references: [users.id],
  }),
  recipients: many(campaignRecipients),
}));

export const campaignRecipientsRelations = relations(campaignRecipients, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignRecipients.campaignId],
    references: [campaigns.id],
  }),
  lead: one(leads, {
    fields: [campaignRecipients.leadId],
    references: [leads.id],
  }),
  whatsappNumber: one(whatsappNumbers, {
    fields: [campaignRecipients.whatsappNumberId],
    references: [whatsappNumbers.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  lead: one(leads, {
    fields: [messages.leadId],
    references: [leads.id],
  }),
  whatsappNumber: one(whatsappNumbers, {
    fields: [messages.whatsappNumberId],
    references: [whatsappNumbers.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));
