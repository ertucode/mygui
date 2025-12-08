import { Dispatch, SetStateAction, useMemo, useRef, useState } from "react";
import { useShortcuts } from "../../hooks/useShortcuts";
import Fuse from "fuse.js";

export type UseFuzzyFinderProps<T> = {
  query?: string | undefined;
  setQuery?: (query: $Maybe<string>) => void;
  items: T[];
  keys: (keyof T & string)[];
  maxCount?: number;
  onResultChange?: (items: T[]) => void;
  setHighlight: Dispatch<SetStateAction<number>>;
};

export type FuzzyFinderInputProps<T> = {
  fuzzy: ReturnType<typeof useFuzzyFinder<T>>;
  className?: string;
};

export function useFuzzyFinder<T>({
  query: _query,
  setQuery: _setQuery,
  items,
  keys,
  maxCount,
  setHighlight,
}: UseFuzzyFinderProps<T>) {
  const [query, setQuery] = useState(_query ?? "");

  const fuse = useMemo(() => {
    return new Fuse(items, {
      threshold: 0.3,
      minMatchCharLength: 1,
      keys,
      shouldSort: true,
      isCaseSensitive: false,
    });
  }, [items]);

  const results = useMemo(() => {
    if (!query) return items.slice(0, maxCount);

    const results = fuse.search(query, { limit: maxCount ?? items.length });
    if (results.length === 0) return [];

    setHighlight(0);
    return results.map((result) => result.item);
  }, [query, fuse, maxCount]);

  const inputRef = useRef<HTMLInputElement>(null);

  useShortcuts([
    {
      key: { key: "/" },
      handler: (e) => {
        e.preventDefault();
        inputRef.current?.focus();
        if (query) {
          setTimeout(() => {
            const i = inputRef.current;
            if (!i) return;
            i.selectionStart = 0;
            i.selectionEnd = query.length;
          }, 100);
        }
      },
    },
  ]);

  const clearQuery = () => {
    setQuery("");
  };

  return {
    query,
    setQuery,
    clearQuery,
    results,
    inputRef,
    setHighlight,
  };
}

export function FuzzyFinderInput<T>({
  fuzzy: { inputRef, query, setQuery, clearQuery, setHighlight, results },
  className,
}: FuzzyFinderInputProps<T>) {
  return (
    <input
      id="fuzzy-finder-input"
      type="text"
      ref={inputRef}
      className={`input text-sm h-6 ${className ?? ""}`}
      placeholder="Search... (/)"
      value={query}
      onChange={(e) => {
        setQuery(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          clearQuery();
          e.currentTarget.blur();
        }
        if (e.key === "j" && e.ctrlKey)
          setHighlight((h) => Math.min(h + 1, results.length - 1));
        if (e.key === "k" && e.ctrlKey) setHighlight((h) => Math.max(h - 1, 0));
      }}
    />
  );
}
