import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error("DATABASE_URL is not defined");
        process.exit(1);
    }

    console.log("[Migration] Connecting to database...");

    const connection = await mysql.createConnection({
        uri: connectionString,
        multipleStatements: true,
    });

    const db = drizzle(connection);

    console.log("[Migration] Running migrations from ./drizzle folder...");

    try {
        await migrate(db, {
            migrationsFolder: path.resolve(process.cwd(), "drizzle")
        });
        console.log("[Migration] Success! Database is up to date.");
    } catch (error) {
        console.error("[Migration] Failed:", error);
        // Do not exit process if imported, let caller handle it? 
        // Or throw.
        throw error;
    } finally {
        await connection.end();
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runMigrations().catch((err) => {
        console.error("[Migration] Unhandled error:", err);
        process.exit(1);
    });
}
