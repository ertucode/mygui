import { createStore } from "@xstate/store";
import { Task, TaskUpdate } from "@common/task-types";
import { getWindowElectron } from "@/getWindowElectron";

type TasksStoreContext = {
  tasks: Map<string, Task>;
};

const initialContext: TasksStoreContext = {
  tasks: new Map(),
};

export const tasksStore = createStore({
  context: initialContext,
  on: {
    addTask: (context, event: { task: Task }) => {
      const newTasks = new Map(context.tasks);
      newTasks.set(event.task.id, event.task);
      return { tasks: newTasks };
    },
    updateTask: (context, event: TaskUpdate) => {
      const task = context.tasks.get(event.id);
      
      // If task doesn't exist, create it with the update data
      if (!task) {
        const newTask: Task = {
          id: event.id,
          type: "archive-extract", // Default, will be updated
          status: event.status || "pending",
          progress: event.progress ?? 0,
          message: event.message || "Starting...",
          error: event.error,
          metadata: { type: "archive-extract", archivePath: "", destinationFolder: "", archiveFormat: "" },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const newTasks = new Map(context.tasks);
        newTasks.set(event.id, newTask);
        return { tasks: newTasks };
      }

      const updatedTask: Task = {
        ...task,
        ...(event.status && { status: event.status }),
        ...(event.progress !== undefined && { progress: event.progress }),
        ...(event.message && { message: event.message }),
        ...(event.error && { error: event.error }),
        updatedAt: Date.now(),
      };

      const newTasks = new Map(context.tasks);
      newTasks.set(event.id, updatedTask);
      return { tasks: newTasks };
    },
    removeTask: (_context, event: { id: string }) => {
      const newTasks = new Map(_context.tasks);
      newTasks.delete(event.id);
      return { tasks: newTasks };
    },
    setTasks: (_context, event: { tasks: Task[] }) => {
      const newTasks = new Map<string, Task>();
      event.tasks.forEach((task) => newTasks.set(task.id, task));
      return { tasks: newTasks };
    },
  },
});

let initialized = false;
let unsubscribe: (() => void) | null = null;

// Initialize store with existing tasks and subscribe to updates
export async function initializeTasksStore() {
  if (initialized) return;
  initialized = true;

  // Load existing tasks
  const tasks = await getWindowElectron().getTasks();
  tasksStore.send({ type: "setTasks", tasks });

  // Subscribe to task updates
  unsubscribe = getWindowElectron().onTaskUpdate((update) => {
    tasksStore.send({ type: "updateTask", ...update });
  });
}

// Cleanup function
export function cleanupTasksStore() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  initialized = false;
}

// Selectors - return primitive values or stable references
export const selectActiveTaskIds = (state: ReturnType<typeof tasksStore.get>) =>
  Array.from(state.context.tasks.values())
    .filter((task) => task.status === "running" || task.status === "pending")
    .map(task => task.id)
    .join(','); // Return a string for stable comparison

export const selectAllTaskIds = (state: ReturnType<typeof tasksStore.get>) =>
  Array.from(state.context.tasks.keys()).join(',');

// Helper to get actual tasks
export const getActiveTasks = () => 
  Array.from(tasksStore.getSnapshot().context.tasks.values()).filter(
    (task) => task.status === "running" || task.status === "pending",
  );

export const getAllTasks = () =>
  Array.from(tasksStore.getSnapshot().context.tasks.values());

// Actions
export const taskActions = {
  cancelTask: async (taskId: string) => {
    await getWindowElectron().cancelTask(taskId);
  },
};
