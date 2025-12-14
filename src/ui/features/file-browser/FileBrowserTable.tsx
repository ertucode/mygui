import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { ContextMenu, useContextMenu } from "../../lib/components/context-menu";
import { clsx } from "../../lib/functions/clsx";
import { useTable } from "../../lib/libs/table/useTable";
import { onSortKey } from "../../lib/libs/table/useTableSort";
import { useRef } from "react";
import { useSelector } from "@xstate/store/react";
import { fileBrowserSettingsStore } from "@/features/file-browser/settings";
import {
  directoryHelpers,
  directoryStore,
  useFilteredDirectoryData,
} from "@/features/file-browser/directory";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { FileTableRowContextMenu } from "@/features/file-browser/FileTableRowContextMenu";
import { getWindowElectron } from "@/getWindowElectron";
import { captureDivAsBase64 } from "@/lib/functions/captureDiv";
import { useDirectoryContext } from "@/features/file-browser/DirectoryContext";
import { createColumns } from "./config/columns";
import { tagsStore, selectFileTags } from "./tags";
import { useFileBrowserShortcuts } from "./useFileBrowserShortcuts";

export type TableContextMenuProps<T> = {
  item: T;
  close: () => void;
  tableData: T[];
};

export function FileBrowserTable() {
  const filteredDirectoryData = useFilteredDirectoryData();
  const fileTags = useSelector(tagsStore, selectFileTags);
  const columns = createColumns({
    fileTags,
    getFullPath: directoryHelpers.getFullPath,
  });

  const table = useTable({
    columns,
    data: filteredDirectoryData,
  });
  useFileBrowserShortcuts(table.data);
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
    (s) => s.context.selection.indexes,
  );

  const context = useDirectoryContext();

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

      <div className="relative h-full min-h-0 overflow-auto">
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
                      directoryHelpers.openItem(table.data[idx]);
                      lastClickRef.current = null;
                    } else {
                      // This is a single click
                      directoryHelpers.select(idx, e);
                      lastClickRef.current = { index: idx, timestamp: now };
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    contextMenu.onRightClick(e, table.data[idx]);
                  }}
                  onDragStart={async (e) => {
                    e.preventDefault();
                    getWindowElectron().onDragStart({
                      files: directoryHelpers
                        .getSelectedItemsOrCurrentItem(idx)
                        .map(directoryHelpers.getFullPathForItem),
                      image: await captureDivAsBase64(
                        e.currentTarget.closest("tbody")!,
                      ),
                    });
                  }}
                  onPointerDown={(_) => {
                    const item = table.data[idx];
                    if (item.type === "dir") {
                      directoryHelpers.preloadDirectory(
                        item.fullPath ??
                          directoryHelpers.getFullPath(item.name),
                      );
                    }
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
