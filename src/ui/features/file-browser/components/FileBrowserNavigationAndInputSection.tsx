import {
  FuzzyFinderInput,
  useFuzzyFinder,
} from "@/lib/libs/fuzzy-find/FuzzyFinderInput";
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react";
import { useDirectory } from "../hooks/useDirectory";
import { FolderBreadcrumb } from "./FolderBreadcrumb";
import { useDefaultPath } from "../hooks/useDefaultPath";
import { useTags } from "../hooks/useTags";

type UseDirectoryReturnType = ReturnType<typeof useDirectory>;
export type FileBrowserNavigationAndInputSectionProps = {
  d: ReturnType<typeof useDirectory>;
  defaultPath: ReturnType<typeof useDefaultPath>;
  fuzzy: ReturnType<typeof useFuzzyFinder>;
  onGoUpOrPrev: (fn: UseDirectoryReturnType["goUp" | "goPrev"]) => void;
  tags: ReturnType<typeof useTags>;
};

export function FileBrowserNavigationAndInputSection({
  d,
  defaultPath,
  fuzzy,
  onGoUpOrPrev,
  tags,
}: FileBrowserNavigationAndInputSectionProps) {
  const navigationButtonClassName = "btn btn-xs btn-soft btn-info join-item";
  const navigationButtonIconClassName = "size-4";

  return (
    <div className="join items-center mb-2">
      <button
        className={navigationButtonClassName}
        onClick={d.goPrev}
        disabled={!d.hasPrev}
      >
        {<ArrowLeftIcon className={navigationButtonIconClassName} />}
      </button>
      <button
        className={navigationButtonClassName}
        onClick={d.goNext}
        disabled={!d.hasNext}
      >
        {<ArrowRightIcon className={navigationButtonIconClassName} />}
      </button>
      <button
        className={navigationButtonClassName}
        onClick={() => onGoUpOrPrev(d.goUp)}
      >
        {<ArrowUpIcon className={navigationButtonIconClassName} />}
      </button>
      <div className="flex-1 join-item px-2 overflow-x-auto">
        <FolderBreadcrumb d={d} defaultPath={defaultPath} tags={tags} />
      </div>
      <FuzzyFinderInput
        fuzzy={fuzzy}
        className="w-48 min-[1000px]:w-80 join-item"
      />
    </div>
  );
}
