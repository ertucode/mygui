import { ContextMenu, useContextMenu } from "../../components/context-menu";
import { clsx } from "../../functions/clsx";
import type { useSelection } from "./useSelection";
import type { TableMetadata } from "./useTable";

export type TableProps<T> = {
  table: TableMetadata<T>;
  onRowDoubleClick?: (item: T) => void;
  selection?: ReturnType<typeof useSelection>;
  ContextMenu?: React.FC<TableContextMenuProps<T>>;
  onRowDragStart?: (item: T) => void;
};
export type TableContextMenuProps<T> = {
  item: T;
  close: () => void;
};

export function Table<T>({
  table,
  onRowDoubleClick,
  selection,
  ...props
}: TableProps<T>) {
  const contextMenu = useContextMenu<T>();

  return (
    <>
      {props.ContextMenu && contextMenu.item && (
        <ContextMenu ref={contextMenu.ref} position={contextMenu.position}>
          {
            <props.ContextMenu
              item={contextMenu.item}
              close={contextMenu.close}
            />
          }
        </ContextMenu>
      )}

      <table className="w-full overflow-auto table table-zebra table-xs border border-base-content/5 ">
        <thead>
          <tr>
            {table.headers.map((header) => {
              return (
                <th key={header.id} className="relative">
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                    {header.value}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody
          onKeyDown={(e) => selection?.onKeydown(e, table.rows.length)}
          tabIndex={0}
        >
          {table.rows.map((row, idx) => {
            return (
              <tr
                key={row.id}
                className={clsx(
                  selection?.isSelected(idx) && "bg-base-content/10",
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
                  props.onRowDragStart(table.data[idx]);
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
    </>
  );
}
