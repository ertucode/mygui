import { getWindowElectron, homeDirectory } from "@/getWindowElectron";
import { taskStore } from "./taskStore";
import { directoryHelpers } from "./file-browser/directoryStore/directoryHelpers";
import { PathHelpers } from "@common/PathHelpers";

export function subscribeToTasks() {
  getWindowElectron().onTaskEvent((event) => {
    if (event.type === "result") {
      const tasks = taskStore.getSnapshot().context.tasks;
      const task = tasks[event.id];
      if (!task) return;

      if (task.type === "archive" || task.type === "unarchive") {
        const destination = task.metadata.destination;
        const start = new Date(task.createdIso);
        const elapsed = new Date().getTime() - start.getTime();
        const fileToSelect =
          elapsed < 1000 ? PathHelpers.getLastPathPart(destination) : undefined;
        return directoryHelpers.checkAndReloadDirectories(
          PathHelpers.getParentFolder(
            PathHelpers.expandHome(homeDirectory, destination),
          ).path,
          fileToSelect,
        );
      }
    }
  });
}
