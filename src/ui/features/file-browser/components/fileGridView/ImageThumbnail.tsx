import { getWindowElectron } from "@/getWindowElectron";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { PathHelpers } from "@common/PathHelpers";

export function ImageThumbnail({
  item,
  fullPath,
}: {
  item: GetFilesAndFoldersInDirectoryItem;
  fullPath: string;
}) {
  return (
    <div className="w-16 h-16 flex items-center justify-center overflow-hidden rounded bg-base-200">
      <img
        src={`file://${PathHelpers.expandHome(
          getWindowElectron().homeDirectory,
          fullPath,
        )}`}
        alt={item.name}
        className="max-w-full max-h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
