import fs from "fs/promises";
import path from "path";
import { expandHome } from "./expand-home.js";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";
import { TaskManager } from "../TaskManager.js";
import { VimEngine } from "../../common/VimEngine.js";
import { Typescript } from "../../common/Typescript.js";

export async function applyVimChanges(
  changes: VimEngine.Change[],
): Promise<GenericResult<void>> {
  // Calculate affected directories
  const affectedDirsSet = new Set<string>();
  for (const change of changes) {
    if (change.type === "add" || change.type === "remove") {
      affectedDirsSet.add(change.directory);
    } else if (change.type === "copy" || change.type === "rename") {
      // Add both source and destination directories
      const originalDir = change.item.fullPath
        ? change.item.fullPath.substring(
            0,
            change.item.fullPath.lastIndexOf("/"),
          )
        : change.newDirectory;
      affectedDirsSet.add(originalDir);
      affectedDirsSet.add(change.newDirectory);
    } else {
      Typescript.assertUnreachable(change);
    }
  }

  const taskId = TaskManager.create({
    type: "vim-changes",
    metadata: {
      changeCount: changes.length,
      affectedDirectories: Array.from(affectedDirsSet),
    },
    progress: 0,
  });

  try {
    let completed = 0;
    const totalChanges = changes.length;

    // Validate all changes before applying any
    for (const change of changes) {
      try {
        await validateChange(change);
      } catch (error) {
        const result =
          error instanceof Error
            ? GenericError.Message(`Validation failed: ${error.message}`)
            : GenericError.Unknown(error);
        TaskManager.result(taskId, result);
        return result;
      }
    }

    // Apply changes sequentially to avoid conflicts
    for (const change of changes) {
      try {
        await applyChange(change);
        completed++;
        TaskManager.progress(taskId, (completed / totalChanges) * 100);
      } catch (error) {
        const result =
          error instanceof Error
            ? GenericError.Message(`Failed to apply change: ${error.message}`)
            : GenericError.Unknown(error);
        TaskManager.result(taskId, result);
        return result;
      }
    }

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

async function validateChange(change: VimEngine.Change): Promise<void> {
  switch (change.type) {
    case "add": {
      const targetDir = expandHome(change.directory);
      // Check if parent directory exists
      const stats = await fs.stat(targetDir);
      if (!stats.isDirectory()) {
        throw new Error(`Target directory does not exist: ${targetDir}`);
      }

      // Parse the name to handle nested paths
      const isDirectory = change.name.endsWith("/");
      const cleanName = change.name.replace(/\/+$/, ""); // Remove trailing slashes
      const targetPath = path.join(targetDir, cleanName);

      // Check if the path already exists
      try {
        await fs.access(targetPath);
        throw new Error(`Path already exists: ${targetPath}`);
      } catch (error: any) {
        // ENOENT means it doesn't exist, which is what we want
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
      break;
    }

    case "remove": {
      const fullPath = expandHome(
        change.item.fullPath || path.join(change.directory, change.item.name),
      );
      // Check if the item exists
      try {
        await fs.access(fullPath);
      } catch {
        throw new Error(`Item does not exist: ${fullPath}`);
      }
      break;
    }

    case "copy": {
      const sourcePath = expandHome(
        change.item.fullPath ||
          path.join(change.newDirectory, change.item.name),
      );
      const destDir = expandHome(change.newDirectory);
      const destPath = path.join(destDir, change.newName);

      // Check if source exists
      try {
        await fs.access(sourcePath);
      } catch {
        throw new Error(`Source item does not exist: ${sourcePath}`);
      }

      // Check if destination directory exists
      try {
        const stats = await fs.stat(destDir);
        if (!stats.isDirectory()) {
          throw new Error(`Target directory is not a directory: ${destDir}`);
        }
      } catch {
        throw new Error(`Target directory does not exist: ${destDir}`);
      }

      // Check if destination already exists
      try {
        await fs.access(destPath);
        throw new Error(`Destination already exists: ${destPath}`);
      } catch (error: any) {
        // ENOENT means it doesn't exist, which is what we want
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
      break;
    }

    case "rename": {
      const oldPath = expandHome(
        change.item.fullPath ||
          path.join(change.newDirectory, change.item.name),
      );
      const newDir = expandHome(change.newDirectory);
      const newPath = path.join(newDir, change.newName);

      // Check if source exists
      try {
        await fs.access(oldPath);
      } catch {
        throw new Error(`Source item does not exist: ${oldPath}`);
      }

      // Check if destination directory exists
      try {
        const stats = await fs.stat(newDir);
        if (!stats.isDirectory()) {
          throw new Error(`Target directory is not a directory: ${newDir}`);
        }
      } catch {
        throw new Error(`Target directory does not exist: ${newDir}`);
      }

      // Check if destination already exists (unless it's the same as source)
      if (oldPath !== newPath) {
        try {
          await fs.access(newPath);
          throw new Error(`Destination already exists: ${newPath}`);
        } catch (error: any) {
          // ENOENT means it doesn't exist, which is what we want
          if (error.code !== "ENOENT") {
            throw error;
          }
        }
      }
      break;
    }

    default:
      Typescript.assertUnreachable(change);
  }
}

async function applyChange(change: VimEngine.Change): Promise<void> {
  switch (change.type) {
    case "add": {
      const targetDir = expandHome(change.directory);
      const isDirectory = change.name.endsWith("/");
      const cleanName = change.name.replace(/\/+$/, ""); // Remove trailing slashes

      // Handle nested paths (e.g., "dir1/dir2/file.txt")
      const pathParts = cleanName.split("/");
      let currentPath = targetDir;

      // Create intermediate directories if needed
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentPath = path.join(currentPath, pathParts[i]);
        try {
          await fs.mkdir(currentPath, { recursive: true });
        } catch (error: any) {
          if (error.code !== "EEXIST") {
            throw error;
          }
        }
      }

      // Create the final item
      const finalPath = path.join(targetDir, cleanName);
      if (isDirectory) {
        await fs.mkdir(finalPath, { recursive: true });
      } else {
        // Ensure parent directory exists
        const parentDir = path.dirname(finalPath);
        await fs.mkdir(parentDir, { recursive: true });
        // Create empty file
        await fs.writeFile(finalPath, "");
      }
      break;
    }

    case "remove": {
      const fullPath = expandHome(
        change.item.fullPath || path.join(change.directory, change.item.name),
      );

      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
      break;
    }

    case "copy": {
      const sourcePath = expandHome(
        change.item.fullPath ||
          path.join(change.newDirectory, change.item.name),
      );
      const destDir = expandHome(change.newDirectory);
      const destPath = path.join(destDir, change.newName);

      // Create target directory if it doesn't exist
      await fs.mkdir(destDir, { recursive: true });

      // Copy the item (file or directory)
      const stats = await fs.stat(sourcePath);
      if (stats.isDirectory()) {
        await fs.cp(sourcePath, destPath, { recursive: true });
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
      break;
    }

    case "rename": {
      const oldPath = expandHome(
        change.item.fullPath ||
          path.join(change.newDirectory, change.item.name),
      );
      const newDir = expandHome(change.newDirectory);
      const newPath = path.join(newDir, change.newName);

      // Create target directory if it doesn't exist (for cross-directory moves)
      await fs.mkdir(newDir, { recursive: true });

      // Rename/move the item
      await fs.rename(oldPath, newPath);
      break;
    }

    default:
      Typescript.assertUnreachable(change);
  }
}
