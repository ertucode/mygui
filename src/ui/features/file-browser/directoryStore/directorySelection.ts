import { SequenceShortcut, ShortcutWithHandler } from '@/lib/hooks/useShortcuts'
import { createResetSelection, directoryStore } from './directory'
import { DirectoryId } from './DirectoryBase'
import { getActiveDirectory, getBufferSelection, getFullPathForBuffer, selectBuffer } from './directoryPureHelpers'
import { directoryDerivedStores } from './directorySubscriptions'
import { throttle } from '@common/throttle'

export const directorySelection = {
  // Selection helpers
  select: (
    index: number,
    event: React.MouseEvent | KeyboardEvent | undefined,
    _directoryId: DirectoryId | undefined
  ) => {
    const snapshot = directoryStore.getSnapshot()
    const state = getActiveDirectory(snapshot.context, _directoryId)
    const directoryId = state.directoryId
    const filteredData = directoryDerivedStores.get(state.directoryId)!.getFilteredDirectoryData()!
    index = index < 0 ? filteredData.length + index : index
    const selection = getBufferSelection(snapshot.context, state)

    // Helper to remove item from set
    const removeFromSet = (set: Set<number>, item: number) => {
      const newSet = new Set(set)
      newSet.delete(item)
      return newSet
    }

    const isShiftEvent = event && event.shiftKey && (!('key' in event) || (event.key !== 'G' && event.key !== 'g'))
    if (isShiftEvent && selection.last != null) {
      const lastSelected = selection.last
      const indexes = new Set(selection.indexes)

      if (lastSelected > index) {
        let allSelected = true
        for (let i = lastSelected - 1; i >= index; i--) {
          if (!indexes.has(i)) {
            allSelected = false
            break
          }
        }

        if (allSelected) {
          for (let i = lastSelected - 1; i >= index; i--) {
            indexes.delete(i)
          }
        } else {
          for (let i = lastSelected - 1; i >= index; i--) {
            indexes.add(i)
          }
        }
      } else {
        let allSelected = true
        for (let i = lastSelected + 1; i <= index; i++) {
          if (!indexes.has(i)) {
            allSelected = false
            break
          }
        }

        if (allSelected) {
          for (let i = lastSelected + 1; i <= index; i++) {
            indexes.delete(i)
          }
        } else {
          for (let i = lastSelected + 1; i <= index; i++) {
            indexes.add(i)
          }
        }
      }

      directoryStore.send({
        type: 'setSelection',
        indexes,
        last: index,
        directoryId,
      })
      return
    }

    const isCtrlEvent = event && event.metaKey
    if (isCtrlEvent) {
      if (selection.indexes.has(index)) {
        directoryStore.send({
          type: 'setSelection',
          indexes: removeFromSet(selection.indexes, index),
          last: index,
          directoryId,
        })
        return
      }
      directoryStore.send({
        type: 'setSelection',
        indexes: new Set([...selection.indexes, index]),
        last: index,
        directoryId,
      })
      return
    }

    directoryStore.send({
      type: 'setSelection',
      indexes: new Set([index]),
      last: index,
      directoryId,
    })
  },

  getSelectionShortcuts: (): ShortcutWithHandler[] => {
    // Helper function to get current cursor position
    const getCursorPosition = () => {
      const snapshot = directoryStore.getSnapshot()
      const state = getActiveDirectory(snapshot.context, undefined)
      const selection = getBufferSelection(snapshot.context, state)
      const fullPath = getFullPathForBuffer(state.directory)
      const vimBuffer = fullPath ? snapshot.context.vim.buffers[fullPath] : undefined
      return {
        state,
        selection,
        cursorLine: vimBuffer?.cursor.line ?? selection.last ?? 0,
        filteredData: directoryDerivedStores.get(state.directoryId)!.getFilteredDirectoryData()!,
      }
    }

    // Helper function to move cursor and optionally modify selection
    const moveCursor = (
      offset: number,
      mode: 'replace' | 'add' | 'toggle' | 'remove',
      e?: KeyboardEvent | React.KeyboardEvent
    ) => {
      const { state, selection, cursorLine, filteredData } = getCursorPosition()
      const count = filteredData.length

      let targetIndex = cursorLine + offset
      // Wrap around
      if (targetIndex < 0) targetIndex = count - 1
      if (targetIndex >= count) targetIndex = 0

      const indexes = new Set(selection.indexes)

      if (mode === 'replace') {
        // Clear selection and select only target
        indexes.clear()
        indexes.add(targetIndex)
      } else if (mode === 'add') {
        // Add current item to selection first, then add target
        indexes.add(cursorLine)
        indexes.add(targetIndex)
      } else if (mode === 'toggle') {
        // Toggle target in selection
        if (indexes.has(targetIndex)) {
          indexes.delete(targetIndex)
        } else {
          indexes.add(targetIndex)
        }
      } else if (mode === 'remove') {
        // Remove current item from selection first, then remove target
        indexes.delete(cursorLine)
        indexes.delete(targetIndex)
      }

      directoryStore.send({
        type: 'setSelection',
        indexes,
        last: targetIndex,
        directoryId: state.directoryId,
      })
      e?.preventDefault()
    }

    // Helper function to calculate columns in grid view
    const getColumnsPerRow = (): number => {
      const context = getActiveDirectory(directoryStore.getSnapshot().context, undefined)
      if (context.viewMode !== 'grid') return 1

      const gridContainer = document.querySelector(`[data-list-id="${context.directoryId}"] > div`) as HTMLElement
      if (!gridContainer) return 1

      const gridItems = gridContainer.querySelectorAll('[data-list-item]')
      if (gridItems.length < 2) return 1

      const firstItem = gridItems[0] as HTMLElement
      const secondItem = gridItems[1] as HTMLElement
      const firstRect = firstItem.getBoundingClientRect()
      const secondRect = secondItem.getBoundingClientRect()

      if (Math.abs(firstRect.top - secondRect.top) < 10) {
        let cols = 1
        for (let i = 1; i < gridItems.length; i++) {
          const itemRect = (gridItems[i] as HTMLElement).getBoundingClientRect()
          if (Math.abs(itemRect.top - firstRect.top) < 10) {
            cols++
          } else {
            break
          }
        }
        return cols
      }

      return 1
    }

    const THROTTLE_DELAY = 0

    return [
      // Cmd+A: Select all
      {
        key: [{ key: 'a', metaKey: true }],
        handler: e => {
          const { state, filteredData } = getCursorPosition()
          directoryStore.send({
            type: 'setSelection',
            indexes: new Set(Array.from({ length: filteredData.length }).map((_, i) => i)),
            last: filteredData.length - 1,
            directoryId: state.directoryId,
          })
          e?.preventDefault()
        },
        label: 'Select all items',
      },

      // Shift+Space: Toggle current item
      {
        key: { key: ' ', shiftKey: true },
        handler: e => moveCursor(0, 'toggle', e),
        label: 'Toggle selection of current item',
      },

      // Space: Set selection to current item only
      {
        key: { key: ' ' },
        handler: e => moveCursor(0, 'replace', e),
        label: 'Select only current item',
      },

      // J/ArrowDown: Move down (replace selection)
      {
        key: ['j', 'ArrowDown'],
        handler: throttle(e => {
          const cols = getColumnsPerRow()
          const snapshot = directoryStore.getSnapshot()
          const state = getActiveDirectory(snapshot.context, undefined)
          const offset = state.viewMode === 'grid' ? cols : 1
          moveCursor(offset, 'replace', e)
        }, THROTTLE_DELAY),
        label: 'Move down',
      },

      // K/ArrowUp: Move up (replace selection)
      {
        key: ['k', 'ArrowUp'],
        handler: throttle(e => {
          const cols = getColumnsPerRow()
          const snapshot = directoryStore.getSnapshot()
          const state = getActiveDirectory(snapshot.context, undefined)
          const offset = state.viewMode === 'grid' ? cols : 1
          moveCursor(-offset, 'replace', e)
        }, THROTTLE_DELAY),
        label: 'Move up',
      },

      // J/Shift+ArrowDown: Move down and add to selection
      {
        key: [
          { key: 'J', shiftKey: true },
          { key: 'ArrowDown', shiftKey: true },
        ],
        handler: throttle(e => {
          const cols = getColumnsPerRow()
          const snapshot = directoryStore.getSnapshot()
          const state = getActiveDirectory(snapshot.context, undefined)
          const offset = state.viewMode === 'grid' ? cols : 1
          moveCursor(offset, 'add', e)
        }, THROTTLE_DELAY),
        label: 'Move down and add to selection',
      },

      // K/Shift+ArrowUp: Move up and add to selection
      {
        key: [
          { key: 'K', shiftKey: true },
          { key: 'ArrowUp', shiftKey: true },
        ],
        handler: throttle(e => {
          const cols = getColumnsPerRow()
          const snapshot = directoryStore.getSnapshot()
          const state = getActiveDirectory(snapshot.context, undefined)
          const offset = state.viewMode === 'grid' ? cols : 1
          moveCursor(-offset, 'add', e)
        }, THROTTLE_DELAY),
        label: 'Move up and add to selection',
      },

      // h/ArrowLeft: Move left in grid, jump up 10 in list
      {
        key: ['h', 'ArrowLeft'],
        handler: throttle(e => {
          const snapshot = directoryStore.getSnapshot()
          const state = getActiveDirectory(snapshot.context, undefined)
          const offset = state.viewMode === 'grid' ? -1 : -10
          moveCursor(offset, 'replace', e)
        }, THROTTLE_DELAY),
        label: 'Move left or jump up',
      },

      // l/ArrowRight: Move right in grid, jump down 10 in list
      {
        key: ['l', 'ArrowRight'],
        handler: throttle(e => {
          const snapshot = directoryStore.getSnapshot()
          const state = getActiveDirectory(snapshot.context, undefined)
          const offset = state.viewMode === 'grid' ? 1 : 10
          moveCursor(offset, 'replace', e)
        }, THROTTLE_DELAY),
        label: 'Move right or jump down',
      },

      // H/Shift+ArrowLeft: Move left and add in grid, jump up 10 and add in list
      {
        key: [
          { key: 'H', shiftKey: true },
          { key: 'ArrowLeft', shiftKey: true },
        ],
        handler: throttle(e => {
          const snapshot = directoryStore.getSnapshot()
          const state = getActiveDirectory(snapshot.context, undefined)
          const offset = state.viewMode === 'grid' ? -1 : -10
          moveCursor(offset, 'add', e)
        }, THROTTLE_DELAY),
        label: 'Move left and add to selection',
      },

      // L/Shift+ArrowRight: Move right and add in grid, jump down 10 and add in list
      {
        key: [
          { key: 'L', shiftKey: true },
          { key: 'ArrowRight', shiftKey: true },
        ],
        handler: throttle(e => {
          const snapshot = directoryStore.getSnapshot()
          const state = getActiveDirectory(snapshot.context, undefined)
          const offset = state.viewMode === 'grid' ? 1 : 10
          moveCursor(offset, 'add', e)
        }, THROTTLE_DELAY),
        label: 'Move right and add to selection',
      },

      // Ctrl+J/Cmd+ArrowDown: Move down and remove from selection
      {
        key: [
          { key: 'j', ctrlKey: true },
          { key: 'ArrowDown', metaKey: true },
        ],
        handler: throttle(e => {
          const cols = getColumnsPerRow()
          const snapshot = directoryStore.getSnapshot()
          const state = getActiveDirectory(snapshot.context, undefined)
          const offset = state.viewMode === 'grid' ? cols : 1
          moveCursor(offset, 'remove', e)
        }, THROTTLE_DELAY),
        label: 'Move down and remove from selection',
      },

      // Ctrl+K/Cmd+ArrowUp: Move up and remove from selection
      {
        key: [
          { key: 'k', ctrlKey: true },
          { key: 'ArrowUp', metaKey: true },
        ],
        handler: throttle(e => {
          const cols = getColumnsPerRow()
          const snapshot = directoryStore.getSnapshot()
          const state = getActiveDirectory(snapshot.context, undefined)
          const offset = state.viewMode === 'grid' ? cols : 1
          moveCursor(-offset, 'remove', e)
        }, THROTTLE_DELAY),
        label: 'Move up and remove from selection',
      },

      // Ctrl+H/Cmd+ArrowLeft: Move left and remove in grid, jump up 10 and remove in list
      {
        key: [
          { key: 'h', ctrlKey: true },
          { key: 'ArrowLeft', metaKey: true },
        ],
        handler: throttle(e => {
          const snapshot = directoryStore.getSnapshot()
          const state = getActiveDirectory(snapshot.context, undefined)
          const offset = state.viewMode === 'grid' ? -1 : -10
          moveCursor(offset, 'remove', e)
        }, THROTTLE_DELAY),
        label: 'Move left and remove from selection',
      },

      // Ctrl+L/Cmd+ArrowRight: Move right and remove in grid, jump down 10 and remove in list
      {
        key: [
          { key: 'l', ctrlKey: true },
          { key: 'ArrowRight', metaKey: true },
        ],
        handler: throttle(e => {
          const snapshot = directoryStore.getSnapshot()
          const state = getActiveDirectory(snapshot.context, undefined)
          const offset = state.viewMode === 'grid' ? 1 : 10
          moveCursor(offset, 'remove', e)
        }, THROTTLE_DELAY),
        label: 'Move right and remove from selection',
      },

      // Shift+G: Go to last item
      {
        key: { key: 'G', shiftKey: true },
        handler: e => {
          const { state, filteredData } = getCursorPosition()
          directoryStore.send({
            type: 'setSelection',
            indexes: new Set([filteredData.length - 1]),
            last: filteredData.length - 1,
            directoryId: state.directoryId,
          })
          e?.preventDefault()
        },
        label: 'Go to last item',
      },

      // Ctrl+D: Page down
      {
        key: { key: 'd', ctrlKey: true },
        handler: throttle(e => moveCursor(10, 'replace', e), THROTTLE_DELAY),
        label: 'Page down',
      },

      // Ctrl+U: Page up
      {
        key: { key: 'u', ctrlKey: true },
        handler: throttle(e => moveCursor(-10, 'replace', e), THROTTLE_DELAY),
        label: 'Page up',
      },
    ]
  },
  getSelectionSequenceShortcuts: (): SequenceShortcut[] => {
    return [
      {
        // Go to the top (like vim gg)
        sequence: ['g', 'g'],
        handler: e => {
          directorySelection.select(0, e, undefined)
          e?.preventDefault()
        },
        label: 'Go to first item',
      },
    ]
  },

  resetSelection: (directoryId: DirectoryId | undefined) => {
    const s = createResetSelection()
    directoryStore.send({ type: 'setSelection', directoryId, ...s })
  },

  isSelected: (index: number, directoryId: DirectoryId) => {
    const active = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
    const selection = getBufferSelection(directoryStore.getSnapshot().context, active)
    return selection.indexes.has(index)
  },

  selectManually: (index: number, directoryId: DirectoryId | undefined) => {
    directoryStore.send({ type: 'selectManually', index, directoryId })
  },

  setSelection: (h: number | ((s: number) => number), directoryId: DirectoryId) => {
    const active = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
    const selection = getBufferSelection(directoryStore.getSnapshot().context, active)
    let newSelection: number
    if (selection.indexes.size === 0) {
      newSelection = typeof h === 'number' ? h : h(0)
    } else if (selection.indexes.size === 1) {
      newSelection = typeof h === 'number' ? h : h(selection.last!)
    } else {
      newSelection = typeof h === 'number' ? h : h(selection.last!)
    }
    directoryStore.send({
      type: 'setSelection',
      indexes: new Set([newSelection]),
      last: newSelection,
      directoryId,
    })
  },

  getSelectedRealsOrCurrentReal: (directoryId: DirectoryId | undefined) => {
    const snapshot = directoryStore.getSnapshot()
    const buffer = selectBuffer(snapshot.context, directoryId)
    if (!buffer) return undefined

    const selection = buffer.selection.indexes
    const result = [...selection].map(i => buffer.items[i]).filter(i => i.type === 'real')
    if (result.length <= 1) {
      const item = buffer.items[buffer.cursor.line]
      if (item.type === 'real') return [item]
      return undefined
    }
    return result
  },
}
