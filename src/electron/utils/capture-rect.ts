import { BrowserWindow } from "electron";

export async function captureRect(
  rect: Electron.Rectangle,
  event: Electron.IpcMainInvokeEvent,
) {
  const win = BrowserWindow.fromWebContents(event.sender)!;
  const image = await win.capturePage(rect);
  const width = 800;
  return image
    .resize({ width, height: width * image.getAspectRatio() })
    .toDataURL();
}
