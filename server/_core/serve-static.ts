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
    } else {
        console.error("❌ Assets folder MISSING at:", assetsPath);
    }


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

    app.get("*", (_req, res) => {
        res.sendFile(path.join(root, "index.html"));
    });
}
