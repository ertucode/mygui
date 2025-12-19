import { createStore, StoreSnapshot } from "@xstate/store";
import { HistoryStack } from "@common/history-stack";
import { errorToString } from "@common/errorToString";
import { mergeMaybeSlashed } from "@common/merge-maybe-slashed";
import Fuse from "fuse.js";
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
import { defaultPath, initialDirectoryInfo } from "./defaultPath";
import { toast } from "@/lib/components/toast";
import { confirmation } from "@/lib/hooks/useConfirmation";
import { favoritesStore, selectIsFavorite } from "./favorites";
import { dialogActions } from "./dialogStore";
import {
  createUseDerivedStoreValue,
  subscribeToStores,
} from "@/lib/functions/storeHelpers";
import { scrollRowIntoViewIfNeeded } from "@/lib/libs/table/globalTableScroll";
import { FileBrowserCache } from "./FileBrowserCache";
import { ShortcutInput } from "@/lib/hooks/useShortcuts";

export type DirectoryInfo =
  | { type: "path"; fullPath: string }
  | { type: "tags"; color: TagColor };

function directoryInfoEquals(a: DirectoryInfo, b: DirectoryInfo): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "path" && b.type === "path") return a.fullPath === b.fullPath;
  if (a.type === "tags" && b.type === "tags") return a.color === b.color;
  return false;
}
function getActiveDirectory(
  context: DirectoryContext,
  directoryId: DirectoryId | undefined,
) {
  const dirId = directoryId ?? context.activeDirectoryId;
  return context.directoriesById[dirId];
}

export type DirectoryId = $Branded<string, "DirectoryId">;

// Helper function to compute filtered directory data
function computeFilteredData(
  directoryData: GetFilesAndFoldersInDirectoryItem[],
  query: string,
): GetFilesAndFoldersInDirectoryItem[] {
  if (!query) return directoryData;

  const fuse = new Fuse(directoryData, {
    threshold: 0.3,
    minMatchCharLength: 1,
    keys: ["name"],
    shouldSort: true,
    isCaseSensitive: false,
  });

  const results = fuse.search(query);
  return results.map((result) => result.item);
}

type DirectoryContextDirectory = {
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
};

type DirectoryContext = {
  directoriesById: { [id: DirectoryId]: DirectoryContextDirectory };
  directoryOrder: DirectoryId[];
  activeDirectoryId: DirectoryId;
};

function updateDirectory(
  context: DirectoryContext,
  directoryId: DirectoryId | undefined,
  fn: (d: DirectoryContextDirectory) => DirectoryContextDirectory,
  needsUpdate?: (d: DirectoryContextDirectory) => boolean,
) {
  const activeDirectory = getActiveDirectory(context, directoryId);
  if (directoryId && !activeDirectory) return context;

  if (needsUpdate && !needsUpdate(activeDirectory)) return context;

  const newItem = fn(activeDirectory);
  return {
    ...context,
    directoriesById: {
      ...context.directoriesById,
      [activeDirectory.directoryId]: newItem,
    },
  };
}

const dummyDirectoryId = "dummmyy" as DirectoryId; // kimse dokunmadan initialize edilmeli zaten

