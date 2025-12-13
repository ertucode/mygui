import { createStore } from "@xstate/store";
import { z } from "zod";
import { createLocalStoragePersistence } from "./utils/localStorage";
import { sortNames } from "./config/columns";

const fileCategoryFilter = z.enum([
  "all",
  "image",
  "video",
  "audio",
  "document",
  "spreadsheet",
  "presentation",
  "archive",
  "code",
  "font",
  "executable",
  "other",
]);

export type FileCategoryFilter = z.infer<typeof fileCategoryFilter>;

const SettingsSchema = z.object({
  showDotFiles: z.boolean(),
  foldersOnTop: z.boolean(),
  fileTypeFilter: fileCategoryFilter.optional(),
  sort: z.object({
    by: sortNames.nullish(),
    order: z.enum(["asc", "desc"]).nullish(),
  }),
});

export type FileBrowserSettings = z.infer<typeof SettingsSchema>;
export type FileBrowserSort = FileBrowserSettings["sort"];

const defaultSettings: FileBrowserSettings = {
  showDotFiles: false,
  foldersOnTop: true,
  fileTypeFilter: "all",
  sort: {
    by: "ext",
    order: "asc",
  },
};

// Create localStorage persistence helper
const settingsPersistence = createLocalStoragePersistence(
  "fbSettings",
  SettingsSchema,
);

// Create the store
export const fileBrowserSettingsStore = createStore({
  context: {
    settings: settingsPersistence.load(defaultSettings),
  },
  on: {
    toggleShowDotFiles: (context) => ({
      ...context,
      settings: {
        ...context.settings,
        showDotFiles: !context.settings.showDotFiles,
      },
    }),

    toggleFoldersOnTop: (context) => ({
      ...context,
      settings: {
        ...context.settings,
        foldersOnTop: !context.settings.foldersOnTop,
      },
    }),

    setFileTypeFilter: (context, event: { filter: FileCategoryFilter }) => ({
      ...context,
      settings: {
        ...context.settings,
        fileTypeFilter: event.filter,
      },
    }),

    setSort: (context, event: { sort: FileBrowserSort }) => ({
      ...context,
      settings: {
        ...context.settings,
        sort: event.sort,
      },
    }),

    setSettings: (context, event: { settings: FileBrowserSettings }) => ({
      ...context,
      settings: event.settings,
    }),
  },
});

// Subscribe to store changes for persistence
fileBrowserSettingsStore.subscribe((state) => {
  // Persist state changes to localStorage
  settingsPersistence.save(state.context.settings);
});

// Helper functions for common operations
export const fileBrowserSettingsHelpers = {
  toggleShowDotFiles: () =>
    fileBrowserSettingsStore.send({ type: "toggleShowDotFiles" }),

  toggleFoldersOnTop: () =>
    fileBrowserSettingsStore.send({ type: "toggleFoldersOnTop" }),

  setFileTypeFilter: (filter: FileCategoryFilter) =>
    fileBrowserSettingsStore.send({ type: "setFileTypeFilter", filter }),

  setSort: (stateOrCb: FileBrowserSort | ((current: FileBrowserSort) => FileBrowserSort)) => {
    const currentSort = selectSettings(fileBrowserSettingsStore.get()).sort;
    let newSort: FileBrowserSort;
    
    if (typeof stateOrCb === "function") {
      newSort = stateOrCb(currentSort);
    } else {
      newSort = stateOrCb;
    }
    
    fileBrowserSettingsStore.send({ type: "setSort", sort: newSort });
  },

  setSettings: (newSettings: FileBrowserSettings) =>
    fileBrowserSettingsStore.send({ type: "setSettings", settings: newSettings }),
};

// Selector functions for common use cases
export const selectSettings = (state: ReturnType<typeof fileBrowserSettingsStore.get>) =>
  state.context.settings;

export const selectShowDotFiles = (state: ReturnType<typeof fileBrowserSettingsStore.get>) =>
  state.context.settings.showDotFiles;

export const selectFoldersOnTop = (state: ReturnType<typeof fileBrowserSettingsStore.get>) =>
  state.context.settings.foldersOnTop;

export const selectFileTypeFilter = (state: ReturnType<typeof fileBrowserSettingsStore.get>) =>
  state.context.settings.fileTypeFilter;

export const selectSort = (state: ReturnType<typeof fileBrowserSettingsStore.get>) =>
  state.context.settings.sort;

export const FILE_TYPE_FILTER_OPTIONS: {
  value: FileCategoryFilter;
  label: string;
}[] = [
  { value: "all", label: "All files" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Documents" },
  { value: "spreadsheet", label: "Spreadsheets" },
  { value: "presentation", label: "Presentations" },
  { value: "archive", label: "Archives" },
  { value: "code", label: "Code" },
  { value: "font", label: "Fonts" },
  { value: "executable", label: "Executables" },
  { value: "other", label: "Other" },
];