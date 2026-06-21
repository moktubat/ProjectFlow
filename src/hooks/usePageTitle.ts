/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";

const BASE = "ProjectFlow";

export function usePageTitle(title?: string, description?: string) {
    useEffect(() => {
        const newTitle = title ? `${title} — ${BASE}` : BASE;
        const prevTitle = document.title;
        document.title = newTitle;

        let prevDesc = "";
        let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');

        if (description) {
            if (!metaDesc) {
                metaDesc = document.createElement("meta");
                metaDesc.name = "description";
                document.head.appendChild(metaDesc);
            }

            prevDesc = metaDesc.getAttribute("content") ?? "";
            metaDesc.setAttribute("content", description);
        }

        return () => {
            if (document.title === newTitle) {
                document.title = prevTitle;
            }

            if (description && metaDesc && metaDesc.getAttribute("content") === description) {
                if (prevDesc) {
                    metaDesc.setAttribute("content", prevDesc);
                } else {
                    metaDesc.removeAttribute("content");
                }
            }
        };
    }, [title, description]);
}