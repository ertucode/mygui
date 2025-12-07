import electron from "electron";

// Expose the same electron API as the main preload
electron.contextBridge.exposeInMainWorld("electron", {
  readFilePreview: (filePath: string) =>
    electron.ipcRenderer.invoke("readFilePreview", filePath),
});

// Listen for messages from the main window via IPC
electron.ipcRenderer.on("preview-file", (_event, payload) => {
  window.postMessage({ type: "preview-file", payload }, "*");
});
