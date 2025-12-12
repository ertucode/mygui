import {
  FolderCogIcon,
  StarIcon,
  StarOffIcon,
  Trash2Icon,
  FilePlusIcon,
  PencilIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { useFuzzyFinder } from "@/lib/libs/fuzzy-find/FuzzyFinderDialog";
import { useConfirmation } from "@/lib/hooks/useConfirmation";
import { cols, sortNames } from "./config/columns";
import { useDirectory } from "./hooks/useDirectory";
import { useDefaultPath } from "./hooks/useDefaultPath";
import { FavoritesList } from "./components/FavoritesList";
import { useFavorites } from "./hooks/useFavorites";
import { RecentsList } from "./components/RecentsList";
import { useRecents } from "./hooks/useRecents";
import { FilePreview } from "./components/FilePreview";
import { NewItemDialog } from "./components/NewItemDialog";
import { RenameDialog } from "./components/RenameDialog";
import { TextWithIcon } from "@/lib/components/text-with-icon";
import { FileBrowserOptionsSection } from "./components/FileBrowserOptionsSection";
import { FileBrowserNavigationAndInputSection } from "./components/FileBrowserNavigationAndInputSection";
import { useResizablePanel, ResizeHandle } from "@/lib/hooks/useResizablePanel";
import {
  DialogsReturn,
  renderAsContextMenu,
  useDialogs,
} from "@/lib/hooks/useDialogs";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { getWindowElectron } from "@/getWindowElectron";
import { ResultHandlerResult } from "@/lib/hooks/useDefaultResultHandler";
import { errorResponseToMessage, GenericError } from "@common/GenericError";

export function FileBrowser() {
  const defaultPath = useDefaultPath();
  const recents = useRecents();
  const d = useDirectory(defaultPath.path, recents);
  const s = useSelection(useDefaultSelection());
  const confirmation = useConfirmation();
  const [error, setError] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    s.reset();
  }, [d.directoryData]);

  const handleCreateNewItem = async (
    name: string,
  ): Promise<ResultHandlerResult> => {
    try {
      const result = await getWindowElectron().createFileOrFolder(
        d.directory.fullName,
        name,
      );
      if (result.success) {
        await d.reload();
        setError(null);

        // Set pending selection for the newly created item
        const itemName = name.endsWith("/") ? name.slice(0, -1) : name;
        setPendingSelection(itemName);
      } else if (result.error) {
        setError(errorResponseToMessage(result.error));
      }
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      return GenericError.Message(errorMessage);
    }
  };

  const handleRename = async (
    newName: string,
  ): Promise<ResultHandlerResult> => {
    const item = dialogs.currentRef.current?.item;
    if (!item) return GenericError.Message("No item selected");

    try {
      const fullPath = d.getFullName(item.name);
      const result = await getWindowElectron().renameFileOrFolder(
        fullPath,
        newName,
      );
      if (result.success) {
        await d.reload();
        setError(null);

        // Set pending selection for the renamed item
        setPendingSelection(newName);
      }
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      return GenericError.Message(errorMessage);
    }
  };

  const fuzzy = useFuzzyFinder({
    items: d.directoryData,
    keys: ["name"],
    setHighlight: s.setSelection,
  });

  const table = useTable({
    columns: cols,
    data: fuzzy.results,
    selection: s,
    resetSelectionOnDataChange: false,
  });

  const scrollRowIntoViewIfNeeded = (
    rowIndex: number,
    block: ScrollLogicalPosition = "nearest",
  ) => {
    const row = tableRef.current?.querySelector(
      `tbody tr:nth-child(${rowIndex + 1})`,
    );
    if (row) {
      const scrollContainer = tableRef.current?.closest(
        ".overflow-auto",
      ) as HTMLElement | null;
      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const isInView =
          rowRect.top >= containerRect.top &&
          rowRect.bottom <= containerRect.bottom;
        if (!isInView) {
          row.scrollIntoView({ block });
        }
      }
    }
  };

  // Handle pending selection after data reload
  useEffect(() => {
    if (pendingSelection && table.data.length > 0) {
      const newItemIndex = table.data.findIndex(
        (item) => item.name === pendingSelection,
      );
      if (newItemIndex !== -1) {
        s.selectManually(newItemIndex);
        scrollRowIntoViewIfNeeded(newItemIndex, "center");
      }
      setPendingSelection(null);
    }
  }, [pendingSelection, table.data]);

  // Scroll to selected row when selection changes (keyboard navigation)
  useEffect(() => {
    if (s.state.lastSelected != null) {
      scrollRowIntoViewIfNeeded(s.state.lastSelected);
    }
  }, [s.state.lastSelected]);

  const sort = useTableSort(
    {
      state: d.settings.sort,
      changeState: d.setSort,
      schema: sortNames,
    },
    [d.settings],
  );

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
    const deletedNames = new Set(items.map((item) => item.name));

    // Find the smallest index among items being deleted
    const deletedIndexes = items
      .map((item) => table.data.findIndex((d) => d.name === item.name))
      .filter((idx) => idx !== -1)
      .sort((a, b) => a - b);
    const smallestDeletedIndex = deletedIndexes[0] ?? 0;

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
          await getWindowElectron().deleteFiles(paths);

          // Remove from favorites if they were favorited
          paths.forEach((path) => {
            if (favorites.isFavorite(path)) {
              favorites.removeFavorite(path);
            }
          });

          // Reload the directory without affecting history
          await d.reload();

          // Select the nearest item (prefer top, fallback to bottom)
          const remainingItems = table.data.filter(
            (item) => !deletedNames.has(item.name),
          );
          if (remainingItems.length > 0) {
            // Find the item that should now be at or near the smallest deleted index
            const newIndex = Math.min(
              smallestDeletedIndex,
              remainingItems.length - 1,
            );
            const itemToSelect = remainingItems[newIndex];
            setPendingSelection(itemToSelect.name);
          } else {
            s.reset();
          }
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

          if ((e.target as HTMLInputElement).id === "fuzzy-finder-input") {
            fuzzy.clearQuery();
            tableRef.current?.querySelector("tbody")?.focus();
          }
          d.openItem(itemToOpen);
        },
        enabledIn: (e) =>
          (e.target as HTMLInputElement).id === "fuzzy-finder-input" &&
          e.key === "Enter",
      },
      {
        key: ["h"],
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
        enabledIn: () => true,
      },
      {
        key: { key: "n", ctrlKey: true },
        handler: (e) => {
          e.preventDefault();
          dialogs.show(
            dialogs.dialogs[1],
            {} as GetFilesAndFoldersInDirectoryItem,
          );
        },
      },
      {
        key: "r",
        handler: (e) => {
          e.preventDefault();
          d.reload();
        },
      },
      ...s.getShortcuts(table.data.length),
    ],
    {
      isDisabled: confirmation.isOpen,
    },
  );

  // TODO: fix inference
  const dialogs = useDialogs<
    [
      {
        onSubmit: typeof handleRename;
      },
      {
        onSubmit: typeof handleCreateNewItem;
      },
    ],
    GetFilesAndFoldersInDirectoryItem
  >(
    {
      title: "Rename",
      component: RenameDialog,
      props: {
        onSubmit: handleRename,
      },
      icon: PencilIcon,
    },
    {
      title: "New File or Folder",
      component: NewItemDialog,
      props: {
        onSubmit: handleCreateNewItem,
      },
      icon: FilePlusIcon,
    },
  );

  const favorites = useFavorites();

  const sidebarPanel = useResizablePanel({
    storageKey: "file-browser-sidebar-width",
    defaultWidth: 120,
    minWidth: 80,
    maxWidth: 300,
    direction: "left",
  });

  const previewPanel = useResizablePanel({
    storageKey: "file-browser-preview-width",
    defaultWidth: 320,
    minWidth: 200,
    maxWidth: 900,
    direction: "right",
  });

  // Get selected file for preview (only if exactly one file is selected)
  const selectedItem =
    s.state.indexes.size === 1 && s.state.lastSelected != null
      ? table.data[s.state.lastSelected]
      : null;
  const previewFilePath =
    selectedItem && selectedItem.type === "file"
      ? d.getFullName(selectedItem.name)
      : null;

  return (
    <div className="flex flex-col items-stretch gap-3 h-full p-6 overflow-hidden">
      {dialogs.RenderOutside}
      <FileBrowserOptionsSection d={d} />
      <FileBrowserNavigationAndInputSection
        d={d}
        defaultPath={defaultPath}
        fuzzy={fuzzy}
        onGoUpOrPrev={onGoUpOrPrev}
      />
      <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">
        <div
          className="flex flex-col h-full min-h-0 overflow-hidden flex-shrink-0"
          style={{ width: sidebarPanel.width }}
        >
          <FavoritesList
            favorites={favorites}
            d={d}
            className="flex-1 min-h-0"
          />
          <RecentsList recents={recents} d={d} className="flex-1 min-h-0" />
        </div>
        <ResizeHandle
          onMouseDown={sidebarPanel.handleMouseDown}
          direction="left"
        />
        <div className="relative flex flex-col min-h-0 min-w-0 overflow-hidden flex-1">
          {d.loading ? (
            <div>Loading...</div>
          ) : d.error || error ? (
            <Alert children={(d.error || error)!} />
          ) : (
            <Table
              tableRef={tableRef}
              table={table}
              sort={sort}
              onRowDoubleClick={d.openItem}
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
                dialogs: dialogs as any, // TODO: fix this
              })}
              onRowDragStart={async (item, index, e) => {
                const alreadySelected = s.state.indexes.has(index);
                const files = alreadySelected
                  ? [...s.state.indexes].map((i) => {
                      return d.getFullName(table.data[i].name);
                    })
                  : [d.getFullName(item.name)];

                const tableBody = e.currentTarget.closest("tbody");
                getWindowElectron().onDragStart({
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
        <ResizeHandle
          onMouseDown={previewPanel.handleMouseDown}
          direction="right"
          className="hidden min-[1000px]:block"
        />
        <div
          className="hidden min-[1000px]:flex flex-col min-h-0 overflow-hidden flex-shrink-0"
          style={{ width: previewPanel.width }}
        >
          <FilePreview
            filePath={previewFilePath}
            isFile={selectedItem?.type === "file"}
            fileSize={selectedItem?.size}
            fileExt={selectedItem?.type === "file" ? selectedItem.ext : null}
            isResizing={previewPanel.isDragging}
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
  dialogs,
}: {
  setAsDefaultPath: (path: string) => void;
  favorites: ReturnType<typeof useFavorites>;
  d: ReturnType<typeof useDirectory>;
  handleDelete: (items: GetFilesAndFoldersInDirectoryItem[]) => void;
  selection: ReturnType<typeof useSelection>;
  tableData: GetFilesAndFoldersInDirectoryItem[];
  dialogs: DialogsReturn<GetFilesAndFoldersInDirectoryItem>;
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
          view: (
            <TextWithIcon icon={StarOffIcon}>
              Remove from favorites
            </TextWithIcon>
          ),
        }
      : {
          onClick: () => {
            favorites.addFavorite({
              fullPath,
              type: item.type,
            });
            close();
          },
          view: <TextWithIcon icon={StarIcon}>Add to favorites</TextWithIcon>,
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
        <TextWithIcon icon={Trash2Icon}>
          Delete
          {itemIndex !== -1 &&
          selection.state.indexes.has(itemIndex) &&
          selection.state.indexes.size > 1
            ? ` (${selection.state.indexes.size} items)`
            : ""}
        </TextWithIcon>
      ),
    };

    const commonItems = renderAsContextMenu(item, dialogs);

    if (item.type === "dir")
      return (
        <ContextMenuList
          items={[
            {
              onClick: () => {
                setAsDefaultPath(item.name);
                close();
              },
              view: (
                <TextWithIcon icon={FolderCogIcon}>
                  Set as default path
                </TextWithIcon>
              ),
            },
            favoriteItem,
            deleteItem,
            ...commonItems,
          ]}
        />
      );

    return (
      <ContextMenuList items={[favoriteItem, deleteItem, ...commonItems]} />
    );
  };
}
