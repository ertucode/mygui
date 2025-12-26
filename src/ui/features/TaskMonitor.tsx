import { useSelector } from "@xstate/store/react";
import { taskStore } from "./taskStore";
import { TaskDefinition } from "@common/Tasks";
import {
  ChevronDown,
  Loader2Icon,
  CheckCircle2,
  XCircle,
  Archive,
  FolderArchive,
  FileIcon,
  FolderIcon,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { clsx } from "@/lib/functions/clsx";
import { errorResponseToMessage } from "@common/GenericError";
import { PathHelpers } from "@common/PathHelpers";
import { directoryHelpers } from "./file-browser/directoryStore/directory";

function getTaskTypeLabel(task: TaskDefinition): string {
  switch (task.type) {
    case "archive":
      return `Creating ${task.metadata.type} archive`;
    case "unarchive":
      return `Extracting ${task.metadata.type} archive`;
    default:
      return "Processing task";
  }
}

function getTaskIcon(task: TaskDefinition) {
  switch (task.type) {
    case "archive":
      return Archive;
    case "unarchive":
      return FolderArchive;
    default:
      return FileIcon;
  }
}

function getTaskStatus(task: TaskDefinition): "running" | "success" | "error" {
  if (task.result) {
    return task.result.success ? "success" : "error";
  }
  return "running";
}

function formatPath(filePath: string, maxLength = 35): string {
  if (filePath.length <= maxLength) return filePath;

  const filename = PathHelpers.getLastPathPart(filePath);
  const parentInfo = PathHelpers.getParentFolder(filePath);

  if (filename.length > maxLength - 3) {
    return "..." + filename.slice(-(maxLength - 3));
  }

  const remainingLength = maxLength - filename.length - 4; // 4 for "/..."
  if (remainingLength <= 0) {
    return ".../" + filename;
  }

  if (parentInfo.path.length <= remainingLength) {
    return parentInfo.path + "/" + filename;
  }

  return ".../" + filename;
}

function TaskMetadata({ task }: { task: TaskDefinition }) {
  const handleNavigateToPath = (fullPath: string) => {
    const parentPath = PathHelpers.getParentFolder(fullPath).path;
    directoryHelpers.cdFull(parentPath, undefined);
  };

  if (task.type === "archive") {
    const sourceCount = task.metadata.source.length;
    const destination = task.metadata.destination;

    return (
      <div className="mt-2 space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-base-content/70">
          <FileIcon className="h-3 w-3 flex-shrink-0" />
          <span className="font-medium">Source:</span>
          <div className="dropdown dropdown-hover">
            <div
              tabIndex={0}
              className="truncate cursor-pointer hover:text-primary transition-colors"
            >
              {sourceCount === 1
                ? formatPath(task.metadata.source[0])
                : `${sourceCount} items`}
            </div>
            <div
              tabIndex={0}
              className="dropdown-content z-[1] p-2 shadow bg-base-100 rounded-box border border-base-300 max-w-md"
            >
              <div className="space-y-1">
                {task.metadata.source.map((sourcePath, index) => (
                  <div
                    key={index}
                    className="text-xs cursor-pointer hover:text-primary transition-colors p-1 hover:bg-base-200 rounded"
                    onClick={() => handleNavigateToPath(sourcePath)}
                  >
                    {sourcePath}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-base-content/70">
          <Archive className="h-3 w-3 flex-shrink-0" />
          <span className="font-medium">Output:</span>
          <span className="truncate" title={destination}>
            {formatPath(destination)}
          </span>
        </div>
      </div>
    );
  }

  if (task.type === "unarchive") {
    const source = task.metadata.source;
    const destination = task.metadata.destination;

    return (
      <div className="mt-2 space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-base-content/70">
          <Archive className="h-3 w-3 flex-shrink-0" />
          <span className="font-medium">Archive:</span>
          <div className="dropdown dropdown-hover">
            <div
              tabIndex={0}
              className="truncate cursor-pointer hover:text-primary transition-colors"
            >
              {formatPath(source)}
            </div>
            <div
              tabIndex={0}
              className="dropdown-content z-[1] p-2 shadow bg-base-100 rounded-box border border-base-300 max-w-md"
            >
              <div
                className="text-xs cursor-pointer hover:text-primary transition-colors p-1 hover:bg-base-200 rounded"
                onClick={() => handleNavigateToPath(source)}
              >
                {source}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-base-content/70">
          <FolderIcon className="h-3 w-3 flex-shrink-0" />
          <span className="font-medium">Extract to:</span>
          <span className="truncate" title={destination}>
            {formatPath(destination)}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

function TaskItem({
  task,
  onDismiss,
}: {
  task: TaskDefinition;
  onDismiss: () => void;
}) {
  const status = getTaskStatus(task);
  const Icon = getTaskIcon(task);
  const label = getTaskTypeLabel(task);

  // Auto-dismiss successful tasks after 5 seconds
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        onDismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, onDismiss]);

  return (
    <div className="p-3 bg-base-200 rounded-lg border border-base-300 hover:border-primary/30 transition-colors group">
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 mt-0.5">
          <div
            className={clsx(
              "p-1.5 rounded-md",
              status === "running" && "bg-primary/10",
              status === "success" && "bg-success/10",
              status === "error" && "bg-error/10",
            )}
          >
            <Icon
              className={clsx(
                "h-4 w-4",
                status === "running" && "text-primary",
                status === "success" && "text-success",
                status === "error" && "text-error",
              )}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 justify-between">
            <div className="font-medium text-sm text-base-content">{label}</div>
            <div className="flex items-center gap-1.5">
              <div className="flex-shrink-0">
                {status === "running" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-primary">
                      {Math.round(task.progress)}%
                    </span>
                    <Loader2Icon className="h-4 w-4 text-primary animate-spin" />
                  </div>
                )}
                {status === "success" && (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                )}
                {status === "error" && (
                  <XCircle className="h-4 w-4 text-error" />
                )}
              </div>
              {status !== "running" && (
                <button
                  onClick={onDismiss}
                  className="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <TaskMetadata task={task} />

          {status === "running" && (
            <div className="w-full bg-base-300 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary to-primary/70 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          )}

          {status === "error" && task.result && !task.result.success && (
            <div className="mt-2 p-2 bg-error/10 border border-error/20 rounded text-xs text-error">
              {errorResponseToMessage(task.result.error)}
            </div>
          )}

          {status === "success" && (
            <div className="mt-2 text-xs text-success font-medium">
              Completed successfully
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TaskMonitor() {
  const tasks = useSelector(taskStore, (state) => state.context.tasks);
  const [isMinimized, setIsMinimized] = useState(false);

  const taskArray = Object.values(tasks);
  const hasTasks = taskArray.length > 0;

  const handleDismiss = (taskId: string) => {
    taskStore.send({ type: "removeTask", id: taskId });
  };

  if (!hasTasks) {
    return null;
  }

  const runningTasks = taskArray.filter((t) => getTaskStatus(t) === "running");
  const completedTasks = taskArray.filter(
    (t) => getTaskStatus(t) !== "running",
  );

  return (
    <div
      className={clsx("fixed bottom-4 right-4 z-50", !isMinimized && "w-80")}
    >
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="btn btn-primary btn-circle shadow-lg"
          title="Show tasks"
        >
          <div className="relative">
            <Loader2Icon
              className={clsx(
                "h-5 w-5",
                runningTasks.length > 0 && "animate-spin",
              )}
            />
            {taskArray.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-error text-error-content text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {taskArray.length}
              </div>
            )}
          </div>
        </button>
      ) : (
        <div className="bg-base-100 border border-base-300 rounded-lg shadow-xl overflow-hidden">
          <div className="flex items-center justify-between p-3 bg-base-200 border-b border-base-300">
            <div className="flex items-center gap-2">
              <Loader2Icon
                className={clsx(
                  "h-4 w-4",
                  runningTasks.length > 0 && "animate-spin text-primary",
                )}
              />
              <h3 className="text-sm font-semibold text-base-content">
                Tasks ({taskArray.length})
              </h3>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="btn btn-ghost btn-xs btn-circle"
              title="Minimize"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3 max-h-96 overflow-y-auto space-y-2">
            {runningTasks.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-base-content/70 uppercase">
                  Running ({runningTasks.length})
                </div>
                {runningTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onDismiss={() => handleDismiss(task.id)}
                  />
                ))}
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-base-content/70 uppercase">
                  Completed ({completedTasks.length})
                </div>
                {completedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onDismiss={() => handleDismiss(task.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
