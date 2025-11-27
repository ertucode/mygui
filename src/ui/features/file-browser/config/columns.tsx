import { FileIcon, FolderIcon } from "lucide-react";
import type { ColumnDef } from "@/lib/libs/table/table-types";
import z from "zod";

export const cols: ColumnDef<GetFilesAndFoldersInDirectoryItem>[] = [
  {
    accessorKey: "type",
    header: "",
    cell: (row) => {
      const Icon = resolveIcon(row);
      return <Icon className="size-4" />;
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

function resolveIcon(item: GetFilesAndFoldersInDirectoryItem) {
  if (item.type === "file") {
    return FileIcon;
  }
  return FolderIcon;
}
