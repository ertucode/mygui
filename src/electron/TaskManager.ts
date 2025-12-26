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
    publisher.notifyListeners({ type: "create", task: t });
    return id;
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
