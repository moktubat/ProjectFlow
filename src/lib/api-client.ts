import axios from "axios";
import { useUIStore } from "../store/ui-store.js";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
    const token = useUIStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            // same logic currently in fetch-interceptor.ts
        }
        const message = err.response?.data?.error || err.message || "Request failed.";
        return Promise.reject(new Error(message));
    }
);
