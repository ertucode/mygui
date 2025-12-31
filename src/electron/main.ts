import { app, BrowserWindow, Menu, screen, ipcMain, shell } from "electron";
import os from "os";
import { ipcHandle, isDev } from "./util.js";
import fs from "fs";
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
import {
  replaceStringInFile,
  replaceStringInMultipleFiles,
} from "./utils/replace-string-in-files.js";
import { fuzzyFolderFinder } from "./utils/fuzzy-folder-finder.js";
import { getDirectorySizes } from "./utils/get-directory-size.js";
import { generateVideoThumbnail } from "./utils/generate-video-thumbnail.js";
import { generateAppIcon } from "./utils/generate-app-icon.js";
import { xlsxWorkerPool } from "./utils/xlsx-worker-pool.js";
import { TaskManager } from "./TaskManager.js";
import { startArchive, startUnarchive } from "./utils/start-archive-task.js";
import { Archive } from "./utils/archive/Archive.js";
import {
  getApplicationsForFile,
  openFileWithApplication,
} from "./utils/get-applications-for-file.js";
import {
  serializeWindowArguments,
  WindowArguments,
} from "../common/WindowArguments.js";
import { runCommand } from "./utils/run-command.js";
import { getServerConfig } from "./server-config.js";
import { getAudioMetadata } from "./utils/get-audio-metadata.js";

// Handle folders/files opened via "open with" or as default app
let pendingOpenPath: string | undefined;

app.on("open-file", (event, path) => {
  event.preventDefault();
  pendingOpenPath = path;

  // If app is already ready, create a new window with this path
  if (app.isReady()) {
    createWindow({
      initialPath: path,
    });
  }
});

type WindowArgsWithoutHome = Omit<WindowArguments, "homeDir">;

const homeDir = os.homedir();

async function createWindow(args?: WindowArgsWithoutHome) {
  const windowArgs: WindowArguments = {
    ...args,
    homeDir,
  };
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const config = await getServerConfig();
  windowArgs.commands = config.commands?.map((s) => {
    const { command, ...others } = s;
    return others;
  });

  const isSelectMode = windowArgs.mode === "select-app";
  const mainWindow = new BrowserWindow({
    width: isSelectMode ? 900 : width,
    height: isSelectMode ? 600 : height,
    x: isSelectMode ? undefined : 0,
    y: isSelectMode ? undefined : 0,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 10, y: 16 },
    modal: isSelectMode,
    webPreferences: {
      preload: getPreloadPath(),
      webviewTag: true,
      additionalArguments: [
        "--window-args=" + serializeWindowArguments(windowArgs),
      ],
      webSecurity: false,
    },
  });

  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(getUIPath());
  }

  return mainWindow;
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
  createWindow({ initialPath });

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
  ipcHandle("pasteFiles", ({ destinationDir, resolution }) =>
    pasteFiles(destinationDir, resolution),
  );
  ipcHandle("fuzzyFileFinder", ({ directory, query }) =>
    fuzzyFileFinder(directory, query),
  );
  ipcHandle("searchStringRecursively", (options) =>
    searchStringRecursively(options),
  );
  ipcHandle("replaceStringInFile", (options) => replaceStringInFile(options));
  ipcHandle("replaceStringInMultipleFiles", (options) =>
    replaceStringInMultipleFiles(options),
  );
  ipcHandle("fuzzyFolderFinder", ({ directory, query }) =>
    fuzzyFolderFinder(directory, query),
  );
  ipcHandle("getFileInfoByPaths", getFileInfoByPaths);
  ipcHandle("readArchiveContents", ({ archivePath, archiveType }) =>
    Archive.readContents(archiveType, archivePath),
  );
  ipcHandle("getDirectorySizes", ({ parentPath, specificDirName }) =>
    getDirectorySizes(parentPath, specificDirName),
  );
  ipcHandle("generateVideoThumbnail", (filePath) =>
    generateVideoThumbnail(filePath),
  );
  ipcHandle("generateAppIcon", (filePath) => generateAppIcon(filePath));
  ipcHandle("getAudioMetadata", (filePath) => getAudioMetadata(filePath));
  ipcHandle("startArchive", (request) => startArchive(request));
  ipcHandle("startUnarchive", (request) => startUnarchive(request));
  ipcHandle("abortTask", async (taskId) => {
    TaskManager.abort(taskId);
  });
  ipcHandle("getApplicationsForFile", (filePath) =>
    getApplicationsForFile(filePath),
  );
  ipcHandle(
    "openFileWithApplication",
    async ({ filePath, applicationPath }) => {
      if (applicationPath === "__choose__") {
        const res = await openSelectAppWindow("/Applications");
        if (!res) return;
        return openFileWithApplication(filePath, res);
      }
      return openFileWithApplication(filePath, applicationPath);
    },
  );

  ipcHandle("openShell", async (url: string) => {
    await shell.openExternal(url);
  });

  ipcHandle("runCommand", runCommand);

  // Store pending select-app promises
  const selectAppPromises = new Map<
    number,
    (appPath: string | null | undefined) => void
  >();

  function openSelectAppWindow(initialPath: string) {
    return new Promise<string | null | undefined>(async (resolve) => {
      const selectWindow = await createWindow({
        initialPath,
        mode: "select-app",
      });
      const windowId = selectWindow.id;

      // Store the resolve function
      selectAppPromises.set(windowId, resolve);

      // Handle window close without selection
      selectWindow.on("closed", () => {
        const resolver = selectAppPromises.get(windowId);
        if (resolver) {
          resolver(null);
          selectAppPromises.delete(windowId);
        }
      });
    });
  }

  ipcHandle("openSelectAppWindow", ({ initialPath }) =>
    openSelectAppWindow(initialPath),
  );

  // Handle app selection from the select window
  ipcMain.on(
    "selectAppWindowResult",
    (event: Electron.IpcMainEvent, appPath: string | null | undefined) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        const resolver = selectAppPromises.get(window.id);
        if (resolver) {
          if (appPath) {
            if (
              appPath.endsWith(".app") &&
              appPath.startsWith("/Applications")
            ) {
              const actualFolder = `${appPath}/Contents/MacOS`;
              if (!fs.existsSync(actualFolder)) {
                throw new Error(`App at ${appPath} does not exist`);
              }

              const itemFromFolder = fs.readdirSync(actualFolder)[0];
              appPath = `${appPath}/Contents/MacOS/${itemFromFolder}`;
            }
          }
          resolver(appPath);
          selectAppPromises.delete(window.id);
          window.close();
        }
      }
    },
  );

  TaskManager.addListener((e) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) return;

    for (const win of windows) {
      win.webContents.send("task:event", e);
    }
  });
});

// Listen for window focus events and notify renderer
app.on("browser-window-focus", (_event, window) => {
  window.webContents.send("window:focus");
});

// Clean up worker pool when app is quitting
app.on("before-quit", async () => {
  await xlsxWorkerPool.terminate();
});
