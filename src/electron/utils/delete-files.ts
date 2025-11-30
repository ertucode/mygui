import fs from "fs/promises";
import { expandHome } from "./expand-home.js";

export async function deleteFiles(filePaths: string[]) {
  try {
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
      })
    );
    
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Unknown error deleting files" };
  }
}
