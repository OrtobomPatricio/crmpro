
import { getDb } from './server/db';
import { whatsappConnections } from './drizzle/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

async function main() {
    const db = await getDb();
    if (!db) {
        console.error("DB not connected");
        return;
    }

    const connections = await db.select().from(whatsappConnections);
    console.log("=== Existing WhatsApp Connections ===");
    connections.forEach(c => {
        console.log(`ID: ${c.id} | PhoneID: ${c.phoneNumberId} | Status: ${c.isConnected ? 'Connected' : 'Disconnected'}`);
    });

    // Specific check for the one in screenshot
    const targetId = "980444491816543";
    const found = connections.find(c => c.phoneNumberId === targetId);
    if (found) {
        console.log(`✅ Connection for ID ${targetId} FOUND.`);
    } else {
        console.log(`❌ Connection for ID ${targetId} NOT FOUND.`);
    }

    process.exit(0);
}

main().catch(console.error);
