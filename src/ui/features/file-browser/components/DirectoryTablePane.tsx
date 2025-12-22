import { DirectoryContextProvider } from "../DirectoryContext";
import { DirectoryId } from "../directoryStore/DirectoryBase";
import { FileBrowserTable } from "../FileBrowserTable";
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
