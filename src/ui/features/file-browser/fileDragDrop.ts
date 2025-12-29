import { createStore } from "@xstate/store";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { directoryHelpers, directoryStore } from "./directoryStore/directory";
import { clipboardHelpers } from "./clipboardHelpers";
import { getWindowElectron } from "@/getWindowElectron";
import { toast } from "@/lib/components/toast";
import { DirectoryId } from "./directoryStore/DirectoryBase";

// Store context for drag and drop state
type FileDragDropContext = {
  dragOverDirectoryId: DirectoryId | null;
  dragOverRowIdx: number | null;
  isDragToSelect: boolean;
  dragToSelectStartIdx: number | null;
  dragToSelectDirectoryId: DirectoryId | null;
  dragToSelectWithMetaKey: boolean;
};

// Create the store
export const fileDragDropStore = createStore({
  context: {
    dragOverDirectoryId: null,
    dragOverRowIdx: null,
    isDragToSelect: false,
    dragToSelectStartIdx: null,
    dragToSelectDirectoryId: null,
    dragToSelectWithMetaKey: false,
  } as FileDragDropContext,
  on: {
    setDragOverDirectory: (
      context,
      event: { directoryId: DirectoryId | null },
    ) => ({
      ...context,
      dragOverDirectoryId: event.directoryId,
    }),
    setDragOverRowIdx: (context, event: { value: number | null }) => ({
      ...context,
      dragOverRowIdx: event.value,
    }),
    startDragToSelect: (
      context,
      event: { startIdx: number; directoryId: DirectoryId; withMetaKey: boolean },
    ) => ({
      ...context,
      isDragToSelect: true,
      dragToSelectStartIdx: event.startIdx,
      dragToSelectDirectoryId: event.directoryId,
      dragToSelectWithMetaKey: event.withMetaKey,
    }),
    endDragToSelect: (context) => ({
      ...context,
      isDragToSelect: false,
      dragToSelectStartIdx: null,
      dragToSelectDirectoryId: null,
      dragToSelectWithMetaKey: false,
    }),
    reset: () => ({
      dragOverDirectoryId: null,
      dragOverRowIdx: null,
      isDragToSelect: false,
      dragToSelectStartIdx: null,
      dragToSelectDirectoryId: null,
      dragToSelectWithMetaKey: false,
    }),
  },
});

// Selectors
export const selectIsDragOverDirectory = (directoryId: DirectoryId) => {
  const state = fileDragDropStore.getSnapshot();
  return state.context.dragOverDirectoryId === directoryId;
};

export const selectDragOverRowIdx = () => {
  const state = fileDragDropStore.getSnapshot();
  return state.context.dragOverRowIdx;
};

// Helper to check if a drag event is a file drag (not a pane/tab drag)
const isFileDrag = (e: React.DragEvent): boolean => {
  // Check if this drag has our custom file drag marker
  return e.dataTransfer.types.includes("application/x-mygui-file-drag");
};

// Global mouse up handler for drag-to-select
const handleGlobalMouseUp = () => {
  const dragState = fileDragDropStore.getSnapshot();
  if (dragState.context.isDragToSelect) {
    fileDragDropStore.send({ type: "endDragToSelect" });
    document.body.removeEventListener("mouseup", handleGlobalMouseUp);
  }
};

