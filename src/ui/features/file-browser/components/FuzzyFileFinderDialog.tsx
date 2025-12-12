import { useState, useEffect, useRef } from "react";
import { getWindowElectron } from "@/getWindowElectron";
import { useShortcuts } from "@/lib/hooks/useShortcuts";
import { Dialog } from "@/lib/components/dialog";
import { FileIcon, XIcon } from "lucide-react";
import { errorResponseToMessage } from "@common/GenericError";
import { useDirectory } from "../hooks/useDirectory";
import { FilePreview } from "./FilePreview";

type FuzzyFileFinderDialogProps = {
  directory: ReturnType<typeof useDirectory>;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

const MIN_WIDTH_FOR_PREVIEW = 900; // Minimum window width to show preview

export function FuzzyFileFinderDialog({
  directory,
  isOpen,
  setIsOpen,
}: FuzzyFileFinderDialogProps) {
  const [query, setQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(
    window.innerWidth >= MIN_WIDTH_FOR_PREVIEW,
  );

  // Track window width for showing/hiding preview
  useEffect(() => {
    const handleResize = () => {
      setShowPreview(window.innerWidth >= MIN_WIDTH_FOR_PREVIEW);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load files when dialog opens or query changes
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, directory.directory.fullName, query]);

  // Focus input and reset when dialog opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

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
    setIsOpen(false);
  };

  const handleSelect = (filePath: string) => {
    // Open the file using directory's openFile method
    directory.openFile(filePath);
    setIsOpen(false);
  };

  const handleOpenContainingFolder = (filePath: string) => {
    // Extract the directory path from the file path
    const lastSlashIndex = filePath.lastIndexOf("/");
    if (lastSlashIndex === -1) return;

    const dirPath = filePath.slice(0, lastSlashIndex);
    // Navigate to the containing folder
    directory.cdFull(directory.getFullName(dirPath));
    setIsOpen(false);
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
    { isDisabled: !isOpen },
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

  if (!isOpen) return null;

  const selectedFile = filteredFiles[selectedIndex];
  const selectedFilePath = selectedFile
    ? directory.getFullName(selectedFile)
    : null;
  const selectedFileExt = selectedFile
    ? selectedFile.slice(selectedFile.lastIndexOf(".") + 1)
    : null;

  return (
    <Dialog
      onClose={onClose}
      title="Find File"
      className="max-w-[90vw] w-full"
      style={{ height: "80vh" }}
    >
      <div ref={containerRef} className="flex gap-3 h-full overflow-hidden">
        <div className="flex flex-col gap-3 flex-1 min-w-0 h-full">
          {/* Input section - fixed height */}
          <div className="relative flex-shrink-0">
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

          {/* File list section - scrollable */}
          <div className="flex-1 min-h-0 border border-gray-200 rounded overflow-hidden flex flex-col">
            {isLoading && (
              <div className="text-center text-gray-500 py-4">
                Loading files...
              </div>
            )}

            {error && (
              <div className="text-center text-red-500 py-4">
                Error: {error}
              </div>
            )}

            {!isLoading && !error && (
              <div ref={listRef} className="overflow-y-auto flex-1">
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
          </div>

          {/* Footer sections - fixed height */}
          <div className="text-xs text-gray-500 text-center flex-shrink-0">
            {filteredFiles.length > 0 && (
              <span>
                {selectedIndex + 1} / {filteredFiles.length} files
                {filteredFiles.length >= 100 && ` (showing top 100)`}
              </span>
            )}
          </div>

          <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 justify-center flex-shrink-0">
            <div>
              <kbd className="kbd">↑↓</kbd> or{" "}
              <kbd className="kbd">Ctrl+J/K</kbd> to navigate
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

        {/* Preview Panel - only show when window is wide enough */}
        {showPreview && selectedFilePath && (
          <div className="w-[400px] h-full border-l border-gray-200 pl-3 flex flex-col flex-shrink-0">
            <div className="flex-1 min-h-0 overflow-hidden">
              <FilePreview
                filePath={selectedFilePath}
                isFile={true}
                fileSize={null}
                fileExt={selectedFileExt}
              />
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
