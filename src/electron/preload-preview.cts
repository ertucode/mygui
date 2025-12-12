import electron from "electron";
import {
  EventRequestMapping,
  EventResponseMapping,
  WindowElectron,
} from "../common/Contracts";

electron.contextBridge.exposeInMainWorld("electron", {
  getFilePath: (file: File) => electron.webUtils.getPathForFile(file),
  convertDocxToPdf: (file: File) =>
    ipcInvoke("docxToPdf", electron.webUtils.getPathForFile(file)),
  convertDocxToPdfByPath: (filePath: string) =>
    ipcInvoke("docxToPdf", filePath),
  fuzzyFind: (query: string) => ipcInvoke("fuzzyFind", query),
  getFilesAndFoldersInDirectory: (directory: string) =>
    ipcInvoke("getFilesAndFoldersInDirectory", directory),
  openFile: (filePath: string) => ipcInvoke("openFile", filePath),
  onDragStart: (req) => ipcInvoke("onDragStart", req),
  captureRect: (rect) => ipcInvoke("captureRect", rect),
  getHomeDirectory: () => ipcInvoke("getHomeDirectory", undefined),
  readFilePreview: (filePath: string, allowBigSize?: boolean) =>
    ipcInvoke("readFilePreview", { filePath, allowBigSize }),
  deleteFiles: (filePaths: string[]) => ipcInvoke("deleteFiles", filePaths),
  createFileOrFolder: (parentDir: string, name: string) =>
    ipcInvoke("createFileOrFolder", { parentDir, name }),
  renameFileOrFolder: (fullPath: string, newName: string) =>
    ipcInvoke("renameFileOrFolder", { fullPath, newName }),
  getPreviewPreloadPath: () => ipcInvoke("getPreviewPreloadPath", undefined),
  getStartingDirectory: () => {
    const arg = process.argv.find((x) => x.startsWith("--initial-path="));
    const staticData = arg ? arg.replace("--initial-path=", "") : null;
    return staticData;
  },
  copyFiles: (filePaths: string[], cut: boolean) =>
    ipcInvoke("copyFiles", { filePaths, cut }),
  pasteFiles: (destinationDir: string) =>
    ipcInvoke("pasteFiles", { destinationDir }),
  fuzzyFileFinder: (directory: string, query: string) =>
    ipcInvoke("fuzzyFileFinder", { directory, query }),
  searchStringRecursively: (directory: string, query: string) =>
    ipcInvoke("searchStringRecursively", { directory, query }),
} satisfies WindowElectron);

function ipcInvoke<Key extends keyof EventResponseMapping>(
  key: Key,
  request: Key extends keyof EventRequestMapping
    ? EventRequestMapping[Key]
    : void,
) {
  return electron.ipcRenderer.invoke(key, request);
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

electron.ipcRenderer.on("preview-file", (_event, payload) => {
  window.postMessage({ type: "preview-file", payload }, "*");
});
