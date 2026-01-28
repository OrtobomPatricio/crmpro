
process.env.DATABASE_URL = "mysql://root:change_me@127.0.0.1:3306/chin_crm";

import { getDb } from "./server/db";
import { users } from "./drizzle/schema";

async function main() {
    const db = await getDb();
    if (!db) {
        console.error("No DB connection");
        process.exit(1);
    }

    const allUsers = await db.select().from(users);
    console.log("--- USERS ---");
    allUsers.forEach(u => {
        console.log(`ID: ${u.id} | Name: ${u.name} | Email: ${u.email} | Role: ${u.role} | CustomRole: ${u.customRole}`);
    });
    console.log("-------------");
    process.exit(0);
}

main().catch(console.error);
