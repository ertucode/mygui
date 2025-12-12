import { Dialog } from "@/lib/components/dialog";
import {
  useTags,
  TAG_COLORS,
  TAG_COLOR_CLASSES,
  type TagColor,
} from "../hooks/useTags";
import { clsx } from "@/lib/functions/clsx";
import { CheckIcon } from "lucide-react";

interface AssignTagsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fullPath: string | string[];
  tags: ReturnType<typeof useTags>;
}

function getFileNameToDisplay(fullPath: string) {
  return fullPath.split("/").pop() || fullPath;
}

export function AssignTagsDialog({
  isOpen,
  onClose,
  fullPath,
  tags,
}: AssignTagsDialogProps) {
  if (!isOpen) return null;

  const fileNames = Array.isArray(fullPath)
    ? fullPath.map(getFileNameToDisplay)
    : [getFileNameToDisplay(fullPath)];
  if (Array.isArray(fullPath)) {
    if (fullPath.length === 0) {
      throw new Error("No files selected");
    }
    if (!tags.everyFileHasSameTags(fullPath)) {
      throw new Error("All files must have the same tags");
    }
  }
  const currentTags = tags.getFileTags(
    Array.isArray(fullPath) ? fullPath[0] : fullPath,
  );

  const handleToggleTag = (color: TagColor) => {
    if (Array.isArray(fullPath)) {
      tags.toggleTagOnFiles(fullPath, color);
    } else {
      tags.toggleTagOnFile(fullPath, color);
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
            const tagName = tags.getTagName(color);

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
