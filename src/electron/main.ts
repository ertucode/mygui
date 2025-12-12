import { app, BrowserWindow, Menu, screen } from "electron";
import { ipcHandle, isDev } from "./util.js";
import {
  getPreloadPath,
  getPreviewPreloadPath,
  getUIPath,
} from "./pathResolver.js";
import { convertDocxToPdf } from "./utils/docx-to-pdf.js";
import { getFilesAndFoldersInDirectory } from "./utils/get-files-and-folders-in-directory.js";
import { openFile } from "./utils/open-file.js";
import { getInitializedFuzzyFinder } from "./utils/get-initialized-fuzzy-finder.js";
import { expandHome } from "./utils/expand-home.js";
import { base64ImageToTempPath } from "./utils/base64-image-to-temp-path.js";
import { captureRect } from "./utils/capture-rect.js";
import { getFileContent } from "./utils/get-file-content.js";
import { deleteFiles } from "./utils/delete-files.js";
import { createFileOrFolder } from "./utils/create-file-or-folder.js";
import { renameFileOrFolder } from "./utils/rename-file-or-folder.js";
import { copyFiles } from "./utils/copy-files.js";
import { pasteFiles } from "./utils/paste-files.js";
import { fuzzyFileFinder } from "./utils/fuzzy-file-finder.js";

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

  function createWindow(initialPath?: string) {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const mainWindow = new BrowserWindow({
      width: (5 * width) / 8,
      height: height / 3,
      x: 0,
      y: 0,
      webPreferences: {
        preload: getPreloadPath(),
        webviewTag: true,
        additionalArguments: initialPath
          ? [`--initial-path=${initialPath}`]
          : [],
      },
    });

    if (isDev()) {
      mainWindow.loadURL("http://localhost:5123");
    } else {
      mainWindow.loadFile(getUIPath());
    }
  }
  const initialPath = process.argv
    .find((a) => a.startsWith("--initial-path="))
    ?.replace("--initial-path=", "");
  createWindow(initialPath);

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

  ipcHandle("readFilePreview", ({ filePath, allowBigSize }) => {
    return getFileContent(filePath, allowBigSize);
  });
  ipcHandle("deleteFiles", deleteFiles);
  ipcHandle("createFileOrFolder", ({ parentDir, name }) =>
    createFileOrFolder(parentDir, name),
  );
  ipcHandle("renameFileOrFolder", ({ fullPath, newName }) =>
    renameFileOrFolder(fullPath, newName),
  );
  ipcHandle("getPreviewPreloadPath", () => getPreviewPreloadPath());
  ipcHandle("copyFiles", ({ filePaths, cut }) => copyFiles(filePaths, cut));
  ipcHandle("pasteFiles", ({ destinationDir }) => pasteFiles(destinationDir));
  ipcHandle("fuzzyFileFinder", ({ directory, query }) =>
    fuzzyFileFinder(directory, query),
  );
});
