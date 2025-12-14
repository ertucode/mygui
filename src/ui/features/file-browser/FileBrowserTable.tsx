import { ChevronDownIcon, ChevronUpIcon, Loader2Icon } from "lucide-react";
import { ContextMenu, useContextMenu } from "../../lib/components/context-menu";
import { clsx } from "../../lib/functions/clsx";
import { useTable } from "../../lib/libs/table/useTable";
import { onSortKey } from "../../lib/libs/table/useTableSort";
import { memo, useMemo, useRef } from "react";
import { useSelector } from "@xstate/store/react";
import { fileBrowserSettingsStore } from "@/features/file-browser/settings";
import {
  directoryDerivedStores,
  directoryHelpers,
  directoryStore,
  selectLoading,
  selectDirectory,
  DirectoryId,
} from "@/features/file-browser/directory";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { FileTableRowContextMenu } from "@/features/file-browser/FileTableRowContextMenu";
import { getWindowElectron } from "@/getWindowElectron";
import { captureDivAsBase64 } from "@/lib/functions/captureDiv";
import { useDirectoryContext } from "@/features/file-browser/DirectoryContext";
import { createColumns } from "./config/columns";
import { tagsStore, selectFileTags } from "./tags";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { fileDragDropStore, fileDragDropHandlers } from "./fileDragDrop";

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

  const fileTags = useSelector(tagsStore, selectFileTags);

  const columns = useMemo(() => {
    return createColumns({
      fileTags,
      getFullPath: (n) => directoryHelpers.getFullPath(n, context.directoryId),
    });
  }, [fileTags]);

  const table = useTable({
    columns,
    data: filteredDirectoryData,
  });
  const contextMenu = useContextMenu<GetFilesAndFoldersInDirectoryItem>();
  const lastClickRef = useRef<{ index: number; timestamp: number } | null>(
    null,
  );

  const sortSettings = useSelector(
    fileBrowserSettingsStore,
    (s) => s.context.settings.sort,
  );

  const directory = useSelector(directoryStore, selectDirectory(directoryId));

  const isDragOver = useSelector(
    fileDragDropStore,
    (s) => s.context.dragOverDirectoryId === directoryId,
  );

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

      <div
        className={clsx(
          "relative h-full min-h-0 overflow-auto",
          isDragOver && "ring-2 ring-primary ring-inset",
        )}
        onDragOver={(e) =>
          fileDragDropHandlers.handleTableDragOver(e, directoryId)
        }
        onDragLeave={fileDragDropHandlers.handleTableDragLeave}
        onDrop={(e) =>
          fileDragDropHandlers.handleTableDrop(
            e,
            directoryId,
            directory.type,
            directory.type === "path" ? directory.fullPath : undefined,
          )
        }
      >
        <LoadingOverlay />
        <table
          data-table-id={context.directoryId}
          className="w-full table table-zebra table-xs border border-base-content/5"
        >
          <thead>
            <tr>
              {table.headers.map((header) => {
                return (
                  <th key={header.id} onClick={() => onSortKey(header.sortKey)}>
                    <div className="flex items-center gap-1">
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                        {header.value}
                      </span>

                      {sortSettings.by === header.sortKey &&
                        (sortSettings.order === "asc" ? (
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
          <tbody tabIndex={0}>
            {table.rows.map((row, idx) => {
              return (
                <TableRow
                  key={row.id}
                  row={row}
                  index={idx}
                  directoryId={directoryId}
                  item={table.data[idx]}
                  lastClickRef={lastClickRef}
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
  lastClickRef: React.RefObject<{
    index: number;
    timestamp: number;
  } | null>;
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
  lastClickRef,
  onContextMenu,
}: TableRowProps) {
  // Subscribe only to this row's selection state - not the entire selection Set
  const isSelected = useSelector(directoryStore, (state) =>
    state.context.directoriesById[directoryId].selection.indexes.has(index),
  );

  // Subscribe only to drag state for this row
  const isDragOverThisRow = useSelector(
    fileDragDropStore,
    (s) => s.context.dragOverRowIdx === index && item.type === "dir",
  );

  return (
    <tr
      key={row.id}
      className={clsx(
        isSelected && "bg-base-content/10 row-selected",
        isDragOverThisRow && "bg-primary/20 ring-1 ring-primary ring-inset",
        "select-none",
      )}
      onClick={(e) => {
        const now = Date.now();
        const lastClick = lastClickRef.current;

        // Check if this is a double-click (same row, within 500ms)
        if (
          lastClick &&
          lastClick.index === index &&
          now - lastClick.timestamp < 500
        ) {
          // This is a double-click
          e.preventDefault();
          e.stopPropagation();
          directoryHelpers.openItem(item, directoryId);
          lastClickRef.current = null;
        } else {
          // This is a single click
          directoryHelpers.select(index, e, directoryId);
          directoryStore.trigger.setActiveDirectoryId({
            directoryId,
          });
          lastClickRef.current = { index: index, timestamp: now };
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, item);
      }}
      onDragStart={async (_) => {
        const items = directoryHelpers.getSelectedItemsOrCurrentItem(
          index,
          directoryId,
        );
        const filePaths = items.map((i) =>
          directoryHelpers.getFullPathForItem(i, directoryId),
        );

        // Handle drag start
        await fileDragDropHandlers.handleRowDragStart(items, directoryId);

        const table = document.querySelector(
          '[data-table-id="' + directoryId + '"]',
        );
        if (!table) return;

        const tableBody = table.querySelector("tbody");

        // Start the native drag
        getWindowElectron().onDragStart({
          files: filePaths,
          image: await captureDivAsBase64(tableBody!),
        });
      }}
      onPointerDown={(_) => {
        if (item.type === "dir") {
          directoryHelpers.preloadDirectory(
            item.fullPath ??
              directoryHelpers.getFullPath(item.name, directoryId),
          );
        }
      }}
      onDragOver={(e) => {
        fileDragDropHandlers.handleRowDragOver(e, index, item.type === "dir");
      }}
      onDragLeave={(e) => {
        fileDragDropHandlers.handleRowDragLeave(e, item.type === "dir");
      }}
      onDrop={async (e) => {
        await fileDragDropHandlers.handleRowDrop(e, item, directoryId);
      }}
      draggable={true}
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
