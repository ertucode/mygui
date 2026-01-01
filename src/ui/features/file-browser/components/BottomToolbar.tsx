import { useSelector } from "@xstate/store/react";
import { directoryStore } from "../directoryStore/directory";
import { DirectoryContextProvider } from "../DirectoryContext";
import { DirectoryId } from "../directoryStore/DirectoryBase";
import { FolderBreadcrumb } from "./FolderBreadcrumb";
import { FileBrowserOptionsSection } from "./FileBrowserOptionsSection";

export function BottomToolbar() {
  const activeDirectoryId = useSelector(
    directoryStore,
    (s) => s.context.activeDirectoryId,
  );

  if (!activeDirectoryId) {
    return (
      <div className="h-10 bg-base-100 border-t border-base-300 flex items-center px-4">
        <div className="text-sm text-gray-500">No directory selected</div>
      </div>
    );
  }

  return (
    <div
      id="bottom-toolbar"
      className="h-10 bg-base-100 border-t border-base-300 flex items-center px-4"
    >
      <DirectoryContextProvider directoryId={activeDirectoryId}>
        <div className="join flex-1 overflow-x-auto">
          <FolderBreadcrumb />
        </div>
      </DirectoryContextProvider>
      <div className="ml-auto flex items-center gap-2">
        <VimStatus activeDirectoryId={activeDirectoryId} />
        <FileBrowserOptionsSection />
      </div>
    </div>
  );
}

function VimStatus({ activeDirectoryId }: { activeDirectoryId: string }) {
  const vimState = useSelector(
    directoryStore,
    (s) => s.context.directoriesById[activeDirectoryId as DirectoryId]?.vimState,
  );

  if (!vimState) return null;

  const isInsert = vimState.mode === "insert";
  const isDirty = vimState.currentBuffer.historyStack.hasPrev;

  return (
    <div className="flex items-center gap-2 mr-2 text-xs font-mono">
      {isDirty && <span className="text-yellow-500">[+]</span>}
      <span
        className={
          isInsert ? "text-primary font-bold" : "text-base-content/70"
        }
      >
        {isInsert ? "-- INSERT --" : "NORMAL"}
      </span>
    </div>
  );
}
