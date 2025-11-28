import { app, BrowserWindow, screen } from "electron";
import { ipcHandle, isDev } from "./util.js";
import { getStaticData, pollResources } from "./resourceManager.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { convertDocxToPdf } from "./utils/docx-to-pdf.js";
import { getInitializedFuzzyFinder } from "./utils/get-initialized-fuzzy-finder.js";
import { getFilesAndFoldersInDirectory } from "./utils/file-browser-helpers.js";
import { openFile } from "./utils/open-file.js";
import { expandHome } from "./utils/expand-home.js";
import { base64ImageToTempPath } from "./utils/base64-image-to-temp-path.js";

app.on("ready", () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const mainWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      preload: getPreloadPath(),
    },
  });

  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(getUIPath());
  }

  pollResources(mainWindow);

  ipcHandle("getStaticData", () => getStaticData());
  ipcHandle("docxToPdf", (filePath: string) =>
    convertDocxToPdf(filePath, undefined, { copyBase64ToClipboard: true }),
  );

  getInitializedFuzzyFinder({
    filePathOptions: { extensions: ["docx"] },
  }).then((fuzzyFinder) => {
    ipcHandle("fuzzyFind", (query) => {
      const results = fuzzyFinder.search(query, { limit: 50 });
      return results.map((result) => result.item.actual);
    });
  });

  ipcHandle("getFilesAndFoldersInDirectory", getFilesAndFoldersInDirectory);
  ipcHandle("openFile", openFile);
  ipcHandle("onDragStart", async ({ files, image }, event) => {
    event.sender.startDrag({
      files: files.map((file) => expandHome(file)),
      //icon: path.join(__dirname, "assets", "file-drag.png"),
      // icon: base64ImageToTempPath(app, await captureRect(rect, event)),
      icon: base64ImageToTempPath(app, image),
      file: "",
    });
  });

  async function captureRect(
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

  ipcHandle("captureRect", async (rect, event) => {
    return captureRect(rect, event);
  });

  ipcHandle("getHomeDirectory", () => {
    return "/" + app.getPath("home");
  });

  ipcHandle("readFilePreview", async (filePath: string) => {
    try {
      const fs = await import("fs/promises");
      
      // Expand home directory if needed
      const fullPath = expandHome(filePath);
      
      // Check file size first
      const stats = await fs.stat(fullPath);
      const maxSize = 1024 * 1024; // 1MB
      
      if (stats.size > maxSize) {
        return { error: `File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 1MB.` };
      }
      
      // Read file content
      const content = await fs.readFile(fullPath, "utf-8");
      
      return { content, isTruncated: false };
    } catch (error) {
      if (error instanceof Error) {
        return { error: error.message };
      }
      return { error: "Unknown error reading file" };
    }
  });
});
