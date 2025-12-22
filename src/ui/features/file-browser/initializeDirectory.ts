import { IJsonModel, Model } from "flexlayout-react";
import z from "zod";
import { TAG_COLORS } from "./tags";
import { defaultPath } from "./defaultPath";
import { directoryStore } from "./directoryStore/directory";
import { DirectoryId } from "./directoryStore/DirectoryBase";

const layoutStorageSchema = z.object({
  layout: z.any(),
  directories: z.array(
    z
      .object({
        id: z.string(),
      })
      .and(
        z
          .object({
            fullPath: z.string(),
            type: z.literal("path"),
          })
          .or(
            z.object({
              type: z.literal("tags"),
              color: z.enum(TAG_COLORS),
            }),
          ),
      ),
  ),
  activeDirectoryId: z.string(),
});
type LayoutStorage = z.infer<typeof layoutStorageSchema>;
const LOCAL_STORAGE_KEY = "mygui-flexlayout-model";

export const layoutJson = ((): IJsonModel => {
  const savedModel = localStorage.getItem(LOCAL_STORAGE_KEY);

  // If we have a saved model with directories, use it
  if (savedModel) {
    try {
      const parsed = JSON.parse(savedModel);
      const storage = layoutStorageSchema.parse(parsed);

      directoryStore.trigger.initDirectories({
        directories: storage.directories,
        activeDirectoryId: storage.activeDirectoryId,
      });

      return storage.layout;
    } catch (e) {
      console.error("Failed to load saved layout:", e);
    }
  }
  const directoriesToInit: Parameters<
    typeof directoryStore.trigger.initDirectories
  >[0]["directories"] = [
    {
      fullPath: "~/Downloads/",
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

export function saveLayout() {
  const snapshot = directoryStore.getSnapshot();
  const storage: LayoutStorage = {
    layout: layoutModel.toJson(),
    directories: snapshot.context.directoryOrder.map((id) => {
      const directory = snapshot.context.directoriesById[id];
      return {
        id,
        ...directory.directory,
      };
    }),
    activeDirectoryId: snapshot.context.activeDirectoryId,
  };
  console.log(storage);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storage));
}

export function clearLayout() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export const layoutModel = Model.fromJson(layoutJson);
