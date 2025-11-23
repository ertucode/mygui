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
  size: string | null | undefined;
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
};

type EventRequestMapping = {
  docxToPdf: string;
  fuzzyFind: string;
  getFilesAndFoldersInDirectory: string;
  openFile: string;
};

type EventRequest<Key extends keyof EventResponseMapping> =
  Key extends keyof EventRequestMapping ? EventRequestMapping[Key] : void;

type UnsubscribeFunction = () => void;

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
  };
}
