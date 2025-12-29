import { IJsonModel, Model } from "flexlayout-react";
import { defaultPath } from "./defaultPath";
import { directoryStore } from "./directoryStore/directory";
import { DirectoryId } from "./directoryStore/DirectoryBase";
import { layoutStore, selectDefaultLayout } from "./layoutStore";
import { windowArgs } from "@/getWindowElectron";

const isSelectAppMode = windowArgs.isSelectAppMode;

type InitDirectories = Parameters<
  typeof directoryStore.trigger.initDirectories
>[0]["directories"];
function init(
  directories: InitDirectories,
  activeDirectoryId: string,
  layoutJson: IJsonModel,
) {
  directoryStore.trigger.initDirectories({
    directories: directories,
    activeDirectoryId: activeDirectoryId,
  });

  return layoutJson;
}

function initFromPaths(paths: string[]) {
  const directoriesToInit: Parameters<
    typeof directoryStore.trigger.initDirectories
  >[0]["directories"] = paths.map((p) => {
    return {
      fullPath: p,
      type: "path",
      id: Math.random().toString(36).slice(2) as DirectoryId,
    };
  });

  return init(
    directoriesToInit,
    directoriesToInit[0].id,
    createDefaultLayout(directoriesToInit),
  );
}

function createDefaultLayout(directories: InitDirectories) {
  const directoryTabs = directories.map((dir, index) => ({
    type: "tab" as const,
    name: `Directory ${index + 1}`,
    component: "directory",
    config: { directoryId: dir.id },
    enableClose: true,
  }));

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
      splitterSize: 2,
    },
    borders: [],
    layout: {
      type: "row",
      weight: 100,
      children: [
        // Left sidebar column - vertical split with favorites, recents, tags
        {
          type: "row",
          weight: 10,
          children: [
            {
              type: "tabset",
              weight: 33,
              selected: 0,
              enableTabStrip: true,
              children: [
                {
                  type: "tab",
                  name: "FAVORITES",
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
                  name: "RECENTS",
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
                  name: "TAGS",
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
          weight: 80,
          children: [
            {
              type: "tabset",
              weight: 96,
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
          weight: 15,
          selected: 0,
          enableTabStrip: true,
          children: [
            {
              type: "tab",
              name: "PREVIEW",
              component: "preview",
              enableClose: false,
            },
          ],
        },
      ],
    },
  };
}

export const layoutJson = ((): IJsonModel => {
  if (isSelectAppMode && windowArgs.initialPath) {
    return initFromPaths([windowArgs.initialPath]);
  }
  // First, check if there's an applied layout in localStorage (from CustomLayoutsDialog)
  const appliedLayoutStr = localStorage.getItem("mygui-flexlayout-model");
  if (appliedLayoutStr) {
    try {
      const appliedLayout = JSON.parse(appliedLayoutStr);
      if (appliedLayout.layout && appliedLayout.directories) {
        directoryStore.trigger.initDirectories({
          directories: appliedLayout.directories,
          activeDirectoryId:
            appliedLayout.activeDirectoryId || appliedLayout.directories[0]?.id,
        });
        // Clear the applied layout after loading it once
        localStorage.removeItem("mygui-flexlayout-model");
        return appliedLayout.layout;
      }
    } catch (error) {
      console.error("Failed to load applied layout:", error);
      // Clear corrupted data
      localStorage.removeItem("mygui-flexlayout-model");
    }
  }

  // Otherwise, use the default layout from layoutStore
  const layoutStoreState = layoutStore.get();
  const defaultLayout = selectDefaultLayout(layoutStoreState);
  const layoutToUse = defaultLayout || layoutStoreState.context.layouts[0];

  // If we have a saved layout with directories, use it
  if (layoutToUse) {
    return init(
      layoutToUse.directories,
      layoutToUse.activeDirectoryId,
      layoutToUse.layoutJson,
    );
  }

  return initFromPaths(["~/Downloads", defaultPath]);
})();

export const layoutModel = Model.fromJson(layoutJson);
