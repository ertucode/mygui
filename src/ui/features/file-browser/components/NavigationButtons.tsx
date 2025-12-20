import { ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react";
import { useSelector } from "@xstate/store/react";
import {
  directoryStore,
  directoryHelpers,
  selectHasNext,
  selectHasPrev,
} from "../directory";

export function NavigationButtons() {
  const activeDirectoryId = useSelector(
    directoryStore,
    (s) => s.context.activeDirectoryId,
  );
  const hasNext = useSelector(directoryStore, selectHasNext(activeDirectoryId));
  const hasPrev = useSelector(directoryStore, selectHasPrev(activeDirectoryId));

  const navigationButtonClassName = "btn btn-xs btn-soft btn-info join-item";
  const navigationButtonIconClassName = "size-4";

  return (
    <div className="join items-center">
      <button
        className={navigationButtonClassName}
        onClick={() => directoryHelpers.goPrev(activeDirectoryId)}
        disabled={!hasPrev}
      >
        <ArrowLeftIcon className={navigationButtonIconClassName} />
      </button>
      <button
        className={navigationButtonClassName}
        onClick={() => directoryHelpers.goNext(activeDirectoryId)}
        disabled={!hasNext}
      >
        <ArrowRightIcon className={navigationButtonIconClassName} />
      </button>
      <button
        className={navigationButtonClassName}
        onClick={() =>
          directoryHelpers.onGoUpOrPrev(directoryHelpers.goUp, activeDirectoryId)
        }
      >
        <ArrowUpIcon className={navigationButtonIconClassName} />
      </button>
    </div>
  );
}
