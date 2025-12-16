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
import "./pane.css";

import { FileBrowserShortcuts } from "./FileBrowserShortcuts";
import {
  createTilePanes,
  TileBranchSubstance,
  TileContainer,
  TileProvider,
  useGetRootNode,
} from "react-tile-pane";
import { DirectoryTablePane } from "./components/DirectoryTablePane";
import { useMemo } from "react";
import { theme } from "./paneStyles";

// Configure stretch bars to be visible

export function FileBrowser() {
  const dialogs = useDialogStoreRenderer();

  const directories = useSelector(
    directoryStore,
    (s) => s.context.directoryOrder,
  );

  // Create tile panes dynamically based on directories
  const { paneList, rootPane } = useMemo(() => {
    const paneDict: Record<string, React.ReactNode> = {
      favorites: <FavoritesList />,
      recents: <RecentsList />,
      tags: <TagsList />,
      options: <div></div>,
      preview: <FileBrowserFilePreview />,
    };

    // Add directory panes
    directories.forEach((d) => {
      paneDict[`dir-${d}`] = <DirectoryTablePane directoryId={d} />;
    });

    const [paneList, names] = createTilePanes(paneDict);

    // Create initial layout with sidebar on left, directories in middle, preview on right
    const directoryChildren = directories.map((d) => ({
      children: names[`dir-${d}`],
    }));

    const rootPane: TileBranchSubstance = {
      children: [
        // Top: Options section
        {
          children: names.options,
          grow: 0.25,
        },
        // Bottom: Main content area
        {
          isRow: true,
          grow: 6,
          children: [
            // Left sidebar with favorites, recents, tags
            {
              children: [
                { children: names.favorites, grow: 1 },
                { children: names.recents, grow: 1 },
                { children: names.tags, grow: 1 },
              ],
              grow: 1,
            },
            // Middle section with directories
            {
              children:
                directoryChildren.length > 0
                  ? directoryChildren.map((d) => d.children)
                  : [],
              grow: 10,
              onTab: 1,
            },
            // Right section with preview
            {
              children: names.preview,
              grow: 2,
            },
          ],
        },
      ],
    };

    return { paneList, rootPane };
  }, [directories]);

  return (
    <div className="flex flex-col items-stretch h-full p-6 overflow-hidden">
      {dialogs.RenderOutside}
      <FileBrowserShortcuts />
      <div className="flex-1 overflow-hidden min-w-0 min-h-0">
        <TileProvider tilePanes={paneList} rootNode={rootPane} {...theme()}>
          <AutoSaveLayout />
          <TileContainer className="w-full h-full" />
        </TileProvider>
      </div>
    </div>
  );
}

function FileBrowserFilePreview() {
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
      isResizing={false}
    />
  );
}
function AutoSaveLayout() {
  const getRootNode = useGetRootNode();
  console.log(getRootNode());
  return <></>;
}
