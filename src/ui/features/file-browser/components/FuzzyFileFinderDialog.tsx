import { useState, useEffect, useRef } from "react";
import { getWindowElectron } from "@/getWindowElectron";
import { useShortcuts } from "@/lib/hooks/useShortcuts";
import { Dialog } from "@/lib/components/dialog";
import { FileIcon, XIcon } from "lucide-react";
import { errorResponseToMessage } from "@common/GenericError";
import { useDirectory } from "../hooks/useDirectory";

type FuzzyFileFinderDialogProps = {
  directory: ReturnType<typeof useDirectory>;
};

export function FuzzyFileFinderDialog({
  directory,
}: FuzzyFileFinderDialogProps) {
  const [query, setQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isFuzzyFinderOpen, setIsFuzzyFinderOpen] = useState(false);

  // Load files when dialog opens or query changes
  useEffect(() => {
    if (!isFuzzyFinderOpen) return;

    const searchFiles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getWindowElectron().fuzzyFileFinder(
          directory.directory.fullName,
          query,
        );
        if (result.success) {
          setFilteredFiles(result.data);
          setSelectedIndex(0);
        } else {
          setError(
            errorResponseToMessage(result.error) || "Failed to load files",
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load files");
      } finally {
        setIsLoading(false);
      }
    };

    searchFiles();
  }, [isFuzzyFinderOpen, directory.directory.fullName, query]);

  useShortcuts([
    {
      key: { key: "p", ctrlKey: true },
      handler: (e) => {
        e.preventDefault();
        setIsFuzzyFinderOpen(true);
      },
    },
  ]);

  // Focus input and reset when dialog opens
  useEffect(() => {
    if (isFuzzyFinderOpen) {
      setQuery("");
      setSelectedIndex(0);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isFuzzyFinderOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedElement = listRef.current.querySelector(
      `[data-index="${selectedIndex}"]`,
    );
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const onClose = () => {
    setIsFuzzyFinderOpen(false);
  };

  const handleSelect = (filePath: string) => {
    // Open the file using directory's openFile method
    directory.openFile(filePath);
    setIsFuzzyFinderOpen(false);
  };

  const handleOpenContainingFolder = (filePath: string) => {
    // Extract the directory path from the file path
    const lastSlashIndex = filePath.lastIndexOf("/");
    if (lastSlashIndex === -1) return;

    const dirPath = filePath.slice(0, lastSlashIndex);
    // Navigate to the containing folder
    directory.cdFull(directory.getFullName(dirPath));
    setIsFuzzyFinderOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredFiles.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredFiles[selectedIndex]) {
        handleSelect(filteredFiles[selectedIndex]);
      }
    } else if (e.key === "o" && e.ctrlKey) {
      e.preventDefault();
      if (filteredFiles[selectedIndex]) {
        handleOpenContainingFolder(filteredFiles[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  useShortcuts(
    [
      {
        key: { key: "j", ctrlKey: true },
        handler: (e) => {
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredFiles.length - 1),
          );
        },
        enabledIn: () => true,
      },
      {
        key: { key: "k", ctrlKey: true },
        handler: (e) => {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        },
        enabledIn: () => true,
      },
    ],
    { isDisabled: !isFuzzyFinderOpen },
  );

  const getFileIcon = () => {
    return <FileIcon className="w-4 h-4 text-gray-400" />;
  };

  const getFileNameAndFolder = (filePath: string) => {
    const lastSlashIndex = filePath.lastIndexOf("/");
    if (lastSlashIndex === -1) {
      return { fileName: filePath, folder: "" };
    }
    return {
      fileName: filePath.slice(lastSlashIndex + 1),
      folder: filePath.slice(0, lastSlashIndex),
    };
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text;

    return (
      <>
        {text.slice(0, index)}
        <span className="bg-yellow-300 text-black">
          {text.slice(index, index + query.length)}
        </span>
        {text.slice(index + query.length)}
      </>
    );
  };

  if (!isFuzzyFinderOpen) return null;

  return (
    <Dialog
      onClose={onClose}
      title="Find File"
      className="max-w-[90vw] max-h-[90vh] w-full h-full"
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type to search files..."
            className="input w-full text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {isLoading && (
          <div className="text-center text-gray-500 py-4">Loading files...</div>
        )}

        {error && (
          <div className="text-center text-red-500 py-4">Error: {error}</div>
        )}

        {!isLoading && !error && (
          <div
            ref={listRef}
            className="overflow-y-auto border border-gray-200 rounded"
          >
            {filteredFiles.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {query ? "No files found" : "No files in directory"}
              </div>
            ) : (
              <div>
                {filteredFiles.map((file, index) => {
                  const { fileName, folder } = getFileNameAndFolder(file);
                  return (
                    <div
                      key={file}
                      data-index={index}
                      onClick={() => handleSelect(file)}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-base-content/10 ${
                        index === selectedIndex ? "bg-base-content/10" : ""
                      }`}
                    >
                      {getFileIcon()}
                      <div className="flex gap-3 items-center min-w-0 flex-1">
                        <span className="text-xs truncate">
                          {highlightMatch(fileName, query)}
                        </span>
                        {folder && (
                          <span className="text-xs text-gray-500 truncate">
                            {folder}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 text-center">
          {filteredFiles.length > 0 && (
            <span>
              {selectedIndex + 1} / {filteredFiles.length} files
              {filteredFiles.length >= 100 && ` (showing top 100)`}
            </span>
          )}
        </div>

        <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 justify-center">
          <div>
            <kbd className="kbd">↑↓</kbd> or <kbd className="kbd">Ctrl+J/K</kbd>{" "}
            to navigate
          </div>
          <div>
            <kbd className="kbd">Enter</kbd> to select
          </div>
          <div>
            <kbd className="kbd">Ctrl+O</kbd> to open containing folder
          </div>
          <div>
            <kbd className="kbd">Esc</kbd> to close
          </div>
        </div>
      </div>
    </Dialog>
  );
}
