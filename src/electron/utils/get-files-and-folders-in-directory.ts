import fs from "node:fs/promises";
import path from "node:path";
import { expandHome } from "./expand-home.js";
import { getCategoryFromExtension } from "../../common/file-category.js";
import { GetFilesAndFoldersInDirectoryItem } from "../../common/Contracts.js";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";
import { formatFileSize } from "../../common/file-size.js";

// Re-export for backwards compatibility
export const formatSize = formatFileSize;

/**
 * Format file permissions as a Unix-style string (e.g., "rwxr-xr-x")
 */
export function formatPermissions(mode: number): string {
  const perms = mode & 0o777;
  const owner = (perms >> 6) & 7;
  const group = (perms >> 3) & 7;
  const others = perms & 7;

  const format = (n: number) => {
    return (n & 4 ? "r" : "-") + (n & 2 ? "w" : "-") + (n & 1 ? "x" : "-");
  };

  return format(owner) + format(group) + format(others);
}

async function safeStat(filePath: string) {
  try {
    return await fs.stat(filePath);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return null; // file doesn't exist
    }
    throw err; // other errors
  }
}

export async function getFilesAndFoldersInDirectory(
  d: string,
): Promise<GenericResult<GetFilesAndFoldersInDirectoryItem[]>> {
  try {
    const dir = expandHome(d);
    const dirents = await fs.readdir(dir, { withFileTypes: true });

    const items = await Promise.all(
      dirents.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isFile()) {
          const stat = await safeStat(fullPath);
          const ext = path.extname(entry.name);
          const item: GetFilesAndFoldersInDirectoryItem = {
            type: "file" as const,
            name: entry.name,
            ext,
            category: getCategoryFromExtension(ext),
            sizeStr: stat?.size ? formatSize(stat.size) : "--",
            size: stat?.size,
            modifiedTimestamp: stat?.mtime.getTime(),
            modifiedAt: stat?.mtime.toLocaleString("tr-TR", dateOptions),
            permissions:
              stat?.mode !== undefined
                ? formatPermissions(stat.mode)
                : undefined,
          };
          return item;
        }

        const stat = await safeStat(fullPath);

        return {
          type: "dir" as const,
          name: entry.name,
          ext: "" as const,
          category: "folder" as const,
          sizeStr: "--",
          size: null,
          modifiedTimestamp: stat?.mtime.getTime(),
          modifiedAt: stat?.mtime.toLocaleString("tr-TR", dateOptions),
          permissions:
            stat?.mode !== undefined ? formatPermissions(stat.mode) : undefined,
        };
      }),
    );

    return Result.Success(items);
  } catch (error) {
    if (error instanceof Error) {
      return GenericError.Message(error.message);
    }
    return GenericError.Unknown(error);
  }
}

const dateOptions: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short", // "May"
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false, // 24-hour format
};

export async function getFileInfoByPaths(
  filePaths: string[],
): Promise<GetFilesAndFoldersInDirectoryItem[]> {
  const items = await Promise.all(
    filePaths.map(async (filePath) => {
      const fullPath = expandHome(filePath);
      const stat = await safeStat(fullPath);
      const name = path.basename(fullPath);

      if (!stat) {
        // File doesn't exist, return minimal info
        const ext = path.extname(name);
        return {
          type: "file" as const,
          name,
          ext,
          category: getCategoryFromExtension(ext),
          sizeStr: "--",
          size: null,
          modifiedTimestamp: null,
          modifiedAt: null,
          fullPath,
          permissions: undefined,
        };
      }

      if (stat.isDirectory()) {
        return {
          type: "dir" as const,
          name,
          ext: "" as const,
          category: "folder" as const,
          sizeStr: "--",
          size: null,
          modifiedTimestamp: stat.mtime.getTime(),
          modifiedAt: stat.mtime.toLocaleString("tr-TR", dateOptions),
          fullPath,
          permissions: formatPermissions(stat.mode),
        };
      }

      const ext = path.extname(name);
      return {
        type: "file" as const,
        name,
        ext,
        category: getCategoryFromExtension(ext),
        sizeStr: stat.size ? formatSize(stat.size) : "--",
        size: stat.size,
        modifiedTimestamp: stat.mtime.getTime(),
        modifiedAt: stat.mtime.toLocaleString("tr-TR", dateOptions),
        fullPath,
        permissions: formatPermissions(stat.mode),
      };
    }),
  );

  return items;
}
