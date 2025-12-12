import fs from "fs/promises";
import path from "path";
import { expandHome } from "./expand-home.js";
import { getClipboardState, clearClipboardState } from "./copy-files.js";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";

async function copyRecursive(src: string, dest: string) {
  const stats = await fs.stat(src);

  if (stats.isDirectory()) {
    // Create directory
    await fs.mkdir(dest, { recursive: true });

    // Copy all contents
    const entries = await fs.readdir(src);
    for (const entry of entries) {
      await copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    // Copy file
    await fs.copyFile(src, dest);
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

export async function pasteFiles(
  destinationDir: string,
): Promise<GenericResult<{ pastedItems: string[] }>> {
  try {
    // Get files from in-memory clipboard
    const clipboardState = getClipboardState();

    if (!clipboardState || clipboardState.filePaths.length === 0) {
      return GenericError.Message("No files in clipboard");
    }

    const { filePaths, cut: isCut } = clipboardState;
    const expandedDest = expandHome(destinationDir);
    const pastedItems: string[] = [];

    // Verify destination exists and is a directory
    const destStats = await fs.stat(expandedDest);
    if (!destStats.isDirectory()) {
      return GenericError.Message("Destination is not a directory");
    }

    // Check if cutting to the same directory
    if (isCut) {
      const allInSameDir = filePaths.every((sourcePath) => {
        const sourceDir = path.dirname(sourcePath);
        return path.resolve(sourceDir) === path.resolve(expandedDest);
      });

      if (allInSameDir) {
        return GenericError.Message(
          "Cannot cut and paste in the same directory",
        );
      }
    }

    for (const sourcePath of filePaths) {
      const fileName = path.basename(sourcePath);

      // Generate unique name if file already exists
      const uniqueName = await generateUniqueName(expandedDest, fileName);
      const destPath = path.join(expandedDest, uniqueName);

      if (isCut) {
        // Move file
        await fs.rename(sourcePath, destPath);
      } else {
        // Copy file
        await copyRecursive(sourcePath, destPath);
      }

      pastedItems.push(uniqueName);
    }

    // Clear clipboard if it was a cut operation (files have been moved)
    if (isCut) {
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
