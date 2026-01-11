import { createStore } from '@xstate/store'
import { GetFilesAndFoldersInDirectoryItem } from '@common/Contracts'
import { directoryHelpers, directoryStore } from './directoryStore/directory'
import { clipboardHelpers } from './clipboardHelpers'
import { getWindowElectron } from '@/getWindowElectron'
import { toast } from '@/lib/components/toast'
import { DerivedDirectoryItem, DirectoryId, RealDirectoryItem } from './directoryStore/DirectoryBase'
import { useSelector } from '@xstate/store/react'
import { captureDivAsBase64 } from '@/lib/functions/captureDiv'

// Type for drag items (shared with components)
export type DragItem = {
  fullPath: string
  type: 'file' | 'dir'
  name: string
}

// Type for active in-app drag data
type ActiveDrag = {
  items: DragItem[]
  sourceDirectoryId: DirectoryId
} | null

// Store context for drag and drop state
type FileDragDropContext = {
  dragOverDirectoryId: DirectoryId | null
  dragOverRowIdx: number | null
  isDragToSelect: boolean
  dragToSelectStartIdx: number | null
  dragToSelectDirectoryId: DirectoryId | null
  dragToSelectWithMetaKey: boolean
  dragToSelectStartPosition: { x: number; y: number } | null
  // Track active drag for in-app drops (since native drag doesn't use dataTransfer)
  activeDrag: ActiveDrag
}

// Create the store
export const fileDragDropStore = createStore({
  context: {
    dragOverDirectoryId: null,
    dragOverRowIdx: null,
    isDragToSelect: false,
    dragToSelectStartIdx: null,
    dragToSelectDirectoryId: null,
    dragToSelectWithMetaKey: false,
    dragToSelectStartPosition: null,
    dragToSelectCurrentPosition: null,
    activeDrag: null,
  } as FileDragDropContext,
  on: {
    setDragOverDirectory: (context, event: { directoryId: DirectoryId | null }) => ({
      ...context,
      dragOverDirectoryId: event.directoryId,
    }),
    setDragOverRowIdx: (context, event: { value: number | null }) => ({
      ...context,
      dragOverRowIdx: event.value,
    }),
    startDragToSelect: (
      context,
      event: {
        startIdx: number
        directoryId: DirectoryId
        withMetaKey: boolean
        startPosition: { x: number; y: number }
      }
    ) => ({
      ...context,
      isDragToSelect: true,
      dragToSelectStartIdx: event.startIdx,
      dragToSelectDirectoryId: event.directoryId,
      dragToSelectWithMetaKey: event.withMetaKey,
      dragToSelectStartPosition: event.startPosition,
    }),
    endDragToSelect: context => ({
      ...context,
      isDragToSelect: false,
      dragToSelectStartIdx: null,
      dragToSelectDirectoryId: null,
      dragToSelectWithMetaKey: false,
      dragToSelectStartPosition: null,
    }),
    setActiveDrag: (context, event: { activeDrag: ActiveDrag }) => ({
      ...context,
      activeDrag: event.activeDrag,
    }),
    reset: () => ({
      dragOverDirectoryId: null,
      dragOverRowIdx: null,
      isDragToSelect: false,
      dragToSelectStartIdx: null,
      dragToSelectDirectoryId: null,
      dragToSelectWithMetaKey: false,
      dragToSelectStartPosition: null,
      activeDrag: null,
    }),
  },
})

// Selectors
export const selectIsDragOverDirectory = (directoryId: DirectoryId) => {
  const state = fileDragDropStore.getSnapshot()
  return state.context.dragOverDirectoryId === directoryId
}

export const selectDragOverRowIdx = () => {
  const state = fileDragDropStore.getSnapshot()
  return state.context.dragOverRowIdx
}

// Helper to check if there's an active file drag (either from dataTransfer or store)
const isFileDrag = (e: React.DragEvent): boolean => {
  // Check if this drag has our custom file drag marker (HTML5 drag)
  if (e.dataTransfer.types.includes('application/x-mygui-file-drag')) {
    return true
  }

  // For native drag, check if we have active drag in store AND the drag contains files
  // (Electron's native drag sets 'Files' type in dataTransfer)
  // This prevents false positives from other drag sources like flexlayout tabs
  const activeDrag = fileDragDropStore.getSnapshot().context.activeDrag
  if (activeDrag !== null && e.dataTransfer.types.includes('Files')) {
    return true
  }

  return false
}

// Global mouse up handler for drag-to-select
const handleGlobalMouseUp = () => {
  const dragState = fileDragDropStore.getSnapshot()
  if (dragState.context.isDragToSelect) {
    fileDragDropStore.send({ type: 'endDragToSelect' })
    document.body.removeEventListener('mouseup', handleGlobalMouseUp)
  }
}

