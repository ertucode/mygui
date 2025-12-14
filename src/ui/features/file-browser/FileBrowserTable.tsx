import { ChevronDownIcon, ChevronUpIcon, Loader2Icon } from "lucide-react";
import { ContextMenu, useContextMenu } from "../../lib/components/context-menu";
import { clsx } from "../../lib/functions/clsx";
import { useTable } from "../../lib/libs/table/useTable";
import { onSortKey } from "../../lib/libs/table/useTableSort";
import { useRef } from "react";
import { useSelector } from "@xstate/store/react";
import { fileBrowserSettingsStore } from "@/features/file-browser/settings";
import {
  directoryDerivedStores,
  directoryHelpers,
  directoryStore,
  selectLoading,
  selectSelection,
  selectDirectory,
} from "@/features/file-browser/directory";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { FileTableRowContextMenu } from "@/features/file-browser/FileTableRowContextMenu";
import { getWindowElectron } from "@/getWindowElectron";
import { captureDivAsBase64 } from "@/lib/functions/captureDiv";
import { useDirectoryContext } from "@/features/file-browser/DirectoryContext";
import { createColumns } from "./config/columns";
import { tagsStore, selectFileTags } from "./tags";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useFileDragDrop } from "./useFileDragDrop";

export type TableContextMenuProps<T> = {
  item: T;
  close: () => void;
  tableData: T[];
};

export function FileBrowserTable() {
  const context = useDirectoryContext();
  const directoryId = context.directoryId;
  const filteredDirectoryData = directoryDerivedStores
    .get(context.directoryId)!
    .useFilteredDirectoryData();
  const fileTags = useSelector(tagsStore, selectFileTags);
  const columns = createColumns({
    fileTags,
    getFullPath: (n) => directoryHelpers.getFullPath(n, context.directoryId),
  });

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

  const selectionIndexes = useSelector(
    directoryStore,
    selectSelection(directoryId),
  ).indexes;

  const directory = useSelector(directoryStore, selectDirectory(directoryId));

  const dragDrop = useFileDragDrop({
    directoryId,
    directoryType: directory.directory.type,
    directoryFullPath:
      directory.directory.type === "path"
        ? directory.directory.fullPath
        : undefined,
  });

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
          dragDrop.isDragOver && "ring-2 ring-primary ring-inset",
        )}
        onDragOver={dragDrop.handleTableDragOver}
        onDragLeave={dragDrop.handleTableDragLeave}
        onDrop={dragDrop.handleTableDrop}
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
                <tr
                  key={row.id}
                  className={clsx(
                    selectionIndexes.has(idx) &&
                      "bg-base-content/10 row-selected",
                    dragDrop.dragOverRowIdx === idx &&
                      table.data[idx].type === "dir" &&
                      "bg-primary/20 ring-1 ring-primary ring-inset",
                    "select-none",
                  )}
                  onClick={(e) => {
                    const now = Date.now();
                    const lastClick = lastClickRef.current;

                    // Check if this is a double-click (same row, within 500ms)
                    if (
                      lastClick &&
                      lastClick.index === idx &&
                      now - lastClick.timestamp < 500
                    ) {
                      // This is a double-click
                      e.preventDefault();
                      e.stopPropagation();
                      directoryHelpers.openItem(table.data[idx], directoryId);
                      lastClickRef.current = null;
                    } else {
                      // This is a single click
                      directoryHelpers.select(idx, e, directoryId);
                      directoryStore.trigger.setActiveDirectoryId({
                        directoryId,
                      });
                      lastClickRef.current = { index: idx, timestamp: now };
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    contextMenu.onRightClick(e, table.data[idx]);
                  }}
                  onDragStart={async (_) => {
                    const items =
                      directoryHelpers.getSelectedItemsOrCurrentItem(
                        idx,
                        directoryId,
                      );
                    const filePaths = items.map((i) =>
                      directoryHelpers.getFullPathForItem(i, directoryId),
                    );

                    // Handle drag start with hook
                    await dragDrop.handleRowDragStart(items);

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
                    const item = table.data[idx];
                    if (item.type === "dir") {
                      directoryHelpers.preloadDirectory(
                        item.fullPath ??
                          directoryHelpers.getFullPath(item.name, directoryId),
                      );
                    }
                  }}
                  onDragOver={(e) => {
                    const item = table.data[idx];
                    dragDrop.handleRowDragOver(e, idx, item.type === "dir");
                  }}
                  onDragLeave={(e) => {
                    const item = table.data[idx];
                    dragDrop.handleRowDragLeave(e, item.type === "dir");
                  }}
                  onDrop={async (e) => {
                    const item = table.data[idx];
                    await dragDrop.handleRowDrop(e, item);
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
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

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
