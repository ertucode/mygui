import { getWindowElectron } from '@/getWindowElectron'
import { captureDivAsBase64 } from '@/lib/functions/captureDiv'
import { directoryStore } from './directoryStore/directory'
import { DerivedDirectoryItem, DirectoryId, RealDirectoryItem } from './directoryStore/DirectoryBase'
import { getActiveDirectory, getBufferSelection, selectBuffer } from './directoryStore/directoryPureHelpers'
import { directoryHelpers } from './directoryStore/directoryHelpers'
import { perDirectoryDataHelpers } from './directoryStore/perDirectoryData'
import { fileDragDropHandlers, fileDragDropStore } from './fileDragDrop'

export function fileBrowserListItemProps({
  item: i,
  index,
  directoryId,
  onContextMenu,
}: {
  item: DerivedDirectoryItem
  index: number
  directoryId: DirectoryId
  onContextMenu: (e: React.MouseEvent, item: { item: DerivedDirectoryItem; index: number }) => void
}): React.HTMLAttributes<HTMLElement> | undefined {
  if (i.type === 'str') return undefined
  const item = i.item
  return {
    onClick: perDirectoryDataHelpers.getOnClick(directoryId, item, index),
    onMouseDown: e => {
      if (e.button !== 0) return

      const state = directoryStore.getSnapshot()
      const selection = getBufferSelection(state.context, getActiveDirectory(state.context, directoryId))
      const isItemSelected = selection.indexes.has(index)

      // If item is not selected, start drag-to-select mode
      if (!isItemSelected) {
        fileDragDropHandlers.startDragToSelect(index, directoryId, e.metaKey)
      }
    },
    onMouseEnter: () => {
      const dragState = fileDragDropStore.getSnapshot()

      // If we're in drag-to-select mode for this directory, update the selection
      if (dragState.context.isDragToSelect && dragState.context.dragToSelectDirectoryId === directoryId) {
        const startIdx = dragState.context.dragToSelectStartIdx!
        const currentIdx = index

        const state = directoryStore.getSnapshot()
        const directory = state.context.directoriesById[directoryId]
        const viewMode = directory?.viewMode ?? 'list'
        const withMetaKey = dragState.context.dragToSelectWithMetaKey

        // Create selection range from start to current
        const minIdx = Math.min(startIdx, currentIdx)
        const maxIdx = Math.max(startIdx, currentIdx)
        const newIndexes = new Set<number>()

        // If metaKey is pressed, use linear selection regardless of view mode
        if (viewMode === 'grid' && !withMetaKey) {
          // In grid mode, select items in a rectangular area
          // First, calculate columns per row
          const gridContainer = document.querySelector(`[data-list-id="${directoryId}"] > div`) as HTMLElement

          if (gridContainer) {
            const gridItems = gridContainer.querySelectorAll('[data-list-item]')
            let cols = 1

            if (gridItems.length >= 2) {
              const firstRect = (gridItems[0] as HTMLElement).getBoundingClientRect()
              const secondRect = (gridItems[1] as HTMLElement).getBoundingClientRect()

              // If second item is on same row, count columns
              if (Math.abs(firstRect.top - secondRect.top) < 10) {
                for (let i = 1; i < gridItems.length; i++) {
                  const itemRect = (gridItems[i] as HTMLElement).getBoundingClientRect()
                  if (Math.abs(itemRect.top - firstRect.top) < 10) {
                    cols++
                  } else {
                    break
                  }
                }
              }
            }

            // Calculate row and column for start and current
            const startRow = Math.floor(startIdx / cols)
            const startCol = startIdx % cols
            const currentRow = Math.floor(currentIdx / cols)
            const currentCol = currentIdx % cols

            const minRow = Math.min(startRow, currentRow)
            const maxRow = Math.max(startRow, currentRow)
            const minCol = Math.min(startCol, currentCol)
            const maxCol = Math.max(startCol, currentCol)

            // Select all items in the rectangular area
            const totalItems = directory.directoryData.length
            for (let row = minRow; row <= maxRow; row++) {
              for (let col = minCol; col <= maxCol; col++) {
                const idx = row * cols + col
                if (idx < totalItems) {
                  newIndexes.add(idx)
                }
              }
            }
          } else {
            // Fallback to linear selection if grid container not found
            for (let i = minIdx; i <= maxIdx; i++) {
              newIndexes.add(i)
            }
          }
        } else {
          // In list mode, select all items between start and current
          for (let i = minIdx; i <= maxIdx; i++) {
            newIndexes.add(i)
          }
        }

        directoryStore.send({
          type: 'setSelection',
          indexes: newIndexes,
          last: currentIdx,
          directoryId,
        })
      }
    },
    onMouseUp: () => {
      const dragState = fileDragDropStore.getSnapshot()
      if (dragState.context.isDragToSelect) {
        fileDragDropHandlers.endDragToSelect()
      }
    },
    onContextMenu: e => {
      e.preventDefault()
      directoryStore.trigger.selectManually({ index, directoryId })
      onContextMenu(e, { item: i, index })
    },
    onPointerDown: e => {
      if (item.type === 'dir') {
        directoryHelpers.preloadDirectory(item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId))
      }

      // Make element draggable only if it's selected or on cursor
      const state = directoryStore.getSnapshot()
      const buffer = selectBuffer(state.context, directoryId)
      if (!buffer) return
      const isItemSelected = buffer.selection.indexes.has(index)
      const isCursor = buffer.cursor.line === index

      const target = e.currentTarget as HTMLElement
      // Bunun amacı kaydırarak select yapabilmek
      target.draggable = isItemSelected || isCursor
    },
    onDragStart: async e => {
      const items = directoryHelpers.getSelectedItemsOrCurrentItem(index, directoryId) as RealDirectoryItem[]
      const isOutsideDrag = e.metaKey || e.ctrlKey || e.shiftKey

      if (isOutsideDrag) {
        // e.preventDefault çağırmayınca başka uygulamaya taşıma yapılamıyor.
        // e.preventDefault() çağırınca uygulama içinde taşıma yapılamıyor.
        // Şu anda dışarı drag sadece metaKeyle başlarsa ve bırakırken metaKey kapatılırsa çalışıyor.
        e.preventDefault()
      } else {
        e.dataTransfer.setData('application/x-mygui-file-drag', 'true')

        // Store dragged items data for favorites/other drop targets
        e.dataTransfer.setData(
          'application/x-mygui-drag-items',
          JSON.stringify(
            items.map(i => ({
              fullPath: directoryHelpers.getFullPathForItem(i.item, directoryId),
              type: i.item.type,
              name: i.item.name,
            }))
          )
        )
      }

      const filePaths = items.map(i => directoryHelpers.getFullPathForItem(i.item, directoryId))

      // Handle drag start
      await fileDragDropHandlers.handleRowDragStart(items, directoryId)

      const table = document.querySelector('[data-list-id="' + directoryId + '"]')
      if (!table) return

      // Start the native drag
      getWindowElectron().onDragStart({
        files: filePaths,
        image: await captureDivAsBase64(table as HTMLElement),
      })
    },
    onDragOver: e => {
      fileDragDropHandlers.handleRowDragOver(e, index, item.type === 'dir')
    },
    onDragLeave: e => {
      fileDragDropHandlers.handleRowDragLeave(e, item.type === 'dir')
    },
    onDrop: async e => {
      await fileDragDropHandlers.handleRowDrop(e, item, directoryId)
    },
    draggable: false,
  }
}
