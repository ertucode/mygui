import React, { useRef, ComponentProps } from "react";
import { Layout } from "flexlayout-react";
import { BottomToolbar } from "../file-browser/components/BottomToolbar";
import { CustomTitleBar } from "../file-browser/components/CustomTitleBar";
import { FileBrowserShortcuts } from "../file-browser/FileBrowserShortcuts";
import { useDialogStoreRenderer } from "../file-browser/dialogStore";
import "./FlexLayoutManager.css";
import { layoutModel } from "../file-browser/initializeDirectory";
import { layoutFactory } from "./layoutFactory";
import { onRenderTab } from "./onRenderTab";
import { onRenderTabSet } from "./onRenderTabSetFn";
import { useSyncDirectoryStoreAndLayout } from "./useSyncDirectoryStoreAndLayout";
import { LayoutShortcuts } from "./LayoutShortcuts";
import { LayoutHelpers } from "../file-browser/utils/LayoutHelpers";

export const FlexLayoutManager: React.FC = () => {
  const layoutRef = useRef<Layout>(null);
  const dialogs = useDialogStoreRenderer();

  const { handleModelChange } = useSyncDirectoryStoreAndLayout({ layoutRef });

  return (
    <div className="flex flex-col items-stretch h-full overflow-hidden">
      <LayoutShortcuts />
      {dialogs.RenderOutside}
      <FileBrowserShortcuts />
      <CustomTitleBar />
      <div className="flex-1 min-w-0 min-h-0 relative">
        <Layout
          ref={layoutRef}
          model={layoutModel}
          factory={layoutFactory}
          onAction={layoutActionFn}
          onModelChange={handleModelChange}
          onRenderTab={onRenderTab}
          onRenderTabSet={onRenderTabSet}
        />
      </div>
      <BottomToolbar />
    </div>
  );
};

type LayoutActionFn = Exclude<
  ComponentProps<typeof Layout>["onAction"],
  undefined
>;
const layoutActionFn: LayoutActionFn = (action) => {
  const directories = LayoutHelpers.getDirectoryIds();
  if (
    action.type === "FlexLayout_SetActiveTabset" &&
    directories.length === 1
  ) {
    return undefined;
  }
  return action;
};
