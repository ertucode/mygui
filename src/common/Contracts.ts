import { type GenericResult } from "./GenericError.js";
import { TaskEvents } from "./Tasks.js";
import { type ArchiveTypes } from "./ArchiveTypes.js";

export type ContextLine = {
  lineNumber: number;
  content: string;
  isMatch: boolean;
};

export type StringSearchResult = {
  filePath: string;
  matchLineNumber: number;
  matchContent: string;
  contextLines: ContextLine[];
};

export type ArchiveEntry = {
  name: string;
  isDirectory: boolean;
  size: number;
  compressedSize?: number;
  comment?: string;
};

export type ApplicationInfo = {
  name: string;
  path: string;
  isDefault?: boolean;
};

export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "code"
  | "font"
  | "executable"
  | "other";

export type GetFilesAndFoldersInDirectoryItem = (
  | {
      type: "file";
      ext: string;
      category: FileCategory;
    }
  | {
      type: "dir";
      ext: "";
      category: "folder";
    }
) & {
  modifiedAt: string | undefined | null;
  modifiedTimestamp: number | undefined | null;
  sizeStr: string | null | undefined;
  size: number | undefined | null;
  name: string;
  fullPath?: string;
};

export type EventResponseMapping = {
  docxToPdf: Promise<string>;
  getFilesAndFoldersInDirectory: Promise<GetFilesAndFoldersInDirectoryItem[]>;
  getFileInfoByPaths: Promise<GetFilesAndFoldersInDirectoryItem[]>;
  openFile: Promise<unknown>;
  onDragStart: Promise<unknown>;
  captureRect: Promise<unknown>;
  readFilePreview: Promise<
    | {
        content: string;
        isTruncated: boolean;
        // Note: images, PDFs, and videos are handled directly in the frontend
        // using file:// URLs without making IPC calls
        contentType: "text" | "docx" | "xlsx";
      }
    | { error: string }
    | { error: "FILE_TOO_LARGE" }
  >;
  deleteFiles: Promise<GenericResult<void>>;
  createFileOrFolder: Promise<GenericResult<{ path: string }>>;
  renameFileOrFolder: Promise<GenericResult<{ newPath: string }>>;
  batchRenameFiles: Promise<
    GenericResult<{ renamedPaths: Array<{ oldPath: string; newPath: string }> }>
  >;
  getPreviewPreloadPath: string;
  copyFiles: Promise<GenericResult<void>>;
  setClipboardCutMode: Promise<void>;
  pasteFiles: Promise<GenericResult<{ pastedItems: string[] }>>;
  fuzzyFileFinder: Promise<GenericResult<string[]>>;
  searchStringRecursively: Promise<GenericResult<StringSearchResult[]>>;
  fuzzyFolderFinder: Promise<GenericResult<string[]>>;
  readArchiveContents: Promise<GenericResult<ArchiveEntry[]>>;
  getDirectorySizes: Promise<Record<string, number>>;
  generateVideoThumbnail: Promise<string>;
  generateAppIcon: Promise<string>;
  "task:event": TaskEvents;
  startArchive: Promise<void>;
  startUnarchive: Promise<void>;
  abortTask: Promise<void>;
  getApplicationsForFile: Promise<ApplicationInfo[]>;
  openFileWithApplication: Promise<void>;
  openSelectAppWindow: Promise<string | null | undefined>;
};

export type StringSearchOptions = {
  directory: string;
  query: string;
  /** Custom working directory - can be relative (subdirectory) or absolute (starts with / or ~) */
  cwd?: string;
  /** Glob patterns for files to include (e.g., "*.ts", "*.{js,jsx}") */
  includePatterns?: string[];
  /** Glob patterns for files to exclude (e.g., "node_modules/**", "*.min.js") */
  excludePatterns?: string[];
  /** Use regex search instead of literal string */
  useRegex?: boolean;
  /** Case sensitive search */
  caseSensitive?: boolean;
  /** Search in hidden files and directories (default: true) */
  searchHidden?: boolean;
};