// Handler functions
export const fileDragDropHandlers = {
  // Start drag-to-select mode
  startDragToSelect: (
    startIdx: number,
    directoryId: DirectoryId,
    withMetaKey: boolean = false,
    startPosition: { x: number; y: number }
  ) => {
    fileDragDropStore.send({
      type: 'startDragToSelect',
      startIdx,
      directoryId,
      withMetaKey,
      startPosition,
    })
    // Add global mouseup listener to handle release anywhere
    document.body.addEventListener('mouseup', handleGlobalMouseUp)
  },

  // End drag-to-select mode
  endDragToSelect: () => {
    fileDragDropStore.send({ type: 'endDragToSelect' })
    document.body.removeEventListener('mouseup', handleGlobalMouseUp)
  },

  // Start native drag - always uses Electron's native drag for outside-app compatibility
  // Also stores drag data in state for in-app drop handlers to use
  startNativeDrag: async (items: DragItem[], sourceDirectoryId: DirectoryId, e: React.DragEvent) => {
    // Store drag data in state for in-app drops (since native drag doesn't use dataTransfer)
    fileDragDropStore.send({
      type: 'setActiveDrag',
      activeDrag: { items, sourceDirectoryId },
    })

    // Create ghost element for Electron native drag
    const electronGhost = document.createElement('pre')
    electronGhost.className = 'drag-ghost'
    electronGhost.textContent = items.map(i => i.name).join('\n')

    const { rect, remove } = await captureDivAsBase64(electronGhost, e)
    electronGhost.remove()

    // Trigger Electron's native drag (works for outside-app drops)
    // e.preventDefault() is called in the component to enable this
    await getWindowElectron().onDragStart({
      files: items.map(i => i.fullPath),
      rect,
    })
    remove()
  },

  // Clear active drag (call on drag end)
  clearActiveDrag: () => {
    fileDragDropStore.send({
      type: 'setActiveDrag',
      activeDrag: null,
    })
  },

  // Get current active drag data (for in-app drop handlers)
  getActiveDrag: () => {
    return fileDragDropStore.getSnapshot().context.activeDrag
  },

  // Handle drag start on table rows (copies to clipboard for paste operations)
  handleRowDragStart: async (items: RealDirectoryItem[], directoryId: DirectoryId) => {
    // Copy files to clipboard (cut=true for move by default)
    // The cut mode can be changed to false (copy) if Alt is pressed during drop
    await clipboardHelpers.copy(
      items.map(i => i.item),
      true,
      directoryId
    )
  },

  // Handle drag over on the table container
  handleTableDragOver: (e: React.DragEvent, directoryId: DirectoryId) => {
    // Only handle file drags, ignore pane/tab drags
    if (!isFileDrag(e)) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    fileDragDropStore.send({ type: 'setDragOverDirectory', directoryId })

    // Set dropEffect based on Alt key
    if (e.altKey) {
      e.dataTransfer.dropEffect = 'copy'
    } else {
      e.dataTransfer.dropEffect = 'move'
    }
  },

  // Handle drag leave on the table container
  handleTableDragLeave: (e: React.DragEvent) => {
    // Only handle file drags, ignore pane/tab drags
    if (!isFileDrag(e)) {
      return
    }

    // Only clear if we're actually leaving the container, not just moving between children
    const rect = e.currentTarget.getBoundingClientRect()
    const isOutside =
      e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom

    if (isOutside) {
      fileDragDropStore.send({
        type: 'setDragOverDirectory',
        directoryId: null,
      })
    }
  },

  // Handle drop on the table container
  handleTableDrop: async (
    e: React.DragEvent,
    directoryId: DirectoryId,
    directoryType: 'path' | 'tags',
    directoryFullPath?: string
  ) => {
    // Only handle file drags, ignore pane/tab drags
    if (!isFileDrag(e)) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    fileDragDropStore.send({
      type: 'setDragOverDirectory',
      directoryId: null,
    })

    // Only allow drops in path directories, not in tags view
    if (directoryType !== 'path' || !directoryFullPath) {
      toast.show({
        message: 'Cannot drop files in tags view',
        severity: 'error',
      })
      return
    }

    const isCopy = e.altKey // Alt key means copy instead of move

    try {
      // If Alt key is pressed, change clipboard to copy mode instead of cut
      if (isCopy) {
        await getWindowElectron().setClipboardCutMode(false)
      }

      // The files should already be in clipboard from onDragStart
      // Use clipboardHelpers to handle the drop with conflict resolution
      await clipboardHelpers.paste(directoryId)

      // Activate the target directory
      directoryStore.send({
        type: 'setActiveDirectoryId',
        directoryId: directoryId,
      })

      // Reload all OTHER directory panes to reflect changes
      // The active directory will be reloaded by clipboardHelpers.paste
      const allDirectories = directoryStore.getSnapshot().context.directoryOrder
      for (const dirId of allDirectories) {
        if (dirId !== directoryId) {
          await directoryHelpers.reload(dirId)
        }
      }
    } catch (error) {
      toast.show({
        message: error instanceof Error ? error.message : 'Failed to drop files',
        severity: 'error',
      })
    }
  },

  // Handle drag over on rows
  // Always stops propagation and decides whether to highlight the folder row or the current directory
  handleRowDragOver: (e: React.DragEvent, idx: number, isFolder: boolean, directoryId: DirectoryId) => {
    // Only handle file drags, ignore pane/tab drags
    if (!isFileDrag(e)) {
      return
    }

    e.preventDefault()
    e.stopPropagation()

    // Always set the directory for preview purposes
    fileDragDropStore.send({ type: 'setDragOverDirectory', directoryId })

    // Check if we're over a no-drag-to-select element (like the file/folder name)
    const target = e.target as HTMLElement
    const isOnNoDragToSelect = target.closest('[data-no-drag-to-select]') !== null

    // If over a folder's no-drag-to-select zone, also highlight that folder row
    if (isFolder && isOnNoDragToSelect) {
      fileDragDropStore.send({ type: 'setDragOverRowIdx', value: idx })
    } else {
      // Otherwise, only highlight the directory (drop into current directory)
      fileDragDropStore.send({ type: 'setDragOverRowIdx', value: null })
    }

    // Set dropEffect based on Alt key
    e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move'
  },

  // Handle drag leave on rows
  // Note: Since handleRowDragOver now handles all cases, this just needs to handle
  // leaving the row entirely (going outside the table area)
  handleRowDragLeave: (e: React.DragEvent) => {
    // Only handle file drags, ignore pane/tab drags
    if (!isFileDrag(e)) {
      return
    }

    // Only clear if we're actually leaving the row entirely
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const isOutside =
      e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom

    if (isOutside) {
      fileDragDropStore.send({ type: 'setDragOverRowIdx', value: null })
    }
  },

  // Handle drop on rows
  // Drops into the folder if dragOverRowIdx is set (folder's no-drag-to-select zone), otherwise drops into current directory
  handleRowDrop: async (e: React.DragEvent, item: GetFilesAndFoldersInDirectoryItem, directoryId: DirectoryId) => {
    // Only handle file drags, ignore pane/tab drags
    if (!isFileDrag(e)) {
      return
    }

    e.preventDefault()
    e.stopPropagation()

    // Check if we should drop into folder based on the drag state (set by handleRowDragOver)
    const dragState = fileDragDropStore.getSnapshot().context
    const shouldDropIntoFolder = dragState.dragOverRowIdx !== null && item.type === 'dir'

    fileDragDropStore.send({ type: 'setDragOverRowIdx', value: null })
    fileDragDropStore.send({ type: 'setDragOverDirectory', directoryId: null })

    // Get directory info from store
    const directory = directoryStore.getSnapshot().context.directoriesById[directoryId]?.directory
    if (!directory) return

    if (shouldDropIntoFolder) {
      // Drop into the folder
      const targetDir = item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId)
      const isCopy = e.altKey

      try {
        // If Alt key is pressed, change clipboard to copy mode instead of cut
        if (isCopy) {
          await getWindowElectron().setClipboardCutMode(false)
        }

        // Navigate to the target folder first
        await directoryHelpers.cdFull(targetDir, directoryId)
        directoryStore.send({
          type: 'setActiveDirectoryId',
          directoryId: directoryId,
        })

        // Now paste into this directory using clipboardHelpers
        // This will handle conflicts and reload automatically
        await clipboardHelpers.paste(directoryId)

        // Reload all OTHER directory panes to reflect changes
        const allDirectories = directoryStore.getSnapshot().context.directoryOrder
        for (const dirId of allDirectories) {
          if (dirId !== directoryId) {
            await directoryHelpers.reload(dirId)
          }
        }
      } catch (error) {
        toast.show({
          message: error instanceof Error ? error.message : 'Failed to drop files',
          severity: 'error',
        })
      }
    } else {
      // Drop into the current directory (same logic as handleTableDrop)
      if (directory.type !== 'path') {
        toast.show({
          message: 'Cannot drop files in tags view',
          severity: 'error',
        })
        return
      }

      const isCopy = e.altKey

      try {
        if (isCopy) {
          await getWindowElectron().setClipboardCutMode(false)
        }

        await clipboardHelpers.paste(directoryId)

        directoryStore.send({
          type: 'setActiveDirectoryId',
          directoryId: directoryId,
        })

        const allDirectories = directoryStore.getSnapshot().context.directoryOrder
        for (const dirId of allDirectories) {
          if (dirId !== directoryId) {
            await directoryHelpers.reload(dirId)
          }
        }
      } catch (error) {
        toast.show({
          message: error instanceof Error ? error.message : 'Failed to drop files',
          severity: 'error',
        })
      }
    }
  },
}

export function useDragOverThisRow(item: DerivedDirectoryItem, index: number, directoryId: DirectoryId) {
  return useSelector(fileDragDropStore, s => {
    return (
      item.type === 'real' &&
      s.context.dragOverDirectoryId === directoryId &&
      s.context.dragOverRowIdx === index &&
      item.item.type === 'dir'
    )
  })
}
