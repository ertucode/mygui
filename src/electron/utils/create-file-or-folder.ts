import fs from "fs/promises";
import path from "path";
import { expandHome } from "./expand-home.js";

export async function createFileOrFolder(
  parentDir: string,
  name: string,
): Promise<{ success: boolean; error?: string; path?: string }> {
  try {
    const expandedParent = expandHome(parentDir);
    const fullPath = path.join(expandedParent, name);

    // Check if name ends with slash - if so, create a folder
    const isFolder = name.endsWith("/");

    if (isFolder) {
      await fs.mkdir(fullPath, { recursive: true });
    } else {
      // Ensure parent directories exist
      const parentPath = path.dirname(fullPath);
      await fs.mkdir(parentPath, { recursive: true });
      // Create empty file
      await fs.writeFile(fullPath, "");
    }

    return { success: true, path: fullPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
