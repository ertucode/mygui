import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { HistoryStack } from "@common/history-stack";
import { TagColor } from "../tags";

export type DirectoryInfo =
  | { type: "path"; fullPath: string }
  | { type: "tags"; color: TagColor };
export type DirectoryType = DirectoryInfo["type"];

export function directoryInfoEquals(
  a: DirectoryInfo,
  b: DirectoryInfo,
): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "path" && b.type === "path") return a.fullPath === b.fullPath;
  if (a.type === "tags" && b.type === "tags") return a.color === b.color;
  return false;
}
export function getActiveDirectory(
  context: DirectoryContext,
  directoryId: DirectoryId | undefined,
) {
  const dirId = directoryId ?? context.activeDirectoryId;
  return context.directoriesById[dirId];
}

export type DirectoryId = $Branded<string, "DirectoryId">;

export type DirectoryContextDirectory = {
  directoryId: DirectoryId;
  directory: DirectoryInfo;
  loading: boolean;
  directoryData: GetFilesAndFoldersInDirectoryItem[];
  error: string | undefined;
  historyStack: HistoryStack<DirectoryInfo>;
  pendingSelection: string | null;
  selection: {
    indexes: Set<number>;
    last: number | undefined;
  };
  fuzzyQuery: string;
  viewMode: "list" | "grid";
};

export type DirectoryContext = {
  directoriesById: { [id: DirectoryId]: DirectoryContextDirectory };
  directoryOrder: DirectoryId[];
  activeDirectoryId: DirectoryId;
};
