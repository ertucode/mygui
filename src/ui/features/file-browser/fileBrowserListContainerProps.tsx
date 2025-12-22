import { DirectoryId, DirectoryInfo } from "./directoryStore/DirectoryBase";
import { fileDragDropHandlers } from "./fileDragDrop";

export function fileBrowserListContainerProps({
  directory,
  directoryId,
}: {
  directory: DirectoryInfo;
  directoryId: DirectoryId;
}): React.HTMLAttributes<HTMLElement> {
  return {
    onDragOver: (e) => fileDragDropHandlers.handleTableDragOver(e, directoryId),
    onDragLeave: fileDragDropHandlers.handleTableDragLeave,
    onDrop: (e) =>
      fileDragDropHandlers.handleTableDrop(
        e,
        directoryId,
        directory.type,
        directory.type === "path" ? directory.fullPath : undefined,
      ),
  };
}
