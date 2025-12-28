import { getWindowElectron, homeDirectory } from "@/getWindowElectron";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { mergeMaybeSlashed } from "@common/merge-maybe-slashed";
import { PathHelpers } from "@common/PathHelpers";
import { GenericResult } from "@common/GenericError";

export type FileBrowserCacheOperation =
  | {
      loading: true;
      promise: Promise<GenericResult<GetFilesAndFoldersInDirectoryItem[]>>;
    }
  | {
      loading: false;
      loaded: GenericResult<GetFilesAndFoldersInDirectoryItem[]>;
    };

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
      .then((result) => {
        FileBrowserCache.cache.set(dir, { loading: false, loaded: result });

        if (result.success) {
          for (const i of result.data) {
            i.fullPath = PathHelpers.revertExpandedHome(
              homeDirectory,
              mergeMaybeSlashed(dir, i.name),
            );
          }
        }
        
        setTimeout(() => {
          FileBrowserCache.cache.delete(dir);
        }, 500);
        return result;
      });
    return promise;
  };
}
