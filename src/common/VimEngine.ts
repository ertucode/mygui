import { GetFilesAndFoldersInDirectoryItem } from './Contracts.js'
import { GenericError } from './GenericError.js'
import { HistoryStack } from './history-stack.js'
import { Typescript } from './Typescript.js'

export namespace VimEngine {
  export type CursorPosition = {
    line: number
    column: number
  }

  export type RealBufferItem = {
    type: 'real'
    item: GetFilesAndFoldersInDirectoryItem
    str: string
  }
  export type BufferItem =
    | {
        type: 'str'
        str: string
        id: number
      }
    | RealBufferItem

  export type Buffer = {
    fullPath: string
    items: BufferItem[]
    originalItems: RealBufferItem[]
    historyStack: HistoryStack<HistoryItem>
    cursor: CursorPosition
  }

  export type FindCommand = 'f' | 'F' | 't' | 'T'
  export type Operator = 'd' | 'c' | 'y'
  export type TextObjectModifier = 'i' | 'a'
  type FullPath = string
  export type State = {
    buffers: Record<FullPath, Buffer>
    mode: Mode
    count: number
    registry: BufferItem[]
    pendingFindCommand?: $Maybe<FindCommand>
    pendingOperator?: $Maybe<Operator>
    textObjectModifier?: $Maybe<TextObjectModifier>
    insertModeStartReversions?: Reversion[]
    selection: {
      indexes: Set<number>
      last: number | undefined
    }
  }

  export type CommandOpts = {
    state: State
    fullPath: FullPath
  }
  export type CommandResult = State

  export type HistoryItem = {
    reversions: Reversion[]
  }
  type Reversion =
    | {
        type: 'cursor'
        cursor: CursorPosition
      }
    | {
        type: 'add'
        items: BufferItem[]
        index: number
      }
    | {
        type: 'remove'
        count: number
        index: number
      }
    | {
        type: 'update-content'
        index: number
        str: string
      }
    | {
        type: 'selection'
        indexes: Set<number>
        last: number | undefined
      }
  export const Mode = {
    N: 'normal',
    I: 'insert',
  } as const
  export type Mode = (typeof Mode)[keyof typeof Mode]

  export function cc({ state, fullPath }: CommandOpts): CommandResult {
    const buffer = state.buffers[fullPath]
    const currentItems = [...buffer.items]
    
    // If we have multiple selection indexes, use those; otherwise use cursor position
    let deletedItems: BufferItem[]
    let newCursorLine: number
    let reversions: Reversion[]
    
    if (state.selection.indexes.size > 1) {
      // Get sorted indexes for deletion
      const sortedIndexes = Array.from(state.selection.indexes).sort((a, b) => a - b)
      const minIndex = sortedIndexes[0]
      
      // Delete selected lines and replace with single empty line
      deletedItems = []
      for (let i = sortedIndexes.length - 1; i >= 0; i--) {
        const deleted = currentItems.splice(sortedIndexes[i], 1)
        deletedItems.unshift(...deleted)
      }
      currentItems.splice(minIndex, 0, createStrBufferItem(''))
      
      reversions = [
        {
          type: 'remove',
          count: 1,
          index: minIndex,
        },
        {
          type: 'add',
          items: deletedItems,
          index: minIndex,
        },
        {
          type: 'cursor',
          cursor: buffer.cursor,
        },
        {
          type: 'selection',
          indexes: state.selection.indexes,
          last: state.selection.last,
        },
      ]
      
      newCursorLine = minIndex
    } else {
      // No selection, use normal behavior
      deletedItems = currentItems.splice(buffer.cursor.line, getEffectiveCount(state), createStrBufferItem(''))
      
      reversions = [
        {
          type: 'remove',
          count: 1,
          index: buffer.cursor.line,
        },
        {
          type: 'add',
          items: deletedItems,
          index: buffer.cursor.line,
        },
        {
          type: 'cursor',
          cursor: buffer.cursor,
        },
        {
          type: 'selection',
          indexes: state.selection.indexes,
          last: state.selection.last,
        },
      ]
      
      newCursorLine = buffer.cursor.line
    }

    const currentBuffer: Buffer = {
      fullPath,
      items: currentItems,
      originalItems: buffer.originalItems,
      historyStack: buffer.historyStack,
      cursor: {
        line: newCursorLine,
        column: 0,
      },
    }

    return {
      count: 0,
      mode: 'insert',
      registry: deletedItems,
      buffers: {
        ...state.buffers,
        [fullPath]: currentBuffer,
      },
      insertModeStartReversions: reversions,
      pendingOperator: undefined,
      selection: {
        indexes: new Set<number>(),
        last: undefined,
      },
    }
  }

