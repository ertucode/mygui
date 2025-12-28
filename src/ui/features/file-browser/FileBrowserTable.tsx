import {
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
  RefreshCwIcon,
  Settings2Icon,
} from "lucide-react";
import { ContextMenu, useContextMenu } from "../../lib/components/context-menu";
import { clsx } from "../../lib/functions/clsx";
import { useTable } from "../../lib/libs/table/useTable";
import { memo, useMemo } from "react";
import { useSelector } from "@xstate/store/react";
import {
  directoryHelpers,
  directoryStore,
  selectLoading,
  selectDirectory,
  selectViewMode,
  selectError,
} from "@/features/file-browser/directoryStore/directory";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { FileTableRowContextMenu } from "@/features/file-browser/FileTableRowContextMenu";
import { useDirectoryContext } from "@/features/file-browser/DirectoryContext";
import { createColumns } from "./config/columns";
import { tagsStore, selectFileTags } from "./tags";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { fileDragDropStore } from "./fileDragDrop";
import { DirectoryId } from "./directoryStore/DirectoryBase";
import { directoryDerivedStores } from "./directoryStore/directorySubscriptions";
import { FileGridView } from "./components/fileGridView/FileGridView";
import { fileBrowserListItemProps } from "./fileBrowserListItemProps";
import { fileBrowserListContainerProps } from "./fileBrowserListContainerProps";
import { ColumnHeaderContextMenu } from "./components/ColumnHeaderContextMenu";
import {
  columnPreferencesStore,
  resolveGlobalOrPathSort,
  selectEffectivePreferences,
} from "./columnPreferences";
import { sortNames } from "./schemas";
import { Alert } from "@/lib/components/alert";
import { errorResponseToMessage, GenericError } from "@common/GenericError";
import { getWindowElectron } from "@/getWindowElectron";
import { Button } from "@/lib/components/button";

export type TableContextMenuProps<T> = {
  item: T;
  close: () => void;
  tableData: T[];
};

