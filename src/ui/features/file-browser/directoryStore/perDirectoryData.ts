import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { directoryStore } from "./directory";
import { DirectoryId } from "./DirectoryBase";
import { directoryHelpers } from "./directoryHelpers";
import { directorySelection } from "./directorySelection";
import { subscribeToStores } from "@/lib/functions/storeHelpers";

export type PerDirectoryData = {
  lastClick: { index: number; timestamp: number } | undefined;
};

// Non reactive data
export const perDirectoryData: Record<DirectoryId, PerDirectoryData> = {};

export const perDirectoryDataHelpers = {
  getOnClick: (
    directoryId: DirectoryId,
    item: GetFilesAndFoldersInDirectoryItem,
    index: number,
  ) => {
    return (e: React.MouseEvent) => {
      const now = Date.now();
      const dirData = perDirectoryData[directoryId];
      const lastClick = dirData.lastClick;

      if (
        lastClick &&
        lastClick.index === index &&
        now - lastClick.timestamp < 500
      ) {
        e.preventDefault();
        e.stopPropagation();
        directoryHelpers.openItem(item, directoryId);
        dirData.lastClick = undefined;
      } else {
        directorySelection.select(index, e, directoryId);
        directoryStore.trigger.setActiveDirectoryId({
          directoryId,
        });
        dirData.lastClick = {
          index: index,
          timestamp: now,
        };
      }
    };
  },
};

subscribeToStores(
  [directoryStore],
  ([s]) => [s.directoryOrder.length],
  ([s]) => {
    const directoryIds = s.directoryOrder;
    for (const directoryId of directoryIds) {
      if (!perDirectoryData[directoryId]) {
        perDirectoryData[directoryId] = {
          lastClick: undefined,
        };
      }
    }

    for (const oldDirs of Object.keys(perDirectoryData) as DirectoryId[]) {
      if (!directoryIds.includes(oldDirs)) {
        delete perDirectoryData[oldDirs];
      }
    }
  },
);
