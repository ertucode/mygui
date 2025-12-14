import { Table } from "@/features/file-browser/FileBrowserTable";
import { useTable } from "@/lib/libs/table/useTable";
import { createColumns } from "./config/columns";
import {
  directoryStore,
  directoryHelpers,
  selectLoading,
  selectSelection,
  useFilteredDirectoryData,
} from "./directory";
import { FavoritesList } from "./components/FavoritesList";
import { RecentsList } from "./components/RecentsList";
import { TagsList } from "./components/TagsList";
import { useSelector } from "@xstate/store/react";
import { tagsStore, selectFileTags } from "./tags";

import { FilePreview } from "./components/FilePreview";
import { useDialogStoreRenderer } from "./dialogStore";
import { FileBrowserOptionsSection } from "./components/FileBrowserOptionsSection";
import { FileBrowserNavigationAndInputSection } from "./components/FileBrowserNavigationAndInputSection";
import { useResizablePanel, ResizeHandle } from "@/lib/hooks/useResizablePanel";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useFileBrowserShortcuts } from "./useFileBrowserShortcuts";
import { DirectoryContextProvider } from "./DirectoryContext";

export function FileBrowser() {
  const dialogs = useDialogStoreRenderer();
  const fileTags = useSelector(tagsStore, selectFileTags);

  const _loading = useSelector(directoryStore, selectLoading);

  const loading = useDebounce(_loading, 100);
  const filteredDirectoryData = useFilteredDirectoryData();

  const columns = createColumns({
    fileTags,
    getFullPath: directoryHelpers.getFullPath,
  });

  const table = useTable({
    columns,
    data: filteredDirectoryData,
  });

  useFileBrowserShortcuts(table.data);

  const sidebarPanel = useResizablePanel({
    storageKey: "file-browser-sidebar-width",
    defaultWidth: 120,
    minWidth: 80,
    maxWidth: 300,
    direction: "left",
  });

  const previewPanel = useResizablePanel({
    storageKey: "file-browser-preview-width",
    defaultWidth: 320,
    minWidth: 200,
    maxWidth: 900,
    direction: "right",
  });

  const directoryId = useSelector(directoryStore, (s) => s.context.directoryId);

  return (
    <div className="flex flex-col items-stretch gap-3 h-full p-6 overflow-hidden">
      {dialogs.RenderOutside}
      <FileBrowserOptionsSection />
      <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">
        <div
          className="flex flex-col h-full min-h-0 overflow-hidden flex-shrink-0 [&>*]:flex-1 [&>*]:min-h-0 [&>*]:basis-0"
          style={{ width: sidebarPanel.width }}
        >
          <FavoritesList />
          <RecentsList />
          <TagsList />
        </div>
        <ResizeHandle
          onMouseDown={sidebarPanel.handleMouseDown}
          direction="left"
        />
        <div className="relative flex flex-col min-h-0 min-w-0 overflow-hidden flex-1">
          <DirectoryContextProvider directoryId={directoryId}>
            <FileBrowserNavigationAndInputSection />
            {loading ? <div>Loading...</div> : <Table table={table}></Table>}
          </DirectoryContextProvider>
        </div>
        <ResizeHandle
          onMouseDown={previewPanel.handleMouseDown}
          direction="right"
          className="hidden min-[1000px]:block"
        />
        <div
          className="hidden min-[1000px]:flex flex-col min-h-0 overflow-hidden flex-shrink-0"
          style={{ width: previewPanel.width }}
        >
          <FileBrowserFilePreview isDragging={previewPanel.isDragging} />
        </div>
      </div>
    </div>
  );
}

function FileBrowserFilePreview({ isDragging }: { isDragging: boolean }) {
  const selection = useSelector(directoryStore, selectSelection);
  const filteredDirectoryData = useFilteredDirectoryData();
  // Get selected file for preview (only if exactly one file is selected)
  const selectedItem =
    selection.indexes.size === 1 && selection.last != null
      ? filteredDirectoryData[selection.last]
      : null;
  const previewFilePath =
    selectedItem && selectedItem.type === "file"
      ? (selectedItem.fullPath ??
        directoryHelpers.getFullPath(selectedItem.name))
      : null;

  return (
    <FilePreview
      filePath={previewFilePath}
      isFile={selectedItem?.type === "file"}
      fileSize={selectedItem?.size}
      fileExt={selectedItem?.type === "file" ? selectedItem.ext : null}
      isResizing={isDragging}
    />
  );
}
