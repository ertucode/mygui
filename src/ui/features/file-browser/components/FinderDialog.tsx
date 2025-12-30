import { useState, useEffect, forwardRef, ReactNode } from "react";
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

  // Handle keyboard shortcuts
  useShortcuts(
    [
      {
        key: { key: "1", metaKey: true },
        handler: (e) => {
          e?.preventDefault();
          setActiveTab("files");
        },
        enabledIn: () => true,
        label: "Switch to Find File tab",
      },
      {
        key: { key: "2", metaKey: true },
        handler: (e) => {
          e?.preventDefault();
          setActiveTab("folders");
        },
        enabledIn: () => true,
        label: "Switch to Find Folder tab",
      },
      {
        key: { key: "3", metaKey: true },
        handler: (e) => {
          e?.preventDefault();
          setActiveTab("strings");
        },
        enabledIn: () => true,
        label: "Switch to Search in Files tab",
      },
      {
        key: "Escape",
        handler: (e) => {
          e?.preventDefault();
          onClose();
        },
        enabledIn: () => true,
        label: "Close finder dialog",
      },
    ],
    { isDisabled: !dialogOpen },
  );

  if (!dialogOpen) return null;

  const tabs: {
    id: FinderTab;
    label: React.ReactNode;
    icon: React.ReactNode;
    keys: string;
  }[] = [
    {
      id: "files",
      label: "Find File",
      icon: <FileIcon className="w-4 h-4" />,
      keys: "⌘ 1",
    },
    {
      id: "folders",
      label: "Find Folder",
      icon: <FolderIcon className="w-4 h-4" />,
      keys: "⌘ 2",
    },
    {
      id: "strings",
      label: "Search in Files",
      icon: <SearchIcon className="w-4 h-4" />,
      keys: "⌘ 3",
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
              <TabLabel label={tab.label} keys={tab.keys} icon={tab.icon} />
            </button>
          ))}
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

function TabLabel(opts: { label: ReactNode; keys: string; icon: ReactNode }) {
  return (
    <>
      {opts.icon}
      {opts.label}
      <kbd className="kbd kbd-xs rounded-1 opacity-70">{opts.keys}</kbd>
    </>
  );
}
