import { useMemo, type ReactNode } from "react";
import type { ColumnDef } from "./table-types";

export type TableMetadata<T> = ReturnType<typeof useTable<T>>;

export type UseTableOptions<T> = {
  columns: ColumnDef<T>[];
  data: T[];
};

export function useTable<T>(opts: UseTableOptions<T>) {
  const { columns: cols, data } = opts;
  const headers = useMemo(() => {
    return cols.map((col, idx) => {
      const value = resolveColumnHeaderValue(col);

      return {
        value,
        id: columnId(col, idx),
        sortKey: columnSortKey(col),
      };
    });
  }, [cols]);

  const rows = useMemo(() => {
    return data.map((item, idx) => {
      return {
        cells: cols.map((col, colIdx) => {
          const value = resolveColumnCellValue(col, item, idx);
          return {
            value,
            id: headers[colIdx].id,
            size: col.size,
          };
        }),
        id: Math.random(),
      };
    });
  }, [data, cols]);

  return {
    headers,
    rows,
    data,
  };
}

function resolveColumnHeaderValue<T>(col: ColumnDef<T>) {
  if (col.header != null) return col.header;
  if (col.accessorKey) return col.accessorKey;
  return "N/A";
}

function resolveColumnCellValue<T>(col: ColumnDef<T>, item: T, idx: number) {
  if (col.cell) return col.cell(item, { index: idx });
  return item[col.accessorKey] as ReactNode;
}

function columnId<T>(col: ColumnDef<T>, idx: number) {
  if (col.id) return col.id;
  if (col.accessorKey) return `col_${col.accessorKey}`;
  return `col_${idx}`;
}

function columnSortKey<T>(col: ColumnDef<T>) {
  if (col.sortKey) return col.sortKey;
  if (col.id) return col.id;
  if (col.accessorKey) return col.accessorKey;
  return "N/A";
}
