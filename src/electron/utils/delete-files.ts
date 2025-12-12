import fs from "fs/promises";
import { expandHome } from "./expand-home.js";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";

export async function deleteFiles(
  filePaths: string[],
): Promise<GenericResult<void>> {
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
      }),
    );

    return Result.Success(undefined);
  } catch (error) {
    if (error instanceof Error) {
      return GenericError.Message(error.message);
    }
    return GenericError.Unknown(error);
  }
}
