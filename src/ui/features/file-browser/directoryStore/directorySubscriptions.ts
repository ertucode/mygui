import {
  subscribeToStores,
  createUseDerivedStoreValue,
} from "@/lib/functions/storeHelpers";
import { scrollRowIntoViewIfNeeded } from "@/lib/libs/table/globalTableScroll";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { directoryHelpers } from "./directoryHelpers";
import { fileBrowserSettingsStore } from "../settings";
import { DirectoryDataFromSettings } from "../utils/DirectoryDataFromSettings";
import Fuse from "fuse.js";
import { directoryStore } from "./directory";
import { DirectoryId } from "./DirectoryBase";
import { directorySelection } from "./directorySelection";

export const directorySubscriptions = new Map<DirectoryId, (() => void)[]>();

export const directoryDerivedStores = new Map<
  DirectoryId,
  {
    useFilteredDirectoryData: () => GetFilesAndFoldersInDirectoryItem[];
    getFilteredDirectoryData: () =>
      | GetFilesAndFoldersInDirectoryItem[]
      | undefined;
  }
>();

function computeFilteredData(
  directoryData: GetFilesAndFoldersInDirectoryItem[],
  query: string,
): GetFilesAndFoldersInDirectoryItem[] {
  if (!query) return directoryData;

  const fuse = new Fuse(directoryData, {
    threshold: 0.3,
    minMatchCharLength: 1,
    keys: ["name"],
    shouldSort: true,
    isCaseSensitive: false,
  });

  const results = fuse.search(query);
  return results.map((result) => result.item);
}

export function setupSubscriptions(directoryId: DirectoryId) {
  const subscriptions: (() => void)[] = [];
  directorySubscriptions.set(directoryId, subscriptions);
  subscriptions.push(
    subscribeToStores(
      [directoryStore],
      ([s]) => [s.directoriesById[directoryId]?.directoryData],
      (_) => {
        directorySelection.resetSelection(directoryId);
      },
    ),
  );

  subscriptions.push(
    subscribeToStores(
      [directoryStore],
      ([s]) => [s.directoriesById[directoryId]?.selection.last],
      ([s]) => {
        const ss = s.directoriesById[directoryId];
        if (!ss) return;
        if (ss.selection.last != null) {
          scrollRowIntoViewIfNeeded(ss.directoryId, ss.selection.last);
        }
      },
    ),
  );

  const [useFilteredDirectoryData, getFilteredDirectoryData] =
    createUseDerivedStoreValue(
      [directoryStore, fileBrowserSettingsStore],
      ([d, settings]) => [
        d.directoriesById[directoryId]?.directoryData,
        settings.settings,
        d.directoriesById[directoryId]?.fuzzyQuery,
      ],
      ([d, settings]) => {
        const directoryData = DirectoryDataFromSettings.getDirectoryData(
          d.directoriesById[directoryId]?.directoryData,
          settings.settings,
        );
        const filteredDirectoryData = computeFilteredData(
          directoryData,
          d.directoriesById[directoryId]?.fuzzyQuery,
        );

        return filteredDirectoryData;
      },
    );

  directoryDerivedStores.set(directoryId, {
    useFilteredDirectoryData,
    getFilteredDirectoryData,
  });

  // DO NOT MOVE THIS FUNCTION, Terrible code!!!
  subscriptions.push(
    subscribeToStores(
      [directoryStore, fileBrowserSettingsStore],
      ([d, settings]) => [
        d.directoriesById[directoryId]?.pendingSelection,
        settings.settings,
      ],
      ([d]) => {
        const filteredDirectoryData = getFilteredDirectoryData();
        if (!filteredDirectoryData) return;
        const s = d.directoriesById[directoryId];
        if (s.pendingSelection && filteredDirectoryData.length > 0) {
          const newItemIndex = filteredDirectoryData.findIndex(
            (item) => item.name === s.pendingSelection,
          );
          if (newItemIndex !== -1) {
            directorySelection.selectManually(newItemIndex, directoryId);
            scrollRowIntoViewIfNeeded(s.directoryId, newItemIndex, "center");
          }
          directoryHelpers.setPendingSelection(null, directoryId);
        }
      },
    ),
  );

  return subscriptions;
}

export const unsubscribeDirectorySubscriptions = (directoryId: DirectoryId) => {
  const subscriptions = directorySubscriptions.get(directoryId);
  if (!subscriptions) return;
  subscriptions.forEach((unsubscribe) => unsubscribe());
  directorySubscriptions.delete(directoryId);
};
