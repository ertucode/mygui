import {
  FileIcon,
  FolderIcon,
  ImageIcon,
  VideoIcon,
  MusicIcon,
  FileTextIcon,
  TableIcon,
  PresentationIcon,
  ArchiveIcon,
  CodeIcon,
  TypeIcon,
  CogIcon,
} from "lucide-react";
import type { ColumnDef } from "@/lib/libs/table/table-types";
import z from "zod";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { FileCategory } from "@common/file-category";

/**
 * Icon and color mapping for file categories
 */
const categoryIconMap: Record<
  FileCategory | "folder",
  { icon: React.ComponentType<{ className?: string }>; colorClass: string }
> = {
  folder: { icon: FolderIcon, colorClass: "text-blue-500" },
  image: { icon: ImageIcon, colorClass: "text-pink-500" },
  video: { icon: VideoIcon, colorClass: "text-purple-500" },
  audio: { icon: MusicIcon, colorClass: "text-orange-500" },
  document: { icon: FileTextIcon, colorClass: "text-red-500" },
  spreadsheet: { icon: TableIcon, colorClass: "text-green-600" },
  presentation: { icon: PresentationIcon, colorClass: "text-amber-500" },
  archive: { icon: ArchiveIcon, colorClass: "text-yellow-600" },
  code: { icon: CodeIcon, colorClass: "text-cyan-500" },
  font: { icon: TypeIcon, colorClass: "text-indigo-500" },
  executable: { icon: CogIcon, colorClass: "text-slate-500" },
  other: { icon: FileIcon, colorClass: "text-gray-400" },
};

function CategoryIcon({ category }: { category: FileCategory | "folder" }) {
  const config = categoryIconMap[category] ?? categoryIconMap.other;
  return <config.icon className={`size-4 ${config.colorClass}`} />;
}

export const cols: ColumnDef<GetFilesAndFoldersInDirectoryItem>[] = [
  {
    accessorKey: "type",
    header: "",
    cell: (row) => {
      return <CategoryIcon category={row.category} />;
    },
    size: 24,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: (row) => (
      <span className="block truncate" title={row.name}>
        {row.name}
      </span>
    ),
  },
  {
    accessorKey: "ext",
    header: "Ext",
    size: 24,
    cell: (row) => (
      <span
        className="block truncate"
        style={{ maxWidth: 24 }}
        title={row.ext ?? undefined}
      >
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
      <span
        className="block truncate"
        style={{ maxWidth: 84 }}
        title={row.sizeStr ?? undefined}
      >
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
      <span
        className="block truncate"
        style={{ maxWidth: 148 }}
        title={row.modifiedAt ?? undefined}
      >
        {row.modifiedAt}
      </span>
    ),
  },
];

export const sortNames = z.enum(["name", "modifiedTimestamp", "size", "ext"]);
