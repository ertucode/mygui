import { createStore } from "@xstate/store";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { directoryHelpers, directoryStore } from "./directory";
import { getWindowElectron } from "@/getWindowElectron";
import { toast } from "@/lib/components/toast";
import type { DirectoryId } from "./directory";

// Store context for drag and drop state
type FileDragDropContext = {
  dragOverDirectoryId: DirectoryId | null;
  dragOverRowIdx: number | null;
};

// Create the store
export const fileDragDropStore = createStore({
  context: {
    dragOverDirectoryId: null,
    dragOverRowIdx: null,
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
    reset: () => ({
      dragOverDirectoryId: null,
      dragOverRowIdx: null,
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

// Handler functions
export const fileDragDropHandlers = {
  // Handle drag start on table rows
  handleRowDragStart: async (
    items: GetFilesAndFoldersInDirectoryItem[],
    directoryId: DirectoryId,
  ) => {
    // Copy files to clipboard (cut=true for move by default)
    // The cut mode can be changed to false (copy) if Alt is pressed during drop
    await directoryHelpers.handleCopy(items, true, directoryId);
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
      fileDragDropStore.send({ type: "setDragOverDirectory", directoryId: null });
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
    fileDragDropStore.send({ type: "setDragOverDirectory", directoryId: null });

    // Only allow drops in path directories, not in tags view
    if (directoryType !== "path" || !directoryFullPath) {
      toast.show({
        message: "Cannot drop files in tags view",
        severity: "error",
      });
      return;
    }

    const destinationDir = directoryFullPath;
    const isCopy = e.altKey; // Alt key means copy instead of move

    try {
      // If Alt key is pressed, change clipboard to copy mode instead of cut
      if (isCopy) {
        await getWindowElectron().setClipboardCutMode(false);
      }

      // The files should already be in clipboard from onDragStart
      // Use the existing paste mechanism to handle the drop
      const result = await getWindowElectron().pasteFiles(destinationDir);

      if (result.success) {
        const itemCount = result.data?.pastedItems.length ?? 0;
        toast.show({
          message: isCopy
            ? `Copied ${itemCount} item(s)`
            : `Moved ${itemCount} item(s)`,
          severity: "success",
        });

        // Activate the target directory
        directoryStore.send({
          type: "setActiveDirectoryId",
          directoryId: directoryId,
        });

        // Reload all directory panes to reflect changes
        const allDirectories =
          directoryStore.getSnapshot().context.directoryOrder;
        for (const dirId of allDirectories) {
          await directoryHelpers.reload(dirId);
        }

        // Set selection on the first pasted item in the target directory
        if (result.data?.pastedItems && result.data.pastedItems.length > 0) {
          directoryHelpers.setPendingSelection(
            result.data.pastedItems[0],
            directoryId,
          );
        }
      } else {
        toast.show(result);
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
  handleRowDragOver: (
    e: React.DragEvent,
    idx: number,
    isFolder: boolean,
  ) => {
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

      const result = await getWindowElectron().pasteFiles(targetDir);

      if (result.success) {
        const itemCount = result.data?.pastedItems.length ?? 0;
        toast.show({
          message: isCopy
            ? `Copied ${itemCount} item(s) to ${item.name}`
            : `Moved ${itemCount} item(s) to ${item.name}`,
          severity: "success",
        });

        // Navigate to the target folder and activate this directory
        directoryHelpers.cdFull(targetDir, directoryId);
        directoryStore.send({
          type: "setActiveDirectoryId",
          directoryId: directoryId,
        });

        // Wait a bit for navigation to complete, then set selection
        setTimeout(() => {
          if (result.data?.pastedItems && result.data.pastedItems.length > 0) {
            directoryHelpers.setPendingSelection(
              result.data.pastedItems[0],
              directoryId,
            );
          }
        }, 100);

        // Reload all OTHER directory panes to reflect changes
        const allDirectories =
          directoryStore.getSnapshot().context.directoryOrder;
        for (const dirId of allDirectories) {
          if (dirId !== directoryId) {
            await directoryHelpers.reload(dirId);
          }
        }
      } else {
        toast.show(result);
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
