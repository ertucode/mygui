import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useRef } from "react";
import { Alert } from "@/lib/components/alert";
import { Table } from "@/lib/libs/table/Table";
import { useTable } from "@/lib/libs/table/useTable";
import {
  useDefaultSelection,
  useSelection,
} from "@/lib/libs/table/useSelection";
import { captureDivAsBase64 } from "@/lib/functions/captureDiv";
import { useTableSort } from "@/lib/libs/table/useTableSort";
import {
  ContextMenuItem,
  ContextMenuList,
} from "@/lib/components/context-menu";
import { useShortcuts } from "@/lib/hooks/useShortcuts";
import {
  FuzzyFinderDialog,
  useFuzzyFinder,
} from "@/lib/libs/fuzzy-find/FuzzyFinderDialog";
import { cols, sortNames } from "./config/columns";
import { useDirectory } from "./hooks/useDirectory";
import { useDefaultPath } from "./hooks/useDefaultPath";
import { FolderBreadcrumb } from "./components/FolderBreadcrumb";
import { FavoritesList } from "./components/FavoritesList";
import { useFavorites } from "./hooks/useFavorites";
import { RecentsList } from "./components/RecentsList";
import { useRecents } from "./hooks/useRecents";

export function FileBrowser() {
  const defaultPath = useDefaultPath();
  const recents = useRecents();
  const d = useDirectory(defaultPath.path, recents);
  const s = useSelection(useDefaultSelection());

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
      recents.addRecent({ fullPath: d.getFullName(item.name), type: "file" });
      d.openFile(item.name);
    }
  };

  const onGoUpOrPrev = async (fn: typeof d.goPrev | typeof d.goUp) => {
    const metadata = await fn();
    if (!metadata) return;
    let { directoryData, beforeNavigation } = metadata;

    setTimeout(() => {
      if (!directoryData) return;
      const idx = directoryData.findIndex(
        (i) => i.name === beforeNavigation.name,
      );
      if (idx === -1) return;
      s?.selectManually(idx);
    }, 5);
  };

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
        onGoUpOrPrev(d.goPrev);
      },
    },
    {
      key: " ",
      handler: (_) => {
        if (s.state.lastSelected == null) {
          s?.selectManually(0);
        }
      },
    },
    {
      key: "-",
      handler: () => onGoUpOrPrev(d.goUp),
    },
    ...s.getShortcuts(table.data.length),
  ]);

  const favorites = useFavorites();

  return (
    <div className="flex flex-col items-stretch py-3 gap-3 h-full">
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
      <div className="flex gap-0 h-full">
        <div className="flex flex-col h-full">
          <FavoritesList favorites={favorites} d={d} className="flex-1" />
          <RecentsList recents={recents} d={d} className="flex-1" />
        </div>
        <div className="relative h-full flex flex-col max-h-full overflow-y-auto flex-1">
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
              selection={s}
              ContextMenu={getRowContextMenu({
                setAsDefaultPath: (p) => {
                  defaultPath.setPath(d.getFullName(p));
                },
                favorites,
                d,
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
    </div>
  );
}

function getRowContextMenu({
  setAsDefaultPath,
  favorites,
  d,
}: {
  setAsDefaultPath: (path: string) => void;
  favorites: ReturnType<typeof useFavorites>;
  d: ReturnType<typeof useDirectory>;
}) {
  return ({
    item,
    close,
  }: {
    item: GetFilesAndFoldersInDirectoryItem;
    close: () => void;
  }) => {
    const fullPath = d.getFullName(item.name);
    const isFavorite = favorites.isFavorite(fullPath);
    const favoriteItem: ContextMenuItem = isFavorite
      ? {
          onClick: () => {
            favorites.removeFavorite(fullPath);
            close();
          },
          view: <div>Remove from favorites</div>,
        }
      : {
          onClick: () => {
            favorites.addFavorite({
              fullPath,
              type: "dir",
            });
            close();
          },
          view: <div>Set as favorite</div>,
        };
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
            favoriteItem,
          ]}
        />
      );

    return <ContextMenuList items={[favoriteItem]} />;
  };
}
