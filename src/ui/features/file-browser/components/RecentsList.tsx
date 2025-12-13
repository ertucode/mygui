import { FileIcon, FolderIcon } from "lucide-react";
import { useSelector } from "@xstate/store/react";
import { type RecentItem, recentsStore, selectRecents } from "../recents";
import { useDirectory } from "../hooks/useDirectory";
import { FileBrowserSidebarSection } from "./FileBrowserSidebarSection";
import { getWindowElectron } from "@/getWindowElectron";

interface RecentsListProps {
  d: ReturnType<typeof useDirectory>;
  className?: string;
}

export function RecentsList({ d, className }: RecentsListProps) {
  const r = useSelector(recentsStore, selectRecents);

  return (
    <FileBrowserSidebarSection
      items={r}
      header="Recents"
      emptyMessage="No recent directories"
      getKey={(recent) => recent.fullPath}
      isSelected={(recent) => d.directory.type === "path" && d.directory.fullPath === recent.fullPath}
      onClick={(recent) => {
        if (recent.type === "dir") {
          d.cdFull(recent.fullPath);
        } else {
          getWindowElectron().openFile(recent.fullPath);
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
