import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (page > 3) pages.push("...");
            for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
                pages.push(i);
            }
            if (page < totalPages - 2) pages.push("...");
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <div className="flex items-center justify-center gap-1.5 mt-5">
            <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg border border-[#E8E8E8] text-[#737373] hover:bg-[#F4F4F4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>

            {getPageNumbers().map((p, idx) =>
                p === "..." ? (
                    <span key={`dots-${idx}`} className="px-2 text-[#A0A0A0] text-sm">…</span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onPageChange(p as number)}
                        className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${page === p
                                ? "bg-[#0038BC] text-white shadow-sm"
                                : "border border-[#E8E8E8] text-[#525252] hover:bg-[#F4F4F4]"
                            }`}
                    >
                        {p}
                    </button>
                )
            )}

            <button
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-[#E8E8E8] text-[#737373] hover:bg-[#F4F4F4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}