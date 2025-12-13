import {
  FolderCogIcon,
  StarIcon,
  StarOffIcon,
  Trash2Icon,
  FilePlusIcon,
  PencilIcon,
  CopyIcon,
  ScissorsIcon,
  ClipboardPasteIcon,
  TagIcon,
} from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
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
import { useFuzzyFinder } from "@/lib/libs/fuzzy-find/FuzzyFinderInput";
import { useConfirmation } from "@/lib/hooks/useConfirmation";
import { createColumns, sortNames } from "./config/columns";
import { useDirectory } from "./hooks/useDirectory";
import { useDefaultPath } from "./hooks/useDefaultPath";
import { FavoritesList } from "./components/FavoritesList";
import { FavoriteItem, useFavorites } from "./hooks/useFavorites";
import { RecentsList } from "./components/RecentsList";
import { useRecents } from "./hooks/useRecents";
import { TagsList } from "./components/TagsList";
import { useTags, TAG_COLOR_CLASSES } from "./hooks/useTags";
import { AssignTagsDialog } from "./components/AssignTagsDialog";
import { MultiFileTagsDialog } from "./components/MultiFileTagsDialog";
import { FilePreview } from "./components/FilePreview";
import { NewItemDialog } from "./components/NewItemDialog";
import { RenameDialog } from "./components/RenameDialog";
import { FinderDialog, FinderTab } from "./components/FinderDialog";
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
import { GenericError } from "@common/GenericError";
import { useToast } from "@/lib/components/toast";
import { PathHelpers } from "@common/PathHelpers";
import { useForceRerender } from "@/lib/hooks/forceRerender";

type D = ReturnType<typeof useDirectory>;

type ActiveDirectoryData = {
  d: ReturnType<typeof useDirectory>;
  s: ReturnType<typeof useSelection>;
  table: ReturnType<typeof useTable<GetFilesAndFoldersInDirectoryItem>>;
  fuzzy: ReturnType<typeof useFuzzyFinder>;
  tableRef: React.RefObject<HTMLTableElement | null>;
};
type ActiveDirectoryDataRef = Record<number, ActiveDirectoryData>;

type FileBrowserTab = {
  id: number;
  initialPath?: string;
};