  export function dd({ state, fullPath }: CommandOpts): CommandResult {
    const buffer = state.buffers[fullPath]
    const currentItems = [...buffer.items]
    
    // If we have multiple selection indexes, use those; otherwise use cursor position
    let deletedItems: BufferItem[]
    let deleteIndex: number
    
    if (state.selection.indexes.size > 1) {
      // Get sorted indexes for deletion
      const sortedIndexes = Array.from(state.selection.indexes).sort((a, b) => b - a)
      deleteIndex = Math.min(...sortedIndexes)
      
      // Delete selected lines from highest to lowest index
      deletedItems = []
      for (const idx of sortedIndexes) {
        const deleted = currentItems.splice(idx, 1)
        deletedItems.unshift(...deleted)
      }
    } else {
      // No selection, use normal behavior
      deleteIndex = buffer.cursor.line
      deletedItems = currentItems.splice(buffer.cursor.line, getEffectiveCount(state))
    }
    
    if (currentItems.length === 0) {
      currentItems.push(createStrBufferItem(''))
    }
    const line = Math.min(deleteIndex, currentItems.length - 1)
    const currentBuffer: Buffer = {
      fullPath: fullPath,
      items: currentItems,
      originalItems: buffer.originalItems,
      historyStack: buffer.historyStack.withNew({
        reversions: [
          {
            type: 'add',
            items: deletedItems,
            index: deleteIndex,
          },
          {
            type: 'cursor',
            cursor: buffer.cursor,
          },
          {
            type: 'selection',
            indexes: state.selection.indexes,
            last: state.selection.last,
          },
        ],
      }),
      cursor: {
        line,
        column: Math.min(buffer.cursor.column, currentItems[line].str.length),
      },
    }
    return {
      count: 0,
      mode: 'normal',
      registry: deletedItems,
      buffers: {
        ...state.buffers,
        [fullPath]: currentBuffer,
      },
      pendingOperator: undefined,
      selection: {
        indexes: new Set<number>(),
        last: undefined,
      },
    }
  }

  export function yy({ state, fullPath }: CommandOpts): CommandResult {
    const buffer = state.buffers[fullPath]
    let idxs: number[] = []
    
    if (state.selection.indexes.size > 1) {
      // If we have selection, yank selected lines
      idxs = Array.from(state.selection.indexes).sort((a, b) => a - b)
    } else {
      // No selection, use normal behavior
      const lastLine = Math.min(getEffectiveCount(state) + buffer.cursor.line, buffer.items.length)
      for (let i = buffer.cursor.line; i < lastLine; i++) {
        idxs.push(i)
      }
    }
    
    // Note: yy doesn't modify the buffer, so we don't add to history
    // The selection clearing is intentional and doesn't need undo support
    return {
      ...state,
      registry: idxs.map(i => buffer.items[i]),
      count: 0,
      pendingOperator: undefined,
      selection: {
        indexes: new Set<number>(),
        last: undefined,
      },
    }
  }

