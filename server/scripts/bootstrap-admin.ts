import "dotenv/config";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";

async function main() {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const pass = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!email || !pass) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD");

    const hashed = await bcrypt.hash(pass, 12);
    await db.insert(users).values({
        openId: `local_${nanoid(16)}`,
        name: "Admin",
        email,
        password: hashed,
        role: "admin",
        loginMethod: "credentials",
        isActive: true,
        hasSeenTour: false,
    });

    console.log("admin creado");
}

main().catch(e => { console.error(e); process.exit(1); });
