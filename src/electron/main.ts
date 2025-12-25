import { app, BrowserWindow, Menu, screen } from "electron";
import os from "os";
import { ipcHandle, isDev } from "./util.js";
import {
  getPreloadPath,
  getPreviewPreloadPath,
  getUIPath,
} from "./pathResolver.js";
import { convertDocxToPdf } from "./utils/docx-to-pdf.js";
import {
  getFilesAndFoldersInDirectory,
  getFileInfoByPaths,
} from "./utils/get-files-and-folders-in-directory.js";
import { openFile } from "./utils/open-file.js";
import { expandHome } from "./utils/expand-home.js";
import { base64ImageToTempPath } from "./utils/base64-image-to-temp-path.js";
import { captureRect } from "./utils/capture-rect.js";
import { getFileContent } from "./utils/get-file-content.js";
import { deleteFiles } from "./utils/delete-files.js";
import { createFileOrFolder } from "./utils/create-file-or-folder.js";
import { renameFileOrFolder } from "./utils/rename-file-or-folder.js";
import { batchRenameFiles } from "./utils/batch-rename-files.js";
import { copyFiles, setClipboardCutMode } from "./utils/copy-files.js";
import { pasteFiles } from "./utils/paste-files.js";
import { fuzzyFileFinder } from "./utils/fuzzy-file-finder.js";
import { searchStringRecursively } from "./utils/search-string-recursively.js";
import { fuzzyFolderFinder } from "./utils/fuzzy-folder-finder.js";
import { readZipContents } from "./utils/read-zip-contents.js";
import { zipFiles } from "./utils/zip-files.js";
import { unzipFile } from "./utils/unzip-file.js";
import { getDirectorySizes } from "./utils/get-directory-size.js";
import { generateVideoThumbnail } from "./utils/generate-video-thumbnail.js";
import { xlsxWorkerPool } from "./utils/xlsx-worker-pool.js";
import { TaskManager } from "./TaskManager.js";

// Handle folders/files opened via "open with" or as default app
let pendingOpenPath: string | undefined;

app.on("open-file", (event, path) => {
  event.preventDefault();
  pendingOpenPath = path;

  // If app is already ready, create a new window with this path
  if (app.isReady()) {
    createWindow(path);
  }
});

function createWindow(initialPath?: string) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const basePaths = [`--home-dir=${os.homedir()}`];
  const mainWindow = new BrowserWindow({
    // width: (7 * width) / 8,
    // height: (2 * height) / 3,
    width,
    height,
    x: 0,
    y: 0,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 10, y: 16 },
    webPreferences: {
      preload: getPreloadPath(),
      webviewTag: true,
      additionalArguments: initialPath
        ? [`--initial-path=${initialPath}`, ...basePaths]
        : basePaths,
      webSecurity: false,
    },
  });

  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(getUIPath());
  }
}

app.on("ready", () => {
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            createWindow();
          },
        },
        { type: "separator" },
        {
          label: "Close Window",
          accelerator: "CmdOrCtrl+W",
          role: "close",
        },
        {
          label: "Quit",
          accelerator: "CmdOrCtrl+Q",
          role: "quit",
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", role: "undo" },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", role: "redo" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", role: "cut" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
        { type: "separator" },
        { label: "Select All", accelerator: "CmdOrCtrl+A", role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+R", role: "reload" },
        {
          label: "Toggle Developer Tools",
          accelerator: "Alt+CmdOrCtrl+I",
          role: "toggleDevTools",
        },
        { type: "separator" },
        {
          label: "Toggle Fullscreen",
          accelerator: "Ctrl+Command+F",
          role: "togglefullscreen",
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Use pending path from open-file event if available, otherwise check argv
  const initialPath =
    pendingOpenPath ??
    process.argv
      .find((a) => a.startsWith("--initial-path="))
      ?.replace("--initial-path=", "");
  createWindow(initialPath);

  ipcHandle("docxToPdf", (filePath: string) =>
    convertDocxToPdf(filePath, undefined, { copyBase64ToClipboard: true }),
  );

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

  ipcHandle("readFilePreview", ({ filePath, allowBigSize, fullSize }) => {
    return getFileContent(filePath, allowBigSize, fullSize);
  });
  ipcHandle("deleteFiles", deleteFiles);
  ipcHandle("createFileOrFolder", ({ parentDir, name }) =>
    createFileOrFolder(parentDir, name),
  );
  ipcHandle("renameFileOrFolder", ({ fullPath, newName }) =>
    renameFileOrFolder(fullPath, newName),
  );
  ipcHandle("batchRenameFiles", (items) => batchRenameFiles(items));
  ipcHandle("getPreviewPreloadPath", () => getPreviewPreloadPath());
  ipcHandle("copyFiles", ({ filePaths, cut }) => copyFiles(filePaths, cut));
  ipcHandle("setClipboardCutMode", async ({ cut }) => {
    setClipboardCutMode(cut);
  });
  ipcHandle("pasteFiles", ({ destinationDir }) => pasteFiles(destinationDir));
  ipcHandle("fuzzyFileFinder", ({ directory, query }) =>
    fuzzyFileFinder(directory, query),
  );
  ipcHandle("searchStringRecursively", (options) =>
    searchStringRecursively(options),
  );
  ipcHandle("fuzzyFolderFinder", ({ directory, query }) =>
    fuzzyFolderFinder(directory, query),
  );
  ipcHandle("getFileInfoByPaths", getFileInfoByPaths);
  ipcHandle("readZipContents", (filePath) => readZipContents(filePath));
  ipcHandle("zipFiles", ({ filePaths, destinationZipPath }) =>
    zipFiles(filePaths, destinationZipPath),
  );
  ipcHandle("unzipFile", ({ zipFilePath, destinationFolder }) =>
    unzipFile(zipFilePath, destinationFolder),
  );
  ipcHandle("getDirectorySizes", ({ parentPath, specificDirName }) =>
    getDirectorySizes(parentPath, specificDirName),
  );
  ipcHandle("generateVideoThumbnail", (filePath) =>
    generateVideoThumbnail(filePath),
  );

  TaskManager.addListener((e) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) return;

    for (const win of windows) {
      win.webContents.send("task:event", e);
    }
  });
});

// Clean up worker pool when app is quitting
app.on("before-quit", async () => {
  await xlsxWorkerPool.terminate();
});
