import { FileIcon, FolderIcon } from "lucide-react";
import { useRecents, type RecentItem } from "../hooks/useRecents";
import { useDirectory } from "../hooks/useDirectory";
import { FileBrowserSidebarSection } from "./FileBrowserSidebarSection";

interface RecentsListProps {
  recents: ReturnType<typeof useRecents>;
  d: ReturnType<typeof useDirectory>;
  className?: string;
}

export function RecentsList({ recents, d, className }: RecentsListProps) {
  const r = recents.recents;

  return (
    <FileBrowserSidebarSection
      items={r}
      header="Recents"
      emptyMessage="No recent directories"
      getKey={(recent) => recent.fullPath}
      isSelected={(recent) => d.directory.fullName === recent.fullPath}
      onClick={(recent) => {
        if (recent.type === "dir") {
          d.cdFull(recent.fullPath);
        } else {
          window.electron.openFile(recent.fullPath);
        }
      }}
      className={className}
      render={(recent) => (
        <>
          {recent.type === "dir" ? (
            <FolderIcon className="size-4 min-w-4 text-blue-500" />
          ) : (
            <FileIcon className="size-4 min-w-4 text-green-500" />
          )}
          <span className="truncate">{recentName(recent)}</span>
        </>
      )}
    />
  );
}

function recentName(recent: RecentItem) {
  return recent.fullPath.split("/").pop() || recent.fullPath;
}
