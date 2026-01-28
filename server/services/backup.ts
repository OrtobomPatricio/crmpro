import { getDb } from "../db";
import {
  appSettings,
  leads,
  templates,
  pipelines,
  pipelineStages,
  campaigns,
  campaignRecipients,
  conversations,
  chatMessages,
  whatsappNumbers,
  whatsappConnections,
  integrations,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export type BackupMode = "replace" | "merge";

export interface BackupData {
  version: string;
  timestamp: string;
  data: {
    appSettings?: any[];
    pipelines?: any[];
    pipelineStages?: any[];
    templates?: any[];
    leads: any[];
    campaigns?: any[];
    campaignRecipients?: any[];
    conversations?: any[];
    chatMessages?: any[];
    whatsappNumbers?: any[];
    whatsappConnections?: any[];
    integrations?: any[];
  };
}

function asArray(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Create a full backup of critical CRM data
 */
export async function createBackup(): Promise<BackupData> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [
    settingsData,
    pipelinesData,
    pipelineStagesData,
    templatesData,
    leadsData,
    campaignsData,
    recipientsData,
    conversationsData,
    messagesData,
    numbersData,
    connectionsData,
    integrationsData,
  ] = await Promise.all([
    db.select().from(appSettings),
    db.select().from(pipelines),
    db.select().from(pipelineStages),
    db.select().from(templates),
    db.select().from(leads),
    db.select().from(campaigns),
    db.select().from(campaignRecipients),
    db.select().from(conversations),
    db.select().from(chatMessages),
    db.select().from(whatsappNumbers),
    db.select().from(whatsappConnections),
    db.select().from(integrations),
  ]);

  return {
    version: "2.0",
    timestamp: new Date().toISOString(),
    data: {
      appSettings: settingsData,
      pipelines: pipelinesData,
      pipelineStages: pipelineStagesData,
      templates: templatesData,
      leads: leadsData,
      campaigns: campaignsData,
      campaignRecipients: recipientsData,
      conversations: conversationsData,
      chatMessages: messagesData,
      whatsappNumbers: numbersData,
      whatsappConnections: connectionsData,
      integrations: integrationsData,
    },
  };
}

/**
 * Validate backup file structure (supports v1 and v2)
 */
export function validateBackupFile(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  if (!data.version || !data.timestamp || !data.data) return false;

  // Must have at least leads array
  if (!data.data.leads || !Array.isArray(data.data.leads)) return false;

  return true;
}

/**
 * Restore backup JSON
 *
 * - replace: wipes and restores all supported tables (recommended)
 * - merge: safe merge (ONLY imports leads + templates + pipelines/stages, and avoids duplicates)
 */
export async function restoreBackup(backup: any, mode: BackupMode = "replace") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (!validateBackupFile(backup)) {
    throw new Error("Archivo de backup inválido");
  }

  const data = backup.data ?? {};

  if (mode === "merge") {
    return restoreBackupMergeSafe(data);
  }

  return restoreBackupReplaceAll(data);
}

