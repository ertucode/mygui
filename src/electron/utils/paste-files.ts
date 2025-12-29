import fs from "fs/promises";
import path from "path";
import { expandHome } from "./expand-home.js";
import { getClipboardState, clearClipboardState } from "./copy-files.js";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";
import { TaskManager } from "../TaskManager.js";
import { formatFileSize } from "../../common/file-size.js";
import { moveToTrash } from "./move-to-trash.js";

/**
 * Paste file operations with conflict resolution and cancellation support
 *
 * CANCELLATION BEHAVIOR:
 * - Checks abort signal before each file operation
 * - Returns partial success if some files were pasted before cancellation
 * - For cut operations: clipboard is NOT cleared on cancellation (allows retry)
 * - For cut operations: clipboard IS cleared only when ALL files successfully paste
 *
 * EDGE CASES & LIMITATIONS:
 * 1. Large file copy: If cancelled mid-copy, partial file may remain on disk
 * 2. Folder merge: If cancelled during merge, some files copied, some not
 * 3. Trash then cancel: File moved to trash but replacement not pasted
 * 4. Cut then cancel: Already-moved files are in destination, rest remain in source
 *
 * These limitations are acceptable because:
 * - Cancellation happens between files, not during individual file ops
 * - Partial files can be manually deleted
 * - Clipboard preserved for cut operations allows user to retry
 * - Files in trash can be restored manually
 */

// Types
export type PasteConflictInfo = {
  sourcePath: string;
  destinationPath: string;
  suggestedName: string;
  type: "file" | "dir";
  sourceSize: number;
  destSize: number;
  sourceSizeStr: string;
  destSizeStr: string;
};

export type PasteConflictData = {
  conflicts: PasteConflictInfo[];
  exceedsLimit: boolean;
  totalConflicts: number;
};

export type ConflictResolution = {
  globalStrategy: "override" | "trash" | "autoName" | "skip";
  perFileOverrides?: {
    [destinationPath: string]: {
      action: "override" | "trash" | "customName" | "skip";
      customName?: string;
    };
  };
};

export type PasteResult =
  | { needsResolution: true; conflictData: PasteConflictData }
  | {
      needsResolution: false;
      result: GenericResult<{ pastedItems: string[] }>;
    };

async function countFilesInPaths(
  filePaths: string[],
  maxDepth: number = Infinity,
) {
  let totalFiles = 0;
  let isEstimated = false;

  async function countRecursive(currentPath: string, depth: number) {
    try {
      const stats = await fs.stat(currentPath);

      if (stats.isDirectory()) {
        // Stop recursing if we've reached max depth
        if (depth >= maxDepth) {
          // Count this directory as 1 item instead of recursing
          totalFiles++;
          isEstimated = true;
          return;
        }

        const entries = await fs.readdir(currentPath);
        for (const entry of entries) {
          await countRecursive(path.join(currentPath, entry), depth + 1);
        }
      } else {
        totalFiles++;
      }
    } catch (error) {
      // Ignore errors (permission denied, etc.)
    }
  }

  for (const filePath of filePaths) {
    await countRecursive(filePath, 0);
  }

  return {
    totalFiles,
    isEstimated,
  };
}

async function copyRecursive(
  src: string,
  dest: string,
  onFileCopied?: () => void,
) {
  const stats = await fs.stat(src);

  if (stats.isDirectory()) {
    // Create directory
    await fs.mkdir(dest, { recursive: true });

    // Copy all contents
    const entries = await fs.readdir(src);
    for (const entry of entries) {
      await copyRecursive(
        path.join(src, entry),
        path.join(dest, entry),
        onFileCopied,
      );
    }
  } else {
    // Copy file
    await fs.copyFile(src, dest);
    // Notify that a file was copied
    onFileCopied?.();
  }
}

async function generateUniqueName(
  destinationDir: string,
  fileName: string,
): Promise<string> {
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);
  let counter = 1;
  let newName = fileName;

  while (true) {
    const testPath = path.join(destinationDir, newName);
    try {
      await fs.access(testPath);
      // File exists, try next name
      newName = `${baseName} (${counter})${ext}`;
      counter++;
    } catch {
      // File doesn't exist, we can use this name
      return newName;
    }
  }
}

