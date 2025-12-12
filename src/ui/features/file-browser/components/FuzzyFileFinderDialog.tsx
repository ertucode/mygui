import { useState, useEffect } from "react";
import { useShortcuts } from "@/lib/hooks/useShortcuts";
import { Dialog } from "@/lib/components/dialog";
import { FileIcon, SearchIcon } from "lucide-react";
import { useDirectory } from "../hooks/useDirectory";
import { FileFinderTab } from "./FileFinderTab";
import { StringFinderTab } from "./StringFinderTab";

export type FinderTab = "files" | "strings";

type FuzzyFileFinderDialogProps = {
  directory: ReturnType<typeof useDirectory>;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  initialTab?: FinderTab;
};

const MIN_WIDTH_FOR_PREVIEW = 900;

export function FuzzyFileFinderDialog({
  directory,
  isOpen,
  setIsOpen,
  initialTab = "files",
}: FuzzyFileFinderDialogProps) {
  const [activeTab, setActiveTab] = useState<FinderTab>(initialTab);
  const [showPreview, setShowPreview] = useState(
    window.innerWidth >= MIN_WIDTH_FOR_PREVIEW,
  );

  // Reset tab to initial when dialog opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Track window width for showing/hiding preview
  useEffect(() => {
    const handleResize = () => {
      setShowPreview(window.innerWidth >= MIN_WIDTH_FOR_PREVIEW);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const onClose = () => {
    setIsOpen(false);
  };

  const handleTabSwitch = () => {
    setActiveTab((prev) => (prev === "files" ? "strings" : "files"));
  };

  // Handle keyboard shortcuts
  useShortcuts(
    [
      {
        key: "Tab",
        handler: (e) => {
          e.preventDefault();
          handleTabSwitch();
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
    { isDisabled: !isOpen },
  );

  if (!isOpen) return null;

  const tabs: { id: FinderTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "files",
      label: "Find File",
      icon: <FileIcon className="w-4 h-4" />,
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
          {activeTab === "files" ? (
            <FileFinderTab
              directory={directory}
              isOpen={isOpen}
              onClose={onClose}
              showPreview={showPreview}
            />
          ) : (
            <StringFinderTab
              directory={directory}
              isOpen={isOpen}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
}
