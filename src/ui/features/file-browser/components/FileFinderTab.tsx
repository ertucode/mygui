import { useState, useEffect, useRef } from "react";
import { useSelector } from "@xstate/store/react";
import { getWindowElectron } from "@/getWindowElectron";
import { FileIcon, XIcon } from "lucide-react";
import { errorResponseToMessage } from "@common/GenericError";
import { FilePreview } from "./FilePreview";
import { Alert } from "@/lib/components/alert";
import {
  directoryStore,
  directoryHelpers,
  selectDirectory,
} from "../directoryStore/directory";
import { useDebounce } from "@/lib/hooks/useDebounce";

type FileFinderTabProps = {
  isOpen: boolean;
  onClose: () => void;
  showPreview: boolean;
};

export function FileFinderTab({
  isOpen,
  onClose,
  showPreview,
}: FileFinderTabProps) {
  const activeDirectoryId = useSelector(
    directoryStore,
    (s) => s.context.activeDirectoryId,
  );
  const directory = useSelector(
    directoryStore,
    selectDirectory(activeDirectoryId),
  );
  const [query, setQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [_isLoading, setIsLoading] = useState(false);
  const isLoading = useDebounce(_isLoading, 100);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load files when dialog opens or query changes
  useEffect(() => {
    if (!isOpen) return;

    const searchFiles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (directory.type !== "path") return;
        const result = await getWindowElectron().fuzzyFileFinder(
          directory.fullPath,
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
  }, [isOpen, directory, query]);

  // Reset and focus when dialog opens
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

  const handleSelect = (filePath: string) => {
    directoryHelpers.openFile(filePath, activeDirectoryId);
    onClose();
  };

  const handleOpenContainingFolder = (filePath: string) => {
    const lastSlashIndex = filePath.lastIndexOf("/");
    if (lastSlashIndex === -1) return;

    const dirPath = filePath.slice(0, lastSlashIndex);
    directoryHelpers.cdFull(
      directoryHelpers.getFullPath(dirPath, activeDirectoryId),
      activeDirectoryId,
    );
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || (e.key === "j" && e.ctrlKey)) {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredFiles.length - 1));
    } else if (e.key === "ArrowUp" || (e.key === "k" && e.ctrlKey)) {
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
    }
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

  const selectedFile = filteredFiles[selectedIndex];
  const selectedFilePath = selectedFile
    ? directoryHelpers.getFullPath(selectedFile, activeDirectoryId)
    : null;
  const selectedFileExt = selectedFile
    ? selectedFile.slice(selectedFile.lastIndexOf(".") + 1)
    : null;

  return (
    <div className="flex gap-3 h-full overflow-visible">
      <div className="flex flex-col gap-3 flex-1 min-w-0 h-full">
        {/* Input section */}
        <div className="relative flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type to search files..."
            className="input input-bordered w-full text-sm focus:outline-offset-[-2px]"
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

        {/* File list section */}
        <div className="flex-1 min-h-0 border border-gray-200 rounded overflow-hidden flex flex-col">
          {isLoading && (
            <div className="text-center text-gray-500 py-4">
              Loading files...
            </div>
          )}

          {error && <Alert className="m-6">{error}</Alert>}

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
                        <FileIcon className="w-4 h-4 text-gray-400" />
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

        <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 justify-center flex-shrink-0">
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
        </div>
      </div>

      {/* Preview Panel */}
      {showPreview && selectedFilePath && (
        <div className="w-[400px] h-full border-gray-200 flex flex-col flex-shrink-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            {selectedFile}
            {selectedFilePath}
            {activeDirectoryId}
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
  );
}
