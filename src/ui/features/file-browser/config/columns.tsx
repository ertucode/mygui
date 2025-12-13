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
import { FileTags, TAG_COLOR_CLASSES, TagColor } from "../tags";
import { PathHelpers } from "@common/PathHelpers";

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

/**
 * Tag circles component for displaying file tags
 */
function TagCircles({ tags }: { tags: TagColor[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex gap-0.5 ml-1 flex-shrink-0">
      {tags.map((color) => (
        <span
          key={color}
          className={`size-2 rounded-full ${TAG_COLOR_CLASSES[color].dot}`}
        />
      ))}
    </div>
  );
}

export interface ColumnsContext {
  fileTags: FileTags;
  getFullPath: (name: string) => string;
}

export function createColumns(
  ctx: ColumnsContext,
): ColumnDef<GetFilesAndFoldersInDirectoryItem>[] {
  return [
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
      cell: (row) => {
        const fullPath = row.fullPath ?? ctx.getFullPath(row.name);
        const tags = ctx.fileTags[fullPath];
        // Show folder name when fullPath is available (tags view)
        const parentFolder = row.fullPath
          ? PathHelpers.getParentFolder(row.fullPath)
          : null;
        return (
          <div className="flex items-center min-w-0 gap-2">
            <span className="block truncate" title={row.name}>
              {row.name}
            </span>
            {tags && <TagCircles tags={tags} />}
            {parentFolder && parentFolder.name && (
              <span
                className="text-gray-400 text-xs truncate flex-shrink-0"
                title={parentFolder.path}
              >
                {parentFolder.path}
              </span>
            )}
          </div>
        );
      },
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
}

export const sortNames = z.enum(["name", "modifiedTimestamp", "size", "ext"]);
