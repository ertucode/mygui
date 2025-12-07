import { FileIcon, FolderIcon } from "lucide-react";
import type { ColumnDef } from "@/lib/libs/table/table-types";
import z from "zod";

export const cols: ColumnDef<GetFilesAndFoldersInDirectoryItem>[] = [
  {
    accessorKey: "type",
    header: "",
    cell: (row) => {
      if (row.type === "file") {
        return <FileIcon className="size-4 text-green-500" />;
      }
      return <FolderIcon className="size-4 text-blue-500" />;
    },
    size: 24,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: (row) => (
      <span className="block truncate max-w-xs" title={row.name}>
        {row.name}
      </span>
    ),
  },
  {
    accessorKey: "ext",
    header: "Ext",
    size: 24,
    cell: (row) => (
      <span className="block truncate" style={{ maxWidth: 24 }} title={row.ext ?? undefined}>
        {row.ext}
      </span>
    ),
  },
  {
    accessorKey: "sizeStr",
    sortKey: "size",
    header: "Size",
    size: 84,
    cell: (row) => (
      <span className="block truncate" style={{ maxWidth: 84 }} title={row.sizeStr ?? undefined}>
        {row.sizeStr}
      </span>
    ),
  },
  {
    accessorKey: "modifiedAt",
    sortKey: "modifiedTimestamp",
    header: "Modified",
    size: 148,
    cell: (row) => (
      <span className="block truncate" style={{ maxWidth: 148 }} title={row.modifiedAt ?? undefined}>
        {row.modifiedAt}
      </span>
    ),
  },
];

export const sortNames = z.enum(["name", "modifiedTimestamp", "size", "ext"]);
