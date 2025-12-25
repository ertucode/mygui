import { BrowserWindow } from "electron";
import { Task, TaskType, TaskMetadata, TaskUpdate } from "../../common/task-types.js";
import { randomUUID } from "crypto";

class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private windows: Set<BrowserWindow> = new Set();

  registerWindow(window: BrowserWindow) {
    this.windows.add(window);
    window.on("closed", () => {
      this.windows.delete(window);
    });
  }

  createTask(type: TaskType, metadata: TaskMetadata): string {
    const id = randomUUID();
    const task: Task = {
      id,
      type,
      status: "pending",
      progress: 0,
      message: "Starting...",
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.tasks.set(id, task);
    this.broadcastUpdate({ id, status: "pending", progress: 0, message: "Starting..." });
    return id;
  }

  updateTask(id: string, update: Partial<TaskUpdate>) {
    const task = this.tasks.get(id);
    if (!task) return;

    if (update.status) task.status = update.status;
    if (update.progress !== undefined) task.progress = update.progress;
    if (update.message) task.message = update.message;
    if (update.error) task.error = update.error;
    task.updatedAt = Date.now();

    this.tasks.set(id, task);
    this.broadcastUpdate({ id, ...update });

    // Auto-cleanup completed/error/cancelled tasks after 30 seconds
    if (["completed", "error", "cancelled"].includes(task.status)) {
      setTimeout(() => {
        this.tasks.delete(id);
        this.broadcastUpdate({ id, status: "completed" });
      }, 30000);
    }
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  cancelTask(id: string) {
    const task = this.tasks.get(id);
    if (task && task.status === "running") {
      this.updateTask(id, {
        status: "cancelled",
        message: "Cancelled by user",
      });
    }
  }

  private broadcastUpdate(update: TaskUpdate) {
    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send("taskUpdate", update);
      }
    });
  }
}

export const taskManager = new TaskManager();
