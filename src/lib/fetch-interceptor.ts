/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Global fetch interceptor — ensures 401 on any /api/ call
 * triggers a client-side logout. 403 is intentionally passed
 * through so the UI can show "access denied" for valid sessions.
 *
 * Applied once at app startup via side-effect import.
 */

import { useUIStore } from "../store/ui-store.js";

// ─── Guard against double-init and logout storms ──────────────────────────────

let intercepting = false;
let loggingOut = false;

// ─── Core logout logic (idempotent) ───────────────────────────────────────────

function handleAuthFailure(status: number, url: string): void {
    if (loggingOut) return;
    loggingOut = true;

    console.warn(
        `[fetch-interceptor] ${status} on ${url} — triggering logout`
    );

    // Fire-and-forget: don't block the response return
    try {
        useUIStore.getState().logout();
    } catch {
        // Store may not be hydrated yet in edge cases during init
    }

    // Reset guard after a cooldown so a re-login can work
    setTimeout(() => {
        loggingOut = false;
    }, 2000);
}

// ─── Should this URL be intercepted? ──────────────────────────────────────────

function isApiUrl(input: RequestInfo | URL): boolean {
    const url = typeof input === "string"
        ? input
        : input instanceof URL
            ? input.href
            : input.url;

    // Only intercept calls to our own API — skip CDN, analytics, etc.
    return url.startsWith("/api/") || url.includes("/api/");
}

// ─── The interceptor ──────────────────────────────────────────────────────────

function interceptedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    // Pass through non-API calls untouched
    if (!isApiUrl(input)) {
        return originalFetch(input, init);
    }

    return originalFetch(input, init).then((res) => {
        // 401 = Expired/invalid token -> force logout
        if (res.status === 401) {
            handleAuthFailure(res.status, typeof input === "string" ? input : String(input));
        }

        return res;
    });
}

// ─── Stash original & install ─────────────────────────────────────────────────

const originalFetch = window.fetch;

export function installFetchInterceptor(): void {
    if (intercepting) return;
    intercepting = true;
    window.fetch = interceptedFetch;
}


export async function authFetch(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    return fetch(url, options);
}