import { app, BrowserWindow, screen } from "electron";
import { ipcHandle, isDev } from "./util.js";
import { getStaticData, pollResources } from "./resourceManager.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { convertDocxToPdf } from "./utils/docx-to-pdf.js";
import { getInitializedFuzzyFinder } from "./utils/get-initialized-fuzzy-finder.js";
import { getFilesAndFoldersInDirectory } from "./utils/file-browser-helpers.js";
import { openFile } from "./utils/open-file.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { expandHome } from "./utils/expand-home.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  ipcHandle("onDragStart", async (files, event) => {
    event.sender.startDrag({
      files: files.map((file) => expandHome(file)),
      icon: path.join(__dirname, "assets", "file-drag.png"),
      file: "",
    });
  });
});
