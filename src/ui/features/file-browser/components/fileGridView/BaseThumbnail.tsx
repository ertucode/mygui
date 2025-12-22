import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { CategoryHelpers } from "../../CategoryHelpers";

export type BaseThumbnailProps = {
  item: GetFilesAndFoldersInDirectoryItem;
  fullPath: string;
};

export function BaseThumbnail({ item }: BaseThumbnailProps) {
  const IconComponent = CategoryHelpers.getIcon(item.category);

  return (
    <div className="w-16 h-16 flex items-center justify-center">
      <IconComponent className="w-10 h-10 text-base-content/60" />
    </div>
  );
}
