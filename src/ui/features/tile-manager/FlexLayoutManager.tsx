import React, {
  useRef,
  useCallback,
  useMemo,
  useEffect,
  ComponentProps,
} from "react";
import {
  Layout,
  TabNode,
  ITabSetRenderValues,
  ITabRenderValues,
  TabSetNode,
  BorderNode,
  Actions,
  IIcons,
  IJsonTabNode,
} from "flexlayout-react";
import { BottomToolbar } from "../file-browser/components/BottomToolbar";
import { CustomTitleBar } from "../file-browser/components/CustomTitleBar";
import {
  directoryStore,
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
  XIcon,
  ChevronDownIcon,
  Trash2Icon,
  SaveIcon,
  LoaderIcon,
} from "lucide-react";
import { clsx } from "@/lib/functions/clsx";
import { Button } from "@/lib/components/button";
import "./FlexLayoutManager.css";
import { TAG_COLOR_CLASSES } from "../file-browser/tags";
import { useShortcuts } from "@/lib/hooks/useShortcuts";
import {
  clearLayout,
  layoutModel,
  saveLayout,
} from "../file-browser/initializeDirectory";
import { toast } from "@/lib/components/toast";
import { useDirectoryLoading } from "../file-browser/directoryLoadingStore";
import { LayoutHelpers } from "../file-browser/utils/LayoutHelpers";
import { layoutFactory } from "./layoutFactory";

// Component factory function
function DirectoryTabLabel({ directoryId }: { directoryId: DirectoryId }) {
  const directory = useSelector(directoryStore, selectDirectory(directoryId));

  if (directory.type !== "path")
    return (
      <div
        className={clsx(
          "size-3 min-w-3 rounded-full flex-shrink-0",
          TAG_COLOR_CLASSES[directory.color].dot,
        )}
      />
    );

  return (
    <>
      <span className="text-xs truncate max-w-[200px]">
        {directory.fullPath}
      </span>
    </>
  );
}

