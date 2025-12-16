import { DirectoryContextProvider } from "../DirectoryContext";
import { FileBrowserTable } from "../FileBrowserTable";
import { DirectoryId } from "../directory";
import { FileBrowserNavigationAndInputSection } from "./FileBrowserNavigationAndInputSection";

export function DirectoryTablePane({
  directoryId,
}: {
  directoryId: DirectoryId;
}) {
  return (
    <div className="relative flex flex-col min-h-0 min-w-0 h-full gap-1">
      <DirectoryContextProvider directoryId={directoryId}>
        <FileBrowserNavigationAndInputSection directoryId={directoryId} />
        <FileBrowserTable />
      </DirectoryContextProvider>
    </div>
  );
}
