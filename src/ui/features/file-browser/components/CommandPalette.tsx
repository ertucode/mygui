import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/lib/components/dialog";
import { DialogForItem } from "@/lib/hooks/useDialogForItem";
import { useDialogStoreDialog } from "../dialogStore";
import { shortcutRegistryAPI } from "@/lib/hooks/shortcutRegistry";
import { KeyboardIcon, Edit2Icon, XIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/lib/components/button";
import {
  ShortcutDefinition,
  isSequenceShortcut,
  useShortcuts,
} from "@/lib/hooks/useShortcuts";
import { clsx } from "@/lib/functions/clsx";
import Fuse from "fuse.js";
import {
  shortcutCustomizationHelpers,
  shortcutCustomizationStore,
} from "@/lib/hooks/shortcutCustomization";
import { useSelector } from "@xstate/store/react";

export const CommandPalette = forwardRef<DialogForItem<{}>, {}>(
  function CommandPalette(_props, ref) {
    const { dialogOpen, onClose } = useDialogStoreDialog<{}>(ref);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingLabel, setEditingLabel] = useState<string | null>(null);
    const [recordedKeys, setRecordedKeys] = useState<KeyboardEvent | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const customShortcuts = useSelector(
      shortcutCustomizationStore,
      (state) => state.context.customShortcuts,
    );

    const shortcuts = useMemo(() => {
      if (!dialogOpen) return [];
      return shortcutRegistryAPI.getAll();
    }, [dialogOpen]);

    const fuse = useMemo(() => {
      return new Fuse(shortcuts, {
        keys: ["label"],
        threshold: 0.4,
        ignoreLocation: true,
      });
    }, [shortcuts]);

    const filteredShortcuts = useMemo(() => {
      if (!searchQuery.trim()) {
        return shortcuts;
      }
      return fuse.search(searchQuery).map((result) => result.item);
    }, [searchQuery, shortcuts, fuse]);

    useShortcuts(
      [
        {
          key: [{ key: "ArrowDown" }, { key: "j", ctrlKey: true }],
          handler: (e) => {
            e?.preventDefault();
            setSelectedIndex((prev) =>
              prev + 1 === filteredShortcuts.length ? 0 : prev + 1,
            );
          },
          label: "",
          enabledIn: () => true,
        },
        {
          key: [{ key: "ArrowUp" }, { key: "k", ctrlKey: true }],
          handler: (e) => {
            e?.preventDefault();
            setSelectedIndex((prev) => {
              return prev - 1 === -1 ? filteredShortcuts.length - 1 : prev - 1;
            });
          },
          label: "",
          enabledIn: () => true,
        },
        {
          key: { key: "Enter" },
          handler: (e) => {
            e?.preventDefault();
            if (filteredShortcuts[selectedIndex]) {
              onClose();
              filteredShortcuts[selectedIndex].shortcut.handler(undefined);
            }
          },
          label: "",
          enabledIn: () => true,
        },
      ],
      { hideInPalette: true, isDisabled: !dialogOpen },
    );

    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const c = containerRef.current;
      if (!c) return;

      const item = c.querySelector(
        `.command-palette-item:nth-child(${selectedIndex + 1})`,
      ) as HTMLElement | null;
      if (!item) return;

      const containerRect = c.getBoundingClientRect();
      const rowRect = item.getBoundingClientRect();
      const isInView =
        rowRect.top >= containerRect.top &&
        rowRect.bottom <= containerRect.bottom;

      if (!isInView) {
        item.scrollIntoView({ block: "nearest" });
      }
    }, [selectedIndex]);

    useEffect(() => {
      if (dialogOpen) {
        setSearchQuery("");
        setSelectedIndex(0);
        setEditingLabel(null);
        setRecordedKeys(null);
        // Focus the search input when dialog opens
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 0);
      }
    }, [dialogOpen]);

    useEffect(() => {
      // Reset selected index when search results change
      setSelectedIndex(0);
    }, [searchQuery]);

    // Keyboard recording handler for editing shortcuts
    useEffect(() => {
      if (!editingLabel) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Ignore modifier-only keys
        if (["Control", "Meta", "Alt", "Shift"].includes(e.key)) return;
        
        setRecordedKeys(e);
      };

      window.addEventListener("keydown", handleKeyDown, true);
      return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [editingLabel]);

    const handleSaveShortcut = (label: string) => {
      if (!recordedKeys) return;

      const shortcut: ShortcutDefinition = {
        key: recordedKeys.key,
        metaKey: recordedKeys.metaKey || undefined,
        ctrlKey: recordedKeys.ctrlKey || undefined,
        altKey: recordedKeys.altKey || undefined,
        shiftKey: recordedKeys.shiftKey || undefined,
      };

      shortcutCustomizationHelpers.setCustomShortcut(label, shortcut);
      setEditingLabel(null);
      setRecordedKeys(null);
    };

    if (!dialogOpen) return null;

    return (
      <Dialog
        title={
          <div className="flex items-center gap-2">
            <KeyboardIcon className="w-5 h-5" />
            Keyboard Shortcuts
          </div>
        }
        onClose={onClose}
        className="max-w-2xl"
        footer={<Button onClick={onClose}>Close</Button>}
      >
        <div className="mb-4">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search shortcuts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="overflow-y-auto h-[60vh]" ref={containerRef}>
          <div className="space-y-1 min-h-full">
            {filteredShortcuts.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {searchQuery.trim()
                  ? "No shortcuts match your search"
                  : "No shortcuts registered"}
              </div>
            ) : (
              filteredShortcuts.map((shortcut, index) => {
                const isEditing = editingLabel === shortcut.label;
                const hasCustom =
                  shortcutCustomizationHelpers.hasCustomShortcut(
                    shortcut.label,
                  );
                const displayShortcut = hasCustom
                  ? customShortcuts[shortcut.label]
                  : isSequenceShortcut(shortcut.shortcut)
                    ? { sequence: shortcut.shortcut.sequence }
                    : shortcut.shortcut.key;

                return (
                  <div
                    key={shortcut.label}
                    className={clsx(
                      "flex items-center justify-between py-2 px-3 rounded hover:bg-gray-100 dark:hover:bg-gray-800 command-palette-item group",
                      index === selectedIndex ? "bg-base-content/10" : "",
                      !isEditing && "cursor-pointer",
                    )}
                    onClick={() => {
                      if (!isEditing) {
                        onClose();
                        shortcut.shortcut.handler(undefined);
                      }
                    }}
                  >
                    <span className="text-sm flex-1">{shortcut.label}</span>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <kbd className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 border border-blue-200 rounded dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700">
                            {recordedKeys
                              ? shortcutToString({
                                  key: recordedKeys.key,
                                  metaKey: recordedKeys.metaKey || undefined,
                                  ctrlKey: recordedKeys.ctrlKey || undefined,
                                  altKey: recordedKeys.altKey || undefined,
                                  shiftKey: recordedKeys.shiftKey || undefined,
                                })
                              : "Press a key..."}
                          </kbd>
                          <Button
                            onClick={() => handleSaveShortcut(shortcut.label)}
                            disabled={!recordedKeys}
                            className="text-xs px-2 py-1"
                          >
                            Save
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLabel(null);
                              setRecordedKeys(null);
                            }}
                            className="text-xs px-2 py-1"
                          >
                            <XIcon className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <div className="relative flex items-center gap-2 group">
                          {hasCustom && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                shortcutCustomizationHelpers.removeCustomShortcut(
                                  shortcut.label,
                                );
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                              title="Reset to default"
                            >
                              <RotateCcwIcon className="w-3 h-3 text-gray-500" />
                            </button>
                          )}
                          <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLabel(shortcut.label);
                              setRecordedKeys(null);
                            }}
                          >
                            <Edit2Icon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500" />
                            <kbd
                              className={clsx(
                                "px-2 py-1 text-xs font-semibold border rounded hover:opacity-80",
                                hasCustom
                                  ? "text-blue-800 bg-blue-100 border-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700"
                                  : "text-gray-800 bg-gray-100 border-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600",
                              )}
                            >
                              {typeof displayShortcut === "object" &&
                              "sequence" in displayShortcut
                                ? displayShortcut.sequence.join(" ")
                                : Array.isArray(displayShortcut)
                                  ? displayShortcut.map(shortcutToString).join(" or ")
                                  : shortcutToString(displayShortcut)}
                            </kbd>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Dialog>
    );
  },
);

function shortcutKeyString(key: string) {
  if (key === " ") return "Space";
  return key;
}

function shortcutToString(shortcut: ShortcutDefinition): string {
  if (typeof shortcut === "string") {
    return shortcutKeyString(shortcut);
  }

  const parts: string[] = [];
  if (shortcut.metaKey) parts.push("⌘");
  if (shortcut.ctrlKey) parts.push("Ctrl");
  if (shortcut.altKey) parts.push("Alt");
  if (shortcut.shiftKey) parts.push("Shift");
  parts.push(shortcutKeyString(shortcut.key));

  return parts.join("+");
}


