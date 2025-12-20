import { useSelector } from "@xstate/store/react";
import { useEffect, useRef } from "react";
import {
  directoryStore,
  directoryHelpers,
  selectFuzzyQuery,
  directoryDerivedStores,
  DirectoryId,
} from "../directory";
import {
  DirectoryContextProvider,
  useDirectoryContext,
} from "../DirectoryContext";

export type FileBrowserNavigationAndInputSectionProps = {
  directoryId: DirectoryId;
};

export function FileBrowserNavigationAndInputSection({
  directoryId,
}: FileBrowserNavigationAndInputSectionProps) {
  return (
    <DirectoryContextProvider directoryId={directoryId}>
      <div className="join items-center w-full">
        <div className="flex-1"></div>
        <FuzzyInput />
      </div>
    </DirectoryContextProvider>
  );
}

function FuzzyInput() {
  const directoryId = useDirectoryContext().directoryId;
  const fuzzyQuery = useSelector(directoryStore, selectFuzzyQuery(directoryId));
  const filteredData = directoryDerivedStores
    .get(directoryId)!
    .useFilteredDirectoryData();

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return directoryStore.on("focusFuzzyInput", ({ e, directoryId: dId }) => {
      if (dId !== directoryId) return;
      e.preventDefault();
      inputRef.current?.focus();
      const query =
        directoryStore.getSnapshot().context.directoriesById[directoryId]
          .fuzzyQuery;
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
        directoryHelpers.setFuzzyQuery(e.target.value, directoryId);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          directoryHelpers.clearFuzzyQuery(directoryId);
          e.currentTarget.blur();
        }
        if (e.key === "j" && e.ctrlKey)
          directoryHelpers.setSelection(
            (h) => Math.min(h + 1, filteredData.length - 1),
            directoryId,
          );
        if (e.key === "k" && e.ctrlKey)
          directoryHelpers.setSelection((h) => Math.max(h - 1, 0), directoryId);

        if (e.key === "Enter") {
          directoryHelpers.openSelectedItem(
            filteredData,
            undefined,
            directoryId,
          );
          directoryHelpers.clearFuzzyQuery(directoryId);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
