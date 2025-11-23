import fs from "node:fs/promises";
import path from "node:path";
import os from "os";
import { expandHome } from "./expand-home.js";

export function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
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
): Promise<GetFilesAndFoldersInDirectoryItem[]> {
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
          size: stat?.size ? formatSize(stat.size) : undefined,
          modifiedAt: stat?.mtime.toLocaleString("tr-TR", dateOptions),
        };
        return item;
      }

      const stat = await safeStat(fullPath);

      return {
        type: "dir" as const,
        name: entry.name,
        ext: "" as const,
        size: null,
        modifiedAt: stat?.mtime.toLocaleString("tr-TR", dateOptions),
      };
    }),
  );

  // -----------------------------------------------
  // 4. Sorting: folders first, then alphabetical
  // -----------------------------------------------
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return items;
}

const dateOptions: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short", // "May"
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false, // 24-hour format
};
