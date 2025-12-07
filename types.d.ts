type GetFilesAndFoldersInDirectoryItem = (
  | {
      type: "file";
      ext: string;
    }
  | {
      type: "dir";
      ext: "";
    }
) & {
  modifiedAt: string | undefined | null;
  modifiedTimestamp: number | undefined | null;
  sizeStr: string | null | undefined;
  size: number | undefined | null;
  name: string;
};

type EventResponseMapping = {
  docxToPdf: Promise<string>;
  fuzzyFind: string[];
  getFilesAndFoldersInDirectory: Promise<GetFilesAndFoldersInDirectoryItem[]>;
  openFile: Promise<unknown>;
  onDragStart: Promise<unknown>;
  captureRect: Promise<unknown>;
  getHomeDirectory: string;
  readFilePreview: Promise<
    { content: string; isTruncated: boolean; contentType: "image" | "pdf" | "text" } | { error: string }
  >;
  deleteFiles: Promise<{ success: boolean; error?: string }>;
  createFileOrFolder: Promise<{ success: boolean; error?: string; path?: string }>;
};

type EventRequestMapping = {
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
};

type EventRequest<Key extends keyof EventResponseMapping> =
  Key extends keyof EventRequestMapping ? EventRequestMapping[Key] : void;

type UnsubscribeFunction = () => void;

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface Window {
  electron: {
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
    readFilePreview: (
      filePath: string,
    ) => Promise<{ content: string; isTruncated: boolean; contentType: "image" | "pdf" | "text" } | { error: string }>;
    deleteFiles: (
      filePaths: string[],
    ) => Promise<{ success: boolean; error?: string }>;
    createFileOrFolder: (
      parentDir: string,
      name: string,
    ) => Promise<{ success: boolean; error?: string; path?: string }>;
    getStartingDirectory: () => string | undefined | null;
  };
}

type $Maybe<T> = T | undefined | null;
type $ExpectNever<T extends never> = T;
type $AsyncReturnType<T extends (...args: any) => Promise<any>> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : any;
