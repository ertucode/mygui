type Statistics = {
  cpuUsage: number;
  ramUsage: number;
  storageData: {
    total: number;
    usage: number;
  };
};

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

type StatisticData = {
  totalStorage: number;
  cpuModel: string;
  totalMemoryGB: number;
};

type EventResponseMapping = {
  statistics: Statistics;
  getStaticData: StatisticData;
  docxToPdf: Promise<string>;
  fuzzyFind: string[];
  getFilesAndFoldersInDirectory: Promise<GetFilesAndFoldersInDirectoryItem[]>;
  openFile: Promise<unknown>;
  onDragStart: Promise<unknown>;
  captureRect: Promise<unknown>;
  getHomeDirectory: string;
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
    subscribeStatistics: (
      callback: (statistics: Statistics) => void,
    ) => UnsubscribeFunction;
    getStatistics: () => Promise<StatisticData>;
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
  };
}

type $Maybe<T> = T | undefined | null;
type $ExpectNever<T extends never> = T;
type $AsyncReturnType<T extends (...args: any) => Promise<any>> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : any;
