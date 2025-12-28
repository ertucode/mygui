import { createStore, StoreSnapshot } from "@xstate/store";
import { HistoryStack } from "@common/history-stack";
import { errorToString } from "@common/errorToString";
import {
  fileBrowserSettingsStore,
  selectSettings as selectSettingsFromStore,
  FileBrowserSettings,
} from "../settings";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { getWindowElectron, homeDirectory } from "@/getWindowElectron";
import { TagColor, tagsStore } from "../tags";
import { PathHelpers } from "@common/PathHelpers";
import { defaultPath, initialDirectoryInfo } from "../defaultPath";
import { toast } from "@/lib/components/toast";
import { directoryHelpers as dh } from "./directoryHelpers";
import { FileBrowserCache } from "../FileBrowserCache";
import { directoryLoadingHelpers } from "./directoryLoadingStore";
import {
  setupSubscriptions,
  unsubscribeDirectorySubscriptions,
} from "./directorySubscriptions";
import {
  DirectoryContext,
  DirectoryId,
  DirectoryContextDirectory,
  getActiveDirectory,
  DirectoryInfo,
  DirectoryLocalSort,
} from "./DirectoryBase";
import { errorResponseToMessage, GenericError } from "@common/GenericError";

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

export function createDirectoryContext(
  directoryId: DirectoryId,
  directory: DirectoryInfo,
): DirectoryContextDirectory {
  return {
    directoryId,
    directory,
    loading: false,
    directoryData: [] as GetFilesAndFoldersInDirectoryItem[],
    error: undefined as GenericError | undefined,
    historyStack: new HistoryStack<DirectoryInfo>([directory]),
    pendingSelection: null as string | string[] | null,
    selection: {
      indexes: new Set<number>(),
      last: undefined as number | undefined,
    },
    fuzzyQuery: "",
    viewMode: "list",
    localSort: undefined,
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
        pendingSelection: null as string | string[] | null,
        // Selection state
        selection: {
          indexes: new Set<number>(),
          last: undefined as number | undefined,
        },
        // Fuzzy finder state
        fuzzyQuery: "",
        // View mode
        viewMode: "list" as "list" | "grid",
        // Local sort state
        localSort: undefined,
      },
    },
    directoryOrder: [dummyDirectoryId],
    activeDirectoryId: dummyDirectoryId,
  } as DirectoryContext,
  emits: {
    focusFuzzyInput: (_: {
      e: KeyboardEvent | undefined;
      directoryId: DirectoryId;
    }) => {},
    directoryCreated: (_: { directoryId: DirectoryId; tabId?: string }) => {},
  },
  on: {
    focusFuzzyInput: (
      context,
      event: { e: KeyboardEvent | undefined },
      enqueue,
    ) => {
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
    setError: (
      context,
      event: { error: GenericError | undefined; directoryId: DirectoryId },
    ) =>
      updateDirectory(context, event.directoryId, (d) => ({
        ...d,
        error: event.error,
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
      event: {
        name: string | string[] | null;
        directoryId: DirectoryId | undefined;
      },
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
    toggleViewMode: (context, event: { directoryId: DirectoryId }) =>
      updateDirectory(context, event.directoryId, (d) => ({
        ...d,
        viewMode: d.viewMode === "list" ? "grid" : "list",
      })),

    setLocalSort: (
      context,
      event: { sort: DirectoryLocalSort | undefined; directoryId: DirectoryId },
    ) =>
      updateDirectory(context, event.directoryId, (d) => ({
        ...d,
        localSort: event.sort,
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
          [directoryId]: createDirectoryContext(directoryId, directory),
        },
        directoryOrder: [...context.directoryOrder, directoryId],
      };
    },
    createLoadedDirectory: (
      context,
      event: {
        tabId?: string;
        fullPath: string;
        directoryData: GetFilesAndFoldersInDirectoryItem[];
      },
      enqueue,
    ) => {
      const directoryId = Math.random().toString(36).slice(2) as DirectoryId;

      enqueue.emit.directoryCreated({
        directoryId,
        tabId: event.tabId,
      });

      setupSubscriptions(directoryId);
      const directory: DirectoryInfo = {
        type: "path",
        fullPath: event.fullPath,
      };

      const directoryContext = createDirectoryContext(directoryId, directory);
      directoryContext.directoryData = event.directoryData;

      return {
        ...context,
        activeDirectoryId: directoryId,
        directoriesById: {
          ...context.directoriesById,
          [directoryId]: directoryContext,
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
              error: undefined as GenericError | undefined,
              historyStack: new HistoryStack<DirectoryInfo>([directory]),
              pendingSelection: null as string | string[] | null,
              // Selection state
              selection: {
                indexes: new Set<number>(),
                last: undefined as number | undefined,
              },
              // Fuzzy finder state
              fuzzyQuery: "",
              // View mode
              viewMode: "list" as "list" | "grid",
              // Local sort state
              localSort: undefined,
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

export const loadDirectoryPath = async (
  dir: string,
  directoryId: DirectoryId,
) => {
  directoryLoadingHelpers.startLoading(directoryId);
  try {
    const result = await FileBrowserCache.load(dir);

    if (!result.success) {
      directoryStore.send({
        type: "setError",
        error: result.error,
        directoryId,
      });
      toast.show({
        message: errorResponseToMessage(result.error),
        severity: "error",
      });
      return undefined;
    }

    directoryStore.send({
      type: "setDirectoryData",
      data: result.data,
      directoryId,
    });
    return result.data;
  } catch (e) {
    toast.show({
      message: errorToString(e),
      severity: "error",
    });
  } finally {
    directoryLoadingHelpers.endLoading(directoryId);
  }
};

export const loadTaggedFiles = async (
  color: TagColor,
  directoryId: DirectoryId,
) => {
  const getFilesWithTag = (color: TagColor) =>
    Object.entries(tagsStore.get().context.fileTags)
      .filter(([_, tags]) => tags.includes(color))
      .map(([path]) => path);

  directoryLoadingHelpers.startLoading(directoryId);
  try {
    const filePaths = getFilesWithTag(color);
    if (filePaths.length === 0) {
      directoryStore.send({ type: "setDirectoryData", data: [], directoryId });
      return [];
    }
    const result = await getWindowElectron().getFileInfoByPaths(filePaths);

    const staleItems = filePaths.filter((item) => {
      const normalized = PathHelpers.expandHome(homeDirectory, item);
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
    directoryLoadingHelpers.endLoading(directoryId);
  }
};

export const loadDirectoryInfo = async (
  info: DirectoryInfo,
  directoryId: DirectoryId,
) => {
  if (info.type === "path") {
    return loadDirectoryPath(info.fullPath, directoryId);
  } else {
    return loadTaggedFiles(info.color, directoryId);
  }
};

export const directoryHelpers = dh;

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

export const selectViewMode =
  (directoryId: DirectoryId | undefined) =>
  (state: StoreSnapshot<DirectoryContext>) =>
    getActiveDirectory(state.context, directoryId).viewMode;

export const selectError =
  (directoryId: DirectoryId | undefined) =>
  (state: StoreSnapshot<DirectoryContext>) =>
    getActiveDirectory(state.context, directoryId).error;
