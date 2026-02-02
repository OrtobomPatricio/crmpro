import { router } from "../_core/trpc";
import { systemRouter } from "../_core/systemRouter";
import { authRouter } from "./auth";
import { sessionsRouter } from "./sessions";
import { whatsappRouter } from "./whatsapp";
import { whatsappNumbersRouter } from "./whatsapp-numbers";
import { whatsappConnectionsRouter } from "./whatsapp-connections";
import { settingsRouter } from "./settings";
import { teamRouter } from "./team";
import { dashboardRouter } from "./dashboard";
import { pipelinesRouter } from "./pipelines";
import { leadsRouter } from "./leads";
import { templatesRouter } from "./templates";
import { campaignsRouter } from "./campaigns";
import { integrationsRouter } from "./integrations";
import { workflowsRouter } from "./workflows";
import { securityRouter } from "./security";
import { backupRouter } from "./backup";
import { gamificationRouter } from "./gamification";
import { internalChatRouter } from "./internal-chat";
import { chatRouter } from "./chat";
import { messagesRouter } from "./messages";
import { facebookRouter } from "./facebook";
import { smtpRouter } from "./smtp";
import { schedulingRouter } from "./scheduling";
import { customFieldsRouter } from "./custom-fields";

export const appRouter = router({
    system: systemRouter,
    auth: authRouter,
    sessions: sessionsRouter,
    whatsapp: whatsappRouter, // merged from whatsapprouter (manages connections/numbers logic high level) -> actually `whatsapp` in legacy was "settings.view" list.
    whatsappNumbers: whatsappNumbersRouter,
    whatsappConnections: whatsappConnectionsRouter,
    settings: settingsRouter,
    team: teamRouter,
    dashboard: dashboardRouter,
    pipelines: pipelinesRouter,
    leads: leadsRouter,
    templates: templatesRouter,
    campaigns: campaignsRouter,
    integrations: integrationsRouter,
    workflows: workflowsRouter,
    security: securityRouter,
    backup: backupRouter,
    // gamification has sub-routers achievements and goals
    achievements: gamificationRouter.achievements,
    goals: gamificationRouter.goals,
    internalChat: internalChatRouter,
    chat: chatRouter,
    messages: messagesRouter,
    facebook: facebookRouter,
    smtp: smtpRouter,
    scheduling: schedulingRouter,
    customFields: customFieldsRouter,
});

export type AppRouter = typeof appRouter;
