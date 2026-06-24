import { useEffect, useRef } from "react";
import { useUIStore } from "../store/ui-store.js";

const POLL_INTERVAL = 15000;

export function useNotificationPolling() {
    const token = useUIStore((s) => s.token);
    const setNotifications = useUIStore((s) => s.setNotifications);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchNotifications = async () => {
        if (!token) return;
        try {
            const res = await fetch("/api/notifications", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const json = await res.json();
                setNotifications(json.data ?? json);
            }
        } catch {
        }
    };

    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (!token) return;

        fetchNotifications();

        intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [token, setNotifications]);
}