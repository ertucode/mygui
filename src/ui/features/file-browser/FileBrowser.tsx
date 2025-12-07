import { ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react";
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
import { useConfirmation } from "@/lib/hooks/useConfirmation";
import { cols, sortNames } from "./config/columns";
import { useDirectory } from "./hooks/useDirectory";
import { useDefaultPath } from "./hooks/useDefaultPath";
import { FolderBreadcrumb } from "./components/FolderBreadcrumb";
import { FavoritesList } from "./components/FavoritesList";
import { useFavorites } from "./hooks/useFavorites";
import { RecentsList } from "./components/RecentsList";
import { useRecents } from "./hooks/useRecents";
import { FilePreview } from "./components/FilePreview";

export function FileBrowser() {
  const defaultPath = useDefaultPath();
  const recents = useRecents();
  const d = useDirectory(defaultPath.path, recents);
  const s = useSelection(useDefaultSelection());
  const confirmation = useConfirmation();

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

  const handleDelete = (items: GetFilesAndFoldersInDirectoryItem[]) => {
    const paths = items.map((item) => d.getFullName(item.name));

    confirmation.confirm({
      title: "Confirm Delete",
      message: (
        <p>
          Are you sure you want to delete{" "}
          {items.length === 1 ? `"${items[0].name}"` : `${items.length} items`}?
        </p>
      ),
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          // Delete all selected files/folders
          await window.electron.deleteFiles(paths);

          // Remove from favorites if they were favorited
          paths.forEach((path) => {
            if (favorites.isFavorite(path)) {
              favorites.removeFavorite(path);
            }
          });

          // Reload the directory without affecting history
          await d.reload();

          // Clear selection
          s.reset();
        } catch (error) {
          console.error("Error deleting files:", error);
        }
      },
    });
  };

  useShortcuts(
    [
      {
        key: ["Enter", "l"],
        handler: (e) => {
          function resolveItemToOpen() {
            if (s.state.lastSelected == null || s.state.indexes.size !== 1) {
              return table.data[0];
            } else {
              return table.data[s.state.lastSelected];
            }
          }

          const itemToOpen = resolveItemToOpen();
          if (itemToOpen.type === "file" && e.key === "l") return;

          if (fuzzy.open) {
            fuzzy.close();
            fuzzy.setQuery("");
            tableRef.current?.querySelector("tbody")?.focus();
          }
          openItem(itemToOpen);
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
      {
        key: { key: "Backspace", metaKey: true },
        handler: () => {
          // Command+Delete on macOS
          if (s.state.indexes.size === 0) return;
          const itemsToDelete = [...s.state.indexes].map((i) => table.data[i]);
          handleDelete(itemsToDelete);
        },
      },
      ...s.getShortcuts(table.data.length),
    ],
    {
      isDisabled: confirmation.isOpen,
    },
  );

  const favorites = useFavorites();

  // Get selected file for preview (only if exactly one file is selected)
  const selectedItem =
    s.state.indexes.size === 1 && s.state.lastSelected != null
      ? table.data[s.state.lastSelected]
      : null;
  const previewFilePath =
    selectedItem && selectedItem.type === "file"
      ? d.getFullName(selectedItem.name)
      : null;

  const navigationButtonClassName = "btn btn-xs btn-soft btn-info";
  const navigationButtonIconClassName = "size-4";

  return (
    <div className="flex flex-col items-stretch gap-3 h-full p-6 overflow-hidden">
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
        <button
          className={navigationButtonClassName}
          onClick={d.goPrev}
          disabled={!d.hasPrev}
        >
          {<ArrowLeftIcon className={navigationButtonIconClassName} />}
        </button>
        <button
          className={navigationButtonClassName}
          onClick={d.goNext}
          disabled={!d.hasNext}
        >
          {<ArrowRightIcon className={navigationButtonIconClassName} />}
        </button>
        <button
          className={navigationButtonClassName}
          onClick={() => onGoUpOrPrev(d.goUp)}
        >
          {<ArrowUpIcon className={navigationButtonIconClassName} />}
        </button>
        <div>
          <FolderBreadcrumb d={d} defaultPath={defaultPath} />
        </div>
      </div>
      <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <FavoritesList
            favorites={favorites}
            d={d}
            className="flex-1 min-h-0"
          />
          <RecentsList recents={recents} d={d} className="flex-1 min-h-0" />
        </div>
        <div className="relative flex flex-col min-h-0 min-w-0 overflow-hidden flex-1">
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
                handleDelete,
                selection: s,
                tableData: table.data,
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
        <div className="hidden min-[1000px]:flex flex-col w-80 min-h-0 overflow-hidden border-l border-base-300 flex-shrink-0 pl-3">
          <FilePreview
            filePath={previewFilePath}
            isFile={selectedItem?.type === "file"}
          />
        </div>
      </div>
    </div>
  );
}

function getRowContextMenu({
  setAsDefaultPath,
  favorites,
  d,
  handleDelete,
  selection,
  tableData,
}: {
  setAsDefaultPath: (path: string) => void;
  favorites: ReturnType<typeof useFavorites>;
  d: ReturnType<typeof useDirectory>;
  handleDelete: (items: GetFilesAndFoldersInDirectoryItem[]) => void;
  selection: ReturnType<typeof useSelection>;
  tableData: GetFilesAndFoldersInDirectoryItem[];
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
    const itemIndex = tableData.findIndex((i) => i.name === item.name);

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
              type: item.type,
            });
            close();
          },
          view: <div>Set as favorite</div>,
        };

    const deleteItem: ContextMenuItem = {
      onClick: () => {
        const isSelected =
          itemIndex !== -1 && selection.state.indexes.has(itemIndex);
        const itemsToDelete =
          isSelected && selection.state.indexes.size > 0
            ? [...selection.state.indexes].map((i) => tableData[i])
            : [item];
        handleDelete(itemsToDelete);
        close();
      },
      view: (
        <div>
          Delete{" "}
          {itemIndex !== -1 &&
          selection.state.indexes.has(itemIndex) &&
          selection.state.indexes.size > 1
            ? `(${selection.state.indexes.size} items)`
            : ""}
        </div>
      ),
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
            deleteItem,
          ]}
        />
      );

    return <ContextMenuList items={[favoriteItem, deleteItem]} />;
  };
}
