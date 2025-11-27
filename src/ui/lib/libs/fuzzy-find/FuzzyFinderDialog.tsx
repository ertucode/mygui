import { Dispatch, SetStateAction, useMemo, useRef, useState } from "react";
import { useShortcuts } from "../../hooks/useShortcuts";
import Fuse from "fuse.js";

export type UseFuzzyFinderProps<T> = {
  query?: string | undefined;
  setQuery?: (query: $Maybe<string>) => void;
  items: T[];
  keys: (keyof T & string)[];
  maxCount?: number;
  onClose?: () => void;
  onResultChange?: (items: T[]) => void;
  setHighlight: Dispatch<SetStateAction<number>>;
};

export type FuzzyFinderDialogProps<T> = {
  fuzzy: ReturnType<typeof useFuzzyFinder<T>>;
};

export function useFuzzyFinder<T>({
  query: _query,
  setQuery: _setQuery,
  items,
  keys,
  maxCount,
  setHighlight,
  ...props
}: UseFuzzyFinderProps<T>) {
  const [open, setOpen] = useState(false);
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
    if (!open) return items;
    if (!query) return items.slice(0, maxCount);

    const results = fuse.search(query, { limit: maxCount ?? items.length });
    setHighlight(0);
    return results.map((result) => result.item);
  }, [query, fuse, maxCount, open]);

  const inputRef = useRef<HTMLInputElement>(null);

  useShortcuts([
    {
      key: { key: "/" },
      handler: (e) => {
        e.preventDefault();
        setOpen(true);
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
    {
      key: { key: "A" },
      handler: (e) => {
        if (
          open &&
          inputRef.current?.selectionStart !== inputRef.current?.selectionEnd
        ) {
          e.preventDefault();
          inputRef.current!.selectionStart = query.length;
        }
      },
      enabledIn: inputRef,
    },
  ]);

  const close = () => {
    setOpen(false);
    props.onClose?.();
  };

  return {
    open,
    close,
    query,
    setQuery,
    results,
    inputRef,
    setHighlight,
  };
}

export function FuzzyFinderDialog<T>({
  fuzzy: {
    open,
    inputRef,
    query,
    setQuery,
    close: close,
    setHighlight,
    results,
  },
}: FuzzyFinderDialogProps<T>) {
  if (!open) return null;

  return (
    <div className="absolute top-20 left-10 right-10 bg-base-100 z-50000000 flex flex-col gap-3">
      <input
        id="fuzzy-finder-input"
        type="text"
        ref={inputRef}
        className="input w-full text-sm h-6 border-none! highlight-red-100"
        placeholder="Type to search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "j" && e.ctrlKey)
            setHighlight((h) => Math.min(h + 1, results.length - 1));
          if (e.key === "k" && e.ctrlKey)
            setHighlight((h) => Math.max(h - 1, 0));
        }}
        autoFocus
      />
    </div>
  );
}
