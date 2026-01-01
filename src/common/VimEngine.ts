import { GetFilesAndFoldersInDirectoryItem } from './Contracts.js'
import { GenericError } from './GenericError.js'
import { HistoryStack } from './history-stack.js'

export namespace VimEngine {
  export type CursorPosition = {
    line: number
    column: number
  }
  export type CommandOpts = {
    count: number
    buffer: string[]
    cursor: CursorPosition
    registry: string[]
  }

  export type BufferItem =
    | {
        type: 'str'
        str: string
      }
    | {
        type: 'real'
        item: GetFilesAndFoldersInDirectoryItem
        str: string
      }

  export type Buffer = {
    fullPath: string
    items: BufferItem[]
    historyStack: HistoryStack<HistoryItem>
  }

  export type State = {
    buffers: Record<string, Buffer>
    currentBuffer: Buffer
    cursor: CursorPosition
    registry: BufferItem[]
    mode: Mode
    count: number
    disabled?: boolean
  }

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
  export type Mode = 'normal' | 'insert'

  // cc - dd - yy - p - P - u - ciw - C
  // History stack not supported for line updates

  export function cc(state: State): State {
    const currentItems = [...state.currentBuffer.items]
    const deletedItems = currentItems.splice(state.cursor.line, getEffectiveCount(state), {
      type: 'str',
      str: '',
    })
    const currentBuffer: Buffer = {
      fullPath: state.currentBuffer.fullPath,
      items: currentItems,
      historyStack: state.currentBuffer.historyStack.withNew({
        reversions: [
          {
            type: 'remove',
            count: 1,
            index: state.cursor.line,
          },
          {
            type: 'add',
            items: deletedItems,
            index: state.cursor.line,
          },
          {
            type: 'cursor',
            cursor: state.cursor,
          },
        ],
      }),
    }

    return {
      buffers: {
        ...state.buffers,
        [state.currentBuffer.fullPath]: currentBuffer,
      },
      count: 0,
      mode: 'insert',
      currentBuffer,
      cursor: {
        line: state.cursor.line,
        column: 0,
      },
      registry: deletedItems,
    }
  }

  export function dd(state: State): State {
    const currentItems = [...state.currentBuffer.items]
    const deletedItems = currentItems.splice(state.cursor.line, getEffectiveCount(state))
    const currentBuffer: Buffer = {
      fullPath: state.currentBuffer.fullPath,
      items: currentItems,
      historyStack: state.currentBuffer.historyStack.withNew({
        reversions: [
          {
            type: 'add',
            items: deletedItems,
            index: state.cursor.line,
          },
          {
            type: 'cursor',
            cursor: state.cursor,
          },
        ],
      }),
    }
    if (currentItems.length === 0) {
      currentItems.push({ type: 'str', str: '' })
    }
    const line = Math.min(state.cursor.line, currentItems.length - 1)
    return {
      buffers: {
        ...state.buffers,
        [state.currentBuffer.fullPath]: currentBuffer,
      },
      count: 0,
      mode: 'normal',
      currentBuffer,
      cursor: {
        line,
        column: Math.min(state.cursor.column, currentItems[line].str.length),
      },
      registry: deletedItems,
    }
  }

  export function yy(state: State): State {
    const idxs: number[] = []
    const lastLine = Math.min(getEffectiveCount(state) + state.cursor.line, state.currentBuffer.items.length)
    for (let i = state.cursor.line; i < lastLine; i++) {
      idxs.push(i)
    }
    return {
      ...state,
      registry: idxs.map(i => state.currentBuffer.items[i]),
      count: 0,
    }
  }

  export function p(state: State): State {
    if (state.count) GenericError.Message('p not supported with count')

    const currentItems = [...state.currentBuffer.items]
    currentItems.splice(state.cursor.line + 1, 0, ...state.registry)
    const currentBuffer: Buffer = {
      fullPath: state.currentBuffer.fullPath,
      items: currentItems,
      historyStack: state.currentBuffer.historyStack.withNew({
        reversions: [
          {
            type: 'remove',
            count: state.registry.length,
            index: state.cursor.line + 1,
          },
          {
            type: 'cursor',
            cursor: state.cursor,
          },
        ],
      }),
    }
    return {
      buffers: {
        ...state.buffers,
        [state.currentBuffer.fullPath]: currentBuffer,
      },
      count: 0,
      mode: 'normal',
      currentBuffer,
      cursor: {
        line: state.cursor.line + 1,
        column: 0,
      },
      registry: state.registry,
    }
  }

