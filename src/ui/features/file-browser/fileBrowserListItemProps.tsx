import { getWindowElectron } from "@/getWindowElectron";
import { captureDivAsBase64 } from "@/lib/functions/captureDiv";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { directoryStore } from "./directoryStore/directory";
import { DirectoryId } from "./directoryStore/DirectoryBase";
import { directoryHelpers } from "./directoryStore/directoryHelpers";
import { perDirectoryDataHelpers } from "./directoryStore/perDirectoryData";
import { fileDragDropHandlers } from "./fileDragDrop";

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
    onContextMenu: (e) => {
      e.preventDefault();
      directoryStore.trigger.selectManually({ index, directoryId });
      onContextMenu(e, item);
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
    onPointerDown: (_) => {
      if (item.type === "dir") {
        directoryHelpers.preloadDirectory(
          item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId),
        );
      }
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
    draggable: true,
  };
}
