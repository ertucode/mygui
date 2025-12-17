import React, {
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useState,
} from "react";
import {
  Layout,
  Model,
  TabNode,
  ITabSetRenderValues,
  ITabRenderValues,
  IJsonModel,
  TabSetNode,
  BorderNode,
  Actions,
} from "flexlayout-react";
import "/assets/flexlayout-react.css";
// import "flexlayout-react/style/light.css";
import { FavoritesList } from "../file-browser/components/FavoritesList";
import { RecentsList } from "../file-browser/components/RecentsList";
import { TagsList } from "../file-browser/components/TagsList";
import { DirectoryTablePane } from "../file-browser/components/DirectoryTablePane";
import { FilePreview } from "../file-browser/components/FilePreview";
import { FileBrowserOptionsSection } from "../file-browser/components/FileBrowserOptionsSection";
import {
  directoryStore,
  directoryHelpers,
  selectSelection,
  directoryDerivedStores,
  DirectoryId,
  selectDirectory,
} from "../file-browser/directory";
import { useSelector } from "@xstate/store/react";
import { FileBrowserShortcuts } from "../file-browser/FileBrowserShortcuts";
import { useDialogStoreRenderer } from "../file-browser/dialogStore";
import {
  ClockIcon,
  EyeIcon,
  FoldersIcon,
  HeartIcon,
  TagIcon,
  PlusIcon,
  Maximize2Icon,
} from "lucide-react";
import { clsx } from "@/lib/functions/clsx";
import { Button } from "@/lib/components/button";
import "./FlexLayoutManager.css";
import { TAG_COLOR_CLASSES } from "../file-browser/tags";

const LOCAL_STORAGE_KEY = "mygui-flexlayout-model";

const layoutJson = ((): IJsonModel => {
  const savedModel = localStorage.getItem(LOCAL_STORAGE_KEY);

  // If we have a saved model with directories, use it
  if (savedModel) {
    try {
      const parsed = JSON.parse(savedModel);
      return parsed;
    } catch (e) {
      console.error("Failed to load saved layout:", e);
    }
  }
  const directories = directoryStore.getSnapshot().context.directoryOrder;

  // Create directory tabs
  const directoryTabs = directories.map((dirId, index) => ({
    type: "tab" as const,
    name: `Directory ${index + 1}`,
    component: "directory",
    config: { directoryId: dirId },
    enableClose: true,
  }));

  // Build the complete layout
  return {
    global: {
      tabEnableClose: true,
      tabEnableRename: false,
      tabEnableDrag: true,
      tabSetEnableMaximize: false,
      tabSetEnableTabStrip: true,
      tabSetEnableDrop: true,
      tabSetEnableDrag: true,
      tabSetEnableDivide: true,
      tabSetEnableClose: false,
      borderEnableDrop: true,
      splitterSize: 8,
    },
    borders: [],
    layout: {
      type: "row",
      weight: 100,
      children: [
        // Left sidebar column - vertical split with favorites, recents, tags
        {
          type: "row",
          weight: 15,
          children: [
            {
              type: "tabset",
              weight: 33,
              selected: 0,
              enableTabStrip: true,
              children: [
                {
                  type: "tab",
                  name: "Favorites",
                  component: "favorites",
                  enableClose: false,
                },
              ],
            },
            {
              type: "tabset",
              weight: 33,
              selected: 0,
              enableTabStrip: true,
              children: [
                {
                  type: "tab",
                  name: "Recents",
                  component: "recents",
                  enableClose: false,
                },
              ],
            },
            {
              type: "tabset",
              weight: 34,
              selected: 0,
              enableTabStrip: true,
              children: [
                {
                  type: "tab",
                  name: "Tags",
                  component: "tags",
                  enableClose: false,
                },
              ],
            },
          ],
        },
        // Middle: Options at top, directories below
        {
          type: "row",
          weight: 60,
          children: [
            {
              type: "tabset",
              weight: 8,
              selected: 0,
              enableTabStrip: false,
              children: [
                {
                  type: "tab",
                  name: "Options",
                  component: "options",
                  enableClose: false,
                },
              ],
            },
            {
              type: "tabset",
              weight: 92,
              selected: 0,
              enableTabStrip: true,
              children:
                directoryTabs.length > 0
                  ? directoryTabs
                  : [
                      {
                        type: "tab",
                        name: "No Directories",
                        component: "placeholder",
                      },
                    ],
            },
          ],
        },
        // Right preview section
        {
          type: "tabset",
          weight: 25,
          selected: 0,
          enableTabStrip: false,
          children: [
            {
              type: "tab",
              name: "Preview",
              component: "preview",
              enableClose: false,
            },
          ],
        },
      ],
    },
  };
})();

