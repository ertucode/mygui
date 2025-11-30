import fs from "fs/promises";
import { expandHome } from "./expand-home.js";

export async function getFileContent(filePath: string) {
  try {
    // Expand home directory if needed
    const fullPath = expandHome(filePath);
    
    // Check file size first
    const stats = await fs.stat(fullPath);
    const maxSize = 1024 * 1024; // 1MB
    
    if (stats.size > maxSize) {
      return { error: `File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 1MB.` };
    }
    
    // Read file content
    const content = await fs.readFile(fullPath, "utf-8");
    
    return { content, isTruncated: false };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Unknown error reading file" };
  }
}
