import { Task } from "../types/index.js";

export type DerivedProjectStatus = "Ongoing" | "Done";

export function deriveProjectStatus(tasks: Task[]): DerivedProjectStatus {
    const active = tasks.filter((t) => !t.deleted);
    if (active.length === 0) return "Ongoing";
    return active.every((t) => t.status === "Done") ? "Done" : "Ongoing";
}