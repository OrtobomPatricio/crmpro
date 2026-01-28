import { getDb } from "../db";
import { appSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

// Allow passing db instance to use within transactions
export async function getOrCreateAppSettings(dbOrNull?: MySql2Database<any> | null) {
    const db = dbOrNull || await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await db.select().from(appSettings).where(eq(appSettings.singleton, 1)).limit(1);
    if (rows[0]) return rows[0];

    await db.insert(appSettings).values({ singleton: 1 });
    const again = await db.select().from(appSettings).where(eq(appSettings.singleton, 1)).limit(1);
    if (!again[0]) throw new Error("Failed to create app_settings singleton");
    return again[0];
}

export async function updateAppSettings(db: MySql2Database<any>, values: Partial<typeof appSettings.$inferInsert>) {
    const row = await getOrCreateAppSettings(db);
    // Ensure we don't accidentally create a new row or update others (though singleton prevents it)
    await db.update(appSettings)
        .set(values)
        .where(eq(appSettings.id, row.id));
}
