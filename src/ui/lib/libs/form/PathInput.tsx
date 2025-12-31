import { directoryHelpers } from "@/features/file-browser/directoryStore/directory";
import { getWindowElectron } from "@/getWindowElectron";
import { Button } from "@/lib/components/button";
import { FileSearchIcon, FolderIcon, Loader2Icon } from "lucide-react";
import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useDeferredValue,
} from "react";
import { createPortal } from "react-dom";
import { FileBrowserCache } from "@/features/file-browser/FileBrowserCache";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import Fuse from "fuse.js";

export function PathInput(props: React.ComponentProps<"input">) {
  const [value, setValue] = useState(props.value || "");
  const [rawCompletionItems, setRawCompletionItems] = useState<
    GetFilesAndFoldersInDirectoryItem[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoadingCompletions, setIsLoadingCompletions] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const completionListRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Defer the search query to prevent blocking the input
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Memoize the expensive fuzzy filtering
  const completionItems = useMemo(() => {
    if (rawCompletionItems.length === 0) return [];
    if (!deferredSearchQuery) return rawCompletionItems;

    const fuse = new Fuse(rawCompletionItems, {
      threshold: 0.6,
      minMatchCharLength: 1,
      keys: ["name"],
      shouldSort: true,
      isCaseSensitive: false,
      ignoreLocation: true,
      distance: 1000,
    });
    return fuse.search(deferredSearchQuery).map((r) => r.item);
  }, [rawCompletionItems, deferredSearchQuery]);

  useEffect(() => {
    // if (!props.value) {
    //   setValue(directoryHelpers.getOpenedPath(undefined) || "/");
    // }
  }, []);

  // Find the dialog element to portal into
  useEffect(() => {
    const dialogElement = containerRef.current?.closest("dialog");
    setPortalTarget(dialogElement || document.body);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isOutsideContainer =
        containerRef.current && !containerRef.current.contains(target);
      const isOutsideDropdown =
        completionListRef.current &&
        !completionListRef.current.contains(target);

      if (isOutsideContainer && isOutsideDropdown) {
        setRawCompletionItems([]);
        setSearchQuery("");
      }
    }

    if (completionItems.length > 0) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [completionItems.length]);

  async function pickFile() {
    const result = await getWindowElectron().openSelectAppWindow(
      directoryHelpers.getOpenedPath(undefined) || "/",
    );
    if (result) {
      setValue(result);
    }
  }

  async function loadCompletions(inputValue: string) {
    // Find the directory part (everything up to and including the last /)
    const lastSlashIndex = inputValue.lastIndexOf("/");
    if (lastSlashIndex === -1) {
      setRawCompletionItems([]);
      setSearchQuery("");
      return;
    }

    const directoryPath = inputValue.substring(0, lastSlashIndex + 1);
    const query = inputValue.substring(lastSlashIndex + 1);

    setIsLoadingCompletions(true);
    try {
      const result = await FileBrowserCache.load(directoryPath);
      if (result.success) {
        setRawCompletionItems(result.data);
        setSearchQuery(query);
        setSelectedIndex(0);
      } else {
        setRawCompletionItems([]);
        setSearchQuery("");
      }
    } catch (error) {
      setRawCompletionItems([]);
      setSearchQuery("");
    } finally {
      setIsLoadingCompletions(false);
    }
  }

  function handleInputChange(newValue: string) {
    setValue(newValue);
    props.onChange?.({
      target: { value: newValue },
    } as React.ChangeEvent<HTMLInputElement>);

    // Check if "/" was just typed or there's text after /
    if (newValue.endsWith("/") || newValue.includes("/")) {
      loadCompletions(newValue);
    } else {
      setRawCompletionItems([]);
      setSearchQuery("");
    }
  }

  function selectCompletion(item: GetFilesAndFoldersInDirectoryItem) {
    const stringValue = String(value);
    const lastSlashIndex = stringValue.lastIndexOf("/");
    const directoryPath = stringValue.substring(0, lastSlashIndex + 1);
    const isDirectory = item.type === "dir";
    const newValue = directoryPath + item.name + (isDirectory ? "/" : "");

    setValue(newValue);
    props.onChange?.({
      target: { value: newValue },
    } as React.ChangeEvent<HTMLInputElement>);

    if (isDirectory) {
      // Load completions for the new directory
      loadCompletions(newValue);
    } else {
      setRawCompletionItems([]);
      setSearchQuery("");
    }

    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (completionItems.length === 0) return;

    if (e.key === "Tab") {
      e.preventDefault();
      if (completionItems[selectedIndex]) {
        selectCompletion(completionItems[selectedIndex]);
      }
    } else if (e.key === "j" && e.ctrlKey) {
      e.preventDefault();
      setSelectedIndex((prev) =>
        Math.min(prev + 1, completionItems.length - 1),
      );
    } else if (e.key === "k" && e.ctrlKey) {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Escape") {
      setRawCompletionItems([]);
      setSearchQuery("");
    } else if (e.key === "Enter" && completionItems.length > 0) {
      e.preventDefault();
      if (completionItems[selectedIndex]) {
        selectCompletion(completionItems[selectedIndex]);
      }
    }
  }

  // Update dropdown position when completions change
  useEffect(() => {
    if (completionItems.length > 0 && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [completionItems.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (completionListRef.current && completionItems.length > 0) {
      const selectedElement = completionListRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndex, completionItems]);

  const dropdownContent =
    completionItems.length > 0 && dropdownPosition ? (
      <div
        ref={completionListRef}
        className="fixed bg-base-100 border border-gray-200 rounded shadow-lg max-h-64 overflow-y-auto"
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          width: `${dropdownPosition.width}px`,
          zIndex: 9999999,
        }}
      >
        {completionItems.map((item, index) => (
          <div
            key={item.name}
            data-index={index}
            className={`px-2 py-1 cursor-pointer hover:bg-base-content/10 flex items-center gap-1.5 ${
              index === selectedIndex ? "bg-base-content/10" : ""
            }`}
            onClick={() => selectCompletion(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {item.type === "dir" ? (
              <FolderIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
            ) : (
              <FileSearchIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
            )}
            <span className="text-[10px] truncate">{item.name}</span>
          </div>
        ))}
      </div>
    ) : null;

  return (
    <>
      <div className="flex gap-2 relative" ref={containerRef}>
        <div className="flex-1 relative">
          <input
            {...props}
            ref={inputRef}
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {isLoadingCompletions && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
              <Loader2Icon className="size-4 stroke-current" />
            </div>
          )}
        </div>
        <Button icon={FileSearchIcon} onClick={pickFile} type="button"></Button>
      </div>
      {dropdownContent &&
        portalTarget &&
        createPortal(dropdownContent, portalTarget)}
    </>
  );
}
