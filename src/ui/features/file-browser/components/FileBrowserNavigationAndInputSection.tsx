import {
  FuzzyFinderInput,
  useFuzzyFinder,
} from "@/lib/libs/fuzzy-find/FuzzyFinderInput";
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react";
import { FolderBreadcrumb } from "./FolderBreadcrumb";
import { useSelector } from "@xstate/store/react";
import {
  directoryStore,
  directoryHelpers,
  selectHasNext,
  selectHasPrev,
} from "../directory";

export type FileBrowserNavigationAndInputSectionProps = {
  fuzzy: ReturnType<typeof useFuzzyFinder>;
  onGoUpOrPrev: (
    fn: typeof directoryHelpers.goPrev | typeof directoryHelpers.goUp,
  ) => void;
};

export function FileBrowserNavigationAndInputSection({
  fuzzy,
  onGoUpOrPrev,
}: FileBrowserNavigationAndInputSectionProps) {
  const navigationButtonClassName = "btn btn-xs btn-soft btn-info join-item";
  const navigationButtonIconClassName = "size-4";
  const hasNext = useSelector(directoryStore, selectHasNext);
  const hasPrev = useSelector(directoryStore, selectHasPrev);

  return (
    <div className="join items-center mb-2">
      <button
        className={navigationButtonClassName}
        onClick={directoryHelpers.goPrev}
        disabled={!hasPrev}
      >
        {<ArrowLeftIcon className={navigationButtonIconClassName} />}
      </button>
      <button
        className={navigationButtonClassName}
        onClick={directoryHelpers.goNext}
        disabled={!hasNext}
      >
        {<ArrowRightIcon className={navigationButtonIconClassName} />}
      </button>
      <button
        className={navigationButtonClassName}
        onClick={() => onGoUpOrPrev(directoryHelpers.goUp)}
      >
        {<ArrowUpIcon className={navigationButtonIconClassName} />}
      </button>
      <div className="flex-1 join-item px-2 overflow-x-auto">
        <FolderBreadcrumb />
      </div>
      <FuzzyFinderInput
        fuzzy={fuzzy}
        className="w-48 min-[1000px]:w-80 join-item"
      />
    </div>
  );
}
