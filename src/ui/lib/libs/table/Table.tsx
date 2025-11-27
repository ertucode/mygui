import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { ContextMenu, useContextMenu } from "../../components/context-menu";
import { clsx } from "../../functions/clsx";
import type { useSelection } from "./useSelection";
import type { TableMetadata } from "./useTable";
import { useTableSort } from "./useTableSort";
import { RefObject } from "react";

export type TableProps<T> = {
  table: TableMetadata<T>;
  onRowDoubleClick?: (item: T) => void;
  selection?: ReturnType<typeof useSelection>;
  sort?: ReturnType<typeof useTableSort>;
  ContextMenu?: React.FC<TableContextMenuProps<T>>;
  onRowDragStart?: (
    item: T,
    index: number,
    event: React.DragEvent<HTMLTableRowElement>,
  ) => void;
  onRowMouseDown?: (item: T, index: number) => void;
  tableRef?: RefObject<HTMLTableElement | null>;
  children?: React.ReactNode;
};
export type TableContextMenuProps<T> = {
  item: T;
  close: () => void;
};

export function Table<T>({
  table,
  onRowDoubleClick,
  selection,
  sort,
  tableRef,
  children,
  ...props
}: TableProps<T>) {
  const contextMenu = useContextMenu<T>();

  return (
    <>
      {props.ContextMenu && contextMenu.item && (
        <ContextMenu menu={contextMenu}>
          {
            <props.ContextMenu
              item={contextMenu.item}
              close={contextMenu.close}
            />
          }
        </ContextMenu>
      )}

      <div className="relative">
        {children}

        <table
          ref={tableRef}
          className="w-full overflow-auto table table-zebra table-xs border border-base-content/5 "
        >
          <thead>
            <tr>
              {table.headers.map((header) => {
                return (
                  <th
                    key={header.id}
                    onClick={() => sort?.onKey(header.sortKey)}
                  >
                    <div className="flex items-center gap-1">
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                        {header.value}
                      </span>

                      {sort?.state.by === header.sortKey &&
                        (sort.state.order === "asc" ? (
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
            onKeyDown={(_) => {
              // selection?.onKeydown(e, table.rows.length);
            }}
            tabIndex={0}
          >
            {table.rows.map((row, idx) => {
              return (
                <tr
                  key={row.id}
                  className={clsx(
                    selection?.isSelected(idx) &&
                      "bg-base-content/10 row-selected",
                    "select-none",
                  )}
                  onDoubleClick={
                    onRowDoubleClick
                      ? () => onRowDoubleClick(table.data[idx])
                      : undefined
                  }
                  onClick={(e) => selection?.select(idx, e)}
                  onContextMenu={(e) => {
                    if (props.ContextMenu == null) return;
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
