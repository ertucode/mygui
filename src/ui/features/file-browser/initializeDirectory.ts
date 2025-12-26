import { IJsonModel, Model } from "flexlayout-react";
import { defaultPath } from "./defaultPath";
import { directoryStore } from "./directoryStore/directory";
import { DirectoryId } from "./directoryStore/DirectoryBase";
import { layoutStore, selectDefaultLayout } from "./layoutStore";

export const layoutJson = ((): IJsonModel => {
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
    directoryStore.trigger.initDirectories({
      directories: layoutToUse.directories,
      activeDirectoryId: layoutToUse.activeDirectoryId,
    });

    return layoutToUse.layoutJson;
  }

  // Otherwise, create default directories and layout
  const directoriesToInit: Parameters<
    typeof directoryStore.trigger.initDirectories
  >[0]["directories"] = [
    {
      fullPath: "~/dev/react-native",
      type: "path",
      id: Math.random().toString(36).slice(2) as DirectoryId,
    },
    {
      fullPath: defaultPath,
      type: "path",
      id: Math.random().toString(36).slice(2) as DirectoryId,
    },
  ];
  directoryStore.trigger.initDirectories({
    directories: directoriesToInit,
    activeDirectoryId: directoriesToInit[0].id,
  });

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
})();

export const layoutModel = Model.fromJson(layoutJson);
