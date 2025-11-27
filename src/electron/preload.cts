import electron from "electron";

electron.contextBridge.exposeInMainWorld("electron", {
  subscribeStatistics: (callback: (statistics: any) => void) => {
    return ipcOn("statistics", callback);
  },
  getStatistics: () => ipcInvoke("getStaticData", undefined),
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
} satisfies Window["electron"]);

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
