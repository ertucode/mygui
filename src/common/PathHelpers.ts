export namespace PathHelpers {
  export function getLastPathPart(path: string) {
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "/";
  }

  /**
   * Get the parent folder path and name from a full path
   * e.g., "/Users/john/Documents/file.txt" -> { path: "/Users/john/Documents", name: "Documents" }
   */
  export function getParentFolder(fullPath: string): {
    path: string;
    name: string;
  } {
    const parts = fullPath.split("/");
    // Remove empty parts but keep track of leading slash
    const filteredParts = parts.filter(Boolean);

    if (filteredParts.length >= 2) {
      const parentParts = filteredParts.slice(0, -1);
      const parentPath = "/" + parentParts.join("/");
      const parentName = parentParts[parentParts.length - 1];
      return { path: parentPath, name: parentName };
    }

    return { path: "/", name: "" };
  }

  export function reconstructDirectoryUntilIndex(parts: string[], idx: number) {
    const d = parts.slice(0, idx + 1).join("/") + "/";
    if (d.startsWith("/") || d.startsWith("~")) return d;
    return "/" + d;
  }

  export function getFolderNameParts(dir: string) {
    return dir.split("/").filter(Boolean);
  }

  export function expandHome(home: string, filePath: string): string {
    if (filePath.startsWith("~/")) {
      return home + filePath.slice(1);
    }
    return filePath;
  }
}
