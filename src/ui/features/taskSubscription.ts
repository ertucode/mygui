import { getWindowElectron } from "@/getWindowElectron";
import { taskStore } from "./taskStore";
import { directoryStore } from "./file-browser/directoryStore/directory";
import { directoryHelpers } from "./file-browser/directoryStore/directoryHelpers";
import { PathHelpers } from "@common/PathHelpers";

const home = getWindowElectron().homeDirectory;

export function subscribeToTasks() {
  getWindowElectron().onTaskEvent((event) => {
    if (event.type === "result") {
      const tasks = taskStore.getSnapshot().context.tasks;
      const task = tasks[event.id];
      if (!task) return;

      if (task.type === "archive" || task.type === "unarchive") {
        const destination = task.metadata.destination;
        return checkAndReloadDirectories(
          PathHelpers.getParentFolder(
            PathHelpers.expandHome(
              getWindowElectron().homeDirectory,
              destination,
            ),
          ).path,
        );
      }
    }
  });

  function checkAndReloadDirectories(path: string) {
    const directories = directoryStore.getSnapshot().context.directoriesById;

    for (const dir of Object.values(directories)) {
      if (dir.directory.type === "tags") continue;

      if (PathHelpers.expandHome(home, dir.directory.fullPath) === path) {
        // TODO: set selection?, set selection if time is really low amount?
        directoryHelpers.reload(dir.directoryId);
        return;
      }
    }
  }
}
