import { app, BrowserWindow } from "electron";
import { ipcHandle, isDev } from "./util.js";
import { getStaticData, pollResources } from "./resourceManager.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { convertDocxToPdf } from "./utils/docx-to-pdf.js";
import { getInitializedFuzzyFinder } from "./utils/get-initialized-fuzzy-finder.js";
import { getFilesAndFoldersInDirectory } from "./utils/file-browser-helpers.js";
import { openFile } from "./utils/open-file.js";

app.on("ready", () => {
  const mainWindow = new BrowserWindow({
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
});
