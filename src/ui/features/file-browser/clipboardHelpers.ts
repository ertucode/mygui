import { getWindowElectron } from '@/getWindowElectron'
import { toast } from '@/lib/components/toast'
import { dialogActions } from './dialogStore'
import { directoryHelpers } from './directoryStore/directoryHelpers'
import { directoryStore } from './directoryStore/directory'
import { type DirectoryId } from './directoryStore/DirectoryBase'
import { GenericError } from '@common/GenericError'
import type { GetFilesAndFoldersInDirectoryItem, ConflictResolution } from '@common/Contracts'
import { getActiveDirectory } from './directoryStore/directoryPureHelpers'
import { createStore } from '@xstate/store'

// Store for tracking clipboard state in the UI
type ClipboardState = {
  /** Full paths of items in clipboard */
  filePaths: Set<string>
  /** Whether items are cut (true) or copied (false) */
  isCut: boolean
}

export const clipboardStore = createStore({
  context: {
    filePaths: new Set<string>(),
    isCut: false,
  } as ClipboardState,
  on: {
    setClipboard: (_, event: { filePaths: Set<string>; isCut: boolean }) => ({
      filePaths: event.filePaths,
      isCut: event.isCut,
    }),
    clearClipboard: () => ({
      filePaths: new Set<string>(),
      isCut: false,
    }),
  },
})

/** Selector to check if a specific file path is in the clipboard */
export const selectIsInClipboard = (fullPath: string) => (state: { context: ClipboardState }) =>
  state.context.filePaths.has(fullPath)

/** Selector to get clipboard state for a file path */
export const selectClipboardState = (fullPath: string) => (state: { context: ClipboardState }) => {
  const isInClipboard = state.context.filePaths.has(fullPath)
  if (!isInClipboard) return null
  return { isCut: state.context.isCut }
}

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
    } else {
      // Update the clipboard store with the copied/cut items
      clipboardStore.send({ type: 'setClipboard', filePaths: new Set(paths), isCut: cut })
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
        dialogActions.open('createImage', {})
      }
      return
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
                // Clear clipboard state after successful paste (cut items are moved)
                if (clipboardStore.getSnapshot().context.isCut) {
                  clipboardStore.send({ type: 'clearClipboard' })
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
        // Clear clipboard state after successful paste (cut items are moved)
        if (clipboardStore.getSnapshot().context.isCut) {
          clipboardStore.send({ type: 'clearClipboard' })
        }
        await directoryHelpers.reload(context.directoryId)
      } else {
        toast.show(result)
      }
    }
  },
}
