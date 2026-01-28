import { getDb } from "../db";
import { sql } from "drizzle-orm";

export async function assertDbConstraints() {
    const db = await getDb();
    if (!db) return;

    // Verificamos el constraint más crítico: UNIQUE en singleton de app_settings
    // Esto asegura que la DB realmente corrió la migración 0011
    try {
        const [r] = await db.execute(sql`
      SELECT COUNT(*) as c
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'app_settings'
        AND index_name = 'uniq_app_settings_singleton'
    `) as any;

        const ok = Number(r?.c ?? 0) > 0;

        // Solo fallamos en producción si falta el constraint
        if (!ok && process.env.NODE_ENV === "production") {
            console.error("🔴 [CRITICAL] DB SECURITY CHECK FAILED: uniq_app_settings_singleton is missing.");
            console.error("   Run 'npm run db:migrate' immediately.");
            throw new Error("DB MISSING CONSTRAINT: uniq_app_settings_singleton");
        } else if (ok) {
            console.log("✅ [Checking] DB has critical hardening constraints.");
        }
    } catch (err: any) {
        // Si falla la consulta (ej. permisos), logueamos pero no crasheamos a menos que sea el error explícito
        if (err.message.includes("DB MISSING CONSTRAINT")) {
            throw err;
        }
        console.warn("⚠️ [Checking] Could not verify DB constraints:", err.message);
    }
}
