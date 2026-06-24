/**
 * Used in: TasksListView, DashboardView
 */
export const TASK_STATUS_STYLES: Record<string, string> = {
    "To Do": "bg-[#F4F4F4] text-[#737373]",
    "In Progress": "bg-[#e8edfb] text-[#0038BC]",
    Review: "bg-[#fef3dc] text-[#9a5b00]",
    Done: "bg-green-50 text-green-700",
};

/**
 * Used in: KanbanCard, TasksListView
 */
export const PRIORITY_STYLES: Record<string, string> = {
    Low: "bg-[#F4F4F4] text-[#737373]",
    Medium: "bg-[#fef3dc] text-[#9a5b00]",
    High: "bg-orange-50 text-orange-700",
    Critical: "bg-red-50 text-red-700",
};

/**
 * Used in: KanbanCard
 */
export const CATEGORY_STYLES: Record<string, string> = {
    Development: "bg-emerald-50 text-emerald-700",
    Design: "bg-purple-50 text-purple-700",
    QA: "bg-cyan-50 text-cyan-700",
    Management: "bg-indigo-50 text-indigo-700",
    Billing: "bg-amber-50 text-amber-700",
    Others: "bg-[#F4F4F4] text-[#737373]",
};