  export function P(state: State): State {
    if (state.count) GenericError.Message('P not supported with count')

    const currentItems = [...state.currentBuffer.items]
    currentItems.splice(Math.max(0, state.cursor.line), 0, ...state.registry)
    const currentBuffer: Buffer = {
      fullPath: state.currentBuffer.fullPath,
      items: currentItems,
      historyStack: state.currentBuffer.historyStack.withNew({
        reversions: [
          {
            type: 'remove',
            count: state.registry.length,
            index: Math.max(0, state.cursor.line),
          },
          {
            type: 'cursor',
            cursor: state.cursor,
          },
        ],
      }),
    }
    return {
      buffers: {
        ...state.buffers,
        [state.currentBuffer.fullPath]: currentBuffer,
      },
      count: 0,
      mode: 'normal',
      currentBuffer,
      cursor: {
        line: state.cursor.line,
        column: 0,
      },
      registry: state.registry,
    }
  }

  export function applyUndo(state: State): State {
    const historyItem = state.currentBuffer.historyStack.goPrevSafe()
    if (!historyItem || !historyItem.reversions.length) return state

    const currentItems = [...state.currentBuffer.items]
    let cursor = state.cursor

    for (const reversion of historyItem.reversions) {
      if (reversion.type === 'cursor') {
        cursor = reversion.cursor
      } else if (reversion.type === 'add') {
        currentItems.splice(reversion.index, 0, ...reversion.items)
      } else if (reversion.type === 'remove') {
        currentItems.splice(reversion.index, reversion.count)
      }
    }

    return {
      ...state,
      cursor,
      currentBuffer: {
        ...state.currentBuffer,
        items: currentItems,
      },
    }
  }

  export function u(state: State): State {
    let currentState = state

    for (let i = 0; i < getEffectiveCount(state); i++) {
      currentState = applyUndo(currentState)
    }

    return {
      ...currentState,
      count: 0,
    }
  }

  function lineUpdatingFn(state: State, fn: (line: string) => { column: number; result: string }): State {
    if (state.count) GenericError.Message('lineUpdatingFn not supported with count')

    const currentItems = [...state.currentBuffer.items]
    const initialStr = currentItems[state.cursor.line].str

    const { column, result } = fn(initialStr)

    currentItems[state.cursor.line] = {
      ...currentItems[state.cursor.line],
      str: result,
    }

    return {
      ...state,
      cursor: {
        line: state.cursor.line,
        column,
      },
      currentBuffer: {
        ...state.currentBuffer,
        items: currentItems,
      },
      count: 0,
      mode: 'insert',
    }
  }

  export function ciw(state: State): State {
    return lineUpdatingFn(state, initialStr => {
      const bounds = getWordBounds(initialStr, state.cursor.column)
      const result = removeWord(initialStr, bounds.start, bounds.end)

      return { column: bounds.start, result }
    })
  }

  export function C(state: State): State {
    return lineUpdatingFn(state, initialStr => {
      return {
        column: state.cursor.column,
        result: initialStr.slice(0, state.cursor.column),
      }
    })
  }

  export function addToCount(state: State, count: number): State {
    return {
      ...state,
      count: state.count === 0 ? count : 10 * state.count + count,
    }
  }

  function getEffectiveCount(state: State): number {
    return state.count || 1
  }

  export function i(state: State): State {
    return {
      ...state,
      mode: 'insert',
      count: 0,
    }
  }

  export function esc(state: State): State {
    return {
      ...state,
      mode: 'normal',
      count: 0,
    }
  }
}

const isWordChar = (ch: string) => /[A-Za-z0-9]/.test(ch)
export function getWordBounds(text: string, index: number): { start: number; end: number } {
  if (index < 0 || index >= text.length) return { start: index, end: index }
  if (!isWordChar(text[index])) return { start: index, end: index }

  let start = index
  let end = index

  while (start > 0 && isWordChar(text[start - 1])) {
    start--
  }

  while (end < text.length - 1 && isWordChar(text[end + 1])) {
    end++
  }

  return { start, end }
}

function removeWord(text: string, start: number, end: number): string {
  return text.slice(0, start) + text.slice(end + 1)
}

//  1
//  2
//  3
//  4
//  5
//  6
//  7
//  8
//  9
// 10
// 11
// 12
// 13
// 14