  export function p({ state, fullPath }: CommandOpts): CommandResult {
    if (state.count) GenericError.Message('p not supported with count')

    const buffer = state.buffers[fullPath]
    const currentItems = [...buffer.items]
    
    // If we have multiple items selected, delete selected lines first then paste
    let pasteIndex: number
    
    if (state.selection.indexes.size > 1) {
      // Get sorted indexes for deletion
      const sortedIndexes = Array.from(state.selection.indexes).sort((a, b) => b - a)
      const minIndex = Math.min(...sortedIndexes)
      
      // Delete selected lines from highest to lowest index
      for (const idx of sortedIndexes) {
        currentItems.splice(idx, 1)
      }
      
      // Paste at the position of the first deleted line
      pasteIndex = minIndex
    } else {
      // No selection, paste after cursor
      pasteIndex = buffer.cursor.line + 1
    }
    
    currentItems.splice(pasteIndex, 0, ...state.registry)
    const currentBuffer: Buffer = {
      fullPath: buffer.fullPath,
      items: currentItems,
      originalItems: buffer.originalItems,
      historyStack: buffer.historyStack.withNew({
        reversions: [
          {
            type: 'remove',
            count: state.registry.length,
            index: pasteIndex,
          },
          {
            type: 'cursor',
            cursor: buffer.cursor,
          },
          {
            type: 'selection',
            indexes: state.selection.indexes,
            last: state.selection.last,
          },
        ],
      }),
      cursor: {
        line: pasteIndex,
        column: 0,
      },
    }
    return {
      buffers: {
        ...state.buffers,
        [buffer.fullPath]: currentBuffer,
      },
      count: 0,
      mode: 'normal',
      registry: state.registry,
      selection: {
        indexes: new Set<number>(),
        last: undefined,
      },
    }
  }

  export function P({ state, fullPath }: CommandOpts): CommandResult {
    if (state.count) GenericError.Message('P not supported with count')
    const buffer = state.buffers[fullPath]

    const currentItems = [...buffer.items]
    
    // If we have multiple items selected, delete selected lines first then paste
    let pasteIndex: number
    
    if (state.selection.indexes.size > 1) {
      // Get sorted indexes for deletion
      const sortedIndexes = Array.from(state.selection.indexes).sort((a, b) => b - a)
      const minIndex = Math.min(...sortedIndexes)
      
      // Delete selected lines from highest to lowest index
      for (const idx of sortedIndexes) {
        currentItems.splice(idx, 1)
      }
      
      // Paste at the position of the first deleted line
      pasteIndex = minIndex
    } else {
      // No selection, paste before cursor
      pasteIndex = Math.max(0, buffer.cursor.line)
    }
    
    currentItems.splice(pasteIndex, 0, ...state.registry)
    const currentBuffer: Buffer = {
      fullPath: fullPath,
      items: currentItems,
      originalItems: buffer.originalItems,
      historyStack: buffer.historyStack.withNew({
        reversions: [
          {
            type: 'remove',
            count: state.registry.length,
            index: pasteIndex,
          },
          {
            type: 'cursor',
            cursor: buffer.cursor,
          },
          {
            type: 'selection',
            indexes: state.selection.indexes,
            last: state.selection.last,
          },
        ],
      }),
      cursor: {
        line: pasteIndex,
        column: 0,
      },
    }
    return {
      buffers: {
        ...state.buffers,
        [fullPath]: currentBuffer,
      },
      count: 0,
      mode: 'normal',
      registry: state.registry,
      selection: {
        indexes: new Set<number>(),
        last: undefined,
      },
    }
  }

  export function applyUndo(state: State, fullPath: FullPath): CommandResult {
    const buffer = state.buffers[fullPath]
    const historyItem = buffer.historyStack.goPrevSafe()
    if (!historyItem || !historyItem.reversions.length) return state

    const currentItems = [...buffer.items]
    let cursor = buffer.cursor
    let selection = state.selection

    for (const reversion of historyItem.reversions) {
      if (reversion.type === 'cursor') {
        cursor = reversion.cursor
      } else if (reversion.type === 'add') {
        currentItems.splice(reversion.index, 0, ...reversion.items)
      } else if (reversion.type === 'remove') {
        currentItems.splice(reversion.index, reversion.count)
      } else if (reversion.type === 'update-content') {
        currentItems[reversion.index] = {
          ...currentItems[reversion.index],
          str: reversion.str,
        }
      } else if (reversion.type === 'selection') {
        selection = {
          indexes: reversion.indexes,
          last: reversion.last,
        }
      } else {
        Typescript.assertUnreachable(reversion)
      }
    }

    return {
      ...state,
      buffers: {
        ...state.buffers,
        [fullPath]: {
          ...buffer,
          items: currentItems,
          cursor,
        },
      },
      count: 0,
      selection,
    }
  }

