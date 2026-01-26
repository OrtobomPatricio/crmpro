
import { getDb } from "../db";
import { appSettings, users, conversations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export async function distributeConversation(conversationId: number) {
    const db = await getDb();
    if (!db) return;

    // 1. Get settings
    const settingsList = await db.select().from(appSettings).limit(1);
    const settings = settingsList[0];

    if (!settings || !settings.chatDistributionConfig) return; // Default or not configured

    const config = settings.chatDistributionConfig as any;
    if (config.mode !== 'round_robin') return;

    // 2. Get eligible agents
    // Role 'agent' or 'admin', active, and not in exclude list
    const allUsers = await db.select().from(users).where(eq(users.isActive, true));

    const eligibleAgents = allUsers.filter((u: any) => {
        // Check role, assume 'agent', 'admin', 'supervisor', 'owner' can take chats? 
        // Usually only 'agent' or 'admin' explicitly. Let's include all non-viewers for now.
        if (u.role === 'viewer') return false;

        // Check exclusion
        if (config.excludeAgentIds?.includes(u.id)) return false;

        return true;
    });

    if (eligibleAgents.length === 0) return;

    // 3. Find next agent
    // We use lastAssignedAgentId from settings to find the next one in the list.
    // Sort agents by ID to ensure deterministic order
    eligibleAgents.sort((a: any, b: any) => a.id - b.id);

    let nextAgent = eligibleAgents[0];
    const lastId = settings.lastAssignedAgentId;

    if (lastId) {
        const lastIndex = eligibleAgents.findIndex((a: any) => a.id === lastId);
        if (lastIndex !== -1 && lastIndex < eligibleAgents.length - 1) {
            nextAgent = eligibleAgents[lastIndex + 1];
        }
        // If lastIndex is last element, nextAgent remains index 0 (cycle)
    }

    // 4. Assign
    await db.update(conversations)
        .set({ assignedToId: nextAgent.id })
        .where(eq(conversations.id, conversationId));

    // 5. Update last assigned
    await db.update(appSettings)
        .set({ lastAssignedAgentId: nextAgent.id })
        .where(eq(appSettings.id, settings.id));

    console.log(`[Distribution] Assigned conversation ${conversationId} to agent ${nextAgent.name} (${nextAgent.id})`);
}
