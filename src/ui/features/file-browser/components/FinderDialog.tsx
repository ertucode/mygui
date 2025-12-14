import { useState, useEffect, forwardRef } from "react";
import { useShortcuts } from "@/lib/hooks/useShortcuts";
import { Dialog } from "@/lib/components/dialog";
import { FileIcon, SearchIcon, FolderIcon } from "lucide-react";
import { FileFinderTab } from "./FileFinderTab";
import { StringFinderTab } from "./StringFinderTab";
import { FolderFinderTab } from "./FolderFinderTab";
import { DialogForItem } from "@/lib/hooks/useDialogForItem";
import { useDialogStoreDialog } from "../dialogStore";

export type FinderTab = "files" | "folders" | "strings";

const MIN_WIDTH_FOR_PREVIEW = 900;

export const FinderDialog = forwardRef<
  DialogForItem<{ initialTab?: FinderTab }>,
  {}
>(function FinderDialog(_props, ref) {
  const { item, dialogOpen, onClose } = useDialogStoreDialog<{
    initialTab?: FinderTab;
  }>(ref);
  const [activeTab, setActiveTab] = useState<FinderTab>("files");
  const [showPreview, setShowPreview] = useState(
    window.innerWidth >= MIN_WIDTH_FOR_PREVIEW,
  );

  // Reset tab to initial when dialog opens
  useEffect(() => {
    if (dialogOpen && item) {
      setActiveTab(item.initialTab ?? "files");
    }
  }, [dialogOpen, item]);

  // Track window width for showing/hiding preview
  useEffect(() => {
    const handleResize = () => {
      setShowPreview(window.innerWidth >= MIN_WIDTH_FOR_PREVIEW);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleTabSwitch = () => {
    setActiveTab((prev) => {
      const idx = tabs.findIndex((t) => t.id === prev);
      const nextIdx = idx === tabs.length - 1 ? 0 : idx + 1;
      return tabs[nextIdx].id;
    });
  };

  const goPrevTab = () => {
    setActiveTab((prev) => {
      const idx = tabs.findIndex((t) => t.id === prev);
      const nextIdx = idx === 0 ? tabs.length - 1 : idx - 1;
      return tabs[nextIdx].id;
    });
  };

  // Handle keyboard shortcuts
  useShortcuts(
    [
      {
        key: "Tab",
        notKey: { key: "Tab", shiftKey: true },
        handler: (e) => {
          e.preventDefault();
          handleTabSwitch();
        },
        enabledIn: () => true,
      },
      {
        key: { key: "Tab", shiftKey: true },
        handler: (e) => {
          e.preventDefault();
          goPrevTab();
        },
        enabledIn: () => true,
      },
      {
        key: "Escape",
        handler: (e) => {
          e.preventDefault();
          onClose();
        },
        enabledIn: () => true,
      },
    ],
    { isDisabled: !dialogOpen },
  );

  if (!dialogOpen) return null;

  const tabs: { id: FinderTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "files",
      label: "Find File",
      icon: <FileIcon className="w-4 h-4" />,
    },
    {
      id: "folders",
      label: "Find Folder",
      icon: <FolderIcon className="w-4 h-4" />,
    },
    {
      id: "strings",
      label: "Search in Files",
      icon: <SearchIcon className="w-4 h-4" />,
    },
  ];

  return (
    <Dialog
      onClose={onClose}
      className="max-w-[90vw] w-full"
      style={{ height: "80vh" }}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Tab Bar */}
        <div role="tablist" className="tabs tabs-bordered mb-3 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              onClick={() => setActiveTab(tab.id)}
              className={`tab gap-2 ${activeTab === tab.id ? "tab-active" : ""}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center px-4 text-xs text-base-content/50">
            <kbd className="kbd kbd-sm">Tab</kbd>
            <span className="ml-1">to switch</span>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-visible">
          {activeTab === "files" && (
            <FileFinderTab
              isOpen={dialogOpen}
              onClose={onClose}
              showPreview={showPreview}
            />
          )}
          {activeTab === "folders" && (
            <FolderFinderTab
              isOpen={dialogOpen}
              onClose={onClose}
              showPreview={showPreview}
            />
          )}
          {activeTab === "strings" && (
            <StringFinderTab isOpen={dialogOpen} onClose={onClose} />
          )}
        </div>
      </div>
    </Dialog>
  );
});
