import { useState, useEffect } from "react";
import { debounce } from "lodash";
import { Dialog } from "./lib/components/dialog";

type FuzzySearchDialogProps = {
  onClose: () => void;
  onSelect: (file: string) => void;
};

export default function FuzzySearchDialog({
  onClose,
  onSelect,
}: FuzzySearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [highlight, setHighlight] = useState(0);

  // Debounced fuzzy search
  const runSearch = debounce(async (q: string) => {
    if (!q) {
      setResults([]);
      return;
    }
    const res = await window.electron.fuzzyFind(q);
    console.log("Searching for", res);
    setResults(res);
    setHighlight(0);
  }, 100);

  useEffect(() => {
    runSearch(query);
  }, [query]);

  return (
    <Dialog onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex flex gap-3">
          <input
            type="text"
            className="input input-bordered mb-2 w-[80vw]"
            placeholder="Type to search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown")
                setHighlight((h) => Math.min(h + 1, results.length - 1));
              if (e.key === "ArrowUp") setHighlight((h) => Math.max(h - 1, 0));
              if (e.key === "Enter" && results[highlight]) {
                onSelect(results[highlight]);
                onClose();
              }
              if (e.key === "Escape") onClose();
            }}
          />
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="dropdown dropdown-open">
          <ul className="dropdown-content menu bg-base-100 rounded-box z-1 p-2 shadow-sm">
            {results.map((item, i) => (
              <li
                key={item}
                className={`cursor-pointer px-2 py-1 ${i === highlight ? "bg-primary text-white" : ""}`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
