import { type GenericResult } from "./GenericError.js";

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
};

export type EventResponseMapping = {
  docxToPdf: Promise<string>;
  fuzzyFind: string[];
  getFilesAndFoldersInDirectory: Promise<GetFilesAndFoldersInDirectoryItem[]>;
  openFile: Promise<unknown>;
  onDragStart: Promise<unknown>;
  captureRect: Promise<unknown>;
  getHomeDirectory: string;
  readFilePreview: Promise<
    | {
        content: string;
        isTruncated: boolean;
        contentType:
          | "image"
          | "pdf"
          | "text"
          | "docx"
          | "xlsx"
          | "video"
          | "video-unsupported";
      }
    | { error: string }
  >;
  deleteFiles: Promise<GenericResult<void>>;
  createFileOrFolder: Promise<GenericResult<{ path: string }>>;
  renameFileOrFolder: Promise<GenericResult<{ newPath: string }>>;
  getPreviewPreloadPath: string;
  copyFiles: Promise<GenericResult<void>>;
  pasteFiles: Promise<GenericResult<{ pastedItems: string[] }>>;
  fuzzyFileFinder: Promise<GenericResult<string[]>>;
};

export type EventRequestMapping = {
  docxToPdf: string;
  fuzzyFind: string;
  getFilesAndFoldersInDirectory: string;
  openFile: string;
  onDragStart: {
    files: string[];
    image: string;
  };
  captureRect: Rect;
  readFilePreview: string;
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
  pasteFiles: { destinationDir: string };
  fuzzyFileFinder: { directory: string; query: string };
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
  fuzzyFind: (query: string) => Promise<string[]>;
  getFilesAndFoldersInDirectory: (
    directory: string,
  ) => Promise<GetFilesAndFoldersInDirectoryItem[]>;
  openFile: (filePath: string) => Promise<unknown>;
  onDragStart: (
    request: EventRequestMapping["onDragStart"],
  ) => Promise<unknown>;
  captureRect: (rect: Rect) => Promise<string>;
  getHomeDirectory: () => Promise<string>;
  readFilePreview: (filePath: string) => Promise<
    | {
        content: string;
        isTruncated: boolean;
        contentType: "image" | "pdf" | "text" | "docx" | "xlsx";
      }
    | { error: string }
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
  pasteFiles: (
    destinationDir: string,
  ) => Promise<GenericResult<{ pastedItems: string[] }>>;
  fuzzyFileFinder: (
    directory: string,
    query: string,
  ) => Promise<GenericResult<string[]>>;
};
