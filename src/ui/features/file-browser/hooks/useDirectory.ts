import {
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { HistoryStack } from "@common/history-stack";
import { useForceRerender } from "@/lib/hooks/forceRerender";
import { errorToString } from "@common/errorToString";
import { mergeMaybeSlashed } from "@common/merge-maybe-slashed";
import { useDebounce } from "@/lib/hooks/useDebounce";
import {
  DirectoryDataFromSettings,
  FileBrowserSort,
  useFileBrowserSettings,
} from "./useFileBrowserSettings";
import { useRecents } from "./useRecents";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { getWindowElectron } from "@/getWindowElectron";
import { TagColor, tagsStore } from "./useTags";
import { PathHelpers } from "@common/PathHelpers";

export type DirectoryInfo =
  | { type: "path"; fullPath: string }
  | { type: "tags"; color: TagColor };

function getDirectoryInfo(dir: string): DirectoryInfo {
  const idx = dir.indexOf("/");
  if (idx === -1) throw new Error("Invalid directory name");
  return { type: "path", fullPath: dir };
}

function directoryInfoEquals(a: DirectoryInfo, b: DirectoryInfo): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "path" && b.type === "path") return a.fullPath === b.fullPath;
  if (a.type === "tags" && b.type === "tags") return a.color === b.color;
  return false;
}

type FileBrowserCacheOperation =
  | {
      loading: true;
      promise: Promise<GetFilesAndFoldersInDirectoryItem[]>;
    }
  | {
      loading: false;
      loaded: GetFilesAndFoldersInDirectoryItem[];
    };

class FileBrowserCache {
  static cache = new Map<string, FileBrowserCacheOperation>();

  static load = async (dir: string) => {
    const cached = FileBrowserCache.cache.get(dir);
    if (cached) {
      if (!cached.loading) return cached.loaded;
      return cached.promise;
    }

    const promise = getWindowElectron()
      .getFilesAndFoldersInDirectory(dir)
      .then((items) => {
        FileBrowserCache.cache.set(dir, { loading: false, loaded: items });
        setTimeout(() => {
          FileBrowserCache.cache.delete(dir);
        }, 500);
        return items;
      });
    return promise;
  };
}

function getFolderNameParts(dir: string) {
  return dir.split("/").filter(Boolean);
}

export type TaggedFilesGetter = (color: TagColor) => string[];

