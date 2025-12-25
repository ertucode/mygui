import { ExternalStore } from "../common/external-store.js";
import {
  TaskDefinition,
  TaskDefinitionWithoutId,
  TaskEvents,
} from "../common/Tasks.js";

export namespace TaskManager {
  const tasks: Record<string, TaskDefinition> = {};

  export const publisher = new ExternalStore<TaskEvents>();

  export function create(task: TaskDefinitionWithoutId) {
    const id = Math.random().toString(36).slice(2);
    const t = { ...task, id };
    tasks[id] = t;
    publisher.notifyListeners({ type: "create", task: t });
  }

  export function progress(id: string, progress: number) {
    const task = tasks[id];
    if (!task) return;
    publisher.notifyListeners({ type: "progress", id, progress });
  }

  export function result(id: string, result: TaskDefinition["result"]) {
    const task = tasks[id];
    if (!task) return;
    delete tasks[id];
    publisher.notifyListeners({ type: "result", id, result });
  }

  export function addListener(listener: (event: TaskEvents) => void) {
    publisher.addListener(listener);
  }

  export function removeListener(listener: (event: TaskEvents) => void) {
    publisher.removeListener(listener);
  }
}
