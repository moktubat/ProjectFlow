/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";

const BASE = "ProjectFlow";

/**
 * Sets the document <title> and updates a <meta name="description"> tag.
 * Falls back gracefully if the meta tag doesn't exist yet.
 */
export function usePageTitle(title?: string, description?: string) {
    useEffect(() => {
        const prev = document.title;
        document.title = title ? `${title} — ${BASE}` : BASE;

        let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        const prevDesc = metaDesc?.getAttribute("content") ?? "";
        if (metaDesc && description) {
            metaDesc.setAttribute("content", description);
        }

        return () => {
            document.title = prev;
            if (metaDesc && description) {
                metaDesc.setAttribute("content", prevDesc);
            }
        };
    }, [title, description]);
}