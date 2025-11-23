import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import FuzzySearchDialog from "./FuzzySearchDialog";

export function DocxConverter() {
  const [droppedFile, _setDroppedFile] = useState<File | null>(null);
  const lastDropRef = useRef<"drop" | "fuzzy">(null);
  function setDroppedFile(file: File | null) {
    lastDropRef.current = "drop";
    _setDroppedFile(file);
  }
  const { onDrop, onDragOver } = useDropZone(setDroppedFile);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | undefined>(undefined);
  const [fuzzySearchOpen, setFuzzySearchOpen] = useState(false);
  const [fuzzySelectedFile, _setFuzzySelectedFile] = useState<
    string | undefined
  >(undefined);
  function setFuzzySelectedFile(file: string | undefined) {
    lastDropRef.current = "fuzzy";
    _setFuzzySelectedFile(file);
  }

  const [autoConvert, _] = useState(true);

  const convert = useCallback(
    function () {
      const getPromise = () => {
        if (lastDropRef.current === "fuzzy" && fuzzySelectedFile) {
          return window.electron.convertDocxToPdfByPath(fuzzySelectedFile);
        } else if (lastDropRef.current === "drop" && droppedFile) {
          if (!isDocx(droppedFile)) return;
          return window.electron.convertDocxToPdf(droppedFile);
        }
      };
      const p = getPromise();
      if (!p) return;

      setLoading(true);
      p.then((result) => {
        setResult(result);
      }).finally(() => setLoading(false));
    },
    [droppedFile, fuzzySelectedFile],
  );

  useEffect(() => {
    if (!autoConvert) return;

    convert();
  }, [autoConvert, droppedFile, fuzzySelectedFile, convert]);

  const selectedFile = useMemo(() => {
    if (lastDropRef.current === "fuzzy") return fuzzySelectedFile;
    if (lastDropRef.current === "drop") return droppedFile?.name;
  }, [droppedFile, fuzzySelectedFile]);

  return (
    <div
      className="card bg-base-100 shadow-sm p-3 w-100 flex flex-col gap-3 border"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {fuzzySearchOpen && (
        <FuzzySearchDialog
          onClose={() => setFuzzySearchOpen(false)}
          onSelect={setFuzzySelectedFile}
        />
      )}
      <div className="flex gap-3 items-center">
        <button
          className="btn"
          onClick={() => {
            setFuzzySearchOpen(true);
          }}
          type="button"
        >
          Find File
        </button>
        <div>Or drop .docx to convert to .pdf</div>
      </div>
      {selectedFile && <div>Selected file: {selectedFile}</div>}
      <div className="flex gap-3">
        <div>{loading && <div>Loading...</div>}</div>
      </div>
      <button
        className="btn"
        onClick={convert}
        type="button"
        disabled={loading || !selectedFile || !droppedFile}
      >
        {loading && <span className="loading loading-spinner"></span>}
        Convert
      </button>
      <textarea
        className="textarea text-[8px] w-full h-full"
        placeholder="Base 64 Output"
        value={result}
        readOnly
      />
    </div>
  );
}

function useDropZone(setFile: (file: File | null) => void) {
  return {
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];

      setFile(file);
    },
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    },
  };
}

function isDocx(file: File) {
  return (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}
