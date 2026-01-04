import electron from "electron";
import {
  EventRequestMapping,
  EventResponseMapping,
  StringSearchOptions,
  ReplaceInFileOptions,
  ReplaceInMultipleFilesOptions,
  WindowElectron,
  ConflictResolution,
} from "../common/Contracts";
import { TaskEvents } from "../common/Tasks";
import { ArchiveTypes } from "../common/ArchiveTypes";
import { GenericEvent } from "../common/GenericEvent";

electron.contextBridge.exposeInMainWorld("electron", {
  isSelectAppMode: () => getArgv("--mode=") === "select-app",
  sendSelectAppResult: (appPath: string | null | undefined) => {
    electron.ipcRenderer.send("selectAppWindowResult", appPath);
  },
  getFilePath: (file: File) => electron.webUtils.getPathForFile(file),
  convertDocxToPdf: (file: File) =>
    ipcInvoke("docxToPdf", electron.webUtils.getPathForFile(file)),
  convertDocxToPdfByPath: (filePath: string) =>
    ipcInvoke("docxToPdf", filePath),
  getFilesAndFoldersInDirectory: (directory: string) =>
    ipcInvoke("getFilesAndFoldersInDirectory", directory),
  openFile: (filePath: string) => ipcInvoke("openFile", filePath),
  onDragStart: (req) => ipcInvoke("onDragStart", req),
  captureRect: (rect) => ipcInvoke("captureRect", rect),
  getWindowArgs: () => getArgv("--window-args=")!,
  readFilePreview: (
    filePath: string,
    allowBigSize?: boolean,
    fullSize?: boolean,
  ) => ipcInvoke("readFilePreview", { filePath, allowBigSize, fullSize }),
  deleteFiles: (filePaths: string[], clientMetadata: any) => ipcInvoke("deleteFiles", { filePaths, clientMetadata }),
  applyVimChanges: (changes: any) => ipcInvoke("applyVimChanges", changes),
  createFileOrFolder: (parentDir: string, name: string) =>
    ipcInvoke("createFileOrFolder", { parentDir, name }),
  createImageFromClipboard: (parentDir: string, name: string) =>
    ipcInvoke("createImageFromClipboard", { parentDir, name }),
  hasClipboardImage: () => ipcInvoke("hasClipboardImage", undefined),
  setClipboardCutMode: (cut: boolean) =>
    ipcInvoke("setClipboardCutMode", { cut }),
  renameFileOrFolder: (fullPath: string, newName: string) =>
    ipcInvoke("renameFileOrFolder", { fullPath, newName }),
  getPreviewPreloadPath: () => ipcInvoke("getPreviewPreloadPath", undefined),
  getStartingDirectory: () => {
    return getArgv("--initial-path=");
  },
  copyFiles: (filePaths: string[], cut: boolean) =>
    ipcInvoke("copyFiles", { filePaths, cut }),
  pasteFiles: (destinationDir: string, resolution?: ConflictResolution) =>
    ipcInvoke("pasteFiles", { destinationDir, resolution }),
  fuzzyFileFinder: (directory: string, query: string) =>
    ipcInvoke("fuzzyFileFinder", { directory, query }),
  searchStringRecursively: (options: StringSearchOptions) =>
    ipcInvoke("searchStringRecursively", options),
  replaceStringInFile: (options: ReplaceInFileOptions) =>
    ipcInvoke("replaceStringInFile", options),
  replaceStringInMultipleFiles: (options: ReplaceInMultipleFilesOptions) =>
    ipcInvoke("replaceStringInMultipleFiles", options),
  fuzzyFolderFinder: (directory: string, query: string) =>
    ipcInvoke("fuzzyFolderFinder", { directory, query }),
  getFileInfoByPaths: (filePaths: string[]) =>
    ipcInvoke("getFileInfoByPaths", filePaths),
  readArchiveContents: (
    archivePath: string,
    archiveType: ArchiveTypes.ArchiveType,
  ) => ipcInvoke("readArchiveContents", { archivePath, archiveType }),
  getDirectorySizes: (parentPath: string, specificDirName?: string) =>
    ipcInvoke("getDirectorySizes", { parentPath, specificDirName }),
  generateVideoThumbnail: (filePath: string) =>
    ipcInvoke("generateVideoThumbnail", filePath),
  generateAppIcon: (filePath: string) => ipcInvoke("generateAppIcon", filePath),
  batchRenameFiles: (
    items: Array<{
      fullPath: string;
      newName: string;
    }>,
  ) => ipcInvoke("batchRenameFiles", items),
  onTaskEvent: (cb: (e: TaskEvents) => void) => {
    const off = ipcOn("task:event", (e: TaskEvents) => cb(e));
    return () => {
      off();
    };
  },
  onGenericEvent: (cb: (e: GenericEvent) => void) => {
    const off = ipcOn("generic:event", (e: GenericEvent) => cb(e));
    return () => {
      off();
    };
  },
  onWindowFocus: (cb: () => void) => {
    const off = ipcOn("window:focus", () => cb());
    return off;
  },
  startArchive: (
    archiveType: ArchiveTypes.ArchiveType,
    source: string[],
    destination: string,
    clientMetadata: any,
  ) => ipcInvoke("startArchive", { archiveType, source, destination, clientMetadata }),
  startUnarchive: (
    archiveType: ArchiveTypes.ArchiveType,
    source: string,
    destination: string,
    clientMetadata: any,
    extractSingleItem?: boolean,
  ) => ipcInvoke("startUnarchive", { archiveType, source, destination, clientMetadata, extractSingleItem }),
  abortTask: (taskId: string) => ipcInvoke("abortTask", taskId),
  getApplicationsForFile: (filePath: string) =>
    ipcInvoke("getApplicationsForFile", filePath),
  openFileWithApplication: (filePath: string, applicationPath: string) =>
    ipcInvoke("openFileWithApplication", { filePath, applicationPath }),
  openSelectAppWindow: (initialPath: string) =>
    ipcInvoke("openSelectAppWindow", { initialPath }),
  openShell: (url: string) => ipcInvoke("openShell", url),
  runCommand: (opts: { name: string; filePath: string; parameters: any }) =>
    ipcInvoke("runCommand", opts),
  getAudioMetadata: (filePath: string) =>
    ipcInvoke("getAudioMetadata", filePath),
} satisfies WindowElectron);

function ipcInvoke<Key extends keyof EventResponseMapping>(
  key: Key,
  request: Key extends keyof EventRequestMapping
    ? EventRequestMapping[Key]
    : void,
) {
  return electron.ipcRenderer.invoke(key, request);
}

function getArgv(key: string) {
  const arg = process.argv.find((x) => x.startsWith(key));
  const staticData = arg ? arg.replace(key, "") : null;
  return staticData;
}

function ipcOn<Key extends keyof EventResponseMapping>(
  key: Key,
  callback: (payload: EventResponseMapping[Key]) => void,
) {
  const cb = (
    _: Electron.IpcRendererEvent,
    payload: EventResponseMapping[Key],
  ) => {
    callback(payload);
  };
  electron.ipcRenderer.on(key, cb);

  return () => {
    electron.ipcRenderer.off(key, cb);
  };
}
