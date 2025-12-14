import { useEffect } from "react";
import { Table } from "@/lib/libs/table/Table";
import { useTable } from "@/lib/libs/table/useTable";
import { createColumns } from "./config/columns";
import {
  directoryStore,
  directoryHelpers,
  selectLoading,
  selectDirectoryData,
  selectPendingSelection,
  selectSelection,
  selectFilteredDirectoryData,
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
import { scrollRowIntoViewIfNeeded } from "@/lib/libs/table/globalTableScroll";
import { DirectoryContextProvider } from "./DirectoryContext";

const FILE_BROWSER_TABLE_ID = "file-browser-table";

export function FileBrowser() {
  const dialogs = useDialogStoreRenderer();
  const fileTags = useSelector(tagsStore, selectFileTags);

  const selection = useSelector(directoryStore, selectSelection);
  const _loading = useSelector(directoryStore, selectLoading);

  const loading = useDebounce(_loading, 100);
  const directoryData = useSelector(directoryStore, selectDirectoryData);
  const filteredDirectoryData = useSelector(
    directoryStore,
    selectFilteredDirectoryData,
  );
  const pendingSelection = useSelector(directoryStore, selectPendingSelection);

  useEffect(() => {
    directoryHelpers.resetSelection();
  }, [directoryData]);

  const columns = createColumns({
    fileTags,
    getFullPath: directoryHelpers.getFullPath,
  });

  const table = useTable({
    columns,
    data: filteredDirectoryData,
  });

  // Handle pending selection after data reload
  useEffect(() => {
    if (pendingSelection && table.data.length > 0) {
      const newItemIndex = table.data.findIndex(
        (item) => item.name === pendingSelection,
      );
      if (newItemIndex !== -1) {
        directoryHelpers.selectManually(newItemIndex);
        scrollRowIntoViewIfNeeded(
          FILE_BROWSER_TABLE_ID,
          newItemIndex,
          "center",
        );
      }
      directoryHelpers.setPendingSelection(null);
    }
  }, [pendingSelection, table.data]);

  // Scroll to selected row when selection changes (keyboard navigation)
  useEffect(() => {
    if (selection.last != null) {
      scrollRowIntoViewIfNeeded(FILE_BROWSER_TABLE_ID, selection.last);
    }
  }, [selection.last]);

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
          <DirectoryContextProvider directoryId={FILE_BROWSER_TABLE_ID}>
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
  const filteredDirectoryData = useSelector(
    directoryStore,
    selectFilteredDirectoryData,
  );
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
