import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FileIcon,
  FolderIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import z from "zod";
import { useLocalStorage } from "./lib/hooks/useLocalStorage";
import { captureDivAsBase64 } from "./lib/functions/captureDiv";
import { useTableSort } from "./lib/libs/table/useTableSort";
import {
  ContextMenu,
  ContextMenuList,
  useContextMenu,
} from "./lib/components/context-menu";
import { useShortcuts } from "./lib/hooks/useShortcuts";
import {
  FuzzyFinderDialog,
  useFuzzyFinder,
} from "./lib/libs/fuzzy-find/FuzzyFinderDialog";

const cols: ColumnDef<GetFilesAndFoldersInDirectoryItem>[] = [
  {
    accessorKey: "type",
    header: "",
    cell: (row) => {
      const Icon = resolveIcon(row);
      return <Icon className="size-4" />;
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
    accessorKey: "sizeStr",
    sortKey: "size",
    header: "Size",
    size: 84,
  },
  {
    accessorKey: "modifiedAt",
    sortKey: "modifiedTimestamp",
    header: "Modified",
    size: 148,
  },
];

const sortNames = z.enum(["name", "modifiedTimestamp", "size", "ext"]);

export function FileBrowser() {
  const defaultPath = useDefaultPath();
  const d = useDirectory(defaultPath.path);
  const s = useDefaultSelection();

  const fuzzy = useFuzzyFinder({
    items: d.directoryData,
    keys: ["name"],
    setHighlight: (h) => {
      s.setState((selections) => {
        let newSelection: number;
        if (selections.indexes.size === 0) {
          newSelection = typeof h === "number" ? h : h(0);
        } else if (selections.indexes.size === 1) {
          newSelection =
            typeof h === "number" ? h : h(selections.lastSelected!);
        } else {
          newSelection =
            typeof h === "number" ? h : h(selections.lastSelected!);
        }
        return { indexes: new Set([newSelection]), lastSelected: newSelection };
      });
    },
  });

  const table = useTable({
    columns: cols,
    data: fuzzy.results,
    selection: s,
  });

  const tableRef = useRef<HTMLTableElement>(null);

  const sort = useTableSort(
    {
      state: d.settings.sort,
      changeState: (stateOrCb) =>
        d.setSettings((s) => {
          if (typeof stateOrCb === "function") {
            const newSort = stateOrCb(s.sort);
            return { ...s, sort: newSort };
          }

          return { ...s, sort: stateOrCb };
        }),
      schema: sortNames,
    },
    [d.settings],
  );

  const openItem = (item: GetFilesAndFoldersInDirectoryItem) => {
    if (item.type === "dir") {
      d.changeDirectory(item.name);
    } else {
      d.openFile(item.name);
    }
  };

  function goPrev() {
    if (!d.hasPrev) return;
    d.goPrev().then(({ directoryData, current }) => {
      setTimeout(() => {
        if (!directoryData) return;
        if (!d.settings.showDotFiles) {
          directoryData = directoryData.filter((i) => !i.name.startsWith("."));
        }
        const idx = directoryData.findIndex((i) => i.name === current.name);
        if (idx === -1) return;
        table.selection?.selectManually(idx);
      }, 5);
    });
  }

  useShortcuts([
    {
      key: ["Enter", "l"],
      handler: (_) => {
        if (fuzzy.open) {
          fuzzy.close();
          fuzzy.setQuery("");
          tableRef.current?.querySelector("tbody")?.focus();
        }
        if (s.state.lastSelected == null || s.state.indexes.size !== 1) {
          openItem(table.data[0]);
        } else {
          openItem(table.data[s.state.lastSelected]);
        }
      },
      enabledIn: (e) =>
        (e.target as HTMLInputElement).id === "fuzzy-finder-input" &&
        e.key === "Enter",
    },
    {
      key: ["Backspace", "h"],
      handler: (_) => {
        goPrev();
      },
    },
    {
      key: " ",
      handler: (_) => {
        if (s.state.lastSelected == null) {
          table.selection?.selectManually(0);
        }
      },
    },
  ]);

  return (
    <div className="flex flex-col items-stretch py-3 gap-3">
      <FuzzyFinderDialog fuzzy={fuzzy} />
      <div className="flex gap-3">
        <label className="label">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={d.settings.showDotFiles}
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
          <FolderBreadcrumb d={d} defaultPath={defaultPath} />
        </div>
      </div>
      <div className="relative h-160 flex flex-col max-h-160 overflow-y-auto">
        {d.loading ? (
          <div>Loading...</div>
        ) : d.error ? (
          <Alert children={d.error} />
        ) : (
          <Table
            tableRef={tableRef}
            table={table}
            sort={sort}
            onRowDoubleClick={openItem}
            selection={table.selection}
            ContextMenu={getRowContextMenu({
              setAsDefaultPath: (p) => {
                defaultPath.setPath(d.getFullName(p));
              },
            })}
            onRowDragStart={async (item, index, e) => {
              const alreadySelected = s.state.indexes.has(index);
              const files = alreadySelected
                ? [...s.state.indexes].map((i) => {
                    return d.getFullName(table.data[i].name);
                  })
                : [d.getFullName(item.name)];

              const tableBody = e.currentTarget.closest("tbody");
              window.electron.onDragStart({
                files,
                image: await captureDivAsBase64(tableBody!, (node) => {
                  if (typeof node === "string") {
                    return true;
                  }
                  if (!node.classList) {
                    return true;
                  }
                  if (node.classList.contains("row-selected")) return true;
                  const row = node.closest("tr");
                  if (!row) return false;
                  return row.classList.contains("row-selected");
                }),
              });
            }}
            onRowMouseDown={(item) => {
              if (item.type === "dir") {
                d.preloadDirectory(d.getFullName(item.name));
              }
            }}
          ></Table>
        )}
      </div>
    </div>
  );
}

function FolderBreadcrumb({
  d,
  defaultPath,
}: {
  d: ReturnType<typeof useDirectory>;
  defaultPath: ReturnType<typeof useDefaultPath>;
}) {
  const parts = getFolderNameParts(d.directory.fullName);
  const menu = useContextMenu<number>();

  return (
    <div className="breadcrumbs text-sm">
      {menu.isOpen && (
        <ContextMenu menu={menu}>
          <ContextMenuList
            items={[
              {
                onClick: () => {
                  defaultPath.setPath(reconstructDirectory(parts, menu.item!));
                  menu.close();
                },
                view: "Set as default path",
              },
            ]}
          />
        </ContextMenu>
      )}
      <ul>
        {parts.map((part, idx) => {
          return (
            <li
              key={idx}
              className="flex items-center gap-1"
              onClick={() =>
                d.cd({
                  fullName: reconstructDirectory(parts, idx),
                  name: part,
                })
              }
              onContextMenu={(e) => {
                e.preventDefault();
                menu.onRightClick(e, idx);
              }}
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
  const [settings, setSettings] = useFileBrowserSettings();
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
      const result = await FileBrowserCache.load(dir);

      result.sort((a, b) => {
        if (a.type === "dir" && b.type === "dir") return 0;
        if (a.type === "dir") return -1;
        if (b.type === "dir") return 1;
        return a.name.localeCompare(b.name);
      });

      setDirectoryData(result);
      setError(undefined);
      return result;
    } catch (e) {
      setError(errorToString(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const directoryData = useMemo(
    () => DirectoryDataFromSettings.getDirectoryData(_directoryData, settings),
    [_directoryData, settings],
  );

  const historyStack = useMemo(
    () => new HistoryStack<DirectoryInfo>([initialDirectoryInfo]),
    [],
  );

  const cd = async (newDirectory: DirectoryInfo, isNew: boolean) => {
    if (loading) return;
    if (isNew) historyStack.goNew(newDirectory);
    setDirectory(newDirectory);
    return loadDirectory(newDirectory.fullName);
  };

  const preloadDirectory = (dir: string) => {
    return FileBrowserCache.load(dir);
  };

  const getFullName = (dir: string) =>
    mergeMaybeSlashed(directory.fullName, dir);

  return {
    changeDirectory: async (newDirectory: string) => {
      cd(
        {
          fullName: getFullName(newDirectory),
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
    goPrev: async () => {
      forceRerender();
      const p = historyStack.goPrev();
      const directoryData = await cd(p, false);
      return {
        directoryData:
          directoryData &&
          DirectoryDataFromSettings.getDirectoryData(directoryData, settings),
        prev: p,
        current: directory,
      };
    },
    hasNext: historyStack.hasNext,
    hasPrev: historyStack.hasPrev,
    error,
    settings,
    toggleShowDotFiles: () =>
      setSettings((s) => ({ ...s, showDotFiles: !s.showDotFiles })),
    openFile: (filePath: string) =>
      window.electron.openFile(getFullName(filePath)),
    getFullName,
    preloadDirectory,
    setSettings,
  };
}

function getRowContextMenu({
  setAsDefaultPath,
}: {
  setAsDefaultPath: (path: string) => void;
}) {
  return ({
    item,
    close,
  }: {
    item: GetFilesAndFoldersInDirectoryItem;
    close: () => void;
  }) => {
    if (item.type === "dir")
      return (
        <ContextMenuList
          items={[
            {
              onClick: () => {
                setAsDefaultPath(item.name);
                close();
              },
              view: <div>Set as default path</div>,
            },
          ]}
        />
      );

    return (
      <ContextMenuList
        items={[
          {
            onClick: () => {},
            view: <div>TODO</div>,
          },
        ]}
      />
    );
  };
}

function useDefaultPath() {
  const [path, setPath] = useLocalStorage<string>("path", z.string(), "~/");
  return { path, setPath };
}

function resolveIcon(item: GetFilesAndFoldersInDirectoryItem) {
  if (item.type === "file") {
    return FileIcon;
  }
  return FolderIcon;
}

type FileBrowserCacheOperation =
  | {
      loading: true;
      promise: Promise<GetFilesAndFoldersInDirectoryItem[]>;
    }
  | {
      loading: false;
      loaded: GetFilesAndFoldersInDirectoryItem[];
    };

export class FileBrowserCache {
  static cache = new Map<string, FileBrowserCacheOperation>();

  static load = async (dir: string) => {
    const cached = FileBrowserCache.cache.get(dir);
    if (cached) {
      if (!cached.loading) return cached.loaded;
      return cached.promise;
    }

    const promise = window.electron
      .getFilesAndFoldersInDirectory(dir)
      .then((items) => {
        FileBrowserCache.cache.set(dir, { loading: false, loaded: items });
        setTimeout(() => {
          FileBrowserCache.cache.delete(dir);
        }, 500);
        return items;
      });
    return promise;
  };
}

const SettingsSchema = z.object({
  showDotFiles: z.boolean(),
  sort: z.object({
    by: sortNames.nullish(),
    order: z.enum(["asc", "desc"]).nullish(),
  }),
});

type Settings = z.infer<typeof SettingsSchema>;

function useFileBrowserSettings() {
  return useLocalStorage("fbSettings", SettingsSchema, {
    showDotFiles: false,
    sort: {
      by: "ext",
      order: "asc",
    },
  });
}

class DirectoryDataFromSettings {
  static lastSettings: Settings | undefined;
  static lastData: GetFilesAndFoldersInDirectoryItem[] | undefined;
  static lastResult: GetFilesAndFoldersInDirectoryItem[] | undefined;

  static getDirectoryData(
    d: GetFilesAndFoldersInDirectoryItem[],
    settings: Settings,
  ) {
    if (settings === this.lastSettings && d === this.lastData)
      return this.lastResult!;
    this.lastSettings = settings;
    this.lastData = d;
    this.lastResult = this.getDirectoryDataWithoutCache(d, settings);
    return this.lastResult;
  }

  private static getDirectoryDataWithoutCache(
    d: GetFilesAndFoldersInDirectoryItem[],
    settings: Settings,
  ) {
    let data = d;

    if (!settings.showDotFiles)
      data = data.filter((i) => !i.name.startsWith("."));

    if (settings.sort.by === "name") {
      const times = settings.sort.order === "asc" ? 1 : -1;
      data = data.sort((a, b) => {
        return a.name.localeCompare(b.name) * times;
      });
    } else if (settings.sort.by === "modifiedTimestamp") {
      const times = settings.sort.order === "asc" ? 1 : -1;
      data = data.sort((a, b) => {
        if (!a.modifiedTimestamp && !b.modifiedTimestamp) return 0;
        if (!a.modifiedTimestamp) return -1;
        if (!b.modifiedTimestamp) return 1;
        return (a.modifiedTimestamp - b.modifiedTimestamp) * times;
      });
    } else if (settings.sort.by === "size") {
      const times = settings.sort.order === "asc" ? 1 : -1;
      data = data.sort((a, b) => {
        if (!a.size && !b.size) return 0;
        if (!a.size) return 1;
        if (!b.size) return -1;
        return (a.size - b.size) * times;
      });
    } else if (settings.sort.by === "ext") {
      const times = settings.sort.order === "asc" ? 1 : -1;
      data = data.sort((a, b) => {
        if (!a.ext && !b.ext) return 0;
        if (!a.ext) return 1;
        if (!b.ext) return -1;
        return a.ext.localeCompare(b.ext) * times;
      });
    }

    return data;
  }
}
