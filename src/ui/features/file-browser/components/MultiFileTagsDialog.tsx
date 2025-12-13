import { Dialog } from "@/lib/components/dialog";
import {
  useTags,
  TAG_COLORS,
  TAG_COLOR_CLASSES,
  type TagColor,
} from "../hooks/useTags";
import { clsx } from "@/lib/functions/clsx";
import { CheckIcon, MinusIcon } from "lucide-react";

interface MultiFileTagsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fullPaths: string[];
  tags: ReturnType<typeof useTags>;
}

function getFileNameToDisplay(fullPath: string) {
  return fullPath.split("/").pop() || fullPath;
}

type TagState = "all" | "some" | "none";

function getTagStateForFiles(
  fullPaths: string[],
  color: TagColor,
  tags: ReturnType<typeof useTags>,
): TagState {
  const filesWithTag = fullPaths.filter((path) => tags.hasTag(path, color));
  if (filesWithTag.length === 0) return "none";
  if (filesWithTag.length === fullPaths.length) return "all";
  return "some";
}

export function MultiFileTagsDialog({
  isOpen,
  onClose,
  fullPaths,
  tags,
}: MultiFileTagsDialogProps) {
  if (!isOpen || fullPaths.length === 0) return null;

  const handleCellClick = (fullPath: string, color: TagColor) => {
    tags.toggleTagOnFile(fullPath, color);
  };

  const handleHeaderClick = (color: TagColor) => {
    const state = getTagStateForFiles(fullPaths, color, tags);
    if (state === "all") {
      // Remove from all
      fullPaths.forEach((path) => tags.removeTagFromFile(path, color));
    } else {
      // Add to all
      fullPaths.forEach((path) => {
        if (!tags.hasTag(path, color)) {
          tags.addTagToFile(path, color);
        }
      });
    }
  };

  return (
    <Dialog
      title={`Assign Tags to ${fullPaths.length} Items`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3 min-w-[500px] max-w-[800px] max-h-[60vh]">
        <p className="text-sm text-gray-500">
          Click cells to toggle tags. Click column headers to toggle for all
          files.
        </p>

        <div className="overflow-auto border border-base-300 rounded-lg">
          <table className="table table-sm w-full">
            <thead className="sticky top-0 bg-base-200 z-10">
              <tr>
                <th className="text-left font-medium py-2 px-3 min-w-[150px]">
                  File
                </th>
                {TAG_COLORS.map((color) => {
                  const colorClasses = TAG_COLOR_CLASSES[color];
                  const tagName = tags.getTagName(color);
                  const state = getTagStateForFiles(fullPaths, color, tags);

                  return (
                    <th
                      key={color}
                      className="text-center font-medium py-2 px-2 cursor-pointer hover:bg-base-300 transition-colors min-w-[80px]"
                      onClick={() => handleHeaderClick(color)}
                      title={`${tagName} - Click to toggle all`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={clsx(
                            "size-3 rounded-full",
                            colorClasses.dot,
                          )}
                        />
                        <span className="text-xs truncate max-w-[70px]">
                          {tagName}
                        </span>
                        {state !== "none" && (
                          <div
                            className={clsx(
                              "size-4 rounded flex items-center justify-center",
                              state === "all" ? colorClasses.bg : "bg-base-300",
                            )}
                          >
                            {state === "all" ? (
                              <CheckIcon
                                className={clsx("size-3", colorClasses.text)}
                              />
                            ) : (
                              <MinusIcon className="size-3 text-gray-400" />
                            )}
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {fullPaths.map((fullPath) => {
                const fileName = getFileNameToDisplay(fullPath);
                const fileTags = tags.getFileTags(fullPath);

                return (
                  <tr
                    key={fullPath}
                    className="hover:bg-base-200/50 border-t border-base-300"
                  >
                    <td
                      className="py-2 px-3 font-mono text-sm truncate max-w-[200px]"
                      title={fullPath}
                    >
                      {fileName}
                    </td>
                    {TAG_COLORS.map((color) => {
                      const isTagged = fileTags.includes(color);
                      const colorClasses = TAG_COLOR_CLASSES[color];

                      return (
                        <td
                          key={color}
                          className={clsx(
                            "text-center py-2 px-2 cursor-pointer transition-colors",
                            "hover:bg-base-300",
                            isTagged && colorClasses.bg,
                          )}
                          onClick={() => handleCellClick(fullPath, color)}
                        >
                          {isTagged && (
                            <div className="flex items-center justify-center">
                              <CheckIcon
                                className={clsx("size-4", colorClasses.text)}
                              />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-2">
          <button className="btn btn-sm btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}