  export function u(opts: CommandOpts): CommandResult {
    let state: State = opts.state
    const count = getEffectiveCount(state)

    for (let i = 0; i < count; i++) {
      state = applyUndo(state, opts.fullPath)
    }

    return {
      ...state,
    }
  }

  export function esc({ state, fullPath }: CommandOpts, str: $Maybe<string>, column: $Maybe<number>): CommandResult {
    const buffer = state.buffers[fullPath]
    const currentItems = [...buffer.items]
    const prevStr = currentItems[buffer.cursor.line].str
    if (str != null) {
      currentItems[buffer.cursor.line] = {
        ...currentItems[buffer.cursor.line],
        str,
      }
    }

    const returnState: State = {
      ...state,
      buffers: {
        ...state.buffers,
        [fullPath]: {
          ...buffer,
          items: currentItems,
          cursor: column ? { line: buffer.cursor.line, column } : buffer.cursor,
        },
      },
      count: 0,
      mode: 'normal',
      insertModeStartReversions: undefined,
    }

    // If we have pending reversions from insert mode start, add update-content and flush to history
    if (state.insertModeStartReversions) {
      // Add the content change reversion to the beginning of the list
      const updatedReversions = [
        {
          type: 'update-content' as const,
          index: buffer.cursor.line,
          str: prevStr,
        },
        ...state.insertModeStartReversions,
      ]

      buffer.historyStack.goNew({
        reversions: updatedReversions,
      })

      return returnState
    }

    // Normal case: create history immediately
    buffer.historyStack.goNew({
      reversions: [
        {
          type: 'update-content',
          index: buffer.cursor.line,
          str: prevStr,
        },
        {
          type: 'cursor',
          cursor: buffer.cursor,
        },
      ],
    })

    return returnState
  }

  export function enter({ state, fullPath }: CommandOpts, str: $Maybe<string>): CommandResult {
    const buffer = state.buffers[fullPath]
    const currentItems = [...buffer.items]
    const prevStr = currentItems[buffer.cursor.line].str
    if (str != null) {
      currentItems[buffer.cursor.line] = {
        ...currentItems[buffer.cursor.line],
        str,
      }
    }

    currentItems.splice(buffer.cursor.line + 1, 0, createStrBufferItem(''))

    return {
      ...state,
      buffers: {
        ...state.buffers,
        [fullPath]: {
          ...buffer,
          items: currentItems,
          cursor: {
            column: 0,
            line: buffer.cursor.line + 1,
          },
        },
      },
      count: 0,
      mode: 'insert',
      insertModeStartReversions: state.insertModeStartReversions
        ? [
            {
              type: 'update-content' as const,
              index: buffer.cursor.line,
              str: prevStr,
            },
            {
              type: 'remove',
              index: buffer.cursor.line + 1,
              count: 1,
            },
            ...state.insertModeStartReversions,
          ]
        : [
            {
              type: 'update-content',
              index: buffer.cursor.line,
              str: prevStr,
            },
            {
              type: 'remove',
              index: buffer.cursor.line + 1,
              count: 1,
            },
            {
              type: 'cursor',
              cursor: buffer.cursor,
            },
          ],
    }
  }

  export function o({ state, fullPath }: CommandOpts): CommandResult {
    return enter({ state, fullPath }, undefined)
  }

