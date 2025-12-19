import { useSelector } from "@xstate/store/react";
import { directoryStore } from "../directory";
import { DirectoryContextProvider } from "../DirectoryContext";
import { FolderBreadcrumb } from "./FolderBreadcrumb";

export function BottomToolbar() {
  const activeDirectoryId = useSelector(
    directoryStore,
    (s) => s.context.activeDirectoryId,
  );

  if (!activeDirectoryId) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-10 bg-base-100 border-t border-base-300 flex items-center px-4">
        <div className="text-sm text-gray-500">No directory selected</div>
      </div>
    );
  }

  return (
    <div
      id="bottom-toolbar"
      className="fixed bottom-0 left-0 right-0 h-10 bg-base-100 border-t border-base-300 flex items-center px-4"
    >
      <DirectoryContextProvider directoryId={activeDirectoryId}>
        <div className="join flex-1 overflow-x-auto">
          <FolderBreadcrumb />
        </div>
      </DirectoryContextProvider>
    </div>
  );
}