function validateCustomName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Name cannot be empty" };
  }

  const invalidChars = /[\/\\:*?"<>|]/;
  if (invalidChars.test(name)) {
    return {
      valid: false,
      error: 'Name contains invalid characters: / \\ : * ? " < > |',
    };
  }

  return { valid: true };
}

async function findConflictsRecursive(
  sourcePath: string,
  destDir: string,
  relativePath: string,
  conflicts: PasteConflictInfo[],
  limit: number,
  totalCount: { value: number },
): Promise<void> {
  const destPath = path.join(destDir, relativePath);

  try {
    const sourceStats = await fs.stat(sourcePath);

    // Check if destination exists
    let hasConflict = false;
    try {
      const destStats = await fs.stat(destPath);
      // Conflict found!
      hasConflict = true;
      totalCount.value++;

      // Only add to conflicts array if under limit
      if (conflicts.length < limit) {
        const suggestedName = await generateUniqueName(
          path.dirname(destPath),
          path.basename(destPath),
        );

        // Get file sizes - for directories, just use 0 to avoid expensive recursive calculation
        // User can see it's a folder from the type, size is less important
        const sourceSize = sourceStats.isDirectory() ? 0 : sourceStats.size;
        const destSize = destStats.isDirectory() ? 0 : destStats.size;

        conflicts.push({
          sourcePath,
          destinationPath: destPath,
          suggestedName,
          type: sourceStats.isDirectory() ? "dir" : "file",
          sourceSize,
          destSize,
          sourceSizeStr: sourceStats.isDirectory()
            ? "--"
            : formatFileSize(sourceSize),
          destSizeStr: destStats.isDirectory()
            ? "--"
            : formatFileSize(destSize),
        });
      }
    } catch {
      // No conflict, destination doesn't exist
    }

    // If directory AND no conflict at this level, recurse into children
    // If the directory itself conflicts, don't show nested conflicts -
    // resolving the folder name resolves everything inside
    if (sourceStats.isDirectory() && !hasConflict) {
      const entries = await fs.readdir(sourcePath);
      for (const entry of entries) {
        await findConflictsRecursive(
          path.join(sourcePath, entry),
          destDir,
          path.join(relativePath, entry),
          conflicts,
          limit,
          totalCount,
        );
      }
    }
  } catch (error) {
    // Ignore errors (e.g., permission denied) during conflict detection
    console.error(`Error checking conflicts for ${sourcePath}:`, error);
  }
}

async function findConflicts(
  sourcePaths: string[],
  destinationDir: string,
  limit: number = 20,
): Promise<PasteConflictData> {
  const conflicts: PasteConflictInfo[] = [];
  const totalCount = { value: 0 };

  // Continue scanning all files to get accurate totalCount
  for (const sourcePath of sourcePaths) {
    await findConflictsRecursive(
      sourcePath,
      destinationDir,
      path.basename(sourcePath),
      conflicts,
      limit,
      totalCount,
    );
  }

  return {
    conflicts,
    exceedsLimit: totalCount.value > limit,
    totalConflicts: totalCount.value,
  };
}

