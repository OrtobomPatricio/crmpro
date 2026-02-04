import express, { type Express } from "express";
import fs from "fs";
import path from "path";

function pickStaticRoot() {
    const candidates = [
        path.join(process.cwd(), "dist", "public"),
        path.join(process.cwd(), "client", "public"),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return candidates[0];
}

export function serveStatic(app: Express) {
    const root = pickStaticRoot();

    if (!fs.existsSync(root)) {
        throw new Error(`Static root not found: ${root}. Build the client first.`);
    }
    console.log("📂 Serving static files from:", root);
    // Explicitly debug assets path
    const assetsPath = path.join(root, "assets");
    if (fs.existsSync(assetsPath)) {
        console.log("✅ Assets folder found at:", assetsPath);
        // List first few files to verify
        try {
            const files = fs.readdirSync(assetsPath).slice(0, 5);
            console.log("   Files in assets:", files);
        } catch (e) {
            console.error("   Error reading assets folder:", e);
        }
    } else {
        console.error("❌ Assets folder MISSING at:", assetsPath);
    }

    // Add specific logger for static files to debug 404s/500s
    app.use((req, res, next) => {
        if (req.url.startsWith("/assets/") || req.url.startsWith("/static/")) {
            const ext = path.extname(req.url);
            const fullPath = path.join(root, req.url);
            // Only log if it's suspicious (missing file)
            if (!fs.existsSync(fullPath)) {
                console.warn(`⚠️  Static file 404: ${req.url} (Looking at: ${fullPath})`);
            }
        }
        next();
    });

    app.use(
        express.static(root, {
            index: false,
            maxAge: "1y",
            immutable: true,
            setHeaders(res, filePath) {
                if (filePath.endsWith(".html")) {
                    res.setHeader("Cache-Control", "no-store");
                }
            },
        })
    );

    app.get("*", (req, res) => {
        // Fallback handler
        if (req.path.startsWith("/api") || req.path.startsWith("/trpc")) {
            // Don't serve HTML for API 404s
            return res.status(404).json({ error: "Not Found", path: req.path });
        }

        const indexPath = path.join(root, "index.html");
        if (!fs.existsSync(indexPath)) {
            console.error("❌ index.html NOT FOUND at:", indexPath);
            return res.status(500).send("System Error: Frontend build missing index.html");
        }

        res.sendFile(indexPath, (err) => {
            if (err) {
                console.error("🔴 Error sending index.html:", err);
                if (!res.headersSent) res.status(500).send("Error serving frontend");
            }
        });
    });
}
