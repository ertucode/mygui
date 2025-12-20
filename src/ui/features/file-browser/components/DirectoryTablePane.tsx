import { DirectoryContextProvider } from "../DirectoryContext";
import { FileBrowserTable } from "../FileBrowserTable";
import { DirectoryId } from "../directory";
import { FuzzyInput } from "./FileBrowserNavigationAndInputSection";

export function DirectoryTablePane({
  directoryId,
}: {
  directoryId: DirectoryId;
}) {
  return (
    <div className="relative flex flex-col min-h-0 min-w-0 h-full">
      <FuzzyInput directoryId={directoryId} />
      <DirectoryContextProvider directoryId={directoryId}>
        <FileBrowserTable />
      </DirectoryContextProvider>
    </div>
  );
}
