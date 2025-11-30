import { app, BrowserWindow, screen } from "electron";
import { ipcHandle, isDev } from "./util.js";
import { getPreloadPath, getUIPath } from "./pathResolver.js";
import { convertDocxToPdf } from "./utils/docx-to-pdf.js";
import { getFilesAndFoldersInDirectory } from "./utils/file-browser-helpers.js";
import { openFile } from "./utils/open-file.js";
import { getInitializedFuzzyFinder } from "./utils/get-initialized-fuzzy-finder.js";
import { expandHome } from "./utils/expand-home.js";
import { base64ImageToTempPath } from "./utils/base64-image-to-temp-path.js";
import { captureRect } from "./utils/capture-rect.js";
import { getFileContent } from "./utils/get-file-content.js";
import { deleteFiles } from "./utils/delete-files.js";

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
      icon: base64ImageToTempPath(app, image),
      file: "",
    });
  });

  ipcHandle("captureRect", async (rect, event) => {
    return captureRect(rect, event);
  });

  ipcHandle("getHomeDirectory", () => {
    return "/" + app.getPath("home");
  });

  ipcHandle("readFilePreview", getFileContent);
  ipcHandle("deleteFiles", deleteFiles);
});
