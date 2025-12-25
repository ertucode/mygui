import { format } from "path";
import { GenericResult } from "../../../common/GenericError.js";
import { taskManager } from "../task-manager.js";

export function extractZip(
  archivePath: string,
  destinationFolder: string,
): Promise<GenericResult<{ path: string; taskId: string }>> {
  const taskId = taskManager.createTask("archive-extract", {
    type: "archive-extract",
    archivePath,
    destinationFolder,
    archiveFormat: "zip",
  });
}
