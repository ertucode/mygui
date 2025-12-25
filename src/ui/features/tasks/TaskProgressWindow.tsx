import { tasksStore, taskActions } from "./tasksStore";
import { XIcon, Loader2Icon, CheckCircle2Icon, AlertCircleIcon } from "lucide-react";
import { Task } from "@common/task-types";
import { useState, useEffect } from "react";

export function TaskProgressWindow() {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);

  useEffect(() => {
    // Initial load
    const updateActiveTasks = () => {
      const snapshot = tasksStore.getSnapshot();
      const tasks = Array.from(snapshot.context.tasks.values()).filter(
        (task) => task.status === "running" || task.status === "pending"
      );
      setActiveTasks(tasks);
    };

    updateActiveTasks();

    // Subscribe to changes
    const subscription = tasksStore.subscribe(() => {
      updateActiveTasks();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (activeTasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {activeTasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const handleCancel = () => {
    taskActions.cancelTask(task.id);
  };

  const getTaskTitle = () => {
    switch (task.type) {
      case "archive-extract":
        return "Extracting Archive";
      case "archive-create":
        return "Creating Archive";
      case "archive-read":
        return "Reading Archive";
      default:
        return "Processing";
    }
  };

  const getTaskIcon = () => {
    switch (task.status) {
      case "completed":
        return <CheckCircle2Icon className="size-4 text-success" />;
      case "error":
        return <AlertCircleIcon className="size-4 text-error" />;
      case "running":
        return <Loader2Icon className="size-4 animate-spin text-primary" />;
      default:
        return <Loader2Icon className="size-4 text-base-content/50" />;
    }
  };

  return (
    <div className="card bg-base-200 shadow-xl border border-base-300 w-full">
      <div className="card-body p-4 gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getTaskIcon()}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{getTaskTitle()}</h3>
              <p className="text-xs text-base-content/70 truncate">{task.message}</p>
            </div>
          </div>
          {task.status === "running" && (
            <button
              onClick={handleCancel}
              className="btn btn-ghost btn-xs btn-circle"
              title="Cancel"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>

        {task.status === "running" && (
          <div className="w-full">
            <div className="flex justify-between text-xs text-base-content/60 mb-1">
              <span>Progress</span>
              <span>{task.progress}%</span>
            </div>
            <progress
              className="progress progress-primary w-full"
              value={task.progress}
              max="100"
            />
          </div>
        )}

        {task.status === "error" && task.error && (
          <div className="alert alert-error py-2 px-3">
            <span className="text-xs">{task.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
