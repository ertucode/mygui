import { getWindowElectron } from "@/getWindowElectron";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { mergeMaybeSlashed } from "@common/merge-maybe-slashed";
import { PathHelpers } from "@common/PathHelpers";

export type FileBrowserCacheOperation =
  | {
      loading: true;
      promise: Promise<GetFilesAndFoldersInDirectoryItem[]>;
    }
  | {
      loading: false;
      loaded: GetFilesAndFoldersInDirectoryItem[];
    };

const h = getWindowElectron().homeDirectory;
export class FileBrowserCache {
  static cache = new Map<string, FileBrowserCacheOperation>();

  static load = async (dir: string) => {
    const cached = FileBrowserCache.cache.get(dir);
    if (cached) {
      if (!cached.loading) return cached.loaded;
      return cached.promise;
    }

    const promise = getWindowElectron()
      .getFilesAndFoldersInDirectory(dir)
      .then((items) => {
        FileBrowserCache.cache.set(dir, { loading: false, loaded: items });

        for (const i of items) {
          i.fullPath = PathHelpers.revertExpandedHome(
            h,
            mergeMaybeSlashed(dir, i.name),
          );
        }
        setTimeout(() => {
          FileBrowserCache.cache.delete(dir);
        }, 500);
        return items;
      });
    return promise;
  };
}
