import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FileIcon,
  FolderIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HistoryStack } from "../common/history-stack";
import { useForceRerender } from "./lib/hooks/forceRerender";
import { errorToString } from "../common/errorToString";
import { Alert } from "./lib/components/alert";
import { mergeMaybeSlashed } from "../common/merge-maybe-slashed";
import { useDebounce } from "./lib/hooks/useDebounce";
import "./FileBrowser.css";
import type { ColumnDef } from "./lib/libs/table/table-types";
import { Table } from "./lib/libs/table/Table";
import { useTable } from "./lib/libs/table/useTable";
import { useDefaultSelection } from "./lib/libs/table/useSelection";

const cols: ColumnDef<GetFilesAndFoldersInDirectoryItem>[] = [
  {
    accessorKey: "type",
    header: "",
    cell: (row) => {
      return row.type === "file" ? (
        <FileIcon className="size-4" />
      ) : (
        <FolderIcon className="size-4" />
      );
    },
    size: 24,
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "ext",
    header: "Ext",
    size: 24,
  },
  {
    accessorKey: "size",
    header: "Size",
    size: 84,
  },
  {
    accessorKey: "modifiedAt",
    header: "Modified",
    size: 148,
  },
];

export function FileBrowser() {
  const d = useDirectory("~/");
  const s = useDefaultSelection();

  const table = useTable({
    columns: cols,
    data: d.directoryData,
    selection: s,
  });

  return (
    <div className="flex flex-col items-stretch py-3 gap-3">
      <div className="flex gap-3">
        <label className="label">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={d.showDotFiles}
            onChange={() => d.toggleShowDotFiles()}
          />
          Show dot files
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn" onClick={d.goPrev} disabled={!d.hasPrev}>
          {<ArrowLeftIcon />}
        </button>
        <button className="btn" onClick={d.goNext} disabled={!d.hasNext}>
          {<ArrowRightIcon />}
        </button>
        <div>
          <FolderBreadcrumb dir={d.directory.fullName} cd={d.cd} />
        </div>
      </div>
      <div className="h-80 flex flex-col max-h-80 overflow-y-auto">
        {d.loading ? (
          <div>Loading...</div>
        ) : d.error ? (
          <Alert children={d.error} />
        ) : (
          <div>
            <Table
              table={table}
              onRowDoubleClick={(item) => {
                if (item.type === "dir") {
                  d.changeDirectory(item.name);
                } else {
                  d.openFile(item.name);
                }
              }}
              selection={table.selection}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FolderBreadcrumb({
  dir,
  cd,
}: {
  dir: string;
  cd: (dir: DirectoryInfo) => void;
}) {
  const parts = getFolderNameParts(dir);
  return (
    <div className="breadcrumbs text-sm">
      <ul>
        {parts.map((part, idx) => {
          return (
            <li
              key={idx}
              className="flex items-center gap-1"
              onClick={() =>
                cd({
                  fullName: reconstructDirectory(parts, idx),
                  name: part,
                })
              }
            >
              <a>
                <FolderIcon className="size-4" />
                <div>{part}</div>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function getFolderNameParts(dir: string) {
  return dir.split("/").filter(Boolean);
}

function reconstructDirectory(parts: string[], idx: number) {
  return parts.slice(0, idx + 1).join("/") + "/";
}

type DirectoryInfo = {
  fullName: string;
  name: string;
};

function getDirectoryInfo(dir: string): DirectoryInfo {
  const idx = dir.indexOf("/");
  if (idx === -1) throw new Error("Invalid directory name");
  if (idx === dir.length - 1) return { fullName: dir, name: dir };

  const name = dir.slice(idx + 1);
  return { fullName: dir, name };
}

function useDirectory(initialDirectory: string) {
  const initialDirectoryInfo = getDirectoryInfo(initialDirectory);
  const [showDotFiles, setShowDotFiles] = useState(false);
  const [directory, setDirectory] =
    useState<DirectoryInfo>(initialDirectoryInfo);
  const [_loading, setLoading] = useState(false);
  const loading = useDebounce(_loading, 100);
  const [_directoryData, setDirectoryData] = useState<
    GetFilesAndFoldersInDirectoryItem[]
  >([]);
  const [error, setError] = useState<string | undefined>();

  const forceRerender = useForceRerender();

  useEffect(() => {
    loadDirectory(initialDirectory);
  }, []);

  const loadDirectory = useCallback(async (dir: string) => {
    // TODO: cancel previous request
    setLoading(true);
    try {
      const result = await window.electron.getFilesAndFoldersInDirectory(dir);

      result.sort((a, b) => {
        if (a.type === "dir" && b.type === "dir") return 0;
        if (a.type === "dir") return -1;
        if (b.type === "dir") return 1;
        return a.name.localeCompare(b.name);
      });

      setDirectoryData(result);
      setError(undefined);
    } catch (e) {
      setError(errorToString(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const directoryData = useMemo(() => {
    if (showDotFiles) return _directoryData;

    return _directoryData.filter((i) => !i.name.startsWith("."));
  }, [_directoryData, showDotFiles]);

  const historyStack = useMemo(
    () => new HistoryStack<DirectoryInfo>([initialDirectoryInfo]),
    [],
  );

  const cd = async (newDirectory: DirectoryInfo, isNew: boolean) => {
    if (loading) return;
    if (isNew) historyStack.goNew(newDirectory);
    setDirectory(newDirectory);
    loadDirectory(newDirectory.fullName);
  };

  return {
    changeDirectory: async (newDirectory: string) => {
      cd(
        {
          fullName: mergeMaybeSlashed(directory.fullName, newDirectory),
          name: newDirectory,
        },
        true,
      );
    },
    cd: (dir: DirectoryInfo) => cd(dir, true),
    loading,
    directoryData,
    directory,
    goNext: () => {
      forceRerender();
      cd(historyStack.goNext(), false);
    },
    goPrev: () => {
      forceRerender();
      const p = historyStack.goPrev();
      cd(p, false);
    },
    hasNext: historyStack.hasNext,
    hasPrev: historyStack.hasPrev,
    error,
    showDotFiles,
    toggleShowDotFiles: () => setShowDotFiles((s) => !s),
    openFile: (filePath: string) =>
      window.electron.openFile(mergeMaybeSlashed(directory.fullName, filePath)),
  };
}
