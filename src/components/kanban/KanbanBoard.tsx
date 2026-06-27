import { Task, User } from "../../types/index.js";
import { KanbanColumn } from "./KanbanColumn.js";
import { KanbanCard } from "./KanbanCard.js";
import { useDragDropBoard, BOARD_STATUSES } from "../../hooks/useDragDropBoard.js";
import { BoardWrapper } from "../board/BoardWrapper.js";

interface KanbanBoardProps {
  tasks: Task[];
  users: User[];
  onTaskUpdated: (taskId?: string, newStatus?: string) => void;
}

export function KanbanBoard({ tasks, users, onTaskUpdated }: KanbanBoardProps) {
  const board = useDragDropBoard(tasks, onTaskUpdated);

  return (
    <BoardWrapper
      {...board}
      users={users}
      renderOverlay={(task, u) => (
        <div className="rotate-2 opacity-95 shadow-2xl">
          <KanbanCard task={task} users={u} isDragOverlay />
        </div>
      )}
    >
      <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto pb-2">
        {BOARD_STATUSES.map((col) => (
          <KanbanColumn
            key={col}
            status={col}
            tasks={board.localTasks.filter((t) => t.status === col && !t.deleted)}
            users={users}
            isAnyDragging={!!board.activeTask}
          />
        ))}
      </div>
    </BoardWrapper>
  );
}