async function restoreBackupReplaceAll(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // CRITICAL: Use transaction to ensure atomicity
  // If restore fails mid-way, everything rolls back
  return await db.transaction(async (tx) => {
    // Delete children first (best effort). If your schema has no FKs, order still ok.
    await tx.delete(chatMessages);
    await tx.delete(conversations);
    await tx.delete(campaignRecipients);
    await tx.delete(campaigns);
    await tx.delete(templates);
    await tx.delete(pipelineStages);
    await tx.delete(pipelines);
    await tx.delete(integrations);
    await tx.delete(whatsappConnections);
    await tx.delete(whatsappNumbers);
    await tx.delete(leads);
    await tx.delete(appSettings);

    const inserted: Record<string, number> = {
      appSettings: 0,
      pipelines: 0,
      pipelineStages: 0,
      templates: 0,
      leads: 0,
      campaigns: 0,
      campaignRecipients: 0,
      conversations: 0,
      chatMessages: 0,
      whatsappNumbers: 0,
      whatsappConnections: 0,
      integrations: 0,
    };

    // Insert in parent -> children order
    const settings = asArray(data.appSettings);
    if (settings.length) {
      await tx.insert(appSettings).values(settings as any);
      inserted.appSettings = settings.length;
    }

    const pipes = asArray(data.pipelines);
    if (pipes.length) {
      await tx.insert(pipelines).values(pipes as any);
      inserted.pipelines = pipes.length;
    }

    const stages = asArray(data.pipelineStages);
    if (stages.length) {
      await tx.insert(pipelineStages).values(stages as any);
      inserted.pipelineStages = stages.length;
    }

    const tmpl = asArray(data.templates);
    if (tmpl.length) {
      await tx.insert(templates).values(tmpl as any);
      inserted.templates = tmpl.length;
    }

    const leadsData = asArray(data.leads);
    if (leadsData.length) {
      await tx.insert(leads).values(leadsData as any);
      inserted.leads = leadsData.length;
    }

    const nums = asArray(data.whatsappNumbers);
    if (nums.length) {
      await tx.insert(whatsappNumbers).values(nums as any);
      inserted.whatsappNumbers = nums.length;
    }

    const conns = asArray(data.whatsappConnections);
    if (conns.length) {
      await tx.insert(whatsappConnections).values(conns as any);
      inserted.whatsappConnections = conns.length;
    }

    const intgs = asArray(data.integrations);
    if (intgs.length) {
      await tx.insert(integrations).values(intgs as any);
      inserted.integrations = intgs.length;
    }

    const camps = asArray(data.campaigns);
    if (camps.length) {
      await tx.insert(campaigns).values(camps as any);
      inserted.campaigns = camps.length;
    }

    const campRecips = asArray(data.campaignRecipients);
    if (campRecips.length) {
      await tx.insert(campaignRecipients).values(campRecips as any);
      inserted.campaignRecipients = campRecips.length;
    }

    const convs = asArray(data.conversations);
    if (convs.length) {
      await tx.insert(conversations).values(convs as any);
      inserted.conversations = convs.length;
    }

    const msgs = asArray(data.chatMessages);
    if (msgs.length) {
      await tx.insert(chatMessages).values(msgs as any);
      inserted.chatMessages = msgs.length;
    }

    console.log("✅ Backup restored successfully (transactional):", inserted);
    return { success: true, inserted };
  });
}

