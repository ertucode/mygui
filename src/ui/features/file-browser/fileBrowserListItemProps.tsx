import { getWindowElectron } from "@/getWindowElectron";
import { captureDivAsBase64 } from "@/lib/functions/captureDiv";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { directoryStore } from "./directoryStore/directory";
import { DirectoryId } from "./directoryStore/DirectoryBase";
import { directoryHelpers } from "./directoryStore/directoryHelpers";
import { perDirectoryDataHelpers } from "./directoryStore/perDirectoryData";
import { fileDragDropHandlers, fileDragDropStore } from "./fileDragDrop";
import { directorySelection } from "./directoryStore/directorySelection";

export function fileBrowserListItemProps({
  item,
  index,
  directoryId,
  onContextMenu,
}: {
  item: GetFilesAndFoldersInDirectoryItem;
  index: number;
  directoryId: DirectoryId;
  onContextMenu: (
    e: React.MouseEvent,
    item: GetFilesAndFoldersInDirectoryItem,
  ) => void;
}): React.HTMLAttributes<HTMLElement> {
  return {
    onClick: perDirectoryDataHelpers.getOnClick(directoryId, item, index),
    onMouseDown: (e) => {
      // Only handle left mouse button for drag-to-select
      if (e.button !== 0) return;

      const state = directoryStore.getSnapshot();
      const directory = state.context.directoriesById[directoryId];
      const isItemSelected = directory.selection.indexes.has(index);

      // If item is not selected, start drag-to-select mode
      if (!isItemSelected) {
        fileDragDropHandlers.startDragToSelect(index, directoryId);
        // Select the starting item
        directorySelection.select(index, undefined, directoryId);
      }
    },
    onMouseEnter: () => {
      const dragState = fileDragDropStore.getSnapshot();
      
      // If we're in drag-to-select mode for this directory, update the selection
      if (
        dragState.context.isDragToSelect &&
        dragState.context.dragToSelectDirectoryId === directoryId
      ) {
        const startIdx = dragState.context.dragToSelectStartIdx!;
        const currentIdx = index;
        
        // Create selection range from start to current
        const minIdx = Math.min(startIdx, currentIdx);
        const maxIdx = Math.max(startIdx, currentIdx);
        const newIndexes = new Set<number>();
        for (let i = minIdx; i <= maxIdx; i++) {
          newIndexes.add(i);
        }
        
        directoryStore.send({
          type: "setSelection",
          indexes: newIndexes,
          last: currentIdx,
          directoryId,
        });
      }
    },
    onMouseUp: () => {
      const dragState = fileDragDropStore.getSnapshot();
      if (dragState.context.isDragToSelect) {
        fileDragDropHandlers.endDragToSelect();
      }
    },
    onContextMenu: (e) => {
      e.preventDefault();
      directoryStore.trigger.selectManually({ index, directoryId });
      onContextMenu(e, item);
    },
    onPointerDown: (e) => {
      if (item.type === "dir") {
        directoryHelpers.preloadDirectory(
          item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId),
        );
      }

      // Make element draggable only if it's selected
      const state = directoryStore.getSnapshot();
      const directory = state.context.directoriesById[directoryId];
      const isItemSelected = directory.selection.indexes.has(index);
      
      const target = e.currentTarget as HTMLElement;
      target.draggable = isItemSelected;
    },
    onDragStart: async (e) => {
      // Mark this as a file drag operation
      e.dataTransfer.setData("application/x-mygui-file-drag", "true");

      const items = directoryHelpers.getSelectedItemsOrCurrentItem(
        index,
        directoryId,
      );
      const filePaths = items.map((i) =>
        directoryHelpers.getFullPathForItem(i, directoryId),
      );

      // Store dragged items data for favorites/other drop targets
      e.dataTransfer.setData(
        "application/x-mygui-drag-items",
        JSON.stringify(
          items.map((i) => ({
            fullPath: directoryHelpers.getFullPathForItem(i, directoryId),
            type: i.type,
            name: i.name,
          })),
        ),
      );

      // Handle drag start
      await fileDragDropHandlers.handleRowDragStart(items, directoryId);

      const table = document.querySelector(
        '[data-list-id="' + directoryId + '"]',
      );
      if (!table) return;

      // Start the native drag
      getWindowElectron().onDragStart({
        files: filePaths,
        image: await captureDivAsBase64(table as HTMLElement),
      });
    },
    onDragOver: (e) => {
      fileDragDropHandlers.handleRowDragOver(e, index, item.type === "dir");
    },
    onDragLeave: (e) => {
      fileDragDropHandlers.handleRowDragLeave(e, item.type === "dir");
    },
    onDrop: async (e) => {
      await fileDragDropHandlers.handleRowDrop(e, item, directoryId);
    },
    draggable: false,
  };
}