export const FileBrowserTable = memo(function FileBrowserTable() {
  const context = useDirectoryContext();
  const directoryId = context.directoryId;
  const filteredDirectoryData = directoryDerivedStores
    .get(context.directoryId)!
    .useFilteredDirectoryData();
  const directoryType = useSelector(
    directoryStore,
    (d) => d.context.directoriesById[directoryId].directory.type,
  );
  console.log("renreder");

  const fileTags = useSelector(tagsStore, selectFileTags);

  const directory = useSelector(directoryStore, selectDirectory(directoryId));

  const directoryPath = directory?.type === "path" ? directory.fullPath : "";

  const columnPreferences = useSelector(
    columnPreferencesStore,
    selectEffectivePreferences(directoryPath),
  );

  const allColumns = useMemo(() => {
    return createColumns({
      fileTags,
      getFullPath: (n) => directoryHelpers.getFullPath(n, context.directoryId),
      directoryId: context.directoryId,
      directoryType,
    });
  }, [fileTags]);

  // Apply column preferences: reorder and filter columns
  const columns = useMemo(() => {
    if (!columnPreferences || columnPreferences.length === 0) {
      return allColumns;
    }

    const prefMap = new Map(columnPreferences.map((p) => [p.id, p]));
    const columnIds = allColumns.map(
      (col) => col.id?.toString() || col.accessorKey,
    );

    // Create ordered list based on preferences
    const ordered: typeof allColumns = [];

    // First, add columns in preference order
    columnPreferences.forEach((pref) => {
      if (!pref.visible) return; // Skip hidden columns
      const colIndex = columnIds.indexOf(pref.id);
      if (colIndex !== -1) {
        ordered.push(allColumns[colIndex]);
      }
    });

    // Then add any new columns not in preferences
    allColumns.forEach((col) => {
      const id = col.id?.toString() || col.accessorKey;
      if (!prefMap.has(id)) {
        ordered.push(col);
      }
    });

    return ordered;
  }, [allColumns, columnPreferences]);

  const sort = directoryDerivedStores.get(directoryId)!.useSort();

  const table = useTable({
    columns,
    data: filteredDirectoryData,
  });
  const contextMenu = useContextMenu<GetFilesAndFoldersInDirectoryItem>();
  const headerContextMenu = useContextMenu<null>();

  const isDragOver = useSelector(
    fileDragDropStore,
    (s) => s.context.dragOverDirectoryId === directoryId,
  );

  const viewMode = useSelector(directoryStore, selectViewMode(directoryId));

  const error = useSelector(directoryStore, selectError(directoryId));

  if (error) {
    return <ErrorView error={error} directoryId={directoryId} />;
  }

  // If grid view is selected, render the grid view component
  if (viewMode === "grid") {
    return (
      <>
        <LoadingOverlay />
        <FileGridView />
      </>
    );
  }

  return (
    <>
      {contextMenu.item && (
        <ContextMenu menu={contextMenu}>
          {
            <FileTableRowContextMenu
              item={contextMenu.item}
              close={contextMenu.close}
              tableData={table.data}
            />
          }
        </ContextMenu>
      )}

      {headerContextMenu.isOpen && (
        <ContextMenu menu={headerContextMenu}>
          <ColumnHeaderContextMenu
            columns={allColumns}
            directoryPath={directory?.type === "path" ? directory.fullPath : ""}
          />
        </ContextMenu>
      )}

      <div
        className={clsx(
          "relative h-full min-h-0 overflow-auto rounded-none border-none",
          isDragOver && "ring-2 ring-primary ring-inset",
        )}
        {...fileBrowserListContainerProps({ directoryId, directory })}
      >
        <LoadingOverlay />
        <table className="w-full table table-zebra table-xs rounded-none overflow-hidden">
          <thead>
            <tr>
              {table.headers.map((header) => {
                const handleHeaderClick = () => {
                  const basedOn = resolveGlobalOrPathSort(directoryPath);
                  if (header.sortKey == null) {
                    directoryStore.send({
                      type: "setLocalSort",
                      sort: {
                        basedOn,
                        actual: {
                          by: undefined,
                          order: !sort?.by ? "asc" : "desc",
                        },
                      },
                      directoryId,
                    });
                    return;
                  }
                  const p = sortNames.safeParse(header.sortKey);
                  if (p.success) {
                    const newSort = {
                      basedOn,
                      actual: {
                        by: p.data,
                        order:
                          sort?.by === p.data || (!p.data && !sort?.by)
                            ? sort?.order === "asc"
                              ? "desc"
                              : "asc"
                            : "asc",
                      },
                    } as const;
                    directoryStore.send({
                      type: "setLocalSort",
                      sort: newSort,
                      directoryId,
                    });
                  }
                };

                return (
                  <th
                    key={header.id}
                    onClick={handleHeaderClick}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      headerContextMenu.onRightClick(e, null);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                        {header.value}
                      </span>

                      {sort?.by === header.sortKey &&
                        (sort?.order === "asc" ? (
                          <ChevronDownIcon className="size-4 stroke-[3]" />
                        ) : (
                          <ChevronUpIcon className="size-4 stroke-[3]" />
                        ))}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody
            data-list-id={context.directoryId}
            tabIndex={0}
            className="focus-visible:outline-none"
          >
            {table.rows.map((row, idx) => {
              return (
                <TableRow
                  key={row.id}
                  row={row}
                  index={idx}
                  directoryId={directoryId}
                  item={table.data[idx]}
                  onContextMenu={contextMenu.onRightClick}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
});

type TableRowProps = {
  row: {
    cells: Array<{
      value: React.ReactNode;
      id: string | number;
      size?: number;
    }>;
    id: number;
  };
  index: number;
  directoryId: DirectoryId;
  item: GetFilesAndFoldersInDirectoryItem;
  onContextMenu: (
    e: React.MouseEvent,
    item: GetFilesAndFoldersInDirectoryItem,
  ) => void;
};

/**
 * Memoized table row component that subscribes only to its own selection state.
 * This prevents unnecessary rerenders when other rows are selected/deselected,
 * significantly improving performance in directories with 300+ items.
 */
const TableRow = memo(function TableRow({
  row,
  index,
  directoryId,
  item,
  onContextMenu,
}: TableRowProps) {
  // Subscribe only to this row's selection state - not the entire selection Set
  const isSelected = useSelector(directoryStore, (state) =>
    state.context.directoriesById[directoryId].selection.indexes.has(index),
  );

  // Subscribe only to drag state for this row
  const isDragOverThisRow = useSelector(
    fileDragDropStore,
    (s) =>
      s.context.dragOverDirectoryId === directoryId &&
      s.context.dragOverRowIdx === index &&
      item.type === "dir",
  );

  return (
    <tr
      key={row.id}
      className={clsx(
        isSelected && "bg-base-content/10 row-selected",
        isDragOverThisRow && "bg-primary/20 ring-1 ring-primary ring-inset",
        "select-none",
      )}
      data-list-item
      {...fileBrowserListItemProps({
        item,
        index,
        directoryId,
        onContextMenu,
      })}
    >
      {row.cells.map((cell) => {
        return (
          <td
            style={{
              width: cell.size,
            }}
            key={cell.id}
          >
            {cell.value}
          </td>
        );
      })}
    </tr>
  );
});

function LoadingOverlay() {
  const directoryId = useDirectoryContext().directoryId;
  const _loading = useSelector(directoryStore, selectLoading(directoryId));

  const loading = useDebounce(_loading, 100);

  if (!loading) return null;

  return (
    <div className="flex flex-col items-center justify-center absolute inset-0">
      <Loader2Icon className="size-8 stroke-current" />
    </div>
  );
}

function ErrorView({
  error,
  directoryId,
}: {
  error: GenericError;
  directoryId: DirectoryId;
}) {
  const str = errorResponseToMessage(error);

  if (str.startsWith("EPERM")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm opacity-80">
          To access this file or folder, Koda needs Full Disk Access permission.
          You can grant this permission in System Settings.
        </p>

        <div className="flex gap-3">
          <Button
            className="btn-secondary"
            onClick={() => directoryHelpers.reload(directoryId)}
            icon={RefreshCwIcon}
          >
            Reload
          </Button>
          <Button
            className="btn-primary"
            autoFocus
            onClick={() => {
              getWindowElectron().openShell(
                "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
              );
            }}
            icon={Settings2Icon}
          >
            Open System Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Alert>{str}</Alert>
    </div>
  );
}
