import { useSelector } from "@xstate/store/react";
import { useEffect, useRef, useState } from "react";
import {
  directoryStore,
  directoryHelpers,
  selectFuzzyQuery,
} from "../directoryStore/directory";
import { DirectoryId } from "../directoryStore/DirectoryBase";
import { directoryDerivedStores } from "../directoryStore/directorySubscriptions";
import { directorySelection } from "../directoryStore/directorySelection";

export type FuzzyInputProps = {
  directoryId: DirectoryId;
};

export function FuzzyInput({ directoryId }: { directoryId: DirectoryId }) {
  const fuzzyQuery = useSelector(directoryStore, selectFuzzyQuery(directoryId));
  const filteredData = directoryDerivedStores
    .get(directoryId)!
    .useFilteredDirectoryData();

  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    return directoryStore.on("focusFuzzyInput", ({ e, directoryId: dId }) => {
      if (dId !== directoryId) return;
      e?.preventDefault();
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
  }, [directoryId]);

  const isVisible = isFocused || fuzzyQuery.length > 0;

  return (
    <input
      id="fuzzy-finder-input"
      type="text"
      ref={inputRef}
      className="input text-sm h-6 w-48 min-[1000px]:w-60 absolute top-2 right-2 z-10 transition-opacity duration-200 rounded-none"
      style={{
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
      }}
      placeholder="Search... (/)"
      value={fuzzyQuery}
      onChange={(e) => {
        directoryHelpers.setFuzzyQuery(e.target.value, directoryId);
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          directoryHelpers.clearFuzzyQuery(directoryId);
          e.currentTarget.blur();
        }
        if (e.key === "j" && e.ctrlKey)
          directorySelection.setSelection(
            (h) => Math.min(h + 1, filteredData.length - 1),
            directoryId,
          );
        if (e.key === "k" && e.ctrlKey)
          directorySelection.setSelection(
            (h) => Math.max(h - 1, 0),
            directoryId,
          );

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
