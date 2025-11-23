import { clsx } from "../../functions/clsx";
import type { useSelection } from "./useSelection";
import type { TableMetadata } from "./useTable";

export type TableProps<T> = {
  table: TableMetadata<T>;
  onRowDoubleClick?: (item: T) => void;
  selection?: ReturnType<typeof useSelection>;
};

export function Table<T>({
  table,
  onRowDoubleClick,
  selection,
}: TableProps<T>) {
  return (
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
      <tbody onKeyDown={(e) => selection?.onKeydown(e)} tabIndex={0}>
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
  );
}