export const directoryStore = createStore({
  context: {
    directoriesById: {
      [dummyDirectoryId]: {
        directoryId: dummyDirectoryId,
        directory: { color: "red", type: "tags" },
        loading: false,
        directoryData: [] as GetFilesAndFoldersInDirectoryItem[],
        error: undefined as string | undefined,
        historyStack: new HistoryStack<DirectoryInfo>([
          { color: "red", type: "tags" },
        ]),
        pendingSelection: null as string | null,
        // Selection state
        selection: {
          indexes: new Set<number>(),
          last: undefined as number | undefined,
        },
        // Fuzzy finder state
        fuzzyQuery: "",
      },
    },
    directoryOrder: [dummyDirectoryId],
    activeDirectoryId: dummyDirectoryId,
  } as DirectoryContext,
  emits: {
    focusFuzzyInput: (_: { e: KeyboardEvent; directoryId: DirectoryId }) => {},
    directoryCreated: (_: { directoryId: DirectoryId; tabId?: string }) => {},
  },
  on: {
    focusFuzzyInput: (context, event: { e: KeyboardEvent }, enqueue) => {
      enqueue.emit.focusFuzzyInput({
        e: event.e,
        directoryId: context.activeDirectoryId,
      });
      return context;
    },
    setDirectoryData: (
      context,
      event: {
        data: GetFilesAndFoldersInDirectoryItem[];
        directoryId: DirectoryId;
      },
    ) =>
      updateDirectory(context, event.directoryId, (d) => ({
        ...d,
        directoryData: event.data,
        error: undefined,
      })),

    setDirectory: (
      context,
      event: { directory: DirectoryInfo; directoryId: DirectoryId },
    ) =>
      updateDirectory(context, event.directoryId, (d) => ({
        ...d,
        directory: event.directory,
      })),

    historyGoNew: (
      context,
      event: { directory: DirectoryInfo; directoryId: DirectoryId },
    ) =>
      updateDirectory(context, event.directoryId, (d) => {
        d.historyStack.goNew(event.directory);
        return d;
      }),

    historyGoNext: (context, event: { directoryId: DirectoryId }) =>
      updateDirectory(context, event.directoryId, (d) => {
        const nextDir = d.historyStack.goNext();
        return {
          ...d,
          directory: nextDir,
        };
      }),

    historyGoPrev: (context, event: { directoryId: DirectoryId }) =>
      updateDirectory(context, event.directoryId, (d) => {
        const prevDir = d.historyStack.goPrev();
        return {
          ...d,
          directory: prevDir,
        };
      }),

    setPendingSelection: (
      context,
      event: { name: string | null; directoryId: DirectoryId },
    ) =>
      updateDirectory(context, event.directoryId, (d) => ({
        ...d,
        pendingSelection: event.name,
      })),

    setSelection: (
      context,
      event: { indexes: Set<number>; last?: number; directoryId: DirectoryId },
    ) =>
      updateDirectory(context, event.directoryId, (d) => ({
        ...d,
        selection: {
          indexes: event.indexes,
          last: event.last,
        },
      })),

    resetSelection: (context, event: { directoryId: DirectoryId }) =>
      updateDirectory(context, event.directoryId, (d) => ({
        ...d,
        selection: {
          indexes: new Set<number>(),
          last: undefined,
        },
      })),

    selectManually: (
      context,
      event: {
        index: number;
        directoryId: DirectoryId;
        dontTouchWhenSelected?: boolean;
      },
    ) => {
      return updateDirectory(
        context,
        event.directoryId,
        (d) => ({
          ...d,
          selection: {
            indexes: new Set([event.index]),
            last: event.index,
          },
        }),
        (d) => !d.selection.indexes.has(event.index),
      );
    },
    // Fuzzy finder events
    setFuzzyQuery: (
      context,
      event: { query: string; directoryId: DirectoryId },
    ) =>
      updateDirectory(context, event.directoryId, (d) => ({
        ...d,
        fuzzyQuery: event.query,
        selection: event.query
          ? {
              indexes: new Set([0]),
              last: 0,
            }
          : d.selection,
      })),
    clearFuzzyQuery: (context, event: { directoryId: DirectoryId }) =>
      updateDirectory(context, event.directoryId, (d) => ({
        ...d,
        fuzzyQuery: "",
      })),
    setActiveDirectoryId: (context, event: { directoryId: DirectoryId }) => {
      if (context.activeDirectoryId === event.directoryId) return context;
      return {
        ...context,
        activeDirectoryId: event.directoryId,
      };
    },
    createDirectory: (
      context,
      event: { tabId?: string; fullPath?: string },
      enqueue,
    ) => {
      const directoryId = Math.random().toString(36).slice(2) as DirectoryId;

      enqueue.emit.directoryCreated({
        directoryId,
        tabId: event.tabId,
      });

      setupSubscriptions(directoryId);
      const directory: DirectoryInfo = event.fullPath
        ? { type: "path", fullPath: event.fullPath }
        : initialDirectoryInfo;
      loadDirectoryPath(event.fullPath ?? defaultPath, directoryId);

      return {
        ...context,
        directoriesById: {
          ...context.directoriesById,
          [directoryId]: {
            directoryId,
            directory,
            loading: false,
            directoryData: [] as GetFilesAndFoldersInDirectoryItem[],
            error: undefined as string | undefined,
            historyStack: new HistoryStack<DirectoryInfo>([directory]),
            pendingSelection: null as string | null,
            // Selection state
            selection: {
              indexes: new Set<number>(),
              last: undefined as number | undefined,
            },
            // Fuzzy finder state
            fuzzyQuery: "",
          },
        },
        directoryOrder: [...context.directoryOrder, directoryId],
      };
    },
    removeDirectory: (context, event: { directoryId: DirectoryId }) => {
      const newItemOrder = context.directoryOrder.filter(
        (id) => id !== event.directoryId,
      );
      if (newItemOrder.length === context.directoryOrder.length) return context;

      delete context.directoriesById[event.directoryId];
      unsubscribeDirectorySubscriptions(event.directoryId);
      return {
        ...context,
        directoriesById: {
          ...context.directoriesById,
        },
        directoryOrder: newItemOrder,
      };
    },

    onDirectoriesMayHaveBeenRemoved: (
      context,
      event: { directoryIds: DirectoryId[] },
    ) => {
      const newItemOrder = context.directoryOrder.filter(
        (id) => !event.directoryIds.includes(id),
      );
      if (newItemOrder.length === event.directoryIds.length) return context;
      for (const directoryId of event.directoryIds) {
        delete context.directoriesById[directoryId];
        unsubscribeDirectorySubscriptions(directoryId);
      }
      return {
        ...context,
        directoriesById: {
          ...context.directoriesById,
        },
        directoryOrder: newItemOrder,
      };
    },
    initDirectories: (
      _,
      event: {
        directories: (DirectoryInfo & { id: string })[];
        activeDirectoryId: string;
      },
    ) => {
      const result: DirectoryContext = {
        directoriesById: event.directories.reduce(
          (acc, directory) => {
            const directoryId = directory.id as DirectoryId;
            acc[directoryId] = {
              directoryId,
              directory: directory,
              loading: false,
              directoryData: [] as GetFilesAndFoldersInDirectoryItem[],
              error: undefined as string | undefined,
              historyStack: new HistoryStack<DirectoryInfo>([directory]),
              pendingSelection: null as string | null,
              // Selection state
              selection: {
                indexes: new Set<number>(),
                last: undefined as number | undefined,
              },
              // Fuzzy finder state
              fuzzyQuery: "",
            };
            return acc;
          },
          {} as Record<DirectoryId, DirectoryContextDirectory>,
        ),
        directoryOrder: event.directories.map((d) => d.id as DirectoryId),
        activeDirectoryId: event.activeDirectoryId as DirectoryId,
      };
      for (const directory of event.directories) {
        const directoryId = directory.id as DirectoryId;
        setupSubscriptions(directoryId);
        loadDirectoryInfo(directory, directoryId);
      }
      return result;
    },
  },
});

