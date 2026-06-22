import { getApp } from "../server.js";

let cachedApp: any = null;

export default async function handler(req: any, res: any) {
    try {
        if (!cachedApp) {
            cachedApp = await getApp();
        }
        return cachedApp(req, res);
    } catch (err: any) {
        console.error("[VERCEL HANDLER FATAL]", err);
        res.setHeader("Content-Type", "application/json");
        res.status(500).json({
            error: "Server initialization failed: " + (err?.message ?? String(err)),
        });
    }
}