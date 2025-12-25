import { extractArchive, createArchive, readArchiveContents } from "./archive-handler.js";
import { taskManager } from "./task-manager.js";
import { ArchiveFormat, getArchiveFormat } from "../../common/archive-types.js";
import { GenericResult } from "../../common/GenericError.js";
import path from "path";

/**
 * Extract archive with progress tracking
 */
export async function extractArchiveWithProgress(
  archivePath: string,
  destinationFolder: string,
): Promise<GenericResult<{ path: string; taskId: string }>> {
  const format = getArchiveFormat(path.basename(archivePath));
  
  const taskId = taskManager.createTask("archive-extract", {
    type: "archive-extract",
    archivePath,
    destinationFolder,
    archiveFormat: format || "unknown",
  });

  try {
    taskManager.updateTask(taskId, {
      status: "running",
      progress: 10,
      message: "Extracting files...",
    });

    const result = await extractArchive(archivePath, destinationFolder);

    taskManager.updateTask(taskId, {
      progress: 95,
      message: "Finalizing...",
    });

    if (result.success) {
      taskManager.updateTask(taskId, {
        status: "completed",
        progress: 100,
        message: "Extraction completed",
      });
      return { ...result, data: { ...result.data!, taskId } };
    } else {
      const errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
      taskManager.updateTask(taskId, {
        status: "error",
        progress: 0,
        error: errorMsg,
      });
      return result as any;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    taskManager.updateTask(taskId, {
      status: "error",
      progress: 0,
      error: errorMessage,
    });
    throw error;
  }
}

/**
 * Create archive with progress tracking
 */
export async function createArchiveWithProgress(
  filePaths: string[],
  destinationArchivePath: string,
  format: ArchiveFormat = "zip",
): Promise<GenericResult<{ path: string; taskId: string }>> {
  const taskId = taskManager.createTask("archive-create", {
    type: "archive-create",
    filePaths,
    destinationPath: destinationArchivePath,
    archiveFormat: format,
  });

  try {
    taskManager.updateTask(taskId, {
      status: "running",
      progress: 10,
      message: "Compressing files...",
    });

    const result = await createArchive(filePaths, destinationArchivePath, format);

    taskManager.updateTask(taskId, {
      progress: 95,
      message: "Finalizing...",
    });

    if (result.success) {
      taskManager.updateTask(taskId, {
        status: "completed",
        progress: 100,
        message: "Archive created successfully",
      });
      return { ...result, data: { ...result.data!, taskId } };
    } else {
      const errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
      taskManager.updateTask(taskId, {
        status: "error",
        progress: 0,
        error: errorMsg,
      });
      return result as any;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    taskManager.updateTask(taskId, {
      status: "error",
      progress: 0,
      error: errorMessage,
    });
    throw error;
  }
}

/**
 * Read archive contents with progress tracking
 */
export async function readArchiveContentsWithProgress(
  archivePath: string,
): Promise<GenericResult<any>> {
  const format = getArchiveFormat(path.basename(archivePath));
  
  const taskId = taskManager.createTask("archive-read", {
    type: "archive-read",
    archivePath,
  });

  try {
    taskManager.updateTask(taskId, {
      status: "running",
      progress: 50,
      message: "Reading archive contents...",
    });

    const result = await readArchiveContents(archivePath);

    taskManager.updateTask(taskId, {
      status: "completed",
      progress: 100,
      message: "Completed",
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    taskManager.updateTask(taskId, {
      status: "error",
      progress: 0,
      error: errorMessage,
    });
    throw error;
  }
}
