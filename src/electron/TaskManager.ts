import { ExternalStore } from "../common/external-store.js";
import {
  TaskDefinition,
  TaskDefinitionWithoutId,
  TaskEvents,
} from "../common/Tasks.js";

export namespace TaskManager {
  const tasks: Record<
    string,
    TaskDefinition & { abortController: AbortController }
  > = {};

  export const publisher = new ExternalStore<TaskEvents>();

  export function create(task: TaskDefinitionWithoutId): string {
    const id = Math.random().toString(36).slice(2);
    const t = {
      ...task,
      id,
      abortController: new AbortController(),
    } as TaskDefinition & { abortController: AbortController };
    tasks[id] = t;
    
    // Strip out non-serializable parts before sending
    const serializableTask = stripNonSerializable(t);
    publisher.notifyListeners({ type: "create", task: serializableTask });
    return id;
  }
  
  function stripNonSerializable(task: TaskDefinition & { abortController?: AbortController }): TaskDefinition {
    const { abortController, ...taskWithoutController } = task;
    
    // Create a deep copy and remove non-serializable fields from metadata
    if (taskWithoutController.type === "archive" || taskWithoutController.type === "unarchive") {
      const { progressCallback, abortSignal, ...serializableMetadata } = taskWithoutController.metadata;
      return {
        ...taskWithoutController,
        metadata: serializableMetadata as any,
      };
    }
    
    return taskWithoutController as TaskDefinition;
  }

  export function getAbortSignal(id: string): AbortSignal | undefined {
    const task = tasks[id];
    return task?.abortController.signal;
  }

  export function progress(id: string, progress: number) {
    const task = tasks[id];
    if (!task) return;
    publisher.notifyListeners({ type: "progress", id, progress });
  }

  export function result(
    id: string,
    result: TaskDefinition["result"],
  ) {
    const task = tasks[id];
    if (!task) return;
    delete tasks[id];
    publisher.notifyListeners({
      type: "result",
      id,
      result: result!,
    });
  }

  export function abort(id: string) {
    const task = tasks[id];
    if (!task) return;
    task.abortController.abort();
    delete tasks[id];
    publisher.notifyListeners({ type: "abort", id });
  }

  export function addListener(listener: (event: TaskEvents) => void) {
    publisher.addListener(listener);
  }

  export function removeListener(listener: (event: TaskEvents) => void) {
    publisher.removeListener(listener);
  }
}
