import { getWindowElectron, homeDirectory } from '@/getWindowElectron'
import { mergeMaybeSlashed } from '@common/merge-maybe-slashed'
import { PathHelpers } from '@common/PathHelpers'
import { CachedWorker } from '@common/CachedWorker'

export const FileBrowserCache = new CachedWorker(
  (dir: string) => getWindowElectron().getFilesAndFoldersInDirectory(dir),
  (result, dir) => {
    if (result.success) {
      for (const i of result.data) {
        i.fullPath = PathHelpers.revertExpandedHome(homeDirectory, mergeMaybeSlashed(dir, i.name))
      }
    }
    return result
  },
  1000
)
