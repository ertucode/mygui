import { ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react";
import { FolderBreadcrumb } from "./FolderBreadcrumb";
import { useSelector } from "@xstate/store/react";
import { useEffect, useRef } from "react";
import {
  directoryStore,
  directoryHelpers,
  selectHasNext,
  selectHasPrev,
  selectFuzzyQuery,
  useFilteredDirectoryData,
} from "../directory";

export function FileBrowserNavigationAndInputSection() {
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
        onClick={() => directoryHelpers.onGoUpOrPrev(directoryHelpers.goUp)}
      >
        {<ArrowUpIcon className={navigationButtonIconClassName} />}
      </button>
      <div className="flex-1 join-item px-2 overflow-x-auto">
        <FolderBreadcrumb />
      </div>
      <FuzzyInput />
    </div>
  );
}

function FuzzyInput() {
  const fuzzyQuery = useSelector(directoryStore, selectFuzzyQuery);
  const filteredData = useFilteredDirectoryData();

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return directoryStore.on("focusFuzzyInput", ({ e }) => {
      e.preventDefault();
      inputRef.current?.focus();
      const query = directoryStore.getSnapshot().context.fuzzyQuery;
      if (query) {
        setTimeout(() => {
          const i = inputRef.current;
          if (!i) return;
          i.selectionStart = 0;
          i.selectionEnd = query.length;
        }, 100);
      }
    }).unsubscribe;
  }, []);

  return (
    <input
      id="fuzzy-finder-input"
      type="text"
      ref={inputRef}
      className="input text-sm h-6 max-w-50 w-48 min-[1000px]:w-80 join-item"
      placeholder="Search... (/)"
      value={fuzzyQuery}
      onChange={(e) => {
        directoryHelpers.setFuzzyQuery(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          directoryHelpers.clearFuzzyQuery();
          e.currentTarget.blur();
        }
        if (e.key === "j" && e.ctrlKey)
          directoryHelpers.setSelection((h) =>
            Math.min(h + 1, filteredData.length - 1),
          );
        if (e.key === "k" && e.ctrlKey)
          directoryHelpers.setSelection((h) => Math.max(h - 1, 0));

        if (e.key === "Enter") {
          directoryHelpers.openSelectedItem(filteredData);
          directoryHelpers.clearFuzzyQuery();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