export const FlexLayoutManager: React.FC = () => {
  const layoutRef = useRef<Layout>(null);
  const dialogs = useDialogStoreRenderer();
  const isSyncingFromStore = useRef(false); // Prevent feedback loop

  // Icons for the layout
  const icons: IIcons = useMemo(
    () => ({
      edgeArrow: <ChevronDownIcon className="w-4 h-4" />,
      more: <ChevronDownIcon className="size-3" />,
    }),
    [],
  );

  useShortcuts([
    {
      key: { key: "y", ctrlKey: true },
      notKey: { key: "y", ctrlKey: true, metaKey: true },
      handler: () => {
        saveLayout();
        toast.show({
          severity: "success",
          message: "Layout saved",
          customIcon: SaveIcon,
        });
      },
      label: "Save layout",
    },
    {
      key: { key: "y", ctrlKey: true, metaKey: true },
      handler: () => {
        clearLayout();
        toast.show({
          severity: "success",
          message: "Layout cleared",
          customIcon: Trash2Icon,
        });
      },
      label: "Clear layout",
    },
  ]);

  // Save model to localStorage on changes
  const handleModelChange = useCallback(() => {
    // Prevent feedback loop: Don't update directoryStore if we're syncing FROM directoryStore
    if (isSyncingFromStore.current) {
      return;
    }

    const directoryId = LayoutHelpers.getActiveDirectoryId();
    if (!directoryId) return;
    directoryStore.trigger.setActiveDirectoryId({ directoryId });
  }, []);

  useEffect(() => {
    const unsub = directoryStore.subscribe((s) => {
      const directoryId = s.context.activeDirectoryId;
      if (!directoryId) return;

      let done = false;

      layoutModel.visitNodes((node) => {
        if (done) return;
        if (
          LayoutHelpers.isDirectory(node) &&
          node.getConfig()?.directoryId === directoryId
        ) {
          done = true;
          const targetTab = node;

          if (!targetTab) return;

          const tabset = targetTab.getParent();
          if (!tabset) return;

          const activeTabset = layoutModel.getActiveTabset();
          const activeTab = activeTabset?.getSelectedNode();

          // Avoid loops / redundant work
          if (
            activeTabset?.getId() === tabset.getId() &&
            activeTab?.getId() === targetTab.getId()
          ) {
            return;
          }

          // Set flag to prevent feedback loop
          isSyncingFromStore.current = true;

          // 1️⃣ Activate tabset
          layoutModel.doAction(Actions.setActiveTabset(tabset.getId()));

          const idx = tabset
            .getChildren()
            .findIndex((c) => c.getId() === targetTab?.getId());
          if (idx !== -1) {
            tabset.setSelected(idx);
          }

          // Reset flag after a brief delay to allow FlexLayout to settle
          setTimeout(() => {
            isSyncingFromStore.current = false;
          }, 100);
        }
      });
    });

    return unsub.unsubscribe;
  }, []);

  // Custom tab renderer - use actual Button component
  const onRenderTab = (node: TabNode, renderValues: ITabRenderValues) => {
    const component = node.getComponent();
    const config = node.getConfig();

    // Check if this tab is selected - getSelected() returns index, need to get selected tab
    const parent = node.getParent();
    let isSelected = false;
    let parentIsActive = false;
    if (parent && parent instanceof TabSetNode) {
      parentIsActive = parent.isActive();
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

    const isDirectory = component === "directory" && config?.directoryId;
    const noSiblings = node?.getParent()?.getChildren()?.length === 1;

    // Use your actual Button component with join-item styling
    renderValues.content = isDirectory ? (
      <div
        className={clsx(
          "join-item cursor-move flex items-center gap-3 h-full p-2",
          isSelected && "shadow-[inset_0_-3px_0_0_var(--color-primary)]",
          (!parentIsActive || !isSelected) && "opacity-60",
          "dir-marker",
        )}
      >
        <DirectoryIcon directoryId={config.directoryId} />
        <DirectoryTabLabel directoryId={config.directoryId} />
        <div
          key={`close-${node.getId()}`}
          className="join-item cursor-pointer flex items-center gap-3 h-full"
          title="Close"
          onClick={(e) => {
            e.stopPropagation();
            layoutModel.doAction(Actions.deleteTab(node.getId()));
          }}
        >
          <XIcon className="size-4" />
        </div>
      </div>
    ) : (
      <div
        className={clsx(
          "join-item cursor-move flex items-center gap-2 p-1 pl-2 h-full text-xs",
          node.isSelected() &&
            !noSiblings &&
            "shadow-[inset_0_-3px_0_0_var(--color-primary)]",
          !noSiblings && "px-2",
        )}
      >
        <Icon className="size-4" />
        {noSiblings && node.getName()}
      </div>
    );

    // Customize close button with our Button component
    if (node.isEnableClose()) {
      renderValues.buttons = [
        // <Button
        //   key={`close-${node.getId()}`}
        //   icon={XIcon}
        //   className="btn-ghost btn-sm btn-square join-item rounded-none"
        //   title="Close"
        //   onClick={(e) => {
        //     e.stopPropagation();
        //     layoutModel.doAction(Actions.deleteTab(node.getId()));
        //   }}
        // />,
      ];
    }
  };

  useEffect(() => {
    directoryStore.on("directoryCreated", (e) => {
      const json: IJsonTabNode = {
        component: "directory",
        name: `Directory ${Date.now()}`,
        config: { directoryId: e.directoryId },
      };
      if (e.tabId) {
        layoutRef.current?.addTabToTabSet(e.tabId, json);
      } else {
        layoutRef.current?.addTabToActiveTabSet(json);
      }
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
              className="btn-ghost btn-sm btn-square rounded-none directory-tabset-marker"
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
              className="btn-ghost btn-sm btn-square rounded-none"
              title="Maximize Thing"
              onClick={() => {
                if (layoutRef.current) {
                  layoutModel.doAction(
                    Actions.maximizeToggle(tabSetNode.getId()),
                  );
                }
              }}
            />,
          );
        }
      }
    },
    [],
  );

  // Render drag preview when dragging tabs/panes
  const onRenderDragRect = useCallback(
    (content: React.ReactNode | undefined) => {
      return content;
    },
    [],
  );

  type ActionFn = Exclude<ComponentProps<typeof Layout>["onAction"], undefined>;
  const onAction: ActionFn = useCallback((action) => {
    // TODO: we will disable deleting the last directory tab here
    return action;
  }, []);

  return (
    <div className="flex flex-col items-stretch h-full overflow-hidden">
      {dialogs.RenderOutside}
      <FileBrowserShortcuts />
      <CustomTitleBar />
      <div className="flex-1 min-w-0 min-h-0 relative">
        <Layout
          ref={layoutRef}
          model={layoutModel}
          factory={layoutFactory}
          onAction={onAction}
          icons={icons}
          onModelChange={handleModelChange}
          onRenderTab={onRenderTab}
          onRenderTabSet={onRenderTabSet}
          onRenderDragRect={onRenderDragRect}
        />
      </div>
      <BottomToolbar />
    </div>
  );
};

function DirectoryIcon({ directoryId }: { directoryId: DirectoryId }) {
  const isLoading = useDirectoryLoading(directoryId);
  return isLoading ? (
    <LoaderIcon className="size-4 animate-spin" />
  ) : (
    <FoldersIcon className="size-4" />
  );
}
