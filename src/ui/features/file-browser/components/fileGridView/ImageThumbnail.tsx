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
    <div className="w-full h-full flex items-center justify-center overflow-hidden bg-base-200">
      <img
        src={`file://${PathHelpers.expandHome(
          getWindowElectron().homeDirectory,
          fullPath,
        )}`}
        alt={item.name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