const loadDirectoryPath = async (dir: string, directoryId: DirectoryId) => {
  try {
    const result = await FileBrowserCache.load(dir);

    result.sort((a, b) => {
      if (a.type === "dir" && b.type === "dir") return 0;
      if (a.type === "dir") return -1;
      if (b.type === "dir") return 1;
      return a.name.localeCompare(b.name);
    });

    directoryStore.send({
      type: "setDirectoryData",
      data: result,
      directoryId,
    });
    return result;
  } catch (e) {
    toast.show({
      message: errorToString(e),
      severity: "error",
    });
  } finally {
  }
};

const loadTaggedFiles = async (color: TagColor, directoryId: DirectoryId) => {
  const getFilesWithTag = (color: TagColor) =>
    Object.entries(tagsStore.get().context.fileTags)
      .filter(([_, tags]) => tags.includes(color))
      .map(([path]) => path);

  try {
    const filePaths = getFilesWithTag(color);
    if (filePaths.length === 0) {
      directoryStore.send({ type: "setDirectoryData", data: [], directoryId });
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
    directoryStore.send({
      type: "setDirectoryData",
      data: result,
      directoryId,
    });
    return result;
  } catch (e) {
    toast.show({
      message: errorToString(e),
      severity: "error",
    });
  } finally {
  }
};

const loadDirectoryInfo = async (
  info: DirectoryInfo,
  directoryId: DirectoryId,
) => {
  if (info.type === "path") {
    return loadDirectoryPath(info.fullPath, directoryId);
  } else {
    return loadTaggedFiles(info.color, directoryId);
  }
};

const cd = async (
  newDirectory: DirectoryInfo,
  isNew: boolean,
  directoryId: DirectoryId,
) => {
  const context = getActiveDirectory(
    directoryStore.getSnapshot().context,
    directoryId,
  );
  if (directoryInfoEquals(newDirectory, context.directory)) return;
  if (isNew)
    directoryStore.send({
      type: "historyGoNew",
      directory: newDirectory,
      directoryId,
    });
  directoryStore.send({
    type: "setDirectory",
    directory: newDirectory,
    directoryId,
  });
  if (newDirectory.type === "path") {
    recentsStore.send({
      type: "addRecent",
      item: { fullPath: newDirectory.fullPath, type: "dir" },
    });
  }
  return loadDirectoryInfo(newDirectory, directoryId);
};

const preloadDirectory = (dir: string) => {
  return FileBrowserCache.load(dir);
};

const getFullPath = (dir: string, directoryId: DirectoryId) => {
  const context = getActiveDirectory(
    directoryStore.getSnapshot().context,
    directoryId,
  );
  if (context.directory.type === "path") {
    return mergeMaybeSlashed(context.directory.fullPath, dir);
  }
  // For tags view, we cannot merge paths
  return dir;
};

const getFullPathForItem = (
  item: GetFilesAndFoldersInDirectoryItem,
  directoryId: DirectoryId,
) => {
  return item.fullPath ?? getFullPath(item.name, directoryId);
};

const cdWithMetadata = async (
  newDirectory: DirectoryInfo,
  isNew: boolean,
  directoryId: DirectoryId,
) => {
  const context = getActiveDirectory(
    directoryStore.getSnapshot().context,
    directoryId,
  );
  const beforeNavigation = context.directory;
  const directoryData = await cd(newDirectory, isNew, directoryId);
  const settings = selectSettingsFromStore(fileBrowserSettingsStore.get());
  return {
    directoryData:
      directoryData &&
      DirectoryDataFromSettings.getDirectoryData(directoryData, settings),
    beforeNavigation,
  };
};

const changeDirectory = async (
  newDirectory: string,
  directoryId: DirectoryId,
) => {
  cd(
    {
      type: "path",
      fullPath: getFullPath(newDirectory, directoryId),
    },
    true,
    directoryId,
  );
};

const openFileFull = (fullPath: string) =>
  getWindowElectron().openFile(fullPath);
const openFile = (filePath: string, directoryId: DirectoryId) =>
  openFileFull(getFullPath(filePath, directoryId));

type ReturnOfGoPrev = Promise<
  | {
      directoryData: GetFilesAndFoldersInDirectoryItem[] | undefined;
      beforeNavigation: DirectoryInfo;
    }
  | undefined
>;

// Helper functions
export const directoryHelpers = {
  createNewItem: async (
    name: string,
    directoryId: DirectoryId,
  ): Promise<ResultHandlerResult> => {
    const context = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    if (context.directory.type !== "path") {
      return GenericError.Message("Cannot create items in tags view");
    }

    try {
      const result = await getWindowElectron().createFileOrFolder(
        context.directory.fullPath,
        name,
      );
      if (result.success) {
        await loadDirectoryInfo(context.directory, directoryId);
        // Emit itemCreated event to set pending selection
        const itemName = name.endsWith("/") ? name.slice(0, -1) : name;
        directoryStore.send({
          type: "setPendingSelection",
          name: itemName,
          directoryId,
        });
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
    directoryId: DirectoryId,
  ): Promise<ResultHandlerResult> => {
    try {
      if (!item) throw new Error("No item selected");
      const oldPath =
        item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId);
      const result = await getWindowElectron().renameFileOrFolder(
        oldPath,
        newName,
      );
      if (result.success) {
        const context = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        await loadDirectoryInfo(context.directory, directoryId);
        // Emit itemRenamed event to set pending selection
        directoryStore.send({
          type: "setPendingSelection",
          name: newName,
          directoryId,
        });
      }
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      return GenericError.Message(errorMessage);
    }
  },

  setPendingSelection: (name: string | null, directoryId: DirectoryId) => {
    directoryStore.send({ type: "setPendingSelection", name, directoryId });
  },

  changeDirectory,

  cd: (dir: DirectoryInfo, directoryId: DirectoryId) =>
    cd(dir, true, directoryId),

  cdFull: (fullPath: string, directoryId: DirectoryId) => {
    return cd({ type: "path", fullPath }, true, directoryId);
  },

  showTaggedFiles: (color: TagColor, directoryId: DirectoryId) => {
    return cd({ type: "tags", color }, true, directoryId);
  },

  goNext: async (directoryId: DirectoryId) => {
    const context = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    if (!context.historyStack.hasNext) return;
    const beforeNavigation = context.directory;
    directoryStore.send({ type: "historyGoNext", directoryId });
    const newContext = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    const directoryData = await loadDirectoryInfo(
      newContext.directory,
      directoryId,
    );
    const settings = selectSettingsFromStore(fileBrowserSettingsStore.get());
    return {
      directoryData:
        directoryData &&
        DirectoryDataFromSettings.getDirectoryData(directoryData, settings),
      beforeNavigation,
    };
  },

  goPrev: async (directoryId: DirectoryId) => {
    const context = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    if (!context.historyStack.hasPrev) return;
    const beforeNavigation = context.directory;
    directoryStore.send({ type: "historyGoPrev", directoryId });
    const newContext = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    const directoryData = await loadDirectoryInfo(
      newContext.directory,
      directoryId,
    );
    const settings = selectSettingsFromStore(fileBrowserSettingsStore.get());
    return {
      directoryData:
        directoryData &&
        DirectoryDataFromSettings.getDirectoryData(directoryData, settings),
      beforeNavigation,
    };
  },

  goUp: async (directoryId: DirectoryId) => {
    const context = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    const directory = context.directory;
    // goUp only makes sense when in a path directory
    if (directory.type !== "path") return;

    const info: DirectoryInfo = {
      type: "path",
      fullPath: PathHelpers.resolveUpDirectory(
        getWindowElectron().homeDirectory,
        directory.fullPath,
      ),
    };
    return await cdWithMetadata(info, true, directoryId);
  },

  toggleShowDotFiles: fileBrowserSettingsHelpers.toggleShowDotFiles,
  toggleFoldersOnTop: fileBrowserSettingsHelpers.toggleFoldersOnTop,
  setFileTypeFilter: fileBrowserSettingsHelpers.setFileTypeFilter,

  openFile,

  getFullPath,

  preloadDirectory,

  setSettings: fileBrowserSettingsHelpers.setSettings,
  setSort: fileBrowserSettingsHelpers.setSort,

  reload: (directoryId: DirectoryId) => {
    const context = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    return loadDirectoryInfo(context.directory, directoryId);
  },

  openItem: (
    item: GetFilesAndFoldersInDirectoryItem,
    directoryId: DirectoryId,
  ) => {
    if (item.type === "dir") {
      // If we have a fullPath (from tags view), use it directly
      if (item.fullPath) {
        cd({ type: "path", fullPath: item.fullPath }, true, directoryId);
      } else {
        changeDirectory(item.name, directoryId);
      }
    } else {
      const fullPath = item.fullPath || getFullPath(item.name, directoryId);
      recentsStore.send({
        type: "addRecent",
        item: { fullPath, type: "file" },
      });
      openFileFull(fullPath);
    }
  },

  openFileFull,

  openItemFull: (
    item: { type: "dir" | "file"; fullPath: string },
    directoryId: DirectoryId,
  ) => {
    if (item.type === "dir") {
      directoryHelpers.cdFull(item.fullPath, directoryId);
    } else {
      directoryHelpers.openFileFull(item.fullPath);
    }
  },

  // Selection helpers
  select: (
    index: number,
    event: React.MouseEvent | KeyboardEvent,
    directoryId: DirectoryId,
  ) => {
    const state = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );

    // Helper to remove item from set
    const removeFromSet = (set: Set<number>, item: number) => {
      const newSet = new Set(set);
      newSet.delete(item);
      return newSet;
    };

    const isShiftEvent =
      event.shiftKey &&
      (!("key" in event) || (event.key !== "G" && event.key !== "g"));
    if (isShiftEvent && state.selection.last != null) {
      const lastSelected = state.selection.last;
      const indexes = new Set(state.selection.indexes);

      if (lastSelected > index) {
        let allSelected = true;
        for (let i = lastSelected - 1; i >= index; i--) {
          if (!indexes.has(i)) {
            allSelected = false;
            break;
          }
        }

        if (allSelected) {
          for (let i = lastSelected - 1; i >= index; i--) {
            indexes.delete(i);
          }
        } else {
          for (let i = lastSelected - 1; i >= index; i--) {
            indexes.add(i);
          }
        }
      } else {
        let allSelected = true;
        for (let i = lastSelected + 1; i <= index; i++) {
          if (!indexes.has(i)) {
            allSelected = false;
            break;
          }
        }

        if (allSelected) {
          for (let i = lastSelected + 1; i <= index; i++) {
            indexes.delete(i);
          }
        } else {
          for (let i = lastSelected + 1; i <= index; i++) {
            indexes.add(i);
          }
        }
      }

      directoryStore.send({
        type: "setSelection",
        indexes,
        last: index,
        directoryId,
      });
      return;
    }

    const isCtrlEvent =
      (event.ctrlKey || event.metaKey) &&
      (!("key" in event) || (event.key !== "u" && event.key !== "d"));
    if (isCtrlEvent) {
      if (state.selection.indexes.has(index)) {
        directoryStore.send({
          type: "setSelection",
          indexes: removeFromSet(state.selection.indexes, index),
          last: index,
          directoryId,
        });
        return;
      }
      directoryStore.send({
        type: "setSelection",
        indexes: new Set([...state.selection.indexes, index]),
        last: index,
        directoryId,
      });
      return;
    }

    directoryStore.send({
      type: "setSelection",
      indexes: new Set([index]),
      last: index,
      directoryId,
    });
  },

  getSelectionShortcuts: (
    count: number,
    directoryId: DirectoryId,
  ): ShortcutInput[] => [
    {
      key: [{ key: "a", metaKey: true }],
      handler: (e: KeyboardEvent) => {
        directoryStore.send({
          type: "setSelection",
          indexes: new Set(Array.from({ length: count }).map((_, i) => i)),
          last: count - 1,
          directoryId,
        });
        e.preventDefault();
      },
    },
    {
      key: ["ArrowUp", "k", "K"],
      handler: (e: KeyboardEvent) => {
        const state = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        const lastSelected = state.selection.last ?? 0;
        if (state.selection.indexes.has(lastSelected - 1)) {
          const newSet = new Set(state.selection.indexes);
          newSet.delete(lastSelected);
          directoryStore.send({
            type: "setSelection",
            indexes: newSet,
            last: lastSelected - 1,
            directoryId,
          });
        } else {
          if (lastSelected - 1 < 0) {
            directoryHelpers.select(count - 1, e, directoryId);
          } else {
            directoryHelpers.select(lastSelected - 1, e, directoryId);
          }
        }
        e.preventDefault();
      },
    },
    {
      key: ["ArrowDown", "j", "J"],
      handler: (e: KeyboardEvent) => {
        const state = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        const lastSelected = state.selection.last ?? 0;
        if (state.selection.indexes.has(lastSelected + 1)) {
          const newSet = new Set(state.selection.indexes);
          newSet.delete(lastSelected);
          directoryStore.send({
            type: "setSelection",
            indexes: newSet,
            last: lastSelected + 1,
            directoryId,
          });
        } else {
          if (lastSelected + 1 === count) {
            directoryHelpers.select(0, e, directoryId);
          } else {
            directoryHelpers.select(lastSelected + 1, e, directoryId);
          }
        }
        e.preventDefault();
      },
    },
    {
      key: "ArrowLeft",
      handler: (e: KeyboardEvent) => {
        const state = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        const lastSelected = state.selection.last ?? 0;
        directoryHelpers.select(lastSelected - 10, e, directoryId);
        e.preventDefault();
      },
    },
    {
      key: "ArrowRight",
      handler: (e: KeyboardEvent) => {
        const state = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        const lastSelected = state.selection.last ?? 0;
        directoryHelpers.select(lastSelected + 10, e, directoryId);
        e.preventDefault();
      },
    },
    {
      key: "G",
      handler: (e: KeyboardEvent) => {
        // Go to the bottom (like vim G)
        directoryHelpers.select(count - 1, e, directoryId);
        e.preventDefault();
      },
    },
    {
      // Go to the top (like vim gg)
      sequence: ["g", "g"],
      handler: (e: KeyboardEvent) => {
        directoryHelpers.select(0, e, directoryId);
        e.preventDefault();
      },
    },
    {
      key: { key: "d", ctrlKey: true },
      handler: (e: KeyboardEvent) => {
        const state = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        const lastSelected = state.selection.last ?? 0;
        directoryHelpers.select(
          Math.min(lastSelected + 10, count - 1),
          e,
          directoryId,
        );
        e.preventDefault();
      },
    },
    {
      key: { key: "u", ctrlKey: true },
      handler: (e: KeyboardEvent) => {
        const state = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        const lastSelected = state.selection.last ?? 0;
        directoryHelpers.select(Math.max(lastSelected - 10, 0), e, directoryId);
        e.preventDefault();
      },
    },
  ],

  resetSelection: (directoryId: DirectoryId) => {
    directoryStore.send({ type: "resetSelection", directoryId });
  },

  isSelected: (index: number, directoryId: DirectoryId) => {
    const state = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    return state.selection.indexes.has(index);
  },

  selectManually: (index: number, directoryId: DirectoryId) => {
    directoryStore.send({ type: "selectManually", index, directoryId });
  },

  setSelection: (
    h: number | ((s: number) => number),
    directoryId: DirectoryId,
  ) => {
    const state = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    let newSelection: number;
    if (state.selection.indexes.size === 0) {
      newSelection = typeof h === "number" ? h : h(0);
    } else if (state.selection.indexes.size === 1) {
      newSelection = typeof h === "number" ? h : h(state.selection.last!);
    } else {
      newSelection = typeof h === "number" ? h : h(state.selection.last!);
    }
    directoryStore.send({
      type: "setSelection",
      indexes: new Set([newSelection]),
      last: newSelection,
      directoryId,
    });
  },

  handleCopy: async (
    items: GetFilesAndFoldersInDirectoryItem[],
    cut: boolean = false,
    directoryId: DirectoryId,
  ) => {
    const paths = items.map(
      (item) =>
        item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId),
    );
    const result = await getWindowElectron().copyFiles(paths, cut);
    if (!result.success) {
      toast.show(result);
    }
  },

  handlePaste: async (directoryId: DirectoryId) => {
    const context = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    if (context.directory.type !== "path") {
      toast.show(GenericError.Message("Cannot paste in tags view"));
      return;
    }
    const result = await getWindowElectron().pasteFiles(
      context.directory.fullPath,
    );
    if (result.success) {
      await directoryHelpers.reload(directoryId);
      // Select the first pasted item
      if (result.data?.pastedItems && result.data.pastedItems.length > 0) {
        directoryHelpers.setPendingSelection(
          result.data.pastedItems[0],
          directoryId,
        );
      }
    } else {
      toast.show(result);
    }
  },

  handleDelete: async (
    items: GetFilesAndFoldersInDirectoryItem[],
    tableData: GetFilesAndFoldersInDirectoryItem[],
    directoryId: DirectoryId,
  ) => {
    const paths = items.map(
      (item) =>
        item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId),
    );
    const deletedNames = new Set(items.map((item) => item.name));

    // Find the smallest index among items being deleted
    const deletedIndexes = items
      .map((item) => tableData.findIndex((d) => d.name === item.name))
      .filter((idx) => idx !== -1)
      .sort((a, b) => a - b);
    const smallestDeletedIndex = deletedIndexes[0] ?? 0;

    const message =
      items.length === 1
        ? `Are you sure you want to delete "${items[0].name}"?`
        : `Are you sure you want to delete ${items.length} items?`;

    confirmation.confirm({
      title: "Confirm Delete",
      message,
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          // Delete all selected files/folders
          const result = await getWindowElectron().deleteFiles(paths);

          if (!result.success) {
            toast.show(result);
            return;
          }

          // Remove from favorites if they were favorited
          paths.forEach((path) => {
            if (selectIsFavorite(path)(favoritesStore.get())) {
              favoritesStore.send({ type: "removeFavorite", fullPath: path });
            }
          });

          // Reload the directory without affecting history
          await directoryHelpers.reload(directoryId);

          // Select the nearest item (prefer top, fallback to bottom)
          const remainingItems = tableData.filter(
            (item) => !deletedNames.has(item.name),
          );
          if (remainingItems.length > 0) {
            // Find the item that should now be at or near the smallest deleted index
            const newIndex = Math.min(
              smallestDeletedIndex,
              remainingItems.length - 1,
            );
            const itemToSelect = remainingItems[newIndex];
            directoryHelpers.setPendingSelection(
              itemToSelect.name,
              directoryId,
            );
          } else {
            directoryStore.send({ type: "resetSelection", directoryId });
          }
        } catch (error) {
          console.error("Error deleting files:", error);
          toast.show({
            severity: "error",
            message:
              error instanceof Error ? error.message : "Error deleting files",
          });
        }
      },
    });
  },

  onGoUpOrPrev: async (
    fn: (directoryId: DirectoryId) => ReturnOfGoPrev,
    directoryId: DirectoryId,
  ) => {
    const metadata = await fn(directoryId);
    if (!metadata) return;
    const { directoryData, beforeNavigation } = metadata;

    setTimeout(() => {
      if (!directoryData) return;
      if (beforeNavigation.type !== "path") return;
      const beforeNavigationName = PathHelpers.getLastPathPart(
        beforeNavigation.fullPath,
      );
      const idx = directoryData.findIndex(
        (i) => i.name === beforeNavigationName,
      );
      if (idx === -1) return;
      directoryHelpers.selectManually(idx, directoryId);
    }, 5);
  },

  openSelectedItem: (
    data: GetFilesAndFoldersInDirectoryItem[],
    e: KeyboardEvent | undefined,
    directoryId: DirectoryId,
  ) => {
    const context = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    const lastSelected = context.selection.last;
    const selectionIndexes = context.selection.indexes;
    function resolveItemToOpen() {
      if (lastSelected == null || selectionIndexes.size !== 1) {
        return data[0];
      } else {
        return data[lastSelected];
      }
    }

    const itemToOpen = resolveItemToOpen();
    if (itemToOpen.type === "file" && e?.key === "l") return;

    // if ((e.target as HTMLInputElement).id === "fuzzy-finder-input") {
    //   fuzzy.clearQuery();
    //   tableRef.current?.querySelector("tbody")?.focus();
    // }
    directoryHelpers.openItem(itemToOpen, directoryId);
  },

  openAssignTagsDialog: (
    fullPath: string,
    data: GetFilesAndFoldersInDirectoryItem[],
    directoryId: DirectoryId,
  ) => {
    const indexes = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    ).selection.indexes;
    const selectedIndexes = [...indexes.values()];
    const selectedItems = selectedIndexes.map((i) => {
      const item = data[i];
      return (
        item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId)
      );
    });
    if (selectedItems.length > 1) {
      // Multiple files selected - use grid dialog
      dialogActions.open("multiFileTags", selectedItems);
    } else {
      // Single file - use standard dialog
      dialogActions.open("assignTags", fullPath);
    }
  },

  // Fuzzy finder helpers
  setFuzzyQuery: (query: string, directoryId: DirectoryId) => {
    directoryStore.send({ type: "setFuzzyQuery", query, directoryId });
  },

  clearFuzzyQuery: (directoryId: DirectoryId) => {
    directoryStore.send({ type: "clearFuzzyQuery", directoryId });
  },
  getFullPathForItem,
  getSelectedItemsOrCurrentItem(index: number, directoryId: DirectoryId) {
    const context = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    const selection = context.selection;
    const tableData = directoryDerivedStores
      .get(directoryId)
      ?.getFilteredDirectoryData()!;
    const item = tableData[index];

    const alreadySelected = selection.indexes.has(index);
    return alreadySelected
      ? [...selection.indexes].map((i) => tableData[i])
      : [item];
  },

  openInNewTab: (
    item: GetFilesAndFoldersInDirectoryItem,
    currentDirectoryId: DirectoryId,
  ) => {
    // Create a new directory tab
    // We'll emit an event that FlexLayoutManager can listen to
    directoryStore.trigger.createDirectory({ tabId: "DIRECTORY_TABSET" });

    // Wait a bit for the new directory to be created
    setTimeout(() => {
      const newSnapshot = directoryStore.getSnapshot();
      const newDirectoryIds = newSnapshot.context.directoryOrder;
      const newDirectoryId = newDirectoryIds[newDirectoryIds.length - 1];

      if (item.type === "dir") {
        // Open the folder in the new tab
        const fullPath =
          item.fullPath ?? getFullPath(item.name, currentDirectoryId);
        directoryHelpers.cdFull(fullPath, newDirectoryId);
      } else {
        // For files, open the containing folder in the new tab
        const fullPath =
          item.fullPath ?? getFullPath(item.name, currentDirectoryId);
        const containingFolder = PathHelpers.resolveUpDirectory(
          getWindowElectron().homeDirectory,
          fullPath,
        );
        directoryHelpers.cdFull(containingFolder, newDirectoryId);

        // Select the file in the new tab
        setTimeout(() => {
          directoryStore.send({
            type: "setPendingSelection",
            name: item.name,
            directoryId: newDirectoryId,
          });
        }, 100);
      }
    }, 50);
  },

  isDirectoryId: (id: $Maybe<string>) => {
    return id && id.startsWith("dir-");
  },

  openFolderInNewTab: (
    item: GetFilesAndFoldersInDirectoryItem,
    directoryId: DirectoryId,
  ) => {
    if (item.type !== "dir") return;

    const fullPath = getFullPath(item.name, directoryId);
    directoryStore.trigger.createDirectory({
      fullPath: fullPath,
    });
  },
  openContainingFolderInNewTab: (
    item: GetFilesAndFoldersInDirectoryItem,
    directoryId: DirectoryId,
  ) => {
    const fullPath = getFullPath(item.name, directoryId);
    directoryStore.trigger.createDirectory({
      fullPath: PathHelpers.resolveUpDirectory(
        getWindowElectron().homeDirectory,
        PathHelpers.getParentFolder(fullPath).path,
      ),
    });
  },
};

