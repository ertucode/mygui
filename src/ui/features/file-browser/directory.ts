import { createStore } from "@xstate/store";
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
import { defaultPath } from "./defaultPath";
import { toast } from "@/lib/components/toast";
import { confirmation } from "@/lib/hooks/useConfirmation";
import { favoritesStore, selectIsFavorite } from "./favorites";
import { dialogActions } from "./dialogStore";
import { subscribeToStore } from "@/lib/functions/storeHelpers";
import { scrollRowIntoViewIfNeeded } from "@/lib/libs/table/globalTableScroll";
import { FileBrowserCache } from "./FileBrowserCache";

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

function getFolderNameParts(dir: string) {
  return dir.split("/").filter(Boolean);
}

export type TaggedFilesGetter = (color: TagColor) => string[];

const initialDirectoryInfo = getDirectoryInfo(defaultPath);

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

export const directoryStore = createStore({
  context: {
    directoryId: "file-browser-table",
    directory: initialDirectoryInfo,
    loading: false,
    directoryData: [] as GetFilesAndFoldersInDirectoryItem[],
    filteredDirectoryData: [] as GetFilesAndFoldersInDirectoryItem[],
    error: undefined as string | undefined,
    historyStack: new HistoryStack<DirectoryInfo>([initialDirectoryInfo]),
    pendingSelection: null as string | null,
    // Selection state
    selection: {
      indexes: new Set<number>(),
      last: undefined as number | undefined,
    },
    // Fuzzy finder state
    fuzzyQuery: "",
  },
  emits: {
    focusFuzzyInput: (_: { e: KeyboardEvent }) => {},
  },
  on: {
    focusFuzzyInput: (context, event: { e: KeyboardEvent }, enqueue) => {
      enqueue.emit.focusFuzzyInput(event);
      return context;
    },
    setLoading: (context, event: { loading: boolean }) => ({
      ...context,
      loading: event.loading,
    }),

    setDirectoryData: (
      context,
      event: { data: GetFilesAndFoldersInDirectoryItem[] },
    ) => {
      const settings = selectSettingsFromStore(fileBrowserSettingsStore.get());
      const directoryData = DirectoryDataFromSettings.getDirectoryData(
        event.data,
        settings,
      );
      const filteredDirectoryData = computeFilteredData(
        directoryData,
        context.fuzzyQuery,
      );
      return {
        ...context,
        directoryData: event.data,
        filteredDirectoryData,
        error: undefined,
      };
    },

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

    // Selection events
    setSelection: (
      context,
      event: { indexes: Set<number>; last?: number },
    ) => ({
      ...context,
      selection: {
        indexes: event.indexes,
        last: event.last,
      },
    }),

    resetSelection: (context) => ({
      ...context,
      selection: {
        indexes: new Set<number>(),
        last: undefined,
      },
    }),

    selectManually: (context, event: { index: number }) => ({
      ...context,
      selection: {
        indexes: new Set([event.index]),
        last: event.index,
      },
    }),

    // Fuzzy finder events
    setFuzzyQuery: (context, event: { query: string }) => {
      const settings = selectSettingsFromStore(fileBrowserSettingsStore.get());
      const directoryData = DirectoryDataFromSettings.getDirectoryData(
        context.directoryData,
        settings,
      );
      const filteredDirectoryData = computeFilteredData(
        directoryData,
        event.query,
      );
      return {
        ...context,
        fuzzyQuery: event.query,
        filteredDirectoryData,
        // Reset selection to first item when query changes (if query is not empty)
        selection: event.query
          ? {
              indexes: new Set([0]),
              last: 0,
            }
          : context.selection,
      };
    },

    clearFuzzyQuery: (context) => {
      const settings = selectSettingsFromStore(fileBrowserSettingsStore.get());
      const directoryData = DirectoryDataFromSettings.getDirectoryData(
        context.directoryData,
        settings,
      );
      return {
        ...context,
        fuzzyQuery: "",
        filteredDirectoryData: directoryData,
      };
    },
  },
});