  export type Changes = {
    changes: Change[]
  }
  export type Change =
    | {
        type: 'add'
        directory: string
        name: string
      }
    | {
        type: 'remove'
        directory: string
        item: GetFilesAndFoldersInDirectoryItem
      }
    | {
        type: 'copy'
        item: GetFilesAndFoldersInDirectoryItem
        newDirectory: string
        newName: string
      }
    | {
        type: 'rename'
        item: GetFilesAndFoldersInDirectoryItem
        newDirectory: string
        newName: string
      }
  export function aggregateChanges(state: State): Changes {
    const changes: Change[] = []

    // First pass: collect all items across all buffers
    type ItemLocation = {
      directory: string
      item: GetFilesAndFoldersInDirectoryItem
      newName: string
    }

    const originalLocations = new Map<string, ItemLocation>() // id -> original location
    const currentLocations = new Map<string, ItemLocation[]>() // id -> array of current locations (for detecting multiple pastes)
    const addedItems: Array<{ directory: string; name: string }> = []

    // Collect all original and current items from all buffers
    for (const buffer of Object.values(state.buffers)) {
      // Process original items
      for (const originalItem of buffer.originalItems) {
        const id = originalItem.item.fullPath || originalItem.item.name
        originalLocations.set(id, {
          directory: buffer.fullPath,
          item: originalItem.item,
          newName: originalItem.item.name,
        })
      }

      // Process current items
      for (const bufferItem of buffer.items) {
        if (bufferItem.type === 'real') {
          const id = bufferItem.item.fullPath || bufferItem.item.name
          const locations = currentLocations.get(id) || []
          locations.push({
            directory: buffer.fullPath,
            item: bufferItem.item,
            newName: bufferItem.str,
          })
          currentLocations.set(id, locations)
        } else if (bufferItem.type === 'str' && bufferItem.str.trim() !== '') {
          // This is a new item (add)
          addedItems.push({
            directory: buffer.fullPath,
            name: bufferItem.str,
          })
        }
      }
    }

    // Second pass: detect changes by comparing original vs current locations
    for (const [id, originalLocation] of originalLocations.entries()) {
      const locations = currentLocations.get(id) || []

      if (locations.length === 0) {
        // Item was in original but not in current - it's been removed
        changes.push({
          type: 'remove',
          directory: originalLocation.directory,
          item: originalLocation.item,
        })
      } else if (locations.length === 1) {
        // Single location - could be unchanged, renamed, or moved
        const currentLocation = locations[0]
        if (
          currentLocation.directory !== originalLocation.directory ||
          currentLocation.newName !== originalLocation.item.name
        ) {
          // Item exists but directory or name has changed - it's a rename/move
          changes.push({
            type: 'rename',
            item: originalLocation.item,
            newDirectory: currentLocation.directory,
            newName: currentLocation.newName,
          })
        }
        // else: item exists in same directory with same name - no change
      } else {
        // Multiple locations - multiple pastes detected
        // Check if any location matches the original (same directory and name)
        let originalLocationIndex = -1
        for (let i = 0; i < locations.length; i++) {
          if (
            locations[i].directory === originalLocation.directory &&
            locations[i].newName === originalLocation.item.name
          ) {
            originalLocationIndex = i
            break
          }
        }

        if (originalLocationIndex !== -1) {
          // One of the locations matches the original - that's the "rename" (no-op)
          // All others are copies
          for (let i = 0; i < locations.length; i++) {
            if (i !== originalLocationIndex) {
              changes.push({
                type: 'copy',
                item: originalLocation.item,
                newDirectory: locations[i].directory,
                newName: locations[i].newName,
              })
            }
          }
        } else {
          // None match the original - first n-1 are copies, last is rename
          for (let i = 0; i < locations.length - 1; i++) {
            changes.push({
              type: 'copy',
              item: originalLocation.item,
              newDirectory: locations[i].directory,
              newName: locations[i].newName,
            })
          }
          const lastLocation = locations[locations.length - 1]
          changes.push({
            type: 'rename',
            item: originalLocation.item,
            newDirectory: lastLocation.directory,
            newName: lastLocation.newName,
          })
        }
      }
    }

    // Add all new items
    for (const addedItem of addedItems) {
      changes.push({
        type: 'add',
        directory: addedItem.directory,
        name: addedItem.name,
      })
    }

    return { changes }
  }

  export function addToCount(opts: CommandOpts, count: number): CommandResult {
    return {
      ...opts.state,
      count: opts.state.count === 0 ? count : 10 * opts.state.count + count,
    }
  }

