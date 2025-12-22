import { getWindowElectron } from "@/getWindowElectron";
import { toast } from "@/lib/components/toast";
import { confirmation } from "@/lib/hooks/useConfirmation";
import { ResultHandlerResult } from "@/lib/hooks/useDefaultResultHandler";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { GenericError } from "@common/GenericError";
import { mergeMaybeSlashed } from "@common/merge-maybe-slashed";
import { PathHelpers } from "@common/PathHelpers";
import { dialogActions } from "../dialogStore";
import { directoryStore, loadDirectoryInfo } from "./directory";
import { directoryLoadingHelpers } from "./directoryLoadingStore";
import { selectIsFavorite, favoritesStore } from "../favorites";
import { recentsStore } from "../recents";
import {
  fileBrowserSettingsStore,
  fileBrowserSettingsHelpers,
} from "../settings";
import { TagColor } from "../tags";
import { DirectoryDataFromSettings } from "../utils/DirectoryDataFromSettings";
import { selectSettings as selectSettingsFromStore } from "../settings";
import { FileBrowserCache } from "../FileBrowserCache";
import { directoryDerivedStores } from "./directorySubscriptions";
import { directorySelection } from "./directorySelection";
import {
  DirectoryInfo,
  DirectoryId,
  getActiveDirectory,
  directoryInfoEquals,
} from "./DirectoryBase";

export const cd = async (
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

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

      // Check if it's a zip file - if so, open the unzip dialog instead
      if (item.ext === ".zip") {
        const suggestedName = item.name.replace(/\.zip$/i, "");
        dialogActions.open("unzip", { zipFilePath: fullPath, suggestedName });
        return;
      }

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
      directorySelection.selectManually(idx, directoryId);
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

  zipFiles: async (
    filePaths: string[],
    zipName: string,
    directoryId: DirectoryId,
  ): Promise<ResultHandlerResult> => {
    const context = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    if (context.directory.type !== "path") {
      return GenericError.Message("Cannot create zip in tags view");
    }

    try {
      const finalZipName = zipName.endsWith(".zip")
        ? zipName
        : `${zipName}.zip`;
      const destinationZipPath = mergeMaybeSlashed(
        context.directory.fullPath,
        finalZipName,
      );
      const result = await getWindowElectron().zipFiles(
        filePaths,
        destinationZipPath,
      );
      if (result.success) {
        await directoryHelpers.reload(directoryId);
        // Select the newly created zip file
        const zipFileName = PathHelpers.getLastPathPart(result.data!.path);
        directoryHelpers.setPendingSelection(zipFileName, directoryId);
      }
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      return GenericError.Message(errorMessage);
    }
  },

  unzipFile: async (
    zipFilePath: string,
    folderName: string,
    directoryId: DirectoryId,
  ): Promise<ResultHandlerResult> => {
    const context = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    if (context.directory.type !== "path") {
      return GenericError.Message("Cannot extract zip in tags view");
    }

    try {
      const destinationFolder = mergeMaybeSlashed(
        context.directory.fullPath,
        folderName,
      );
      const result = await getWindowElectron().unzipFile(
        zipFilePath,
        destinationFolder,
      );
      if (result.success) {
        await directoryHelpers.reload(directoryId);
        // Select the newly created folder
        directoryHelpers.setPendingSelection(folderName, directoryId);
      }
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      return GenericError.Message(errorMessage);
    }
  },

  loadDirectorySizes: async (
    directoryId: DirectoryId,
    specificDirName?: string,
  ): Promise<void> => {
    const context = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    if (context.directory.type !== "path") {
      toast.show({
        message: "Cannot load directory sizes in tags view",
        severity: "error",
      });
      return;
    }

    directoryLoadingHelpers.startLoading(directoryId);
    try {
      const sizes = await getWindowElectron().getDirectorySizes(
        context.directory.fullPath,
        specificDirName,
      );

      // Update the directory data with the new sizes
      const updatedData = context.directoryData.map((item) => {
        if (item.type === "dir" && sizes[item.name] !== undefined) {
          return {
            ...item,
            size: sizes[item.name],
            sizeStr: formatBytes(sizes[item.name]),
          };
        }
        return item;
      });

      directoryStore.send({
        type: "setDirectoryData",
        data: updatedData,
        directoryId,
      });

      if (specificDirName) {
        toast.show({
          message: `Loaded size for ${specificDirName}`,
          severity: "success",
        });
      } else {
        toast.show({
          message: `Loaded sizes for all directories`,
          severity: "success",
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load directory sizes";
      toast.show({
        message: errorMessage,
        severity: "error",
      });
    } finally {
      directoryLoadingHelpers.endLoading(directoryId);
    }
  },
};
