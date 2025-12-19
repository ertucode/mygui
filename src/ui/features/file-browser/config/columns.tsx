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
import { useEffect, useRef, useState } from "react";
import { directoryHelpers, DirectoryId } from "../directory";

/**
 * Icon and color mapping for file categories
 */
const categoryIconMap: Record<
  FileCategory | "folder",
  {
    icon: React.ComponentType<{ className?: string; fill?: string }>;
    colorClass: string;
    fill?: string;
  }
> = {
  folder: {
    icon: FolderIcon,
    colorClass: "text-blue-500",
    fill: "currentColor",
  },
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
  return (
    <config.icon
      className={`size-4 ${config.colorClass}`}
      fill={config.fill || "transparent"}
    />
  );
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
  directoryId: DirectoryId;
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
        return <DirectoryNameColumn row={row} ctx={ctx} />;
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

function DirectoryNameColumn({
  row,
  ctx,
}: {
  row: GetFilesAndFoldersInDirectoryItem;
  ctx: ColumnsContext;
}) {
  const fullPath = row.fullPath ?? ctx.getFullPath(row.name);
  const tags = ctx.fileTags[fullPath];
  // Show folder name when fullPath is available (tags view)
  const parentFolder = row.fullPath
    ? PathHelpers.getParentFolder(row.fullPath)
    : null;

  const [renaming, setRenaming] = useState(false);

  return (
    <div className="flex items-center min-w-0 gap-2">
      {renaming ? (
        <RenameInput row={row} ctx={ctx} setRenaming={setRenaming} />
      ) : (
        <span
          className="block truncate"
          title={row.name}
          onClick={(e) => {
            if (e.metaKey) {
              e.preventDefault();
              setRenaming(true);
            }
          }}
        >
          {row.name}
        </span>
      )}
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
}

function RenameInput({
  row,
  ctx,
  setRenaming,
}: {
  row: GetFilesAndFoldersInDirectoryItem;
  ctx: ColumnsContext;
  setRenaming: (value: boolean) => void;
}) {
  const [value, setValue] = useState(row.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = inputRef.current;
    if (!c) return;
    c.focus();
    c.selectionStart = 0;
    const indexOfLastDot = c.value.lastIndexOf(".");
    if (indexOfLastDot !== -1) {
      c.selectionEnd = indexOfLastDot;
    }

    const closest = c.closest("tr");
    if (closest) {
      closest.draggable = false;
    }

    return () => {
      if (!closest) return;
      closest.draggable = true;
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      directoryHelpers.renameItem(row, value, ctx.directoryId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setRenaming(false);
    }
  };

  const onBlur = (e: React.FocusEvent) => {
    e.preventDefault();
    setRenaming(false);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      onBlur={onBlur}
      draggable={false}
    />
  );
}

export const sortNames = z.enum(["name", "modifiedTimestamp", "size", "ext"]);
