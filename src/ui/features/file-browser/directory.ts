import { createStore } from "@xstate/store";
import { HistoryStack } from "@common/history-stack";
import { errorToString } from "@common/errorToString";
import { mergeMaybeSlashed } from "@common/merge-maybe-slashed";
import {
  fileBrowserSettingsStore,
  selectSettings as selectSettingsFromStore,
  fileBrowserSettingsHelpers,
  FileBrowserSettings,
} from "./settings";
import { DirectoryDataFromSettings } from "./utils/DirectoryDataFromSettings";
import { recentsStore } from "./recents";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { getWindowElectron } from "@/getWindowElectron";
import { TagColor, tagsStore } from "./tags";
import { PathHelpers } from "@common/PathHelpers";
import { GenericError } from "@common/GenericError";
import { ResultHandlerResult } from "@/lib/hooks/useDefaultResultHandler";
import { defaultPath } from "./defaultPath";

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

const initialDirectoryInfo = getDirectoryInfo(defaultPath);

export const directoryStore = createStore({
  context: {
    directory: initialDirectoryInfo,
    loading: false,
    directoryData: [] as GetFilesAndFoldersInDirectoryItem[],
    error: undefined as string | undefined,
    historyStack: new HistoryStack<DirectoryInfo>([initialDirectoryInfo]),
    pendingSelection: null as string | null,
  },
  on: {

    setLoading: (context, event: { loading: boolean }) => ({
      ...context,
      loading: event.loading,
    }),

    setDirectoryData: (
      context,
      event: { data: GetFilesAndFoldersInDirectoryItem[] },
    ) => ({
      ...context,
      directoryData: event.data,
      error: undefined,
    }),

    setError: (context, event: { error: string }) => ({
      ...context,
      error: event.error,
    }),

    setDirectory: (context, event: { directory: DirectoryInfo }) => ({
      ...context,
      directory: event.directory,
    }),

    historyGoNew: (context, event: { directory: DirectoryInfo }) => {
      context.historyStack.goNew(event.directory);
      return context;
    },

    historyGoNext: (context) => {
      const nextDir = context.historyStack.goNext();
      return {
        ...context,
        directory: nextDir,
      };
    },

    historyGoPrev: (context) => {
      const prevDir = context.historyStack.goPrev();
      return {
        ...context,
        directory: prevDir,
      };
    },

    setPendingSelection: (context, event: { name: string | null }) => ({
      ...context,
      pendingSelection: event.name,
    }),

    itemCreated: (context, event: { name: string }) => ({
      ...context,
      pendingSelection: event.name,
    }),

    itemRenamed: (context, event: { name: string }) => ({
      ...context,
      pendingSelection: event.name,
    }),
  },
});

const loadDirectoryPath = async (dir: string) => {
  directoryStore.send({ type: "setLoading", loading: true } as any);
  try {
    const result = await FileBrowserCache.load(dir);

    result.sort((a, b) => {
      if (a.type === "dir" && b.type === "dir") return 0;
      if (a.type === "dir") return -1;
      if (b.type === "dir") return 1;
      return a.name.localeCompare(b.name);
    });

    directoryStore.send({ type: "setDirectoryData", data: result } as any);
    return result;
  } catch (e) {
    directoryStore.send({ type: "setError", error: errorToString(e) } as any);
  } finally {
    directoryStore.send({ type: "setLoading", loading: false } as any);
  }
};