async function validateResolution(
  filePaths: string[],
  destinationDir: string,
  resolution: ConflictResolution,
): Promise<{ valid: boolean; error?: string }> {
  // 1. Validate global strategy
  if (
    !resolution.globalStrategy ||
    !["override", "trash", "autoName", "skip"].includes(
      resolution.globalStrategy,
    )
  ) {
    return {
      valid: false,
      error: `Invalid global strategy: ${resolution.globalStrategy}`,
    };
  }

  // 2. Validate custom names format
  if (resolution.perFileOverrides) {
    for (const [destPath, override] of Object.entries(
      resolution.perFileOverrides,
    )) {
      // Validate override structure
      if (!override || !override.action) {
        return {
          valid: false,
          error: `Invalid override structure for ${destPath}`,
        };
      }

      // Validate action type
      if (
        !["override", "trash", "customName", "skip"].includes(override.action)
      ) {
        return {
          valid: false,
          error: `Invalid action "${override.action}" for ${destPath}`,
        };
      }

      // Validate custom name if provided
      if (override.action === "customName") {
        if (!override.customName) {
          return {
            valid: false,
            error: `Custom name required for ${destPath}`,
          };
        }

        const nameValidation = validateCustomName(override.customName);
        if (!nameValidation.valid) {
          return {
            valid: false,
            error: `Invalid name for ${destPath}: ${nameValidation.error}`,
          };
        }
      }
    }
  }

  // 3. Check for duplicate destination paths after resolution
  const finalDestinations = new Map<string, string[]>(); // destPath -> sourcePaths[]

  for (const sourcePath of filePaths) {
    const fileName = path.basename(sourcePath);
    const destPath = path.join(destinationDir, fileName);

    // Check if destination exists (is a conflict)
    const hasConflict = await (async () => {
      try {
        await fs.access(destPath);
        return true;
      } catch {
        return false;
      }
    })();

    // Determine final action for this file
    let finalAction: "override" | "trash" | "autoName" | "skip" =
      resolution.globalStrategy;
    let customName: string | undefined;

    if (resolution.perFileOverrides?.[destPath]) {
      const override = resolution.perFileOverrides[destPath];
      if (override.action === "customName") {
        finalAction = "autoName";
        customName = override.customName;
      } else {
        finalAction = override.action;
      }
    }

    // Skip only applies to conflicts
    if (finalAction === "skip" && hasConflict) {
      continue;
    }

    // Calculate final destination path
    let finalDestPath = destPath;

    if (finalAction === "autoName" && customName) {
      // Use custom name
      finalDestPath = path.join(destinationDir, customName);
    } else if (finalAction === "override" || finalAction === "trash") {
      // Keep original path (will override/trash existing)
      finalDestPath = destPath;
    } else {
      // No conflict or autoName without custom name
      finalDestPath = destPath;
    }

    // Track this destination
    const sources = finalDestinations.get(finalDestPath) || [];
    sources.push(sourcePath);
    finalDestinations.set(finalDestPath, sources);
  }

  // 4. Check for duplicate destinations
  for (const [destPath, sources] of finalDestinations.entries()) {
    if (sources.length > 1) {
      return {
        valid: false,
        error: `Multiple files would be pasted to ${destPath}: ${sources.join(", ")}`,
      };
    }
  }

  // 5. Check if at least one file will be pasted
  if (finalDestinations.size === 0) {
    return {
      valid: false,
      error:
        "No files would be pasted with this resolution (all files skipped)",
    };
  }

  return { valid: true };
}

