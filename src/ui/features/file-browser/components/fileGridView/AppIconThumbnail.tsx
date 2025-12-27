import { getWindowElectron } from "@/getWindowElectron";
import { useWhenViewed } from "@/lib/hooks/useWhenViewed";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { useState } from "react";

export function AppIconThumbnail({
  item,
  fullPath,
}: {
  item: GetFilesAndFoldersInDirectoryItem;
  fullPath: string;
}) {
  const [data, setData] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const ref = useWhenViewed(() => {
    getWindowElectron()
      .generateAppIcon(fullPath)
      .then(setData)
      .catch(() => {
        setError(true);
      });
  });

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      {data && !error ? (
        <img src={data} alt={item.name} className="w-16 h-16 object-contain" />
      ) : null}
    </div>
  );
}
