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

type DirectoryInfo = {
  fullName: string;
  name: string;
};

function getDirectoryInfo(dir: string): DirectoryInfo {
  const idx = dir.indexOf("/");
  if (idx === -1) throw new Error("Invalid directory name");
  if (idx === dir.length - 1) return { fullName: dir, name: dir };

  const name = dir.slice(idx + 1);
  return { fullName: dir, name };
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

export function useDirectory(
  initialDirectory: string,
  recents: ReturnType<typeof useRecents>,
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
    loadDirectory(initialDirectory);
  }, []);

  const loadDirectory = useCallback(async (dir: string) => {
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
    if (newDirectory.fullName === directory.fullName) return;
    if (isNew) historyStack.goNew(newDirectory);
    setDirectory(newDirectory);
    recents.addRecent({ fullPath: newDirectory.fullName, type: "dir" });
    return loadDirectory(newDirectory.fullName);
  };

  const preloadDirectory = (dir: string) => {
    return FileBrowserCache.load(dir);
  };

  const getFullName = (dir: string) =>
    mergeMaybeSlashed(directory.fullName, dir);

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
        fullName: getFullName(newDirectory),
        name: newDirectory,
      },
      true,
    );
  };

  const openFile = (filePath: string) =>
    getWindowElectron().openFile(getFullName(filePath));

  return {
    changeDirectory,
    cd: (dir: DirectoryInfo) => cd(dir, true),
    cdFull: (fullPath: string) => {
      const parts = fullPath.split("/").filter(Boolean);
      const name = parts[parts.length - 1] || fullPath;
      return cd({ fullName: fullPath, name }, true);
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
      let parts = getFolderNameParts(directory.fullName);
      if (parts.length === 1) {
        if (parts[0] === "~") {
          const home = await getWindowElectron().getHomeDirectory();
          parts = getFolderNameParts(home);
        }
      }
      let fullName = parts.slice(0, parts.length - 1).join("/") + "/";
      if (fullName[0] !== "/" && fullName[0] !== "~") {
        fullName = "/" + fullName;
      }
      const info = {
        fullName,
        name: parts[parts.length - 1],
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
    getFullName,
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
    reload: () => loadDirectory(directory.fullName),
    openItem: (item: GetFilesAndFoldersInDirectoryItem) => {
      if (item.type === "dir") {
        changeDirectory(item.name);
      } else {
        recents.addRecent({ fullPath: getFullName(item.name), type: "file" });
        openFile(item.name);
      }
    },
  };
}