// Selectors
export const selectDirectory =
  (directoryId: DirectoryId | undefined) =>
  (state: StoreSnapshot<DirectoryContext>) =>
    getActiveDirectory(state.context, directoryId).directory;

export const selectLoading =
  (directoryId: DirectoryId | undefined) =>
  (state: StoreSnapshot<DirectoryContext>) =>
    getActiveDirectory(state.context, directoryId).loading;

export const selectRawDirectoryData =
  (directoryId: DirectoryId | undefined) =>
  (state: StoreSnapshot<DirectoryContext>) =>
    getActiveDirectory(state.context, directoryId).directoryData;

export const selectHasNext =
  (directoryId: DirectoryId | undefined) =>
  (state: StoreSnapshot<DirectoryContext>) =>
    getActiveDirectory(state.context, directoryId).historyStack.hasNext;

export const selectHasPrev =
  (directoryId: DirectoryId | undefined) =>
  (state: StoreSnapshot<DirectoryContext>) =>
    getActiveDirectory(state.context, directoryId).historyStack.hasPrev;

export const selectSettings = (): FileBrowserSettings => {
  return selectSettingsFromStore(fileBrowserSettingsStore.get());
};

export const selectPendingSelection =
  (directoryId: DirectoryId | undefined) =>
  (state: StoreSnapshot<DirectoryContext>) =>
    getActiveDirectory(state.context, directoryId).pendingSelection;

