import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { CategoryHelpers } from "../../CategoryHelpers";

export type BaseThumbnailProps = {
  item: GetFilesAndFoldersInDirectoryItem;
  fullPath: string;
};

export function BaseThumbnail({ item }: BaseThumbnailProps) {
  const IconComponent = CategoryHelpers.getIcon(item.category);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <IconComponent className="w-12 h-12 text-base-content/60" />
    </div>
  );
}
