import { useEffect, useRef } from "react";
import { useUIStore } from "../store/ui-store.js";

const POLL_INTERVAL = 15000;

export function useNotificationPolling() {
    const setNotifications = useUIStore((s) => s.setNotifications);
    const user = useUIStore((s) => s.user);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchNotifications = async () => {
        try {
            const res = await fetch("/api/notifications", { credentials: "include" });
            if (res.ok) {
                const json = await res.json();
                setNotifications(json.data ?? json);
            }
        } catch {
            // Silent fail; the global fetch-interceptor will trigger logout on 401
        }
    };

    useEffect(() => {
        if (!user) return;
        fetchNotifications();
        intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [setNotifications, user]);
}