import { PencilIcon } from "lucide-react";
import { useSelector } from "@xstate/store/react";
import {
  tagsStore,
  TAG_COLORS,
  TAG_COLOR_CLASSES,
  type TagColor,
  selectFileCountWithTag,
} from "../tags";
import { useState } from "react";
import { clsx } from "@/lib/functions/clsx";
import {
  directoryStore,
  directoryHelpers,
  selectDirectory,
} from "../directory";

interface TagsListProps {
  className?: string;
}

export function TagsList({ className }: TagsListProps) {
  return (
    <div
      className={clsx("flex flex-col gap-1 pr-2 overflow-hidden", className)}
    >
      <h3 className="text-sm font-semibold pl-2 flex-shrink-0">Tags</h3>
      <div className="flex flex-col gap-1 overflow-y-auto min-h-0 flex-1">
        {TAG_COLORS.map((tag) => (
          <TagListItem key={tag} tag={tag} />
        ))}
      </div>
    </div>
  );
}

function TagListItem({ tag }: { tag: TagColor }) {
  const [editingTag, setEditingTag] = useState<boolean>(false);
  const [editValue, setEditValue] = useState("");
  const activeDirectoryId = useSelector(
    directoryStore,
    (s) => s.context.activeDirectoryId,
  );
  const directory = useSelector(
    directoryStore,
    selectDirectory(activeDirectoryId),
  ).directory;

  const isShowingTag = (color: TagColor) => {
    return directory.type === "tags" && directory.color === color;
  };

  const fileCount = useSelector(tagsStore, selectFileCountWithTag(tag));
  const tagName = useSelector(tagsStore, (s) => s.context.tagConfig[tag]);

  const handleTagClick = () => {
    if (fileCount > 0) {
      directoryHelpers.showTaggedFiles(tag, activeDirectoryId);
    }
  };

  const handleSaveEdit = () => {
    if (editingTag && editValue.trim()) {
      tagsStore.send({
        type: "setTagName",
        color: tag,
        name: editValue.trim(),
      });
    }
    setEditingTag(false);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setEditingTag(false);
      setEditValue("");
    }
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTag(true);
    setEditValue(tagName);
  };

  return (
    <div key={tag}>
      <div
        className={clsx(
          "flex items-center gap-2 hover:bg-base-200 rounded text-xs h-6 px-2 cursor-pointer w-full group",
          isShowingTag(tag) && "bg-base-300 font-medium",
        )}
        onClick={() => !editingTag && handleTagClick()}
      >
        <span
          className={clsx(
            "size-3 min-w-3 rounded-full flex-shrink-0",
            TAG_COLOR_CLASSES[tag].dot,
          )}
        />
        {editingTag ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 text-xs bg-base-300 rounded px-1 outline-none"
            autoFocus
          />
        ) : (
          <>
            <span className="truncate flex-1 text-left">{tagName}</span>
            <span className="text-gray-500 text-[10px] flex-shrink-0 w-4 text-right group-hover:hidden">
              {fileCount}
            </span>
            <PencilIcon
              className="size-3 flex-shrink-0 hidden group-hover:block opacity-50 hover:!opacity-100"
              onClick={(e) => handleStartEdit(e)}
            />
          </>
        )}
      </div>
    </div>
  );
}
