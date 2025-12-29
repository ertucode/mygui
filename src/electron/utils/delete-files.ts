import fs from "fs/promises";
import { expandHome } from "./expand-home.js";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";
import { TaskManager } from "../TaskManager.js";

export async function deleteFiles(
  filePaths: string[],
): Promise<GenericResult<void>> {
  const taskId = TaskManager.create({
    type: "delete",
    metadata: { files: filePaths },
    progress: 0,
  });
  try {
    let totalDeleted = 0;
    // Delete all files/directories
    await Promise.all(
      filePaths.map(async (filePath) => {
        const fullPath = expandHome(filePath);

        // Check if it's a file or directory
        const stats = await fs.stat(fullPath);

        if (stats.isDirectory()) {
          // Delete directory recursively
          await fs.rm(fullPath, { recursive: true, force: true });
        } else {
          // Delete file
          await fs.unlink(fullPath);
        }
        totalDeleted++;
        TaskManager.progress(taskId, (totalDeleted / filePaths.length) * 100);
      }),
    );

    const result = Result.Success(undefined);
    TaskManager.result(taskId, result);
    return result;
  } catch (error) {
    const result =
      error instanceof Error
        ? GenericError.Message(error.message)
        : GenericError.Unknown(error);
    TaskManager.result(taskId, result);
    return result;
  }
}
