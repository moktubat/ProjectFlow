import { useUIStore } from "../store/ui-store.js";

let intercepting = false;
let loggingOut = false;

function handleAuthFailure(url: string): void {
    if (!useUIStore.getState().user) return;
    if (loggingOut) return;

    loggingOut = true;
    console.warn(`[fetch-interceptor] 401 on ${url} — triggering logout`);

    try {
        useUIStore.getState().logout();
    } catch {
        // Store may not be hydrated yet in edge cases during init
    }

    setTimeout(() => {
        loggingOut = false;
    }, 2000);
}

function isApiUrl(input: RequestInfo | URL): boolean {
    const url =
        typeof input === "string"
            ? input
            : input instanceof URL
                ? input.href
                : input.url;
    return url.startsWith("/api/") || url.includes("/api/");
}

const originalFetch = window.fetch;

function interceptedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    return originalFetch(input, init).then((res) => {
        if (res.status === 401 && isApiUrl(input)) {
            handleAuthFailure(typeof input === "string" ? input : String(input));
        }
        return res;
    });
}

export function installFetchInterceptor(): void {
    if (intercepting) return;
    intercepting = true;
    window.fetch = interceptedFetch;
}