async function executePasteWithResolutions(
  filePaths: string[],
  destinationDir: string,
  isCut: boolean,
  resolution: ConflictResolution,
  taskId?: string,
  abortSignal?: AbortSignal,
  totalFiles?: number,
): Promise<GenericResult<{ pastedItems: string[] }>> {
  const pastedItems: string[] = [];
  const successfullyMovedPaths: string[] = [];
  let filesCopied = 0;

  try {
    // Check if aborted
    if (abortSignal?.aborted) {
      return GenericError.Message("Operation cancelled");
    }

    // Validate the entire resolution structure
    const validation = await validateResolution(
      filePaths,
      destinationDir,
      resolution,
    );
    if (!validation.valid) {
      return GenericError.Message(validation.error!);
    }

    for (let i = 0; i < filePaths.length; i++) {
      // Check if aborted before processing next file
      if (abortSignal?.aborted) {
        // Return partial success - some files may have been pasted
        if (pastedItems.length > 0) {
          return Result.Success({
            pastedItems,
            // Note: For cut operations, don't clear clipboard on partial success
            // User still has remaining files to paste
          });
        }
        return GenericError.Message("Operation cancelled");
      }

      const sourcePath = filePaths[i];
      const fileName = path.basename(sourcePath);
      const destPath = path.join(destinationDir, fileName);

      // Check if this file has a conflict
      const hasConflict = await (async () => {
        try {
          await fs.access(destPath);
          return true;
        } catch {
          return false;
        }
      })();

      // Determine the action for this file
      let finalAction: "override" | "trash" | "autoName" | "skip" =
        resolution.globalStrategy;
      let customName: string | undefined;

      // Check if there's a per-file override
      if (resolution.perFileOverrides?.[destPath]) {
        const override = resolution.perFileOverrides[destPath];
        if (override.action === "customName") {
          finalAction = "autoName";
          customName = override.customName;
        } else {
          finalAction = override.action;
        }
      }

      // Handle skip - only skip if there's a conflict
      if (finalAction === "skip" && hasConflict) {
        continue;
      }

      // Determine the final destination path
      let finalDestPath = destPath;
      let finalName = fileName;

      if (finalAction === "autoName") {
        if (customName) {
          // Use the custom name provided, but check if it conflicts
          const customDestPath = path.join(destinationDir, customName);
          try {
            await fs.access(customDestPath);
            // Custom name also conflicts! Auto-generate a unique variant
            finalName = await generateUniqueName(destinationDir, customName);
            finalDestPath = path.join(destinationDir, finalName);
          } catch {
            // Custom name doesn't conflict, use it
            finalName = customName;
            finalDestPath = customDestPath;
          }
        } else {
          // Check if destination exists, auto-generate if needed
          try {
            await fs.access(destPath);
            // Exists, generate unique name
            finalName = await generateUniqueName(destinationDir, fileName);
            finalDestPath = path.join(destinationDir, finalName);
          } catch {
            // Doesn't exist, use original name
            finalDestPath = destPath;
            finalName = fileName;
          }
        }
      }

      // For trash or override, handle existing destination
      if (finalAction === "trash" || finalAction === "override") {
        try {
          const destStats = await fs.stat(finalDestPath);
          const sourceStats = await fs.stat(sourcePath);

          // If both are directories, merge them
          if (destStats.isDirectory() && sourceStats.isDirectory()) {
            // Merge: copy contents into existing folder
            const entries = await fs.readdir(sourcePath);
            for (const entry of entries) {
              await copyRecursive(
                path.join(sourcePath, entry),
                path.join(finalDestPath, entry),
                totalFiles
                  ? () => {
                      filesCopied++;
                      if (taskId) {
                        const progress = (filesCopied / totalFiles) * 100;
                        TaskManager.progress(taskId, progress);
                      }
                    }
                  : undefined,
              );
            }

            if (isCut) {
              // Delete the source directory after successful merge
              await fs.rm(sourcePath, { recursive: true, force: true });
              successfullyMovedPaths.push(sourcePath);
            }

            pastedItems.push(finalName);
            continue;
          }

          // For files or mismatched types, handle based on strategy
          if (finalAction === "trash") {
            // Move existing file to trash before pasting
            const trashResult = await moveToTrash(finalDestPath);
            if (!trashResult.success) {
              return trashResult;
            }
          } else {
            // Override: permanently delete
            if (!destStats.isDirectory()) {
              await fs.rm(finalDestPath, { force: true });
            }
          }
        } catch {
          // Destination doesn't exist, proceed normally
        }
      }

      // Execute the paste operation
      if (isCut) {
        await fs.rename(sourcePath, finalDestPath);
        successfullyMovedPaths.push(sourcePath);
        filesCopied++;
        if (taskId && totalFiles) {
          const progress = (filesCopied / totalFiles) * 100;
          TaskManager.progress(taskId, progress);
        }
      } else {
        await copyRecursive(
          sourcePath,
          finalDestPath,
          totalFiles
            ? () => {
                filesCopied++;
                if (taskId) {
                  const progress = (filesCopied / totalFiles) * 100;
                  TaskManager.progress(taskId, progress);
                }
              }
            : undefined,
        );
      }

      pastedItems.push(finalName);
    }

    // Only clear clipboard if it was a cut operation AND all files were successfully pasted
    // If cancelled mid-operation, clipboard is preserved so user can retry
    if (isCut && pastedItems.length === filePaths.length) {
      clearClipboardState();
    }

    return Result.Success({ pastedItems });
  } catch (error) {
    if (error instanceof Error) {
      return GenericError.Message(error.message);
    }
    return GenericError.Unknown(error);
  }
}