const loadTaggedFiles = async (color: TagColor) => {
  const getFilesWithTag = (color: TagColor) =>
    Object.entries(tagsStore.get().context.fileTags)
      .filter(([_, tags]) => tags.includes(color))
      .map(([path]) => path);

  directoryStore.send({ type: "setLoading", loading: true } as any);
  try {
    const filePaths = getFilesWithTag(color);
    if (filePaths.length === 0) {
      directoryStore.send({ type: "setDirectoryData", data: [] } as any);
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
    directoryStore.send({ type: "setDirectoryData", data: result } as any);
    return result;
  } catch (e) {
    directoryStore.send({ type: "setError", error: errorToString(e) } as any);
  } finally {
    directoryStore.send({ type: "setLoading", loading: false } as any);
  }
};

const loadDirectoryInfo = async (info: DirectoryInfo) => {
  if (info.type === "path") {
    return loadDirectoryPath(info.fullPath);
  } else {
    return loadTaggedFiles(info.color);
  }
};

// Load the initial directory
loadDirectoryPath(defaultPath);

const cd = async (newDirectory: DirectoryInfo, isNew: boolean) => {
  const state = directoryStore.get();
  if (state.context.loading) return;
  if (directoryInfoEquals(newDirectory, state.context.directory)) return;
  if (isNew)
    directoryStore.send({
      type: "historyGoNew",
      directory: newDirectory,
    } as any);
  directoryStore.send({ type: "setDirectory", directory: newDirectory } as any);
  if (newDirectory.type === "path") {
    recentsStore.send({
      type: "addRecent",
      item: { fullPath: newDirectory.fullPath, type: "dir" },
    });
  }
  return loadDirectoryInfo(newDirectory);
};

const preloadDirectory = (dir: string) => {
  return FileBrowserCache.load(dir);
};

const getFullPath = (dir: string) => {
  const state = directoryStore.get();
  if (state.context.directory.type === "path") {
    return mergeMaybeSlashed(state.context.directory.fullPath, dir);
  }
  // For tags view, we cannot merge paths
  return dir;
};

const cdWithMetadata = async (newDirectory: DirectoryInfo, isNew: boolean) => {
  const state = directoryStore.get();
  const beforeNavigation = state.context.directory;
  const directoryData = await cd(newDirectory, isNew);
  const settings = selectSettingsFromStore(fileBrowserSettingsStore.get());
  return {
    directoryData:
      directoryData &&
      DirectoryDataFromSettings.getDirectoryData(directoryData, settings),
    beforeNavigation,
  };
};

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

// Helper functions
export const directoryHelpers = {
  createNewItem: async (name: string): Promise<ResultHandlerResult> => {
    const state = directoryStore.get();
    if (state.context.directory.type !== "path") {
      return GenericError.Message("Cannot create items in tags view");
    }

    try {
      const result = await getWindowElectron().createFileOrFolder(
        state.context.directory.fullPath,
        name,
      );
      if (result.success) {
        await loadDirectoryInfo(state.context.directory);
        // Emit itemCreated event to set pending selection
        const itemName = name.endsWith("/") ? name.slice(0, -1) : name;
        directoryStore.send({ type: "itemCreated", name: itemName } as any);
      }
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      return GenericError.Message(errorMessage);
    }
  },

  renameItem: async (
    item: GetFilesAndFoldersInDirectoryItem,
    newName: string,
  ): Promise<ResultHandlerResult> => {
    try {
      if (!item) throw new Error("No item selected");
      const oldPath = item.fullPath ?? directoryHelpers.getFullPath(item.name);
      const result = await getWindowElectron().renameFileOrFolder(
        oldPath,
        newName,
      );
      if (result.success) {
        const state = directoryStore.get();
        await loadDirectoryInfo(state.context.directory);
        // Emit itemRenamed event to set pending selection
        directoryStore.send({ type: "itemRenamed", name: newName } as any);
      }
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      return GenericError.Message(errorMessage);
    }
  },

  setPendingSelection: (name: string | null) => {
    directoryStore.send({ type: "setPendingSelection", name } as any);
  },

  changeDirectory,

  cd: (dir: DirectoryInfo) => cd(dir, true),

  cdFull: (fullPath: string) => {
    return cd({ type: "path", fullPath }, true);
  },

  showTaggedFiles: (color: TagColor) => {
    return cd({ type: "tags", color }, true);
  },

  goNext: async () => {
    const state = directoryStore.get();
    if (!state.context.historyStack.hasNext) return;
    directoryStore.send({ type: "historyGoNext" } as any);
    const newState = directoryStore.get();
    return await cdWithMetadata(newState.context.directory, false);
  },

  goPrev: async () => {
    const state = directoryStore.get();
    if (!state.context.historyStack.hasPrev) return;
    directoryStore.send({ type: "historyGoPrev" } as any);
    const newState = directoryStore.get();
    return await cdWithMetadata(newState.context.directory, false);
  },

  goUp: async () => {
    const state = directoryStore.get();
    const directory = state.context.directory;
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

  toggleShowDotFiles: fileBrowserSettingsHelpers.toggleShowDotFiles,
  toggleFoldersOnTop: fileBrowserSettingsHelpers.toggleFoldersOnTop,
  setFileTypeFilter: fileBrowserSettingsHelpers.setFileTypeFilter,

  openFile,

  getFullPath,

  preloadDirectory,

  setSettings: fileBrowserSettingsHelpers.setSettings,
  setSort: fileBrowserSettingsHelpers.setSort,

  reload: () => {
    const state = directoryStore.get();
    return loadDirectoryInfo(state.context.directory);
  },

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
      recentsStore.send({
        type: "addRecent",
        item: { fullPath, type: "file" },
      });
      openFileFull(fullPath);
    }
  },

  openFileFull,
};

// Selectors
export const selectDirectory = (state: ReturnType<typeof directoryStore.get>) =>
  state.context.directory;

export const selectLoading = (state: ReturnType<typeof directoryStore.get>) =>
  state.context.loading;

export const selectRawDirectoryData = (
  state: ReturnType<typeof directoryStore.get>,
) => state.context.directoryData;

export const selectDirectoryData = (
  state: ReturnType<typeof directoryStore.get>,
) => {
  const settings = selectSettingsFromStore(fileBrowserSettingsStore.get());
  return DirectoryDataFromSettings.getDirectoryData(
    state.context.directoryData,
    settings,
  );
};

export const selectError = (state: ReturnType<typeof directoryStore.get>) =>
  state.context.error;

export const selectHasNext = (state: ReturnType<typeof directoryStore.get>) =>
  state.context.historyStack.hasNext;

export const selectHasPrev = (state: ReturnType<typeof directoryStore.get>) =>
  state.context.historyStack.hasPrev;

export const selectSettings = (): FileBrowserSettings => {
  return selectSettingsFromStore(fileBrowserSettingsStore.get());
};

export const selectPendingSelection = (
  state: ReturnType<typeof directoryStore.get>,
) => state.context.pendingSelection;
