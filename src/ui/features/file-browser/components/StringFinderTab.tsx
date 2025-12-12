import { useState, useEffect, useRef } from "react";
import { getWindowElectron } from "@/getWindowElectron";
import {
  SearchIcon,
  XIcon,
  FileIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { errorResponseToMessage } from "@common/GenericError";
import { StringSearchResult } from "@common/Contracts";
import { useDirectory } from "../hooks/useDirectory";

type StringFinderTabProps = {
  directory: ReturnType<typeof useDirectory>;
  isOpen: boolean;
  onClose: () => void;
};

export function StringFinderTab({
  directory,
  isOpen,
  onClose,
}: StringFinderTabProps) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StringSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Advanced search options
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [cwd, setCwd] = useState("");
  const [includePatterns, setIncludePatterns] = useState("");
  const [excludePatterns, setExcludePatterns] = useState("");
  const [useRegex, setUseRegex] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searchHidden, setSearchHidden] = useState(true);

  // Parse comma-separated patterns into array
  const parsePatterns = (input: string): string[] => {
    return input
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  };

  // Search with debounce when query or options change
  useEffect(() => {
    if (!isOpen) return;

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Don't search for empty query
    if (!query.trim()) {
      setSearchResults([]);
      setSelectedIndex(0);
      return;
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getWindowElectron().searchStringRecursively({
          directory: directory.directory.fullName,
          query,
          cwd: cwd.trim() || undefined,
          includePatterns: parsePatterns(includePatterns),
          excludePatterns: parsePatterns(excludePatterns),
          useRegex,
          caseSensitive,
          searchHidden,
        });
        if (result.success) {
          setSearchResults(result.data);
          setSelectedIndex(0);
        } else {
          setError(errorResponseToMessage(result.error) || "Failed to search");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to search");
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [
    isOpen,
    directory.directory.fullName,
    query,
    cwd,
    includePatterns,
    excludePatterns,
    useRegex,
    caseSensitive,
    searchHidden,
  ]);

  // Reset and focus when dialog opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setError(null);
      setSearchResults([]);
      // Don't reset advanced options so user can keep their filters
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

  const handleSelect = (result: StringSearchResult) => {
    directory.openFile(result.filePath);
    onClose();
  };

  const handleOpenContainingFolder = (result: StringSearchResult) => {
    const lastSlashIndex = result.filePath.lastIndexOf("/");
    if (lastSlashIndex === -1) return;

    const dirPath = result.filePath.slice(0, lastSlashIndex);
    directory.cdFull(directory.getFullName(dirPath));
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || (e.key === "j" && e.ctrlKey)) {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp" || (e.key === "k" && e.ctrlKey)) {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleSelect(searchResults[selectedIndex]);
      }
    } else if (e.key === "o" && e.ctrlKey) {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        handleOpenContainingFolder(searchResults[selectedIndex]);
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

  const selectedResult = searchResults[selectedIndex];

  return (
    <div className="flex gap-3 h-full overflow-visible">
      {/* Left panel - Results list */}
      <div className="flex flex-col gap-3 w-[350px] min-w-[300px] h-full flex-shrink-0">
        {/* Input section */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type to search in files..."
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

          {/* Toggle advanced options */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 self-start"
          >
            {showAdvanced ? (
              <ChevronUpIcon className="w-3 h-3" />
            ) : (
              <ChevronDownIcon className="w-3 h-3" />
            )}
            Advanced options
          </button>

          {/* Advanced options panel */}
          {showAdvanced && (
            <div className="flex flex-col gap-3 p-3 bg-base-200 rounded-lg text-xs border border-base-300">
              {/* Directory / CWD */}
              <div>
                <label className="block font-medium text-base-content mb-1">
                  Directory
                </label>
                <input
                  type="text"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="e.g., src/components or ~/projects or /absolute/path"
                  className="input input-bordered input-sm w-full bg-base-100"
                />
                <p className="text-base-content/60 mt-1">
                  Relative to current dir, or absolute if starts with / or ~
                </p>
              </div>

              {/* Include patterns */}
              <div>
                <label className="block font-medium text-base-content mb-1">
                  Include files
                </label>
                <input
                  type="text"
                  value={includePatterns}
                  onChange={(e) => setIncludePatterns(e.target.value)}
                  placeholder="e.g., *.ts, *.tsx, src/**/*.js"
                  className="input input-bordered input-sm w-full bg-base-100"
                />
                <p className="text-base-content/60 mt-1">
                  Glob patterns, comma-separated
                </p>
              </div>

              {/* Exclude patterns */}
              <div>
                <label className="block font-medium text-base-content mb-1">
                  Exclude files
                </label>
                <input
                  type="text"
                  value={excludePatterns}
                  onChange={(e) => setExcludePatterns(e.target.value)}
                  placeholder="e.g., node_modules/**, *.min.js, dist/**"
                  className="input input-bordered input-sm w-full bg-base-100"
                />
                <p className="text-base-content/60 mt-1">
                  Glob patterns, comma-separated
                </p>
              </div>

              {/* Checkboxes for options */}
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useRegex}
                    onChange={(e) => setUseRegex(e.target.checked)}
                    className="checkbox checkbox-xs checkbox-primary"
                  />
                  <span className="text-base-content">Use regex</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={caseSensitive}
                    onChange={(e) => setCaseSensitive(e.target.checked)}
                    className="checkbox checkbox-xs checkbox-primary"
                  />
                  <span className="text-base-content">Case sensitive</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={searchHidden}
                    onChange={(e) => setSearchHidden(e.target.checked)}
                    className="checkbox checkbox-xs checkbox-primary"
                  />
                  <span className="text-base-content">Hidden files</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Results list section */}
        <div className="flex-1 min-h-0 border border-gray-200 rounded overflow-hidden flex flex-col">
          {isLoading && (
            <div className="text-center text-gray-500 py-4">Searching...</div>
          )}

          {error && (
            <div className="text-center text-red-500 py-4">Error: {error}</div>
          )}

          {!isLoading && !error && (
            <div ref={listRef} className="overflow-y-auto flex-1">
              {searchResults.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {query ? "No matches found" : "Enter a search term"}
                </div>
              ) : (
                <div>
                  {searchResults.map((result, index) => {
                    const { fileName, folder } = getFileNameAndFolder(
                      result.filePath,
                    );
                    return (
                      <div
                        key={`${result.filePath}:${result.matchLineNumber}:${index}`}
                        data-index={index}
                        onClick={() => handleSelect(result)}
                        className={`flex flex-col px-3 py-2 cursor-pointer hover:bg-base-content/10 ${
                          index === selectedIndex ? "bg-base-content/10" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <SearchIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-xs font-medium truncate">
                            {fileName}
                          </span>
                          <span className="text-xs text-gray-400">
                            :{result.matchLineNumber}
                          </span>
                          {folder && (
                            <span className="text-xs text-gray-500 truncate ml-2">
                              {folder}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 truncate pl-6 mt-1 font-mono">
                          {highlightMatch(result.matchContent, query)}
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
            <kbd className="kbd">Enter</kbd> to open file
          </div>
          <div>
            <kbd className="kbd">Ctrl+O</kbd> to open containing folder
          </div>
        </div>
      </div>

      {/* Right panel - Context preview */}
      <div className="flex-1 min-w-0 h-full border-gray-200 flex flex-col">
        {selectedResult ? (
          <>
            {/* File header */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 flex-shrink-0">
              <FileIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm font-medium truncate">
                {getFileNameAndFolder(selectedResult.filePath).fileName}
              </span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                Line {selectedResult.matchLineNumber}
              </span>
              {getFileNameAndFolder(selectedResult.filePath).folder && (
                <span className="text-xs text-gray-400 truncate ml-auto">
                  {getFileNameAndFolder(selectedResult.filePath).folder}
                </span>
              )}
            </div>

            {/* Context lines */}
            <div className="flex-1 min-h-0 overflow-auto mt-2">
              <pre className="text-xs font-mono leading-relaxed">
                {selectedResult.contextLines.map((line, idx) => (
                  <div
                    key={`${line.lineNumber}-${idx}`}
                    className={`flex ${
                      line.isMatch
                        ? "bg-yellow-100 border-l-2 border-yellow-400"
                        : ""
                    }`}
                  >
                    <span className="text-gray-400 select-none w-12 text-right pr-3 flex-shrink-0">
                      {line.lineNumber}
                    </span>
                    <span
                      className={`flex-1 whitespace-pre-wrap break-all ${
                        line.isMatch ? "text-gray-900" : "text-gray-600"
                      }`}
                    >
                      {line.isMatch
                        ? highlightMatch(line.content, query)
                        : line.content}
                    </span>
                  </div>
                ))}
              </pre>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            {query
              ? "Select a result to see context"
              : "Search results will appear here"}
          </div>
        )}
      </div>
    </div>
  );
}
