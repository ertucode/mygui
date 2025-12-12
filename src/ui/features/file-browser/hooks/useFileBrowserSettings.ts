import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import z from "zod";
import { sortNames } from "../config/columns";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";

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

export function useFileBrowserSettings() {
  return useLocalStorage("fbSettings", SettingsSchema, {
    showDotFiles: false,
    foldersOnTop: true,
    fileTypeFilter: "all",
    sort: {
      by: "ext",
      order: "asc",
    },
  });
}

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

export class DirectoryDataFromSettings {
  static lastSettings: FileBrowserSettings | undefined;
  static lastData: GetFilesAndFoldersInDirectoryItem[] | undefined;
  static lastResult: GetFilesAndFoldersInDirectoryItem[] | undefined;

  static getDirectoryData(
    d: GetFilesAndFoldersInDirectoryItem[],
    settings: FileBrowserSettings,
  ) {
    if (settings === this.lastSettings && d === this.lastData)
      return this.lastResult!;
    this.lastSettings = settings;
    this.lastData = d;
    this.lastResult = this.getDirectoryDataWithoutCache(d, settings);
    return this.lastResult;
  }

  private static getDirectoryDataWithoutCache(
    d: GetFilesAndFoldersInDirectoryItem[],
    settings: FileBrowserSettings,
  ) {
    let data = d;

    if (!settings.showDotFiles)
      data = data.filter((i) => !i.name.startsWith("."));

    // Filter by file type category (always show folders)
    if (settings.fileTypeFilter && settings.fileTypeFilter !== "all") {
      data = data.filter(
        (i) => i.type === "dir" || i.category === settings.fileTypeFilter,
      );
    }

    if (settings.sort.by === "name") {
      const times = settings.sort.order === "asc" ? 1 : -1;
      data = data.slice().sort((a, b) => {
        return a.name.localeCompare(b.name) * times;
      });
    } else if (settings.sort.by === "modifiedTimestamp") {
      const times = settings.sort.order === "asc" ? 1 : -1;
      data = data.slice().sort((a, b) => {
        if (!a.modifiedTimestamp && !b.modifiedTimestamp) return 0;
        if (!a.modifiedTimestamp) return -1;
        if (!b.modifiedTimestamp) return 1;
        return (a.modifiedTimestamp - b.modifiedTimestamp) * times;
      });
    } else if (settings.sort.by === "size") {
      const times = settings.sort.order === "asc" ? 1 : -1;
      data = data.slice().sort((a, b) => {
        if (!a.size && !b.size) return 0;
        if (!a.size) return 1;
        if (!b.size) return -1;
        return (a.size - b.size) * times;
      });
    } else if (settings.sort.by === "ext") {
      const times = settings.sort.order === "asc" ? 1 : -1;
      data = data.slice().sort((a, b) => {
        if (!a.ext && !b.ext) return 0;
        if (!a.ext) return 1;
        if (!b.ext) return -1;
        return a.ext.localeCompare(b.ext) * times;
      });
    }

    if (settings.foldersOnTop) {
      data = data.slice().sort((a, b) => {
        if (a.type === "dir" && b.type !== "dir") return -1;
        if (a.type !== "dir" && b.type === "dir") return 1;
        return 0;
      });
    }

    return data;
  }
}