async function restoreBackupMergeSafe(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1) Pipelines + stages (by name)
  const existingPipes = await db.select({ id: pipelines.id, name: pipelines.name }).from(pipelines);
  const pipeNameToId = new Map(existingPipes.map(p => [p.name, p.id]));

  let pipelinesImported = 0;
  let stagesImported = 0;

  for (const p of asArray(data.pipelines)) {
    if (!p?.name) continue;
    if (!pipeNameToId.has(p.name)) {
      const res = await db.insert(pipelines).values({
        name: p.name,
        isDefault: false,
        createdAt: p.createdAt ?? new Date(),
        updatedAt: p.updatedAt ?? new Date(),
      } as any);
      const newId = (res as any)?.[0]?.insertId;
      if (newId) {
        pipeNameToId.set(p.name, newId);
        pipelinesImported++;
      }
    }
  }

  // Stages: only if pipeline exists
  for (const s of asArray(data.pipelineStages)) {
    const pipeName = (asArray(data.pipelines).find((p: any) => p.id === s.pipelineId)?.name) as string | undefined;
    const mappedPipelineId = pipeName ? pipeNameToId.get(pipeName) : undefined;
    if (!mappedPipelineId) continue;

    // avoid duplicates by (pipelineId + name)
    const already = await db
      .select({ id: pipelineStages.id, name: pipelineStages.name })
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, mappedPipelineId))
      .limit(500);
    const existsByName = already.some((row: any) => row.name === s.name);
    if (existsByName) continue;

    await db.insert(pipelineStages).values({
      pipelineId: mappedPipelineId,
      name: s.name,
      type: s.type ?? "open",
      color: s.color ?? "#e2e8f0",
      order: s.order ?? 1,
      createdAt: s.createdAt ?? new Date(),
      updatedAt: s.updatedAt ?? new Date(),
    } as any);
    stagesImported++;
  }

  // 2) Templates (by name + type)
  const existingTemplates = await db.select({ id: templates.id, name: templates.name, type: templates.type }).from(templates);
  const templateKey = (t: any) => `${t.name}::${t.type}`;
  const existingTemplateKeys = new Set(existingTemplates.map(templateKey));

  let templatesImported = 0;
  for (const t of asArray(data.templates)) {
    if (!t?.name) continue;
    const key = templateKey(t);
    if (existingTemplateKeys.has(key)) continue;
    await db.insert(templates).values({
      name: t.name,
      content: t.content ?? "",
      type: t.type ?? "whatsapp",
      variables: t.variables ?? null,
      createdAt: t.createdAt ?? new Date(),
    } as any);
    templatesImported++;
  }

  // 3) Leads (dedupe by phone)
  const existingLeads = await db.select({ phone: leads.phone }).from(leads);
  const phoneSet = new Set(existingLeads.map(l => String(l.phone ?? "").trim()).filter(Boolean));

  const stageRows = await db.select({ id: pipelineStages.id }).from(pipelineStages);
  const validStageIds = new Set(stageRows.map(s => s.id));

  let leadsImported = 0;
  let duplicates = 0;

  for (const l of asArray(data.leads)) {
    const phone = String(l?.phone ?? "").trim();
    if (!phone) continue;

    if (phoneSet.has(phone)) {
      duplicates++;
      continue;
    }

    await db.insert(leads).values({
      name: l.name ?? "Sin nombre",
      phone,
      email: l.email ?? null,
      country: l.country ?? "Paraguay",
      status: l.status ?? "new",
      notes: l.notes ?? null,
      pipelineStageId: validStageIds.has(l.pipelineStageId) ? l.pipelineStageId : null,
      kanbanOrder: 0,
      createdAt: l.createdAt ?? new Date(),
      updatedAt: l.updatedAt ?? new Date(),
    } as any);

    phoneSet.add(phone);
    leadsImported++;
  }

  return {
    success: true as const,
    mode: "merge" as const,
    imported: {
      pipelines: pipelinesImported,
      pipelineStages: stagesImported,
      templates: templatesImported,
      leads: leadsImported,
      duplicates,
    },
    note: "Merge seguro: solo importa Pipelines/Etapas, Plantillas y Leads. Para restauración completa use 'Reemplazar'.",
  };
}

/**
 * Convert leads to CSV format
 */
export function leadsToCSV(leadsData: any[]): string {
  if (leadsData.length === 0) return "nombre,telefono,email,pais,estado,notas\n";

  const headers = ["nombre", "telefono", "email", "pais", "estado", "notas"];
  const rows = leadsData.map((lead) => [
    lead.name || "",
    lead.phone || "",
    lead.email || "",
    lead.country || "",
    lead.status || "",
    (lead.notes || "").replace(/\"/g, '""'),
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

  return csvContent;
}

/**
 * Parse CSV and return structured data
 */
export function parseCSV(csvContent: string): any[] {
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/\"/g, ""));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]
      .split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/)
      .map((v) => v.trim().replace(/^\"|\"$/g, ""));
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    data.push(row);
  }

  return data;
}

/**
 * Import leads from CSV with deduplication
 */
export async function importLeadsFromCSV(csvData: any[]): Promise<{ imported: number; duplicates: number; errors: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let imported = 0;
  let duplicates = 0;
  let errors = 0;

  const existingLeads = await db.select().from(leads);
  const existingPhones = new Set(existingLeads.map((l) => l.phone));

  for (const row of csvData) {
    try {
      const phone = row.telefono || row.phone;
      const name = row.nombre || row.name;

      if (!phone || !name) {
        errors++;
        continue;
      }

      if (existingPhones.has(phone)) {
        duplicates++;
        continue;
      }

      await db.insert(leads).values({
        name,
        phone,
        email: row.email || null,
        country: row.pais || row.country || "Paraguay",
        status: (row.estado || row.status || "new") as any,
        notes: row.notas || row.notes || null,
      } as any);

      existingPhones.add(phone);
      imported++;
    } catch (error) {
      console.error("[Import] Failed to import lead:", error);
      errors++;
    }
  }

  return { imported, duplicates, errors };
}