export type EventRequestMapping = {
  docxToPdf: string;
  getFilesAndFoldersInDirectory: string;
  getFileInfoByPaths: string[];
  openFile: string;
  onDragStart: {
    files: string[];
    image: string;
  };
  captureRect: Rect;
  readFilePreview: {
    filePath: string;
    allowBigSize?: boolean;
    fullSize?: boolean;
  };
  deleteFiles: string[];
  createFileOrFolder: {
    parentDir: string;
    name: string;
  };
  renameFileOrFolder: {
    fullPath: string;
    newName: string;
  };
  batchRenameFiles: Array<{
    fullPath: string;
    newName: string;
  }>;
  copyFiles: { filePaths: string[]; cut: boolean };
  setClipboardCutMode: { cut: boolean };
  pasteFiles: { destinationDir: string };
  fuzzyFileFinder: { directory: string; query: string };
  searchStringRecursively: StringSearchOptions;
  fuzzyFolderFinder: { directory: string; query: string };
  readArchiveContents: {
    archivePath: string;
    archiveType: ArchiveTypes.ArchiveType;
  };
  getDirectorySizes: { parentPath: string; specificDirName?: string };
  generateVideoThumbnail: string;
  generateAppIcon: string;
  startArchive: {
    archiveType: ArchiveTypes.ArchiveType;
    source: string[];
    destination: string;
  };
  startUnarchive: {
    archiveType: ArchiveTypes.ArchiveType;
    source: string;
    destination: string;
  };
  abortTask: string;
  getApplicationsForFile: string;
  openFileWithApplication: { filePath: string; applicationPath: string };
  openSelectAppWindow: { initialPath: string };
};

export type EventRequest<Key extends keyof EventResponseMapping> =
  Key extends keyof EventRequestMapping ? EventRequestMapping[Key] : void;

export type UnsubscribeFunction = () => void;

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WindowElectron = {
  getFilePath: (file: File) => string;
  convertDocxToPdf: (file: File) => Promise<string>;
  convertDocxToPdfByPath: (filePath: string) => Promise<string>;
  getFilesAndFoldersInDirectory: (
    directory: string,
  ) => Promise<GetFilesAndFoldersInDirectoryItem[]>;
  openFile: (filePath: string) => Promise<unknown>;
  onDragStart: (
    request: EventRequestMapping["onDragStart"],
  ) => Promise<unknown>;
  captureRect: (rect: Rect) => Promise<string>;
  readFilePreview: (
    filePath: string,
    allowBigSize?: boolean,
  ) => Promise<
    | {
        content: string;
        isTruncated: boolean;
        // Note: images, PDFs, and videos are handled directly in the frontend
        // using file:// URLs without making IPC calls
        contentType: "text" | "docx" | "xlsx";
      }
    | { error: string }
    | { error: "FILE_TOO_LARGE" }
  >;
  deleteFiles: (filePaths: string[]) => Promise<GenericResult<void>>;
  createFileOrFolder: (
    parentDir: string,
    name: string,
  ) => Promise<GenericResult<{ path: string }>>;
  renameFileOrFolder: (
    fullPath: string,
    newName: string,
  ) => Promise<GenericResult<{ newPath: string }>>;
  batchRenameFiles: (
    items: Array<{ fullPath: string; newName: string }>,
  ) => Promise<
    GenericResult<{ renamedPaths: Array<{ oldPath: string; newPath: string }> }>
  >;
  getPreviewPreloadPath: () => Promise<string>;
  getStartingDirectory: () => string | undefined | null;
  copyFiles: (
    filePaths: string[],
    cut: boolean,
  ) => Promise<GenericResult<void>>;
  setClipboardCutMode: (cut: boolean) => Promise<void>;
  pasteFiles: (
    destinationDir: string,
  ) => Promise<GenericResult<{ pastedItems: string[] }>>;
  fuzzyFileFinder: (
    directory: string,
    query: string,
  ) => Promise<GenericResult<string[]>>;
  searchStringRecursively: (
    options: StringSearchOptions,
  ) => Promise<GenericResult<StringSearchResult[]>>;
  fuzzyFolderFinder: (
    directory: string,
    query: string,
  ) => Promise<GenericResult<string[]>>;
  getFileInfoByPaths: (
    filePaths: string[],
  ) => Promise<GetFilesAndFoldersInDirectoryItem[]>;
  readArchiveContents: (
    archivePath: string,
    archiveType: ArchiveTypes.ArchiveType,
  ) => Promise<GenericResult<ArchiveEntry[]>>;
  getDirectorySizes: (
    parentPath: string,
    specificDirName?: string,
  ) => Promise<Record<string, number>>;
  generateVideoThumbnail: (filePath: string) => Promise<string>;
  generateAppIcon: (filePath: string) => Promise<string>;
  onTaskEvent: (cb: (e: TaskEvents) => void) => void;
  startArchive: (
    archiveType: ArchiveTypes.ArchiveType,
    source: string[],
    destination: string,
  ) => Promise<void>;
  startUnarchive: (
    archiveType: ArchiveTypes.ArchiveType,
    source: string,
    destination: string,
  ) => Promise<void>;
  abortTask: (taskId: string) => Promise<void>;
  getApplicationsForFile: (filePath: string) => Promise<ApplicationInfo[]>;
  openFileWithApplication: (
    filePath: string,
    applicationPath: string,
  ) => Promise<void>;
  openSelectAppWindow: (
    initialPath: string,
  ) => Promise<string | null | undefined>;
  isSelectAppMode: () => boolean;
  sendSelectAppResult: (appPath: string | null | undefined) => void;
  getWindowArgs: () => string;
};
