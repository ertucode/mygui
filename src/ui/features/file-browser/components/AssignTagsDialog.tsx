import { Dialog } from "@/lib/components/dialog";
import { useSelector } from "@xstate/store/react";
import {
  tagsStore,
  TAG_COLORS,
  TAG_COLOR_CLASSES,
  selectTagConfig,
  selectFileTags,
  type TagColor,
} from "../hooks/useTags";
import { clsx } from "@/lib/functions/clsx";
import { CheckIcon } from "lucide-react";

interface AssignTagsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fullPath: string | string[];
}

function getFileNameToDisplay(fullPath: string) {
  return fullPath.split("/").pop() || fullPath;
}

export function AssignTagsDialog({
  isOpen,
  onClose,
  fullPath,
}: AssignTagsDialogProps) {
  // Select all needed data at component level
  const tagConfig = useSelector(tagsStore, selectTagConfig);
  const fileTags = useSelector(tagsStore, selectFileTags);

  if (!isOpen) return null;

  const fileNames = Array.isArray(fullPath)
    ? fullPath.map(getFileNameToDisplay)
    : [getFileNameToDisplay(fullPath)];
  if (Array.isArray(fullPath)) {
    if (fullPath.length === 0) {
      throw new Error("No files selected");
    }
    // Check if all files have same tags
    const firstTags = fileTags[fullPath[0]] || [];
    const allHaveSameTags = fullPath.every((path) => {
      const tags = fileTags[path] || [];
      if (tags.length !== firstTags.length) return false;
      return tags.every((tag) => firstTags.includes(tag));
    });
    if (!allHaveSameTags) {
      throw new Error("All files must have same tags");
    }
  }
  const currentTags = fileTags[Array.isArray(fullPath) ? fullPath[0] : fullPath] || [];

  const handleToggleTag = (color: TagColor) => {
    if (Array.isArray(fullPath)) {
      tagsStore.send({ type: "toggleTagOnFiles", fullPaths: fullPath, color });
    } else {
      tagsStore.send({ type: "toggleTagOnFile", fullPath, color });
    }
  };

  return (
    <Dialog
      title={`Assign Tags to "${fileNames.join(" | ")}"`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2 min-w-[300px]">
        <p className="text-sm text-gray-500 mb-2">
          Select tags to assign to this item:
        </p>
        <div className="flex flex-col gap-1">
          {TAG_COLORS.map((color) => {
            const isSelected = currentTags.includes(color);
            const colorClasses = TAG_COLOR_CLASSES[color];
            const tagName = tagConfig[color] || color;

            return (
              <button
                key={color}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  "hover:bg-base-200",
                  isSelected && colorClasses.bg,
                )}
                onClick={() => handleToggleTag(color)}
              >
                <span
                  className={clsx("size-4 rounded-full", colorClasses.dot)}
                />
                <span
                  className={clsx(
                    "flex-1 text-left",
                    isSelected && colorClasses.text,
                  )}
                >
                  {tagName}
                </span>
                {isSelected && (
                  <CheckIcon className={clsx("size-4", colorClasses.text)} />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn btn-sm btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}
