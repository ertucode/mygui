import { useEffect, useMemo, type ReactNode } from "react";
import type { ColumnDef } from "./table-types";
import { useSelection, type SelectionInput } from "./useSelection";

export type TableMetadata<T> = ReturnType<typeof useTable<T>>;

export type UseTableOptions<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  selection?: SelectionInput;
};

export function useTable<T>(opts: UseTableOptions<T>) {
  const { columns: cols, data } = opts;
  const headers = useMemo(() => {
    return cols.map((col, idx) => {
      const value = resolveColumnHeaderValue(col);

      return {
        value,
        id: columnId(col, idx),
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

  const selection = useSelection(
    opts.selection ?? { state: { indexes: new Set() }, setState: () => {} },
  );

  useEffect(() => {
    selection.reset();
  }, [data]);

  return {
    headers,
    rows,
    data,
    selection,
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