// Handler functions
export const fileDragDropHandlers = {
  // Start drag-to-select mode
  startDragToSelect: (startIdx: number, directoryId: DirectoryId, withMetaKey: boolean = false) => {
    fileDragDropStore.send({
      type: "startDragToSelect",
      startIdx,
      directoryId,
      withMetaKey,
    });
    // Add global mouseup listener to handle release anywhere
    document.body.addEventListener("mouseup", handleGlobalMouseUp);
  },

  // End drag-to-select mode
  endDragToSelect: () => {
    fileDragDropStore.send({ type: "endDragToSelect" });
    document.body.removeEventListener("mouseup", handleGlobalMouseUp);
  },

  // Handle drag start on table rows
  handleRowDragStart: async (
    items: GetFilesAndFoldersInDirectoryItem[],
    directoryId: DirectoryId,
  ) => {
    // Copy files to clipboard (cut=true for move by default)
    // The cut mode can be changed to false (copy) if Alt is pressed during drop
    await clipboardHelpers.copy(items, true, directoryId);
  },

  // Handle drag over on the table container
  handleTableDragOver: (e: React.DragEvent, directoryId: DirectoryId) => {
    // Only handle file drags, ignore pane/tab drags
    if (!isFileDrag(e)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    fileDragDropStore.send({ type: "setDragOverDirectory", directoryId });

    // Set dropEffect based on Alt key
    if (e.altKey) {
      e.dataTransfer.dropEffect = "copy";
    } else {
      e.dataTransfer.dropEffect = "move";
    }
  },

  // Handle drag leave on the table container
  handleTableDragLeave: (e: React.DragEvent) => {
    // Only handle file drags, ignore pane/tab drags
    if (!isFileDrag(e)) {
      return;
    }

    // Only clear if we're actually leaving the container, not just moving between children
    const rect = e.currentTarget.getBoundingClientRect();
    const isOutside =
      e.clientX < rect.left ||
      e.clientX >= rect.right ||
      e.clientY < rect.top ||
      e.clientY >= rect.bottom;

    if (isOutside) {
      fileDragDropStore.send({
        type: "setDragOverDirectory",
        directoryId: null,
      });
    }
  },

  // Handle drop on the table container
  handleTableDrop: async (
    e: React.DragEvent,
    directoryId: DirectoryId,
    directoryType: "path" | "tags",
    directoryFullPath?: string,
  ) => {
    // Only handle file drags, ignore pane/tab drags
    if (!isFileDrag(e)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    fileDragDropStore.send({
      type: "setDragOverDirectory",
      directoryId: null,
    });

    // Only allow drops in path directories, not in tags view
    if (directoryType !== "path" || !directoryFullPath) {
      toast.show({
        message: "Cannot drop files in tags view",
        severity: "error",
      });
      return;
    }

    const isCopy = e.altKey; // Alt key means copy instead of move

    try {
      // If Alt key is pressed, change clipboard to copy mode instead of cut
      if (isCopy) {
        await getWindowElectron().setClipboardCutMode(false);
      }

      // The files should already be in clipboard from onDragStart
      // Use clipboardHelpers to handle the drop with conflict resolution
      await clipboardHelpers.paste(directoryId);

      // Activate the target directory
      directoryStore.send({
        type: "setActiveDirectoryId",
        directoryId: directoryId,
      });

      // Reload all OTHER directory panes to reflect changes
      // The active directory will be reloaded by clipboardHelpers.paste
      const allDirectories =
        directoryStore.getSnapshot().context.directoryOrder;
      for (const dirId of allDirectories) {
        if (dirId !== directoryId) {
          await directoryHelpers.reload(dirId);
        }
      }
    } catch (error) {
      toast.show({
        message:
          error instanceof Error ? error.message : "Failed to drop files",
        severity: "error",
      });
    }
  },

  // Handle drag over on folder rows
  handleRowDragOver: (e: React.DragEvent, idx: number, isFolder: boolean) => {
    // Only handle file drags, ignore pane/tab drags
    if (!isFileDrag(e)) {
      return;
    }

    // Only allow dropping on folders
    if (!isFolder) return;

    e.preventDefault();
    e.stopPropagation();
    fileDragDropStore.send({ type: "setDragOverRowIdx", value: idx });
    // Set dropEffect based on Alt key
    e.dataTransfer.dropEffect = e.altKey ? "copy" : "move";
  },

  // Handle drag leave on folder rows
  handleRowDragLeave: (e: React.DragEvent, isFolder: boolean) => {
    // Only handle file drags, ignore pane/tab drags
    if (!isFileDrag(e)) {
      return;
    }

    if (!isFolder) return;

    // Only clear if we're actually leaving the row
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const isOutside =
      e.clientX < rect.left ||
      e.clientX >= rect.right ||
      e.clientY < rect.top ||
      e.clientY >= rect.bottom;

    if (isOutside) {
      fileDragDropStore.send({ type: "setDragOverRowIdx", value: null });
    }
  },

  // Handle drop on folder rows
  handleRowDrop: async (
    e: React.DragEvent,
    item: GetFilesAndFoldersInDirectoryItem,
    directoryId: DirectoryId,
  ) => {
    // Only handle file drags, ignore pane/tab drags
    if (!isFileDrag(e)) {
      return;
    }

    // Only allow dropping on folders
    if (item.type !== "dir") return;

    e.preventDefault();
    e.stopPropagation();
    fileDragDropStore.send({ type: "setDragOverRowIdx", value: null });

    const targetDir =
      item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId);
    const isCopy = e.altKey;

    try {
      // If Alt key is pressed, change clipboard to copy mode instead of cut
      if (isCopy) {
        await getWindowElectron().setClipboardCutMode(false);
      }

      // Navigate to the target folder first
      await directoryHelpers.cdFull(targetDir, directoryId);
      directoryStore.send({
        type: "setActiveDirectoryId",
        directoryId: directoryId,
      });

      // Now paste into this directory using clipboardHelpers
      // This will handle conflicts and reload automatically
      await clipboardHelpers.paste(directoryId);

      // Reload all OTHER directory panes to reflect changes
      const allDirectories =
        directoryStore.getSnapshot().context.directoryOrder;
      for (const dirId of allDirectories) {
        if (dirId !== directoryId) {
          await directoryHelpers.reload(dirId);
        }
      }
    } catch (error) {
      toast.show({
        message:
          error instanceof Error ? error.message : "Failed to drop files",
        severity: "error",
      });
    }
  },
};
