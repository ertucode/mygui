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
  },
  {
    accessorKey: "ext",
    header: "Ext",
    size: 24,
  },
  {
    accessorKey: "sizeStr",
    sortKey: "size",
    header: "Size",
    size: 84,
  },
  {
    accessorKey: "modifiedAt",
    sortKey: "modifiedTimestamp",
    header: "Modified",
    size: 148,
  },
];

export const sortNames = z.enum(["name", "modifiedTimestamp", "size", "ext"]);