export async function pasteFiles(
  destinationDir: string,
  resolution?: ConflictResolution,
): Promise<PasteResult> {
  try {
    // Get files from in-memory clipboard
    const clipboardState = getClipboardState();

    if (!clipboardState || clipboardState.filePaths.length === 0) {
      return {
        needsResolution: false,
        result: GenericError.Message("No files in clipboard"),
      };
    }

    const { filePaths, cut: isCut } = clipboardState;
    const expandedDest = expandHome(destinationDir);

    // Verify destination exists and is a directory
    const destStats = await fs.stat(expandedDest);
    if (!destStats.isDirectory()) {
      return {
        needsResolution: false,
        result: GenericError.Message("Destination is not a directory"),
      };
    }

    // Check if cutting to the same directory
    if (isCut) {
      const allInSameDir = filePaths.every((sourcePath) => {
        const sourceDir = path.dirname(sourcePath);
        return path.resolve(sourceDir) === path.resolve(expandedDest);
      });

      if (allInSameDir) {
        return {
          needsResolution: false,
          result: GenericError.Message(
            "Cannot cut and paste in the same directory",
          ),
        };
      }
    }
    const taskId = TaskManager.create({
      type: "paste",
      progress: 0,
      metadata: {
        fileCount: 0,
        destinationDir: expandedDest,
        isCut,
        isEstimated: false,
      },
    });

    // If no resolution provided, check for conflicts
    if (!resolution) {
      const conflictData = await findConflicts(filePaths, expandedDest);

      // TaskManager.result(taskId, GenericError.Message("Found conflicts"));
      TaskManager.abort(taskId);

      if (conflictData.conflicts.length > 0) {
        // Conflicts found, need user resolution
        return {
          needsResolution: true,
          conflictData,
        };
      }

      // No conflicts, proceed with normal paste
      // Count total files (limited depth) for progress tracking
      const { totalFiles, isEstimated } = await countFilesInPaths(filePaths);

      TaskManager.update(taskId, {
        type: "paste",
        metadata: { fileCount: totalFiles, isEstimated },
      });

      // Get abort signal if task was created
      const abortSignal = taskId
        ? TaskManager.getAbortSignal(taskId)
        : undefined;

      let filesCopied = 0;
      const pastedItems: string[] = [];

      for (let i = 0; i < filePaths.length; i++) {
        // Check if aborted before processing next file
        if (abortSignal?.aborted) {
          // Return partial success if any files were pasted
          const result =
            pastedItems.length > 0
              ? Result.Success({ pastedItems })
              : GenericError.Message("Operation cancelled");

          if (taskId) {
            TaskManager.result(taskId, result);
          }
          return {
            needsResolution: false,
            result,
          };
        }

        const sourcePath = filePaths[i];
        const fileName = path.basename(sourcePath);
        const destPath = path.join(expandedDest, fileName);

        if (isCut) {
          await fs.rename(sourcePath, destPath);
          filesCopied++;
          if (taskId) {
            const progress = (filesCopied / totalFiles) * 100;
            TaskManager.progress(taskId, progress);
          }
        } else {
          await copyRecursive(sourcePath, destPath, () => {
            // Called after each file is copied
            filesCopied++;
            if (taskId) {
              const progress = (filesCopied / totalFiles) * 100;
              TaskManager.progress(taskId, progress);
            }
          });
        }

        pastedItems.push(fileName);
      }

      // Only clear clipboard if all files were successfully pasted
      if (isCut && pastedItems.length === filePaths.length) {
        clearClipboardState();
      }

      const result = Result.Success({ pastedItems });

      // Report task completion
      if (taskId) {
        TaskManager.result(taskId, result);
      }

      return {
        needsResolution: false,
        result,
      };
    }

    // Resolution provided, execute paste with resolutions
    // Count total files (limited depth) for progress tracking
    const { totalFiles, isEstimated } = await countFilesInPaths(filePaths);

    TaskManager.update(taskId, {
      type: "paste",
      metadata: { fileCount: totalFiles, isEstimated },
    });

    try {
      // Get abort signal if task was created
      const abortSignal = taskId
        ? TaskManager.getAbortSignal(taskId)
        : undefined;

      const result = await executePasteWithResolutions(
        filePaths,
        expandedDest,
        isCut,
        resolution,
        taskId,
        abortSignal,
        totalFiles,
      );

      // Report task completion
      if (taskId) {
        TaskManager.result(taskId, result);
      }

      return {
        needsResolution: false,
        result,
      };
    } catch (error) {
      // Report task failure
      if (taskId) {
        TaskManager.result(
          taskId,
          error instanceof Error
            ? GenericError.Message(error.message)
            : GenericError.Unknown(error),
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        needsResolution: false,
        result: GenericError.Message(error.message),
      };
    }
    return {
      needsResolution: false,
      result: GenericError.Unknown(error),
    };
  }
}