  export function d(opts: CommandOpts): CommandResult {
    // If we have multiple items selected, execute delete immediately
    if (opts.state.selection.indexes.size > 1) {
      return dd(opts)
    }
    // If d is already pending, execute dd
    if (opts.state.pendingOperator === 'd') {
      return dd(opts)
    }
    return {
      ...opts.state,
      pendingOperator: 'd',
    }
  }

  export function c(opts: CommandOpts): CommandResult {
    // If we have multiple items selected, execute change immediately
    if (opts.state.selection.indexes.size > 1) {
      return cc(opts)
    }
    // If c is already pending, execute cc
    if (opts.state.pendingOperator === 'c') {
      return cc(opts)
    }
    return {
      ...opts.state,
      pendingOperator: 'c',
    }
  }

  export function y(opts: CommandOpts): CommandResult {
    // If we have multiple items selected, execute yank immediately
    if (opts.state.selection.indexes.size > 1) {
      return yy(opts)
    }
    // If y is already pending, execute yy
    if (opts.state.pendingOperator === 'y') {
      return yy(opts)
    }
    return {
      ...opts.state,
      pendingOperator: 'y',
    }
  }

  export type Range = {
    start: number
    end: number
  }

  export function executeOperatorWithRange(opts: CommandOpts, range: Range): CommandResult {
    const { state, fullPath } = opts
    const buffer = state.buffers[fullPath]
    const operator = state.pendingOperator

    if (!operator) return state

    const currentStr = buffer.items[buffer.cursor.line].str
    const selectedStr = currentStr.slice(range.start, range.end)
    const selectedItem = createStrBufferItem(selectedStr)

    // For yank operator, don't modify the buffer
    if (operator === 'y') {
      return {
        ...state,
        count: 0,
        mode: 'normal',
        registry: [selectedItem],
        pendingOperator: undefined,
        textObjectModifier: undefined,
      }
    }

    // For delete and change operators, modify the buffer
    const currentItems = [...buffer.items]
    const beforeRange = currentStr.slice(0, range.start)
    const afterRange = currentStr.slice(range.end)
    const newStr = beforeRange + afterRange

    currentItems[buffer.cursor.line] = {
      ...currentItems[buffer.cursor.line],
      str: newStr,
    }

    const currentBuffer: Buffer = {
      fullPath,
      items: currentItems,
      originalItems: buffer.originalItems,
      historyStack: buffer.historyStack.withNew({
        reversions: [
          {
            type: 'update-content',
            index: buffer.cursor.line,
            str: currentStr,
          },
          {
            type: 'cursor',
            cursor: buffer.cursor,
          },
        ],
      }),
      cursor: {
        line: buffer.cursor.line,
        column: Math.max(0, Math.min(range.start, newStr.length - 1)),
      },
    }

    return {
      count: 0,
      mode: operator === 'c' ? 'insert' : 'normal',
      registry: [selectedItem],
      pendingOperator: undefined,
      textObjectModifier: undefined,
      insertModeStartReversions:
        operator === 'c'
          ? [
              {
                type: 'update-content',
                index: buffer.cursor.line,
                str: currentStr,
              },
              {
                type: 'cursor',
                cursor: buffer.cursor,
              },
            ]
          : undefined,
      buffers: {
        ...state.buffers,
        [fullPath]: currentBuffer,
      },
      selection: state.selection,
    }
  }

  function getEffectiveCount(state: State): number {
    return state.count || 1
  }

  export function defaultState(): State {
    return {
      buffers: {},
      mode: 'normal',
      count: 0,
      registry: [],
      selection: {
        indexes: new Set<number>(),
        last: undefined,
      },
    }
  }

  export function defaultBuffer(fullPath: string, items: RealBufferItem[]): Buffer {
    return {
      fullPath,
      items,
      originalItems: items,
      historyStack: new HistoryStack<HistoryItem>([]),
      cursor: { line: 0, column: 0 },
    }
  }

