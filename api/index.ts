import { getApp } from "../server.js";

let cachedApp: any = null;

export default async function handler(req: any, res: any) {
    if (!cachedApp) {
        cachedApp = await getApp();
    }
    return cachedApp(req, res);
}