export const selectSelection =
  (directoryId: DirectoryId | undefined) =>
  (state: StoreSnapshot<DirectoryContext>) =>
    getActiveDirectory(state.context, directoryId).selection;

export const selectFuzzyQuery =
  (directoryId: DirectoryId | undefined) =>
  (state: StoreSnapshot<DirectoryContext>) =>
    getActiveDirectory(state.context, directoryId).fuzzyQuery;

export const directorySubscriptions = new Map<DirectoryId, (() => void)[]>();

export const directoryDerivedStores = new Map<
  DirectoryId,
  {
    useFilteredDirectoryData: () => GetFilesAndFoldersInDirectoryItem[];
    getFilteredDirectoryData: () =>
      | GetFilesAndFoldersInDirectoryItem[]
      | undefined;
  }
>();

function setupSubscriptions(directoryId: DirectoryId) {
  const subscriptions: (() => void)[] = [];
  directorySubscriptions.set(directoryId, subscriptions);
  subscriptions.push(
    subscribeToStores(
      [directoryStore],
      ([s]) => [s.directoriesById[directoryId]?.directoryData],
      (_) => {
        directoryHelpers.resetSelection(directoryId);
      },
    ),
  );

  subscriptions.push(
    subscribeToStores(
      [directoryStore],
      ([s]) => [s.directoriesById[directoryId]?.selection.last],
      ([s]) => {
        const ss = s.directoriesById[directoryId];
        if (!ss) return;
        if (ss.selection.last != null) {
          scrollRowIntoViewIfNeeded(ss.directoryId, ss.selection.last);
        }
      },
    ),
  );

  const [useFilteredDirectoryData, getFilteredDirectoryData] =
    createUseDerivedStoreValue(
      [directoryStore, fileBrowserSettingsStore],
      ([d, settings]) => [
        d.directoriesById[directoryId]?.directoryData,
        settings.settings,
        d.directoriesById[directoryId]?.fuzzyQuery,
      ],
      ([d, settings]) => {
        const directoryData = DirectoryDataFromSettings.getDirectoryData(
          d.directoriesById[directoryId]?.directoryData,
          settings.settings,
        );
        const filteredDirectoryData = computeFilteredData(
          directoryData,
          d.directoriesById[directoryId]?.fuzzyQuery,
        );

        return filteredDirectoryData;
      },
    );

  directoryDerivedStores.set(directoryId, {
    useFilteredDirectoryData,
    getFilteredDirectoryData,
  });

  // DO NOT MOVE THIS FUNCTION, Terrible code!!!
  subscriptions.push(
    subscribeToStores(
      [directoryStore, fileBrowserSettingsStore],
      ([d, settings]) => [
        d.directoriesById[directoryId]?.pendingSelection,
        settings.settings,
      ],
      ([d]) => {
        const filteredDirectoryData = getFilteredDirectoryData();
        if (!filteredDirectoryData) return;
        const s = d.directoriesById[directoryId];
        if (s.pendingSelection && filteredDirectoryData.length > 0) {
          const newItemIndex = filteredDirectoryData.findIndex(
            (item) => item.name === s.pendingSelection,
          );
          if (newItemIndex !== -1) {
            directoryHelpers.selectManually(newItemIndex, directoryId);
            scrollRowIntoViewIfNeeded(s.directoryId, newItemIndex, "center");
          }
          directoryHelpers.setPendingSelection(null, directoryId);
        }
      },
    ),
  );

  return subscriptions;
}

const unsubscribeDirectorySubscriptions = (directoryId: DirectoryId) => {
  const subscriptions = directorySubscriptions.get(directoryId);
  if (!subscriptions) return;
  subscriptions.forEach((unsubscribe) => unsubscribe());
  directorySubscriptions.delete(directoryId);
};