export function FileBrowser() {
  const defaultPath = useDefaultPath();
  const recents = useRecents();
  const tags = useTags();
  const confirmation = useConfirmation();
  const [isFuzzyFinderOpen, setIsFuzzyFinderOpen] = useState(false);
  const [finderInitialTab, setFinderInitialTab] = useState<FinderTab>("files");
  const [assignTagsPath, setAssignTagsPath] = useState<string | null>(null);
  const [multiFileTagsPaths, setMultiFileTagsPaths] = useState<string[] | null>(
    null,
  );
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);

  const activeDirectoryDataRef = useRef<ActiveDirectoryDataRef>({});

  const trigger = useForceRerender();

  const [tabs, setTabs] = useState<FileBrowserTab[]>(() => {
    return [{ id: 0 }, { id: 1, initialPath: "~/dev/bombardiman/" }];
  });
  const [activeIndex, setActiveIndex] = useState(0);

  const { d, s, table, fuzzy, tableRef } =
    activeDirectoryDataRef.current?.[tabs[activeIndex].id] ??
    ({} as any as ActiveDirectoryData);

  const onGoUpOrPrev = async (fn: typeof d.goPrev | typeof d.goUp) => {
    const metadata = await fn();
    if (!metadata) return;
    let { directoryData, beforeNavigation } = metadata;

    setTimeout(() => {
      if (!directoryData) return;
      if (beforeNavigation.type !== "path") return;
      const beforeNavigationName = PathHelpers.getLastPathPart(
        beforeNavigation.fullPath,
      );
      const idx = directoryData.findIndex(
        (i) => i.name === beforeNavigationName,
      );
      if (idx === -1) return;
      s?.selectManually(idx);
    }, 5);
  };

  // Track if any dialog is open
  const someDialogIsOpened = isFuzzyFinderOpen || confirmation.isOpen;

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
  const toast = useToast();
  const handleCopy = async (
    items: GetFilesAndFoldersInDirectoryItem[],
    cut: boolean = false,
  ) => {
    const paths = items.map(
      (item) => item.fullPath ?? d.getFullPath(item.name),
    );
    const result = await getWindowElectron().copyFiles(paths, cut);
    if (!result.success) {
      toast.show(result);
    }
  };

  const handlePaste = async () => {
    if (d.directory.type !== "path") {
      toast.show(GenericError.Message("Cannot paste in tags view"));
      return;
    }
    const result = await getWindowElectron().pasteFiles(d.directory.fullPath);
    if (result.success) {
      await d.reload();
      // Select the first pasted item
      if (result.data?.pastedItems && result.data.pastedItems.length > 0) {
        setPendingSelection(result.data.pastedItems[0]);
      }
    } else {
      toast.show(result);
    }
  };

  // Handle pending selection after data reload
  useEffect(() => {
    if (pendingSelection && table?.data.length > 0) {
      const newItemIndex = table.data.findIndex(
        (item) => item.name === pendingSelection,
      );
      if (newItemIndex !== -1) {
        s.selectManually(newItemIndex);
        scrollRowIntoViewIfNeeded(newItemIndex, "center");
      }
      setPendingSelection(null);
    }
  }, [pendingSelection, table?.data]);

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
        key: { key: "p", ctrlKey: true },
        handler: (e) => {
          e.preventDefault();
          setFinderInitialTab("files");
          setIsFuzzyFinderOpen(true);
        },
      },
      {
        key: { key: "s", ctrlKey: true },
        handler: (e) => {
          e.preventDefault();
          setFinderInitialTab("strings");
          setIsFuzzyFinderOpen(true);
        },
      },
      {
        key: { key: "f", ctrlKey: true },
        handler: (e) => {
          e.preventDefault();
          setFinderInitialTab("folders");
          setIsFuzzyFinderOpen(true);
        },
      },
      {
        key: { key: "o", ctrlKey: true },
        handler: (_) => {
          onGoUpOrPrev(d.goPrev);
        },
      },
      {
        key: { key: "i", ctrlKey: true },
        handler: (_) => {
          onGoUpOrPrev(d.goNext);
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
        key: ["-", "h"],
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
      {
        key: { key: "c", metaKey: true },
        handler: (e) => {
          // Check if user is selecting text
          const selection = window.getSelection();
          if (selection && selection.toString().length > 0) {
            return; // Allow default text copy
          }

          e.preventDefault();
          if (s.state.indexes.size === 0) return;
          const itemsToCopy = [...s.state.indexes].map((i) => table.data[i]);
          handleCopy(itemsToCopy, false);
        },
        enabledIn: () => true,
      },
      {
        key: { key: "x", metaKey: true },
        handler: (e) => {
          // Check if user is selecting text
          const selection = window.getSelection();
          if (selection && selection.toString().length > 0) {
            return; // Allow default text cut
          }

          e.preventDefault();
          if (s.state.indexes.size === 0) return;
          const itemsToCut = [...s.state.indexes].map((i) => table.data[i]);
          handleCopy(itemsToCut, true);
        },
        enabledIn: () => true,
      },
      {
        key: { key: "v", metaKey: true },
        handler: (e) => {
          // Check if user is in an input field
          const target = e.target as HTMLElement;
          if (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable
          ) {
            return; // Allow default paste in inputs
          }

          e.preventDefault();
          handlePaste();
        },
        enabledIn: () => true,
      },
      {
        key: { key: "0", ctrlKey: true },
        handler: (_) => {
          // @ts-ignore
          document.querySelector("webview")?.openDevTools();
        },
      },
      // Option+1 through Option+9 to open favorites
      ...Array.from({ length: 9 }, (_, i) => ({
        key: { key: `Digit${i + 1}`, isCode: true, altKey: true },
        handler: (e: KeyboardEvent) => {
          e.preventDefault();
          const favorite = favorites.favorites[i];
          if (favorite) {
            openFavorite(favorite);
          }
        },
      })),
      ...(s?.getShortcuts(table.data.length) ?? []),
    ],
    {
      isDisabled: someDialogIsOpened,
    },
  );

  const handleDelete = (items: GetFilesAndFoldersInDirectoryItem[]) => {
    const paths = items.map(
      (item) => item.fullPath ?? d.getFullPath(item.name),
    );
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
          const result = await getWindowElectron().deleteFiles(paths);

          if (!result.success) {
            toast.show(result);
            return;
          }

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
          toast.show(
            GenericError.Message(
              error instanceof Error ? error.message : "Error deleting files",
            ),
          );
        }
      },
    });
  };

  const handleCreateNewItem = async (
    name: string,
  ): Promise<ResultHandlerResult> => {
    if (d.directory.type !== "path") {
      return GenericError.Message("Cannot create items in tags view");
    }
    try {
      const result = await getWindowElectron().createFileOrFolder(
        d.directory.fullPath,
        name,
      );
      if (result.success) {
        await d.reload();

        // Set pending selection for the newly created item
        const itemName = name.endsWith("/") ? name.slice(0, -1) : name;
        setPendingSelection(itemName);
      } else if (result.error) {
        toast.show(result);
      }
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      toast.show(GenericError.Message(errorMessage));
      return GenericError.Message(errorMessage);
    }
  };

  const handleRename = async (
    newName: string,
  ): Promise<ResultHandlerResult> => {
    const item = dialogs.currentRef.current?.item;
    if (!item) return GenericError.Message("No item selected");

    try {
      const fullPath = item.fullPath ?? d.getFullPath(item.name);
      const result = await getWindowElectron().renameFileOrFolder(
        fullPath,
        newName,
      );
      if (result.success) {
        await d.reload();

        // Set pending selection for the renamed item
        setPendingSelection(newName);
      }
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      toast.show(GenericError.Message(errorMessage));
      return GenericError.Message(errorMessage);
    }
  };

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

  const openFavorite = (favorite: FavoriteItem) => {
    if (favorite.type === "dir") {
      d.cdFull(favorite.fullPath);
    } else {
      d.openFileFull(favorite.fullPath);
    }
  };

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
    s?.state.indexes.size === 1 && s.state.lastSelected != null
      ? table?.data[s.state.lastSelected]
      : null;
  const previewFilePath =
    selectedItem && selectedItem.type === "file"
      ? (selectedItem.fullPath ?? d.getFullPath(selectedItem.name))
      : null;

  return (
    <div className="flex flex-col items-stretch gap-3 h-full p-6 overflow-hidden">
      {dialogs.RenderOutside}
      <FinderDialog
        directory={d}
        isOpen={isFuzzyFinderOpen}
        setIsOpen={setIsFuzzyFinderOpen}
        initialTab={finderInitialTab}
      />
      <AssignTagsDialog
        isOpen={assignTagsPath !== null}
        onClose={() => setAssignTagsPath(null)}
        fullPath={assignTagsPath || ""}
        tags={tags}
      />
      <MultiFileTagsDialog
        isOpen={multiFileTagsPaths !== null}
        onClose={() => setMultiFileTagsPaths(null)}
        fullPaths={multiFileTagsPaths || []}
        tags={tags}
      />
      {d && <FileBrowserOptionsSection d={d} />}

      <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">
        {d && (
          <div
            className="flex flex-col h-full min-h-0 overflow-hidden flex-shrink-0"
            style={{ width: sidebarPanel.width }}
          >
            <FavoritesList
              favorites={favorites}
              d={d}
              className="flex-1 min-h-0 basis-0"
              defaultPath={defaultPath}
              openFavorite={openFavorite}
            />
            <RecentsList
              recents={recents}
              d={d}
              className="flex-1 min-h-0 basis-0"
            />
            <TagsList tags={tags} d={d} className="flex-1 min-h-0 basis-0" />
          </div>
        )}
        <ResizeHandle
          onMouseDown={sidebarPanel.handleMouseDown}
          direction="left"
        />
        {tabs.map((tab, idx) => (
          <FileBrowserTab
            key={tab.id}
            id={tab.id}
            initialPath={tab.initialPath ?? defaultPath.path}
            recents={recents}
            tags={tags}
            defaultPath={defaultPath}
            scrollRowIntoViewIfNeeded={scrollRowIntoViewIfNeeded}
            onGoUpOrPrev={onGoUpOrPrev}
            favorites={favorites}
            handleDelete={handleDelete}
            dialogs={dialogs}
            setMultiFileTagsPaths={setMultiFileTagsPaths}
            setAssignTagsPath={setAssignTagsPath}
            handleCopy={handleCopy}
            handlePaste={handlePaste}
            active={idx === activeIndex}
            activeDirectoryDataRef={activeDirectoryDataRef}
            trigger={trigger}
          />
        ))}
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

function FileBrowserTab({
  initialPath,
  recents,
  tags,
  defaultPath,
  scrollRowIntoViewIfNeeded,
  onGoUpOrPrev,
  favorites,
  handleDelete,
  dialogs,
  setMultiFileTagsPaths,
  setAssignTagsPath,
  handleCopy,
  handlePaste,
  active,
  activeDirectoryDataRef,
  id,
  trigger,
}: {
  initialPath: string;
  recents: ReturnType<typeof useRecents>;
  tags: ReturnType<typeof useTags>;
  defaultPath: ReturnType<typeof useDefaultPath>;
  scrollRowIntoViewIfNeeded: (
    rowIndex: number,
    block?: ScrollLogicalPosition,
  ) => void;
  onGoUpOrPrev: (fn: D["goPrev"] | D["goUp"]) => void;
  favorites: ReturnType<typeof useFavorites>;
  handleDelete: (items: GetFilesAndFoldersInDirectoryItem[]) => void;
  dialogs: any;
  setMultiFileTagsPaths: Dispatch<SetStateAction<string[] | null>>;
  setAssignTagsPath: Dispatch<SetStateAction<string | null>>;
  handleCopy: (
    items: GetFilesAndFoldersInDirectoryItem[],
    cut: boolean,
  ) => void;
  handlePaste: () => void;
  active: boolean;
  activeDirectoryDataRef: React.RefObject<ActiveDirectoryDataRef>;
  id: number;
  trigger: () => void;
}) {
  const d = useDirectory(initialPath, recents, tags.getFilesWithTag);
  const s = useSelection(useDefaultSelection());
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    s.reset();
  }, [d.directoryData]);

  const fuzzy = useFuzzyFinder({
    items: d.directoryData,
    keys: ["name"],
    setHighlight: s.setSelection,
  });

  const columns = createColumns({
    fileTags: tags.fileTags,
    getFullPath: d.getFullPath,
  });

  const table = useTable({
    columns,
    data: fuzzy.results,
    selection: s,
    resetSelectionOnDataChange: false,
  });

  useEffect(() => {
    if (!active) return;

    activeDirectoryDataRef.current[id] = { d, s, table, fuzzy, tableRef };
  }, [active, d, s, table, fuzzy, tableRef]);

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

  return (
    <div className="relative flex flex-col min-h-0 min-w-0 overflow-hidden flex-1">
      <FileBrowserNavigationAndInputSection
        d={d}
        defaultPath={defaultPath}
        fuzzy={fuzzy}
        onGoUpOrPrev={onGoUpOrPrev}
        tags={tags}
      />
      {d.loading ? (
        <div>Loading...</div>
      ) : (
        <Table
          tableRef={tableRef}
          table={table}
          sort={sort}
          onRowDoubleClick={d.openItem}
          selection={s}
          ContextMenu={getRowContextMenu({
            setAsDefaultPath: (fullPath) => {
              defaultPath.setPath(fullPath);
            },
            favorites,
            d,
            handleDelete,
            handleCopy,
            handlePaste,
            selection: s,
            tableData: table.data,
            dialogs: dialogs as any, // TODO: fix this
            tags,
            openAssignTagsDialog: (fullPath: string) => {
              const selectedIndexes = [...s.state.indexes.values()];
              const selectedItems = selectedIndexes.map((i) => {
                const item = fuzzy.results[i];
                return item.fullPath ?? d.getFullPath(item.name);
              });
              if (selectedItems.length > 1) {
                // Multiple files selected - use grid dialog
                setMultiFileTagsPaths(selectedItems);
              } else {
                // Single file - use standard dialog
                setAssignTagsPath(fullPath);
              }
            },
          })}
          onRowDragStart={async (item, index, e) => {
            const alreadySelected = s.state.indexes.has(index);
            const files = alreadySelected
              ? [...s.state.indexes].map((i) => {
                  const tableItem = table.data[i];
                  return tableItem.fullPath ?? d.getFullPath(tableItem.name);
                })
              : [item.fullPath ?? d.getFullPath(item.name)];

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
              d.preloadDirectory(item.fullPath ?? d.getFullPath(item.name));
            }
          }}
        ></Table>
      )}
    </div>
  );
}

