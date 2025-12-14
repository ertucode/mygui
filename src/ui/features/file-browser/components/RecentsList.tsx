import { FileIcon, FolderIcon } from "lucide-react";
import { useSelector } from "@xstate/store/react";
import { type RecentItem, recentsStore, selectRecents } from "../recents";
import { FileBrowserSidebarSection } from "./FileBrowserSidebarSection";
import { getWindowElectron } from "@/getWindowElectron";
import {
  directoryStore,
  directoryHelpers,
  selectDirectory,
} from "../directory";

interface RecentsListProps {
  className?: string;
}

export function RecentsList({ className }: RecentsListProps) {
  const r = useSelector(recentsStore, selectRecents);
  const activeDirectoryId = useSelector(
    directoryStore,
    (s) => s.context.activeDirectoryId,
  );
  const directory = useSelector(
    directoryStore,
    selectDirectory(activeDirectoryId),
  );

  return (
    <FileBrowserSidebarSection
      items={r}
      header="Recents"
      emptyMessage="No recent directories"
      getKey={(recent) => recent.fullPath}
      isSelected={(recent) =>
        directory.type === "path" && directory.fullPath === recent.fullPath
      }
      onClick={(recent) => {
        if (recent.type === "dir") {
          directoryHelpers.cdFull(recent.fullPath, activeDirectoryId);
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
