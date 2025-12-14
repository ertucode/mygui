import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { ContextMenu, useContextMenu } from "../../components/context-menu";
import { clsx } from "../../functions/clsx";
import type { TableMetadata } from "./useTable";
import { onSortKey } from "./useTableSort";
import { RefObject, useRef } from "react";
import { useSelector } from "@xstate/store/react";
import { fileBrowserSettingsStore } from "@/features/file-browser/settings";
import { directoryHelpers, directoryStore } from "@/features/file-browser/directory";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { FileTableRowContextMenu } from "@/features/file-browser/FileTableRowContextMenu";

export type TableProps = {
  table: TableMetadata<GetFilesAndFoldersInDirectoryItem>;
  onRowDragStart?: (
    item: GetFilesAndFoldersInDirectoryItem,
    index: number,
    event: React.DragEvent<HTMLTableRowElement>,
  ) => void;
  onRowMouseDown?: (
    item: GetFilesAndFoldersInDirectoryItem,
    index: number,
  ) => void;
  tableRef?: RefObject<HTMLTableElement | null>;
  children?: React.ReactNode;
};
export type TableContextMenuProps<T> = {
  item: T;
  close: () => void;
  tableData: T[];
};

export function Table({
  table,
  tableRef,
  children,
  ...props
}: TableProps) {
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
    (s) => s.context.selectionIndexes,
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

      <div className="relative h-full min-h-0 overflow-auto">
        {children}

        <table
          ref={tableRef}
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
                  onDragStart={(e) => {
                    if (props.onRowDragStart == null) return;
                    e.preventDefault();
                    props.onRowDragStart(table.data[idx], idx, e);
                  }}
                  onPointerDown={(_) => {
                    if (props.onRowMouseDown == null) return;
                    props.onRowMouseDown(table.data[idx], idx);
                  }}
                  draggable={props.onRowDragStart != null}
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