const model = Model.fromJson(layoutJson);

// Component factory function
function createFactory(isResizing: boolean) {
  return (node: TabNode) => {
    const component = node.getComponent();
    const config = node.getConfig();

    const paneClassName = "w-full h-full flex flex-col overflow-auto";

    switch (component) {
      case "favorites":
        return (
          <div className={paneClassName}>
            <FavoritesList />
          </div>
        );
      case "recents":
        return (
          <div className={paneClassName}>
            <RecentsList />
          </div>
        );
      case "tags":
        return (
          <div className={paneClassName}>
            <TagsList />
          </div>
        );
      case "options":
        return (
          <div className={paneClassName}>
            <FileBrowserOptionsSection />
          </div>
        );
      case "preview":
        return (
          <div className={paneClassName}>
            <FileBrowserFilePreview isResizing={isResizing} />
          </div>
        );
      case "directory":
        return (
          <div className={paneClassName}>
            <DirectoryTablePane directoryId={config?.directoryId} />
          </div>
        );
      case "placeholder":
        return <div className={paneClassName}>Placeholder Pane</div>;
      default:
        return (
          <div className={paneClassName}>Unknown Component: {component}</div>
        );
    }
  };
}

function FileBrowserFilePreview({ isResizing }: { isResizing: boolean }) {
  const activeDirectoryId = useSelector(
    directoryStore,
    (s) => s.context.activeDirectoryId,
  );
  const selection = useSelector(
    directoryStore,
    selectSelection(activeDirectoryId),
  );
  const filteredDirectoryData = directoryDerivedStores
    .get(activeDirectoryId)
    ?.useFilteredDirectoryData();

  // Get selected file for preview (only if exactly one file is selected)
  const selectedItem =
    filteredDirectoryData &&
    selection.indexes.size === 1 &&
    selection.last != null
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
      isResizing={isResizing}
    />
  );
}

function DirectoryTabLabel({ directoryId }: { directoryId: DirectoryId }) {
  const directory = useSelector(directoryStore, selectDirectory(directoryId));

  if (directory.type !== "path")
    return (
      <span className="text-xs truncate max-w-[200px]">
        <span
          className={clsx(
            "size-3 min-w-3 rounded-full flex-shrink-0",
            TAG_COLOR_CLASSES[directory.color].dot,
          )}
        />
      </span>
    );

  return (
    <span className="text-xs truncate max-w-[200px]">{directory.fullPath}</span>
  );
}

