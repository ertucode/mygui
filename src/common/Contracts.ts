import { type GenericResult } from "./GenericError.js";

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

export type ZipEntry = {
  name: string;
  isDirectory: boolean;
  size: number;
  compressedSize: number;
  comment: string;
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
  getHomeDirectory: string;
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
  getPreviewPreloadPath: string;
  copyFiles: Promise<GenericResult<void>>;
  setClipboardCutMode: Promise<void>;
  pasteFiles: Promise<GenericResult<{ pastedItems: string[] }>>;
  fuzzyFileFinder: Promise<GenericResult<string[]>>;
  searchStringRecursively: Promise<GenericResult<StringSearchResult[]>>;
  fuzzyFolderFinder: Promise<GenericResult<string[]>>;
  readZipContents: Promise<GenericResult<ZipEntry[]>>;
  zipFiles: Promise<GenericResult<{ path: string }>>;
  unzipFile: Promise<GenericResult<{ path: string }>>;
  getDirectorySizes: Promise<Record<string, number>>;
  generateVideoThumbnail: Promise<string>;
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
  readFilePreview: { filePath: string; allowBigSize?: boolean };
  deleteFiles: string[];
  createFileOrFolder: {
    parentDir: string;
    name: string;
  };
  renameFileOrFolder: {
    fullPath: string;
    newName: string;
  };
  copyFiles: { filePaths: string[]; cut: boolean };
  setClipboardCutMode: { cut: boolean };
  pasteFiles: { destinationDir: string };
  fuzzyFileFinder: { directory: string; query: string };
  searchStringRecursively: StringSearchOptions;
  fuzzyFolderFinder: { directory: string; query: string };
  readZipContents: string;
  zipFiles: { filePaths: string[]; destinationZipPath: string };
  unzipFile: { zipFilePath: string; destinationFolder: string };
  getDirectorySizes: { parentPath: string; specificDirName?: string };
  generateVideoThumbnail: string;
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
  getHomeDirectory: () => Promise<string>;
  homeDirectory: string;
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
  readZipContents: (filePath: string) => Promise<GenericResult<ZipEntry[]>>;
  zipFiles: (
    filePaths: string[],
    destinationZipPath: string,
  ) => Promise<GenericResult<{ path: string }>>;
  unzipFile: (
    zipFilePath: string,
    destinationFolder: string,
  ) => Promise<GenericResult<{ path: string }>>;
  getDirectorySizes: (
    parentPath: string,
    specificDirName?: string,
  ) => Promise<Record<string, number>>;
  generateVideoThumbnail: (filePath: string) => Promise<string>;
};
