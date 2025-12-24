import type { ReactNode } from "react";

export type ColumnDef<T> = {
  id?: string | number;
  accessorKey: keyof T & string;
  sortKey?: keyof T & string;
  header: ReactNode;
  cell?: (item: T, data: { index: number }) => ReactNode;
  size?: number;
  headerConfigView?: ReactNode;
};