export const FlexLayoutManager: React.FC = () => {
  const layoutRef = useRef<Layout>(null);
  const dialogs = useDialogStoreRenderer();
  const [isResizing, setIsResizing] = useState(false);

  // Icons for the layout
  const icons = useMemo(
    () => ({
      edgeArrow: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
      ),
    }),
    [],
  );

  // Save model to localStorage on changes
  const handleModelChange = useCallback((_newModel: Model) => {
    // const json = newModel.toJson();
    // localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json));
  }, []);

  // Custom tab renderer - use actual Button component
  const onRenderTab = (node: TabNode, renderValues: ITabRenderValues) => {
    const component = node.getComponent();
    const config = node.getConfig();

    // Check if this tab is selected - getSelected() returns index, need to get selected tab
    const parent = node.getParent();
    let isSelected = false;
    if (parent && parent instanceof TabSetNode) {
      const selectedIndex = parent.getSelected();
      const children = parent.getChildren();
      if (selectedIndex >= 0 && selectedIndex < children.length) {
        isSelected = children[selectedIndex] === node;
      }
    }

    // Get icon based on component type
    let Icon = FoldersIcon;
    if (component === "favorites") Icon = HeartIcon;
    else if (component === "recents") Icon = ClockIcon;
    else if (component === "tags") Icon = TagIcon;
    else if (component === "preview") Icon = EyeIcon;

    // Use your actual Button component with join-item styling
    renderValues.content = (
      <Button
        icon={Icon}
        className={clsx(
          "btn-ghost btn-sm join-item",
          isSelected && "btn-active",
        )}
      >
        {component === "directory" && config?.directoryId ? (
          <DirectoryTabLabel directoryId={config.directoryId} />
        ) : (
          <span className="text-xs">{node.getName()}</span>
        )}
      </Button>
    );
  };

  useEffect(() => {
    directoryStore.on("directoryCreated", (e) => {
      layoutRef.current?.addTabToTabSet(e.tabId, {
        component: "directory",
        name: `Directory ${Date.now()}`,
        config: { directoryId: e.directoryId },
      });
    });
  }, []);

  // Custom tab header renderer with add button and titles
  const onRenderTabSet = useCallback(
    (
      tabSetNode: TabSetNode | BorderNode,
      renderValues: ITabSetRenderValues,
    ) => {
      renderValues.buttons = [];
      // Only add button for TabSetNode, not BorderNode
      if (tabSetNode instanceof TabSetNode) {
        const children = tabSetNode.getChildren();

        // Check if this is the directory tabset
        const isDirectoryTabSet = children.some((child) => {
          if (child instanceof TabNode) {
            return child.getComponent() === "directory";
          }
          return false;
        });

        if (isDirectoryTabSet) {
          renderValues.buttons.push(
            <Button
              key="add-directory"
              icon={PlusIcon}
              className="btn-ghost btn-sm btn-square"
              title="Add New Directory"
              onClick={() => {
                directoryStore.trigger.createDirectory({
                  tabId: tabSetNode.getId(),
                });
              }}
            />,
          );

          renderValues.buttons.push(
            <Button
              key="maximize-thing"
              icon={Maximize2Icon}
              className="btn-ghost btn-sm btn-square"
              title="Maximize Thing"
              onClick={() => {
                if (layoutRef.current) {
                  model.doAction(Actions.maximizeToggle(tabSetNode.getId()));
                }
              }}
            />,
          );
        }
      }
    },
    [],
  );

  const factory = useMemo(() => createFactory(isResizing), [isResizing]);

  // Detect when resizing/dragging is happening
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Check if the mouse is on a splitter (drag bar between panes)
      const target = e.target as HTMLElement;
      if (
        target.classList.contains("flexlayout__splitter") ||
        target.classList.contains("flexlayout__splitter_drag") ||
        target.closest(".flexlayout__splitter")
      ) {
        setIsResizing(true);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Render drag preview when dragging tabs/panes
  const onRenderDragRect = useCallback(
    (content: React.ReactNode | undefined) => {
      return content;
    },
    [],
  );

  return (
    <div className="flex flex-col items-stretch h-full p-6 overflow-hidden">
      {dialogs.RenderOutside}
      <FileBrowserShortcuts />
      <div className="flex-1 min-w-0 min-h-0 relative">
        <Layout
          ref={layoutRef}
          model={model}
          factory={factory}
          icons={icons}
          onModelChange={handleModelChange}
          onRenderTab={onRenderTab}
          onRenderTabSet={onRenderTabSet}
          onRenderDragRect={onRenderDragRect}
        />
      </div>
    </div>
  );
};