  export function createStrBufferItem(str: string): BufferItem {
    return {
      type: 'str',
      str,
      id: Math.random(),
    }
  }

  export function isActive(state: State, fullPath: string) {
    if (state.mode === 'insert') return true
    const stack = state.buffers[fullPath]?.historyStack
    return stack && stack.hasItems()
  }

  // s - substitute character (delete character under cursor and enter insert mode)
  export function s({ state, fullPath }: CommandOpts): CommandResult {
    const buffer = state.buffers[fullPath]
    const currentItems = [...buffer.items]
    const currentStr = currentItems[buffer.cursor.line].str
    const count = getEffectiveCount(state)

    // Delete count characters starting from cursor position
    const beforeCursor = currentStr.slice(0, buffer.cursor.column)
    const afterCursor = currentStr.slice(buffer.cursor.column + count)
    const newStr = beforeCursor + afterCursor
    const deletedStr = currentStr.slice(buffer.cursor.column, buffer.cursor.column + count)

    currentItems[buffer.cursor.line] = {
      ...currentItems[buffer.cursor.line],
      str: newStr,
    }

    const reversions: Reversion[] = [
      {
        type: 'update-content',
        index: buffer.cursor.line,
        str: currentStr,
      },
      {
        type: 'cursor',
        cursor: buffer.cursor,
      },
    ]

    return {
      count: 0,
      mode: 'insert',
      registry: [createStrBufferItem(deletedStr)],
      buffers: {
        ...state.buffers,
        [fullPath]: {
          ...buffer,
          items: currentItems,
          cursor: buffer.cursor,
        },
      },
      insertModeStartReversions: reversions,
      pendingOperator: undefined,
      selection: state.selection,
    }
  }

  // C - change to end of line
  export function C({ state, fullPath }: CommandOpts): CommandResult {
    const buffer = state.buffers[fullPath]
    const currentItems = [...buffer.items]
    const currentStr = currentItems[buffer.cursor.line].str

    // Delete from cursor to end of line
    const beforeCursor = currentStr.slice(0, buffer.cursor.column)
    const deletedStr = currentStr.slice(buffer.cursor.column)

    currentItems[buffer.cursor.line] = {
      ...currentItems[buffer.cursor.line],
      str: beforeCursor,
    }

    const reversions: Reversion[] = [
      {
        type: 'update-content',
        index: buffer.cursor.line,
        str: currentStr,
      },
      {
        type: 'cursor',
        cursor: buffer.cursor,
      },
    ]

    return {
      count: 0,
      mode: 'insert',
      registry: [createStrBufferItem(deletedStr)],
      buffers: {
        ...state.buffers,
        [fullPath]: {
          ...buffer,
          items: currentItems,
          cursor: buffer.cursor,
        },
      },
      insertModeStartReversions: reversions,
      pendingOperator: undefined,
      selection: state.selection,
    }
  }

  // D - delete to end of line
  export function D({ state, fullPath }: CommandOpts): CommandResult {
    const buffer = state.buffers[fullPath]
    const currentItems = [...buffer.items]
    const currentStr = currentItems[buffer.cursor.line].str

    // Delete from cursor to end of line
    const beforeCursor = currentStr.slice(0, buffer.cursor.column)
    const deletedStr = currentStr.slice(buffer.cursor.column)

    currentItems[buffer.cursor.line] = {
      ...currentItems[buffer.cursor.line],
      str: beforeCursor,
    }

    return {
      count: 0,
      mode: 'normal',
      registry: [createStrBufferItem(deletedStr)],
      buffers: {
        ...state.buffers,
        [fullPath]: {
          ...buffer,
          items: currentItems,
          historyStack: buffer.historyStack.withNew({
            reversions: [
              {
                type: 'update-content',
                index: buffer.cursor.line,
                str: currentStr,
              },
              {
                type: 'cursor',
                cursor: buffer.cursor,
              },
            ],
          }),
          cursor: {
            line: buffer.cursor.line,
            column: Math.max(0, beforeCursor.length - 1),
          },
        },
      },
      pendingOperator: undefined,
      selection: state.selection,
    }
  }
}
