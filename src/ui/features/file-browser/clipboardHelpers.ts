import { getWindowElectron } from '@/getWindowElectron'
import { toast } from '@/lib/components/toast'
import { dialogActions } from './dialogStore'
import { directoryHelpers } from './directoryStore/directoryHelpers'
import { directoryStore } from './directoryStore/directory'
import { getActiveDirectory, type DirectoryId } from './directoryStore/DirectoryBase'
import { GenericError } from '@common/GenericError'
import type { GetFilesAndFoldersInDirectoryItem, ConflictResolution } from '@common/Contracts'

export const clipboardHelpers = {
  copy: async (
    items: GetFilesAndFoldersInDirectoryItem[],
    cut: boolean = false,
    directoryId: DirectoryId | undefined
  ) => {
    const paths = items.map(item => item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId))
    const result = await getWindowElectron().copyFiles(paths, cut)
    if (!result.success) {
      toast.show(result)
    }
  },

  paste: async (directoryId: DirectoryId | undefined) => {
    const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)

    if (context.directory.type !== 'path') {
      toast.show(GenericError.Message('Cannot paste in tags view'))
      return
    }

    const directoryPath = context.directory.fullPath

    // First call without resolution to check for conflicts
    const checkResult = await getWindowElectron().pasteFiles(directoryPath)
    
    // Handle custom paste for image
    if ('customPaste' in checkResult) {
      if (checkResult.customPaste === 'image') {
        dialogActions.open('createImage', {});
      }
      return;
    }

    if (checkResult.needsResolution) {
      // Show conflict dialog
      return new Promise<void>(resolve => {
        dialogActions.open('pasteConflict', {
          conflictData: checkResult.conflictData,
          destinationDir: directoryPath,
          onResolve: async (resolution: ConflictResolution) => {
            // Execute paste with resolutions
            const result = await getWindowElectron().pasteFiles(directoryPath, resolution)

            if ('customPaste' in result) {
              // Shouldn't happen when resolving, but handle it
              dialogActions.close()
              resolve()
              return
            }

            if (!result.needsResolution) {
              if (result.result.success) {
                // Select first pasted item
                if (result.result.data?.pastedItems && result.result.data.pastedItems.length > 0) {
                  directoryHelpers.setPendingSelection(result.result.data.pastedItems[0], directoryId)
                }
                await directoryHelpers.reload(context.directoryId)
              } else {
                toast.show(result.result)
              }
            }
            dialogActions.close()
            resolve()
          },
          onCancel: () => {
            dialogActions.close()
            resolve()
          },
        })
      })
    } else {
      // No conflicts, paste executed successfully or failed
      const result = checkResult.result
      if (result.success) {
        if (result.data?.pastedItems && result.data.pastedItems.length > 0) {
          directoryHelpers.setPendingSelection(result.data.pastedItems[0], directoryId)
        }
        await directoryHelpers.reload(context.directoryId)
      } else {
        toast.show(result)
      }
    }
  },
}
