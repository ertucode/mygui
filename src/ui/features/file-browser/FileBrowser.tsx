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
import { useFuzzyFinder } from "@/lib/libs/fuzzy-find/FuzzyFinderInput";
import { useConfirmation } from "@/lib/hooks/useConfirmation";
import { createColumns, sortNames } from "./config/columns";
import {
  directoryStore,
  directoryHelpers,
  selectDirectory,
  selectLoading,
  selectDirectoryData,
  selectError,
  selectSettings as selectDirectorySettings,
  selectPendingSelection,
} from "./directory";
import { FavoritesList } from "./components/FavoritesList";
import {
  favoritesStore,
  selectIsFavorite,
  type FavoriteItem,
} from "./favorites";
import { RecentsList } from "./components/RecentsList";
import { TagsList } from "./components/TagsList";
import { useSelector } from "@xstate/store/react";
import {
  tagsStore,
  TAG_COLOR_CLASSES,
  selectFileTags,
  selectLastUsedTag,
  selectHasTag,
  selectTagName,
} from "./tags";
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
import { errorResponseToMessage, GenericError } from "@common/GenericError";
import { useToast } from "@/lib/components/toast";
import { PathHelpers } from "@common/PathHelpers";
import { setDefaultPath } from "./defaultPath";

export function FileBrowser() {
  const fileTags = useSelector(tagsStore, selectFileTags);

  // Subscribe to directory store
  const directory = useSelector(directoryStore, selectDirectory);
  const loading = useSelector(directoryStore, selectLoading);
  const directoryData = useSelector(directoryStore, selectDirectoryData);
  const directoryError = useSelector(directoryStore, selectError);
  const pendingSelection = useSelector(directoryStore, selectPendingSelection);
  const settings = selectDirectorySettings();
  const s = useSelection(useDefaultSelection());
  const confirmation = useConfirmation();
  const [localError, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [isFuzzyFinderOpen, setIsFuzzyFinderOpen] = useState(false);
  const [finderInitialTab, setFinderInitialTab] = useState<FinderTab>("files");
  const [assignTagsPath, setAssignTagsPath] = useState<string | null>(null);
  const [multiFileTagsPaths, setMultiFileTagsPaths] = useState<string[] | null>(
    null,
  );

  useEffect(() => {
    s.reset();
  }, [directoryData]);

  const fuzzy = useFuzzyFinder({
    items: directoryData,
    keys: ["name"],
    setHighlight: s.setSelection,
  });

  const columns = createColumns({
    fileTags,
    getFullPath: directoryHelpers.getFullPath,
  });

  const table = useTable({
    columns,
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
      directoryHelpers.setPendingSelection(null);
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
      state: settings.sort,
      changeState: directoryHelpers.setSort,
      schema: sortNames,
    },
    [settings],
  );

  const onGoUpOrPrev = async (
    fn: typeof directoryHelpers.goPrev | typeof directoryHelpers.goUp,
  ) => {
    const metadata = await fn();
    if (!metadata) return;
    const { directoryData, beforeNavigation } = metadata;

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

  const toast = useToast();
  const handleCopy = async (
    items: GetFilesAndFoldersInDirectoryItem[],
    cut: boolean = false,
  ) => {
    const paths = items.map(
      (item) => item.fullPath ?? directoryHelpers.getFullPath(item.name),
    );
    const result = await getWindowElectron().copyFiles(paths, cut);
    if (!result.success) {
      toast.show(result);
    }
  };

  const handlePaste = async () => {
    if (directory.type !== "path") {
      toast.show(GenericError.Message("Cannot paste in tags view"));
      return;
    }
    const result = await getWindowElectron().pasteFiles(directory.fullPath);
    if (result.success) {
      await directoryHelpers.reload();
      // Select the first pasted item
      if (result.data?.pastedItems && result.data.pastedItems.length > 0) {
        directoryHelpers.setPendingSelection(result.data.pastedItems[0]);
      }
    } else {
      toast.show(result);
    }
  };

  // Track if any dialog is open
  const someDialogIsOpened = isFuzzyFinderOpen || confirmation.isOpen;

  const handleDelete = (items: GetFilesAndFoldersInDirectoryItem[]) => {
    const paths = items.map(
      (item) => item.fullPath ?? directoryHelpers.getFullPath(item.name),
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
            setError(errorResponseToMessage(result.error));
            return;
          }

          // Remove from favorites if they were favorited
          paths.forEach((path) => {
            if (selectIsFavorite(path)(favoritesStore.get())) {
              favoritesStore.send({ type: "removeFavorite", fullPath: path });
            }
          });

          // Reload the directory without affecting history
          await directoryHelpers.reload();

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
            directoryHelpers.setPendingSelection(itemToSelect.name);
          } else {
            s.reset();
          }
        } catch (error) {
          console.error("Error deleting files:", error);
          setError(
            error instanceof Error ? error.message : "Error deleting files",
          );
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
          directoryHelpers.openItem(itemToOpen);
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
          onGoUpOrPrev(directoryHelpers.goPrev);
        },
      },
      {
        key: { key: "i", ctrlKey: true },
        handler: (_) => {
          onGoUpOrPrev(directoryHelpers.goNext);
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
        handler: () => onGoUpOrPrev(directoryHelpers.goUp),
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
          directoryHelpers.reload();
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
          const favorite = favoritesStore.get().context.favorites[i];
          if (favorite) {
            openFavorite(favorite);
          }
        },
      })),
      ...s.getShortcuts(table.data.length),
    ],
    {
      isDisabled: someDialogIsOpened,
    },
  );

  const openFavorite = (favorite: FavoriteItem) => {
    if (favorite.type === "dir") {
      directoryHelpers.cdFull(favorite.fullPath);
    } else {
      directoryHelpers.openFileFull(favorite.fullPath);
    }
  };

  // TODO: fix inference
  const dialogs = useDialogs<[{}, {}], GetFilesAndFoldersInDirectoryItem>(
    {
      title: "Rename",
      component: RenameDialog,
      props: {},
      icon: PencilIcon,
    },
    {
      title: "New File or Folder",
      component: NewItemDialog,
      props: {},
      icon: FilePlusIcon,
    },
  );

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
      ? (selectedItem.fullPath ??
        directoryHelpers.getFullPath(selectedItem.name))
      : null;

  return (
    <div className="flex flex-col items-stretch gap-3 h-full p-6 overflow-hidden">
      <FinderDialog
        isOpen={isFuzzyFinderOpen}
        setIsOpen={setIsFuzzyFinderOpen}
        initialTab={finderInitialTab}
      />
      {dialogs.RenderOutside}
      <AssignTagsDialog
        isOpen={assignTagsPath !== null}
        onClose={() => setAssignTagsPath(null)}
        fullPath={assignTagsPath || ""}
      />
      <MultiFileTagsDialog
        isOpen={multiFileTagsPaths !== null}
        onClose={() => setMultiFileTagsPaths(null)}
        fullPaths={multiFileTagsPaths || []}
      />
      <FileBrowserOptionsSection />
      <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">
        <div
          className="flex flex-col h-full min-h-0 overflow-hidden flex-shrink-0"
          style={{ width: sidebarPanel.width }}
        >
          <FavoritesList
            className="flex-1 min-h-0 basis-0"
            openFavorite={openFavorite}
          />
          <RecentsList className="flex-1 min-h-0 basis-0" />
          <TagsList className="flex-1 min-h-0 basis-0" />
        </div>
        <ResizeHandle
          onMouseDown={sidebarPanel.handleMouseDown}
          direction="left"
        />
        <div className="relative flex flex-col min-h-0 min-w-0 overflow-hidden flex-1">
          <FileBrowserNavigationAndInputSection
            fuzzy={fuzzy}
            onGoUpOrPrev={onGoUpOrPrev}
          />
          {loading ? (
            <div>Loading...</div>
          ) : directoryError || localError ? (
            <Alert children={(directoryError || localError)!} />
          ) : (
            <Table
              tableRef={tableRef}
              table={table}
              sort={sort}
              onRowDoubleClick={directoryHelpers.openItem}
              selection={s}
              ContextMenu={getRowContextMenu({
                setAsDefaultPath: setDefaultPath,

                handleDelete,
                handleCopy,
                handlePaste,
                selection: s,
                tableData: table.data,
                dialogs: dialogs as any, // TODO: fix this
                openAssignTagsDialog: (fullPath: string) => {
                  const selectedIndexes = [...s.state.indexes.values()];
                  const selectedItems = selectedIndexes.map((i) => {
                    const item = fuzzy.results[i];
                    return (
                      item.fullPath ?? directoryHelpers.getFullPath(item.name)
                    );
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
                      return (
                        tableItem.fullPath ??
                        directoryHelpers.getFullPath(tableItem.name)
                      );
                    })
                  : [item.fullPath ?? directoryHelpers.getFullPath(item.name)];

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
                  directoryHelpers.preloadDirectory(
                    item.fullPath ?? directoryHelpers.getFullPath(item.name),
                  );
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
  handleDelete,
  handleCopy,
  handlePaste,
  selection,
  tableData,
  dialogs,
  openAssignTagsDialog,
}: {
  setAsDefaultPath: (path: string) => void;
  handleDelete: (items: GetFilesAndFoldersInDirectoryItem[]) => void;
  handleCopy: (
    items: GetFilesAndFoldersInDirectoryItem[],
    cut: boolean,
  ) => void;
  handlePaste: () => void;
  selection: ReturnType<typeof useSelection>;
  tableData: GetFilesAndFoldersInDirectoryItem[];
  dialogs: DialogsReturn<GetFilesAndFoldersInDirectoryItem>;
  openAssignTagsDialog: (fullPath: string) => void;
}) {
  return ({
    item,
    close,
  }: {
    item: GetFilesAndFoldersInDirectoryItem;
    close: () => void;
  }) => {
    const fullPath = item.fullPath ?? directoryHelpers.getFullPath(item.name);
    const isFavorite = selectIsFavorite(fullPath)(favoritesStore.get());
    const itemIndex = tableData.findIndex((i) => i.name === item.name);

    const favoriteItem: ContextMenuItem = isFavorite
      ? {
          onClick: () => {
            favoritesStore.send({ type: "removeFavorite", fullPath });
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
            favoritesStore.send({
              type: "addFavorite",
              item: {
                fullPath,
                type: item.type,
              },
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
    const lastUsedTag = useSelector(tagsStore, selectLastUsedTag);
    const hasLastUsedTag = lastUsedTag
      ? useSelector(tagsStore, selectHasTag(fullPath, lastUsedTag))
      : false;
    const lastUsedTagName = lastUsedTag
      ? useSelector(tagsStore, selectTagName(lastUsedTag))
      : "";

    const lastUsedTagItem: ContextMenuItem | null =
      lastUsedTag && !hasLastUsedTag
        ? {
            onClick: () => {
              tagsStore.send({
                type: "addTagToFiles",
                fullPaths: selectedItems.map(
                  (i) => i.fullPath ?? directoryHelpers.getFullPath(i.name),
                ),
                color: lastUsedTag!,
              });

              close();
            },
            view: (
              <div className="flex items-center gap-2">
                <span
                  className={`size-3 rounded-full ${TAG_COLOR_CLASSES[lastUsedTag!].dot}`}
                />
                <span>Add to "{lastUsedTagName}"</span>
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
