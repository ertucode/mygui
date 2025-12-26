import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { expandHome } from "./expand-home.js";
import { PathHelpers } from "../../common/PathHelpers.js";

const execAsync = promisify(exec);

/**
 * Parse du output to get size in bytes
 * du -sk returns size in kilobytes
 */
function parseDuOutput(output: string): number {
  const lines = output.trim().split("\n");
  if (lines.length === 0) return 0;

  // du -sk output format: "1234\t/path/to/dir"
  const match = lines[0].match(/^(\d+)/);
  if (!match) return 0;

  // Convert from kilobytes to bytes
  return parseInt(match[1], 10) * 1024;
}

/**
 * Get sizes for all directories in the given path using du -sk command
 * Returns a map of directory names to their sizes in bytes
 */
export async function getDirectorySizes(
  parent: string,
  specificDirName?: string,
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const parentPath = expandHome(parent);

  try {
    const entries = await fs.readdir(parentPath, { withFileTypes: true });

    // Filter to only directories, and optionally to a specific directory
    const directories = entries.filter(
      (entry) =>
        entry.isDirectory() &&
        (!specificDirName || entry.name === specificDirName),
    );

    // Calculate sizes in parallel using du -sk
    await Promise.all(
      directories.map(async (dir) => {
        const fullPath = path.join(parentPath, dir.name);
        try {
          // Use du -sk to get size in kilobytes (more reliable than du -sh for parsing)
          // The -k flag ensures consistent output in KB
          const { stdout } = await execAsync(
            `du -sk ${JSON.stringify(fullPath)}`,
          );
          const size = parseDuOutput(stdout);
          result[dir.name] = size;
        } catch (err) {
          console.warn(`Error calculating size for ${dir.name}:`, err);
        }
      }),
    );
  } catch (err) {
    console.error(`Error reading parent directory ${parentPath}:`, err);
    throw err;
  }

  return result;
}

export async function getSizeForPath(fullPath: string): Promise<number> {
  const s = await fs.stat(fullPath);
  if (s.isDirectory()) {
    const itemName = PathHelpers.getLastPathPart(fullPath);
    const sizes = await getDirectorySizes(
      PathHelpers.getParentFolder(fullPath).path,
      itemName,
    );
    return sizes[itemName] || 0;
  } else {
    return s.size;
  }
}
