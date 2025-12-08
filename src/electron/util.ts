import { ipcMain } from "electron";
import { getPreviewHtmlPath, getUIPath } from "./pathResolver.js";
import { pathToFileURL } from "url";

export function isDev() {
  return process.env.NODE_ENV === "development";
}

export function ipcHandle<Key extends keyof EventResponseMapping>(
  key: Key,
  handler: (
    request: EventRequest<Key>,
    event: Electron.IpcMainInvokeEvent,
  ) => EventResponseMapping[Key],
) {
  ipcMain.handle(key, (event, request) => {
    console.log("ipcHandle", key, request);
    event.senderFrame && validateEventFrame(event.senderFrame);
    return handler(request, event);
  });
}

export function ipcWebContentsSend<Key extends keyof EventResponseMapping>(
  key: Key,
  webContents: Electron.WebContents,
  payload: EventResponseMapping[Key],
) {
  webContents.send(key, payload);
}

export function validateEventFrame(frame: Electron.WebFrameMain) {
  if (isDev() && new URL(frame.url).host === "localhost:5123") {
    return;
  }

  if (frame.url === pathToFileURL(getUIPath()).toString()) return;
  if (frame.url === pathToFileURL(getPreviewHtmlPath()).toString()) return;
  throw new Error(
    "Malicious attempt to send IPC messages to the UI. This is a security risk.",
  );
}
