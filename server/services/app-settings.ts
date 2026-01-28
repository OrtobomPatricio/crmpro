import { desc, eq } from "drizzle-orm";
import { appSettings } from "../../drizzle/schema";

export async function getOrCreateAppSettings(db: any) {
    const rows = await db.select().from(appSettings).orderBy(desc(appSettings.id)).limit(1);
    if (rows[0]) return rows[0];

    await db.insert(appSettings).values({
        singleton: 1,
        companyName: "Imagine Lab CRM",
        timezone: "America/Asuncion",
        language: "es",
        currency: "PYG",
        scheduling: { slotMinutes: 15, maxPerSlot: 6, allowCustomTime: true },
    });

    const created = await db.select().from(appSettings).orderBy(desc(appSettings.id)).limit(1);
    return created[0];
}

export async function updateAppSettings(db: any, patch: any) {
    const row = await getOrCreateAppSettings(db);
    await db.update(appSettings).set(patch).where(eq(appSettings.id, row.id));
    const fresh = await db.select().from(appSettings).where(eq(appSettings.id, row.id)).limit(1);
    return fresh[0];
}
