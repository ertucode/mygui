import { getWindowElectron } from "@/getWindowElectron";
import { useWhenViewed } from "@/lib/hooks/useWhenViewed";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { useState } from "react";

export function VideoThumbnail({
  item,
  fullPath,
}: {
  item: GetFilesAndFoldersInDirectoryItem;
  fullPath: string;
}) {
  const [data, setData] = useState<string | null>(null);

  const ref = useWhenViewed(() => {
    getWindowElectron().generateVideoThumbnail(fullPath).then(setData);
  });

  return (
    <div
      ref={ref}
      className="w-full h-full flex items-center justify-center overflow-hidden bg-base-200"
    >
      {data && (
        <img
          src={data}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}
