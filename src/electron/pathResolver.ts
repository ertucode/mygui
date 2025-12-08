import { app } from "electron";
import path from "path";
import { isDev } from "./util.js";

export function getPreloadPath() {
  return path.join(
    app.getAppPath(),
    isDev() ? "." : "..",
    "/dist-electron/preload.cjs",
  );
}

export function getPreviewPreloadPath() {
  return path.join(
    app.getAppPath(),
    isDev() ? "." : "..",
    "/dist-electron/preload-preview.cjs",
  );
}

export function getUIPath() {
  return path.join(app.getAppPath(), "/dist-react/index.html");
}

export function getPreviewHtmlPath(): string {
  return path.join(app.getAppPath(), "/dist-react/preview.html") as string;
}
