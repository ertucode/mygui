export namespace PathHelpers {
  export function getLastPathPart(path: string) {
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "/";
  }

  export function getLastCountParts(path: string, count: number) {
    const parts = path.split("/").filter(Boolean);
    return parts.slice(-count).join("/");
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

  export function revertExpandedHome(home: string, filePath: string): string {
    if (filePath.startsWith(home)) {
      return "~/" + filePath.slice(home.length);
    }
    return filePath;
  }

  export function resolveUpDirectory(homeDirectory: string, input: string) {
    let parts = getFolderNameParts(input);
    if (parts.length === 1) {
      if (parts[0] === "~") {
        parts = getFolderNameParts(homeDirectory);
      }
    }
    let fullPath = parts.slice(0, parts.length - 1).join("/") + "/";
    if (fullPath[0] !== "/" && fullPath[0] !== "~") {
      fullPath = "/" + fullPath;
    }

    return fullPath;
  }

  export function withExtension<TExtension extends `.${string}`>(
    filePath: string,
    extension: TExtension,
  ) {
    if (filePath.endsWith(extension)) return filePath;
    return filePath + extension;
  }

  export function suggestUnarchiveName(filePath: string) {
    const matchedExt = PathHelpers.getExtension(filePath).replace(/^\./, "");
    return filePath.slice(0, -matchedExt.length - 1);
  }

  export function getExtension(filePath: string) {
    const lastDot = filePath.lastIndexOf(".");
    if (lastDot === -1 || lastDot === filePath.length - 1) {
      return "";
    }
    return filePath.slice(lastDot + 1);
  }

  export function ensureDot(ext: string) {
    if (ext.startsWith(".")) return ext;
    return "." + ext;
  }
}
