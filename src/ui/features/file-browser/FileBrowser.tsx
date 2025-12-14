import { FileBrowserTable } from "@/features/file-browser/FileBrowserTable";
import {
  directoryStore,
  directoryHelpers,
  selectSelection,
  directoryDerivedStores,
} from "./directory";
import { FavoritesList } from "./components/FavoritesList";
import { RecentsList } from "./components/RecentsList";
import { TagsList } from "./components/TagsList";
import { useSelector } from "@xstate/store/react";

import { FilePreview } from "./components/FilePreview";
import { useDialogStoreRenderer } from "./dialogStore";
import { FileBrowserOptionsSection } from "./components/FileBrowserOptionsSection";
import { FileBrowserNavigationAndInputSection } from "./components/FileBrowserNavigationAndInputSection";
import { useResizablePanel, ResizeHandle } from "@/lib/hooks/useResizablePanel";
import { DirectoryContextProvider } from "./DirectoryContext";
import { FileBrowserShortcuts } from "./FileBrowserShortcuts";

export function FileBrowser() {
  const dialogs = useDialogStoreRenderer();

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

  const directories = useSelector(
    directoryStore,
    (s) => s.context.directoryOrder,
  );

  return (
    <div className="flex flex-col items-stretch gap-3 h-full p-6 overflow-hidden">
      {dialogs.RenderOutside}
      <FileBrowserOptionsSection />
      <FileBrowserShortcuts />
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
        <div className="flex gap-2 flex-1 overflow-hidden min-w-0 min-h-0">
          {directories.map((d) => {
            return (
              <div
                key={d}
                className="relative flex flex-col min-h-0 min-w-0 flex-1"
              >
                <DirectoryContextProvider directoryId={d}>
                  <FileBrowserNavigationAndInputSection />
                  <FileBrowserTable></FileBrowserTable>
                </DirectoryContextProvider>
              </div>
            );
          })}
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
  const activeDirectoryId = useSelector(
    directoryStore,
    (s) => s.context.activeDirectoryId,
  );
  const selection = useSelector(
    directoryStore,
    selectSelection(activeDirectoryId),
  );
  const filteredDirectoryData = directoryDerivedStores
    .get(activeDirectoryId)!
    .useFilteredDirectoryData();
  // Get selected file for preview (only if exactly one file is selected)
  const selectedItem =
    selection.indexes.size === 1 && selection.last != null
      ? filteredDirectoryData[selection.last]
      : null;
  const previewFilePath =
    selectedItem && selectedItem.type === "file"
      ? (selectedItem.fullPath ??
        directoryHelpers.getFullPath(selectedItem.name, activeDirectoryId))
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