function getRowContextMenu({
  setAsDefaultPath,
  favorites,
  d,
  handleDelete,
  handleCopy,
  handlePaste,
  selection,
  tableData,
  dialogs,
  tags,
  openAssignTagsDialog,
}: {
  setAsDefaultPath: (path: string) => void;
  favorites: ReturnType<typeof useFavorites>;
  d: ReturnType<typeof useDirectory>;
  handleDelete: (items: GetFilesAndFoldersInDirectoryItem[]) => void;
  handleCopy: (
    items: GetFilesAndFoldersInDirectoryItem[],
    cut: boolean,
  ) => void;
  handlePaste: () => void;
  selection: ReturnType<typeof useSelection>;
  tableData: GetFilesAndFoldersInDirectoryItem[];
  dialogs: DialogsReturn<GetFilesAndFoldersInDirectoryItem>;
  tags: ReturnType<typeof useTags>;
  openAssignTagsDialog: (fullPath: string) => void;
}) {
  return ({
    item,
    close,
  }: {
    item: GetFilesAndFoldersInDirectoryItem;
    close: () => void;
  }) => {
    const fullPath = item.fullPath ?? d.getFullPath(item.name);
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

    const isSelected =
      itemIndex !== -1 && selection.state.indexes.has(itemIndex);
    const selectedItems =
      isSelected && selection.state.indexes.size > 0
        ? [...selection.state.indexes].map((i) => tableData[i])
        : [item];

    const copyItem: ContextMenuItem = {
      onClick: () => {
        handleCopy(selectedItems, false);
        close();
      },
      view: (
        <TextWithIcon icon={CopyIcon}>
          Copy
          {isSelected && selection.state.indexes.size > 1
            ? ` (${selection.state.indexes.size} items)`
            : ""}
        </TextWithIcon>
      ),
    };

    const cutItem: ContextMenuItem = {
      onClick: () => {
        handleCopy(selectedItems, true);
        close();
      },
      view: (
        <TextWithIcon icon={ScissorsIcon}>
          Cut
          {isSelected && selection.state.indexes.size > 1
            ? ` (${selection.state.indexes.size} items)`
            : ""}
        </TextWithIcon>
      ),
    };

    const pasteItem: ContextMenuItem = {
      onClick: () => {
        handlePaste();
        close();
      },
      view: <TextWithIcon icon={ClipboardPasteIcon}>Paste</TextWithIcon>,
    };

    const deleteItem: ContextMenuItem = {
      onClick: () => {
        handleDelete(selectedItems);
        close();
      },
      view: (
        <TextWithIcon icon={Trash2Icon}>
          Delete
          {isSelected && selection.state.indexes.size > 1
            ? ` (${selection.state.indexes.size} items)`
            : ""}
        </TextWithIcon>
      ),
    };

    const commonItems = renderAsContextMenu(item, dialogs);

    // Tag-related menu items
    const assignTagsItem: ContextMenuItem = {
      onClick: () => {
        openAssignTagsDialog(fullPath);
        close();
      },
      view: <TextWithIcon icon={TagIcon}>Assign Tags...</TextWithIcon>,
    };

    // Last used tag quick-add item
    const lastUsedTagItem: ContextMenuItem | null =
      tags.lastUsedTag && !tags.hasTag(fullPath, tags.lastUsedTag)
        ? {
            onClick: () => {
              tags.addTagToFiles(
                selectedItems.map((i) => i.fullPath ?? d.getFullPath(i.name)),
                tags.lastUsedTag!,
              );

              close();
            },
            view: (
              <div className="flex items-center gap-2">
                <span
                  className={`size-3 rounded-full ${TAG_COLOR_CLASSES[tags.lastUsedTag].dot}`}
                />
                <span>Add to "{tags.getTagName(tags.lastUsedTag)}"</span>
              </div>
            ),
          }
        : null;

    if (item.type === "dir")
      return (
        <ContextMenuList
          items={[
            {
              onClick: () => {
                setAsDefaultPath(fullPath);
                close();
              },
              view: (
                <TextWithIcon icon={FolderCogIcon}>
                  Set as default path
                </TextWithIcon>
              ),
            },
            favoriteItem,
            lastUsedTagItem,
            assignTagsItem,
            copyItem,
            cutItem,
            pasteItem,
            deleteItem,
            ...commonItems,
          ]}
        />
      );

    return (
      <ContextMenuList
        items={[
          favoriteItem,
          lastUsedTagItem,
          assignTagsItem,
          copyItem,
          cutItem,
          pasteItem,
          deleteItem,
          ...commonItems,
        ]}
      />
    );
  };
}
