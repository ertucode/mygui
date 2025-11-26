import { useMemo, useRef, useState } from "react";
import { Dialog } from "../../components/dialog";
import { useShortcuts } from "../../hooks/useShortcuts";
import Fuse from "fuse.js";

export type FuzzyFinderDialogProps<T> = {
  query?: string | undefined;
  setQuery?: (query: $Maybe<string>) => void;
  items: T[];
  keys: (keyof T & string)[];
  maxCount?: number;
  renderItem: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  onSelect: (item: T) => void;
  onClose?: () => void;
};

export function FuzzyFinderDialog<T>({
  query: _query,
  setQuery: _setQuery,
  onSelect,
  items,
  keys,
  maxCount,
  renderItem,
  getKey,
  ...props
}: FuzzyFinderDialogProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(_query ?? "");

  const [highlight, setHighlight] = useState(0);
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
    setHighlight(0);
    return results.map((result) => result.item);
  }, [query, fuse, maxCount]);

  const inputRef = useRef<HTMLInputElement>(null);

  useShortcuts([
    {
      key: { key: "p", ctrlKey: true },
      handler: () => {
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

  const onClose = () => {
    setOpen(false);
    props.onClose?.();
  };

  if (!open) return null;

  return (
    <Dialog onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex flex gap-3">
          <input
            ref={inputRef}
            type="text"
            className="input input-bordered mb-2 w-[80vw]"
            placeholder="Type to search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "j" && e.ctrlKey)
                setHighlight((h) => Math.min(h + 1, results.length - 1));
              if (e.key === "k" && e.ctrlKey)
                setHighlight((h) => Math.max(h - 1, 0));
              if (e.key === "Enter" && results[highlight]) {
                onSelect(results[highlight]);
                setQuery("");
                setHighlight(0);
                onClose();
              }
            }}
          />
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        <ul className="menu bg-base-100 z-1 shadow-sm w-full p-0 overflow-y-auto h-full">
          {results.map((item, i) => (
            <li
              key={getKey(item)}
              className={`cursor-pointer py-1 w-full ${i === highlight ? "bg-warning text-warning-content" : ""}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => {
                onSelect(item);
                onClose();
              }}
            >
              {renderItem(item)}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
