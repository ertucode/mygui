import { Dialog } from "@/lib/components/dialog";
import { useSelector } from "@xstate/store/react";
import {
  tagsStore,
  TAG_COLORS,
  TAG_COLOR_CLASSES,
  selectTagConfig,
  selectFileTags,
  type TagColor,
} from "../tags";
import { clsx } from "@/lib/functions/clsx";
import { CheckIcon } from "lucide-react";
import {
  useDialogForItem,
  type DialogForItem,
} from "@/lib/hooks/useDialogForItem";
import { Ref } from "react";

function getFileNameToDisplay(fullPath: string) {
  return fullPath.split("/").pop() || fullPath;
}

export function AssignTagsDialog({
  ref,
}: {
  ref?: Ref<DialogForItem<string>>;
}) {
  const { item: fullPath, dialogOpen, setDialogOpen } = useDialogForItem<string>(ref);
    
    // Select all needed data at component level
    const tagConfig = useSelector(tagsStore, selectTagConfig);
    const fileTags = useSelector(tagsStore, selectFileTags);

    if (!dialogOpen || !fullPath) return null;

    const fileName = getFileNameToDisplay(fullPath);
  const currentTags = fileTags[fullPath] || [];

  const handleToggleTag = (color: TagColor) => {
    tagsStore.send({ type: "toggleTagOnFile", fullPath, color });
  };

  const handleClose = () => {
    setDialogOpen(false);
  };

  return (
    <Dialog title={`Assign Tags to "${fileName}"`} onClose={handleClose}>
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
          <button className="btn btn-sm btn-primary" onClick={handleClose}>
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}