// Subscribe to settings changes to recompute filtered data
fileBrowserSettingsStore.subscribe(() => {
  const state = directoryStore.get().context;
  const settings = selectSettingsFromStore(fileBrowserSettingsStore.get());
  const directoryData = DirectoryDataFromSettings.getDirectoryData(
    state.directoryData,
    settings,
  );
  const filteredDirectoryData = computeFilteredData(
    directoryData,
    state.fuzzyQuery,
  );

  // Only update if filtered data actually changed
  if (filteredDirectoryData !== state.filteredDirectoryData) {
    directoryStore.send({
      type: "setDirectoryData",
      data: state.directoryData,
    });
  }
});

const loadDirectoryPath = async (dir: string) => {
  directoryStore.send({ type: "setLoading", loading: true });
  try {
    const result = await FileBrowserCache.load(dir);

    result.sort((a, b) => {
      if (a.type === "dir" && b.type === "dir") return 0;
      if (a.type === "dir") return -1;
      if (b.type === "dir") return 1;
      return a.name.localeCompare(b.name);
    });

    directoryStore.send({ type: "setDirectoryData", data: result });
    return result;
  } catch (e) {
    directoryStore.send({ type: "setError", error: errorToString(e) });
  } finally {
    directoryStore.send({ type: "setLoading", loading: false });
  }
};

