/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Project status is no longer a manually-set field. It's derived:
 *   - "Done"    → the project has at least one task, and every non-deleted task is "Done"
 *   - "Ongoing" → anything else (no tasks yet, some tasks incomplete, or no dates set)
 */
import { Task } from "../types/index.js";

export type DerivedProjectStatus = "Ongoing" | "Done";

export function deriveProjectStatus(tasks: Task[]): DerivedProjectStatus {
    const active = tasks.filter((t) => !t.deleted);
    if (active.length === 0) return "Ongoing";
    return active.every((t) => t.status === "Done") ? "Done" : "Ongoing";
}