export function useDirectory(
  initialDirectory: string,
  recents: ReturnType<typeof useRecents>,
  getFilesWithTag?: TaggedFilesGetter,
) {
  const initialDirectoryInfo = getDirectoryInfo(initialDirectory);
  const [settings, setSettings] = useFileBrowserSettings();
  const [directory, setDirectory] =
    useState<DirectoryInfo>(initialDirectoryInfo);
  const [_loading, setLoading] = useState(false);
  const loading = useDebounce(_loading, 100);
  const [_directoryData, setDirectoryData] = useState<
    GetFilesAndFoldersInDirectoryItem[]
  >([]);
  const [error, setError] = useState<string | undefined>();

  const forceRerender = useForceRerender();

  useEffect(() => {
    loadDirectoryPath(initialDirectory);
  }, []);

  const loadDirectoryPath = useCallback(async (dir: string) => {
    // TODO: cancel previous request
    setLoading(true);
    try {
      const result = await FileBrowserCache.load(dir);

      result.sort((a, b) => {
        if (a.type === "dir" && b.type === "dir") return 0;
        if (a.type === "dir") return -1;
        if (b.type === "dir") return 1;
        return a.name.localeCompare(b.name);
      });

      setDirectoryData(result);
      setError(undefined);
      return result;
    } catch (e) {
      setError(errorToString(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTaggedFiles = useCallback(
    async (color: TagColor) => {
      if (!getFilesWithTag) return;
      setLoading(true);
      try {
        const filePaths = getFilesWithTag(color);
        if (filePaths.length === 0) {
          setDirectoryData([]);
          setError(undefined);
          return [];
        }
        const result = await getWindowElectron().getFileInfoByPaths(filePaths);

        const staleItems = filePaths.filter((item) => {
          const normalized = PathHelpers.expandHome(
            getWindowElectron().homeDirectory,
            item,
          );
          return !result.find((i) => i.fullPath === normalized);
        });
        if (staleItems.length > 0) {
          tagsStore.trigger.removeFilesFromAllTags({
            fullPaths: staleItems,
          });
        }
        setDirectoryData(result);
        setError(undefined);
        return result;
      } catch (e) {
        setError(errorToString(e));
      } finally {
        setLoading(false);
      }
    },
    [getFilesWithTag],
  );

  const loadDirectoryInfo = useCallback(
    async (info: DirectoryInfo) => {
      if (info.type === "path") {
        return loadDirectoryPath(info.fullPath);
      } else {
        return loadTaggedFiles(info.color);
      }
    },
    [loadDirectoryPath, loadTaggedFiles],
  );

  const directoryData = useMemo(
    () => DirectoryDataFromSettings.getDirectoryData(_directoryData, settings),
    [_directoryData, settings],
  );

  const historyStack = useMemo(
    () => new HistoryStack<DirectoryInfo>([initialDirectoryInfo]),
    [],
  );

  const cd = async (newDirectory: DirectoryInfo, isNew: boolean) => {
    if (loading) return;
    if (directoryInfoEquals(newDirectory, directory)) return;
    if (isNew) historyStack.goNew(newDirectory);
    setDirectory(newDirectory);
    if (newDirectory.type === "path") {
      recents.addRecent({ fullPath: newDirectory.fullPath, type: "dir" });
    }
    return loadDirectoryInfo(newDirectory);
  };

  const preloadDirectory = (dir: string) => {
    return FileBrowserCache.load(dir);
  };

  const getFullPath = (dir: string) => {
    if (directory.type === "path") {
      return mergeMaybeSlashed(directory.fullPath, dir);
    }
    // For tags view, we cannot merge paths
    return dir;
  };

  const cdWithMetadata = async (
    newDirectory: DirectoryInfo,
    isNew: boolean,
  ) => {
    const directoryData = await cd(newDirectory, isNew);
    return {
      directoryData:
        directoryData &&
        DirectoryDataFromSettings.getDirectoryData(directoryData, settings),
      beforeNavigation: directory,
    };
  };

  const hasNext = historyStack.hasNext;
  const hasPrev = historyStack.hasPrev;

  const changeDirectory = async (newDirectory: string) => {
    cd(
      {
        type: "path",
        fullPath: getFullPath(newDirectory),
      },
      true,
    );
  };

  const openFileFull = (fullPath: string) =>
    getWindowElectron().openFile(fullPath);
  const openFile = (filePath: string) => openFileFull(getFullPath(filePath));

  return {
    changeDirectory,
    cd: (dir: DirectoryInfo) => cd(dir, true),
    cdFull: (fullPath: string) => {
      return cd({ type: "path", fullPath }, true);
    },
    showTaggedFiles: (color: TagColor) => {
      return cd({ type: "tags", color }, true);
    },
    loading,
    directoryData,
    directory,
    goNext: async () => {
      if (!hasNext) return;
      forceRerender();
      return await cdWithMetadata(historyStack.goNext(), false);
    },
    goPrev: async () => {
      if (!hasPrev) return;
      forceRerender();
      const p = historyStack.goPrev();
      return await cdWithMetadata(p, false);
    },
    goUp: async () => {
      // goUp only makes sense when in a path directory
      if (directory.type !== "path") return;
      let parts = getFolderNameParts(directory.fullPath);
      if (parts.length === 1) {
        if (parts[0] === "~") {
          const home = await getWindowElectron().getHomeDirectory();
          parts = getFolderNameParts(home);
        }
      }
      let fullPath = parts.slice(0, parts.length - 1).join("/") + "/";
      if (fullPath[0] !== "/" && fullPath[0] !== "~") {
        fullPath = "/" + fullPath;
      }
      const info: DirectoryInfo = {
        type: "path",
        fullPath,
      };
      return await cdWithMetadata(info, true);
    },
    hasPrev,
    hasNext,
    error,
    settings,
    toggleShowDotFiles: () =>
      setSettings((s) => ({ ...s, showDotFiles: !s.showDotFiles })),
    toggleFoldersOnTop: () =>
      setSettings((s) => ({ ...s, foldersOnTop: !s.foldersOnTop })),
    setFileTypeFilter: (filter: typeof settings.fileTypeFilter) =>
      setSettings((s) => ({ ...s, fileTypeFilter: filter })),
    openFile,
    getFullPath,
    preloadDirectory,
    setSettings,
    setSort: (stateOrCb: SetStateAction<FileBrowserSort>) =>
      setSettings((s) => {
        if (typeof stateOrCb === "function") {
          const newSort = stateOrCb(s.sort);
          return { ...s, sort: newSort };
        }

        return { ...s, sort: stateOrCb };
      }),
    reload: () => loadDirectoryInfo(directory),
    openItem: (item: GetFilesAndFoldersInDirectoryItem) => {
      if (item.type === "dir") {
        // If we have a fullPath (from tags view), use it directly
        if (item.fullPath) {
          cd({ type: "path", fullPath: item.fullPath }, true);
        } else {
          changeDirectory(item.name);
        }
      } else {
        const fullPath = item.fullPath || getFullPath(item.name);
        recents.addRecent({ fullPath, type: "file" });
        openFileFull(fullPath);
      }
    },
    openFileFull,
  };
}