const loadTaggedFiles = async (color: TagColor) => {
  const getFilesWithTag = (color: TagColor) =>
    Object.entries(tagsStore.get().context.fileTags)
      .filter(([_, tags]) => tags.includes(color))
      .map(([path]) => path);

  directoryStore.send({ type: "setLoading", loading: true });
  try {
    const filePaths = getFilesWithTag(color);
    if (filePaths.length === 0) {
      directoryStore.send({ type: "setDirectoryData", data: [] });
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
    directoryStore.send({ type: "setDirectoryData", data: result });
    return result;
  } catch (e) {
    directoryStore.send({ type: "setError", error: errorToString(e) });
  } finally {
    directoryStore.send({ type: "setLoading", loading: false });
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
    });
  directoryStore.send({ type: "setDirectory", directory: newDirectory });
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

const getFullPathForItem = (item: GetFilesAndFoldersInDirectoryItem) => {
  return item.fullPath ?? getFullPath(item.name);
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

type ReturnOfGoPrev = Promise<
  | {
      directoryData: GetFilesAndFoldersInDirectoryItem[] | undefined;
      beforeNavigation: DirectoryInfo;
    }
  | undefined
>;

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
        directoryStore.send({ type: "itemCreated", name: itemName });
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
        directoryStore.send({ type: "itemRenamed", name: newName });
      }
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      return GenericError.Message(errorMessage);
    }
  },

  setPendingSelection: (name: string | null) => {
    directoryStore.send({ type: "setPendingSelection", name });
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
    const beforeNavigation = state.context.directory;
    directoryStore.send({ type: "historyGoNext" });
    const newState = directoryStore.get();
    const directoryData = await loadDirectoryInfo(newState.context.directory);
    const settings = selectSettingsFromStore(fileBrowserSettingsStore.get());
    return {
      directoryData:
        directoryData &&
        DirectoryDataFromSettings.getDirectoryData(directoryData, settings),
      beforeNavigation,
    };
  },

  goPrev: async () => {
    const state = directoryStore.get();
    if (!state.context.historyStack.hasPrev) return;
    const beforeNavigation = state.context.directory;
    directoryStore.send({ type: "historyGoPrev" });
    const newState = directoryStore.get();
    const directoryData = await loadDirectoryInfo(newState.context.directory);
    const settings = selectSettingsFromStore(fileBrowserSettingsStore.get());
    return {
      directoryData:
        directoryData &&
        DirectoryDataFromSettings.getDirectoryData(directoryData, settings),
      beforeNavigation,
    };
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

  openItemFull: (item: { type: "dir" | "file"; fullPath: string }) => {
    if (item.type === "dir") {
      directoryHelpers.cdFull(item.fullPath);
    } else {
      directoryHelpers.openFileFull(item.fullPath);
    }
  },

  // Selection helpers
  select: (index: number, event: React.MouseEvent | KeyboardEvent) => {
    const state = directoryStore.get().context;

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
        });
        return;
      }
      directoryStore.send({
        type: "setSelection",
        indexes: new Set([...state.selection.indexes, index]),
        last: index,
      });
      return;
    }

    directoryStore.send({
      type: "setSelection",
      indexes: new Set([index]),
      last: index,
    });
  },

  getSelectionShortcuts: (count: number) => [
    {
      key: [{ key: "a", metaKey: true }],
      handler: (e: KeyboardEvent) => {
        directoryStore.send({
          type: "setSelection",
          indexes: new Set(Array.from({ length: count }).map((_, i) => i)),
          last: count - 1,
        });
        e.preventDefault();
      },
    },
    {
      key: ["ArrowUp", "k", "K"],
      handler: (e: KeyboardEvent) => {
        const state = directoryStore.get().context;
        const lastSelected = state.selection.last ?? 0;
        if (state.selection.indexes.has(lastSelected - 1)) {
          const newSet = new Set(state.selection.indexes);
          newSet.delete(lastSelected);
          directoryStore.send({
            type: "setSelection",
            indexes: newSet,
            last: lastSelected - 1,
          });
        } else {
          if (lastSelected - 1 < 0) {
            directoryHelpers.select(count - 1, e);
          } else {
            directoryHelpers.select(lastSelected - 1, e);
          }
        }
        e.preventDefault();
      },
    },
    {
      key: ["ArrowDown", "j", "J"],
      handler: (e: KeyboardEvent) => {
        const state = directoryStore.get().context;
        const lastSelected = state.selection.last ?? 0;
        if (state.selection.indexes.has(lastSelected + 1)) {
          const newSet = new Set(state.selection.indexes);
          newSet.delete(lastSelected);
          directoryStore.send({
            type: "setSelection",
            indexes: newSet,
            last: lastSelected + 1,
          });
        } else {
          if (lastSelected + 1 === count) {
            directoryHelpers.select(0, e);
          } else {
            directoryHelpers.select(lastSelected + 1, e);
          }
        }
        e.preventDefault();
      },
    },
    {
      key: "ArrowLeft",
      handler: (e: KeyboardEvent) => {
        const state = directoryStore.get().context;
        const lastSelected = state.selection.last ?? 0;
        directoryHelpers.select(lastSelected - 10, e);
        e.preventDefault();
      },
    },
    {
      key: "ArrowRight",
      handler: (e: KeyboardEvent) => {
        const state = directoryStore.get().context;
        const lastSelected = state.selection.last ?? 0;
        directoryHelpers.select(lastSelected + 10, e);
        e.preventDefault();
      },
    },
    {
      key: "G",
      handler: (e: KeyboardEvent) => {
        // Go to the bottom (like vim G)
        directoryHelpers.select(count - 1, e);
        e.preventDefault();
      },
    },
    {
      // Go to the top (like vim gg)
      sequence: ["g", "g"],
      handler: (e: KeyboardEvent) => {
        directoryHelpers.select(0, e);
        e.preventDefault();
      },
    },
    {
      key: { key: "d", ctrlKey: true },
      handler: (e: KeyboardEvent) => {
        const state = directoryStore.get().context;
        const lastSelected = state.selection.last ?? 0;
        directoryHelpers.select(Math.min(lastSelected + 10, count - 1), e);
        e.preventDefault();
      },
    },
    {
      key: { key: "u", ctrlKey: true },
      handler: (e: KeyboardEvent) => {
        const state = directoryStore.get().context;
        const lastSelected = state.selection.last ?? 0;
        directoryHelpers.select(Math.max(lastSelected - 10, 0), e);
        e.preventDefault();
      },
    },
  ],

  resetSelection: () => {
    directoryStore.send({ type: "resetSelection" });
  },

  isSelected: (index: number) => {
    const state = directoryStore.get().context;
    return state.selection.indexes.has(index);
  },

  selectManually: (index: number) => {
    directoryStore.send({ type: "selectManually", index });
  },

  setSelection: (h: number | ((s: number) => number)) => {
    const state = directoryStore.get().context;
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
    });
  },

  handleCopy: async (
    items: GetFilesAndFoldersInDirectoryItem[],
    cut: boolean = false,
  ) => {
    const paths = items.map(
      (item) => item.fullPath ?? directoryHelpers.getFullPath(item.name),
    );
    const result = await getWindowElectron().copyFiles(paths, cut);
    if (!result.success) {
      toast.show(result);
    }
  },

  handlePaste: async () => {
    const state = directoryStore.get();
    if (state.context.directory.type !== "path") {
      toast.show(GenericError.Message("Cannot paste in tags view"));
      return;
    }
    const result = await getWindowElectron().pasteFiles(
      state.context.directory.fullPath,
    );
    if (result.success) {
      await directoryHelpers.reload();
      // Select the first pasted item
      if (result.data?.pastedItems && result.data.pastedItems.length > 0) {
        directoryHelpers.setPendingSelection(result.data.pastedItems[0]);
      }
    } else {
      toast.show(result);
    }
  },

  handleDelete: async (
    items: GetFilesAndFoldersInDirectoryItem[],
    tableData: GetFilesAndFoldersInDirectoryItem[],
  ) => {
    const paths = items.map(
      (item) => item.fullPath ?? directoryHelpers.getFullPath(item.name),
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
          await directoryHelpers.reload();

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
            directoryHelpers.setPendingSelection(itemToSelect.name);
          } else {
            directoryStore.send({ type: "resetSelection" });
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

  onGoUpOrPrev: async (fn: () => ReturnOfGoPrev) => {
    const metadata = await fn();
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
      directoryHelpers.selectManually(idx);
    }, 5);
  },

  openSelectedItem: (
    data: GetFilesAndFoldersInDirectoryItem[],
    e?: KeyboardEvent,
  ) => {
    const state = directoryStore.getSnapshot();
    const lastSelected = state.context.selection.last;
    const selectionIndexes = state.context.selection.indexes;
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
    directoryHelpers.openItem(itemToOpen);
  },

  openAssignTagsDialog: (
    fullPath: string,
    data: GetFilesAndFoldersInDirectoryItem[],
  ) => {
    const indexes = directoryStore.getSnapshot().context.selection.indexes;
    const selectedIndexes = [...indexes.values()];
    const selectedItems = selectedIndexes.map((i) => {
      const item = data[i];
      return item.fullPath ?? directoryHelpers.getFullPath(item.name);
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
  setFuzzyQuery: (query: string) => {
    directoryStore.send({ type: "setFuzzyQuery", query });
  },

  clearFuzzyQuery: () => {
    directoryStore.send({ type: "clearFuzzyQuery" });
  },
  getFullPathForItem,
  getSelectedItemsOrCurrentItem(index: number) {
    const snapshot = directoryStore.getSnapshot();
    const selection = snapshot.context.selection;
    const tableData = snapshot.context.filteredDirectoryData;
    const item = tableData[index];

    const alreadySelected = selection.indexes.has(index);
    return alreadySelected
      ? [...selection.indexes].map((i) => tableData[i])
      : [item];
  },
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

export const selectSelection = (state: ReturnType<typeof directoryStore.get>) =>
  state.context.selection;

export const selectFuzzyQuery = (
  state: ReturnType<typeof directoryStore.get>,
) => state.context.fuzzyQuery;

export const selectFilteredDirectoryData = (
  state: ReturnType<typeof directoryStore.get>,
) => state.context.filteredDirectoryData;

subscribeToStore(
  directoryStore,
  (s) => [s.directoryData],
  (_) => {
    directoryHelpers.resetSelection();
  },
);

subscribeToStore(
  directoryStore,
  (s) => [s.pendingSelection, s.filteredDirectoryData],
  (s) => {
    if (s.pendingSelection && s.filteredDirectoryData.length > 0) {
      const newItemIndex = s.filteredDirectoryData.findIndex(
        (item) => item.name === s.pendingSelection,
      );
      if (newItemIndex !== -1) {
        directoryHelpers.selectManually(newItemIndex);
        scrollRowIntoViewIfNeeded(s.directoryId, newItemIndex, "center");
      }
      directoryHelpers.setPendingSelection(null);
    }
  },
);

subscribeToStore(
  directoryStore,
  (s) => [s.selection.last],
  (s) => {
    if (s.selection.last != null) {
      scrollRowIntoViewIfNeeded(s.directoryId, s.selection.last);
    }
  },
);
