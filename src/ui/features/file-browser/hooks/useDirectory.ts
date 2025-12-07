import { useCallback, useEffect, useMemo, useState } from "react";
import { HistoryStack } from "@common/history-stack";
import { useForceRerender } from "@/lib/hooks/forceRerender";
import { errorToString } from "@common/errorToString";
import { mergeMaybeSlashed } from "@common/merge-maybe-slashed";
import { useDebounce } from "@/lib/hooks/useDebounce";
import {
  DirectoryDataFromSettings,
  useFileBrowserSettings,
} from "./useFileBrowserSettings";
import { useRecents } from "./useRecents";

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

    const promise = window.electron
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

  const hasPrev = historyStack.hasPrev;

  return {
    changeDirectory: async (newDirectory: string) => {
      cd(
        {
          fullName: getFullName(newDirectory),
          name: newDirectory,
        },
        true,
      );
    },
    cd: (dir: DirectoryInfo) => cd(dir, true),
    cdFull: (fullPath: string) => {
      const parts = fullPath.split("/").filter(Boolean);
      const name = parts[parts.length - 1] || fullPath;
      return cd({ fullName: fullPath, name }, true);
    },
    loading,
    directoryData,
    directory,
    goNext: () => {
      forceRerender();
      cd(historyStack.goNext(), false);
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
          const home = await window.electron.getHomeDirectory();
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
    hasNext: historyStack.hasNext,
    hasPrev,
    error,
    settings,
    toggleShowDotFiles: () =>
      setSettings((s) => ({ ...s, showDotFiles: !s.showDotFiles })),
    toggleFoldersOnTop: () =>
      setSettings((s) => ({ ...s, foldersOnTop: !s.foldersOnTop })),
    openFile: (filePath: string) =>
      window.electron.openFile(getFullName(filePath)),
    getFullName,
    preloadDirectory,
    setSettings,
    reload: () => loadDirectory(directory.fullName),
  };
}
