import { GetFilesAndFoldersInDirectoryItem } from './Contracts.js'
import { GenericError } from './GenericError.js'
import { HistoryStack } from './history-stack.js'

export namespace VimEngine {
  export type CursorPosition = {
    line: number
    column: number
  }

  export type BufferItem =
    | {
        type: 'str'
        str: string
        id: number
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
    cursor: CursorPosition
  }

  type FullPath = string
  export type State = {
    buffers: Record<FullPath, Buffer>
    mode: Mode
    count: number
    registry: BufferItem[]
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
  export const Mode = {
    N: 'normal',
    I: 'insert',
  } as const
  export type Mode = (typeof Mode)[keyof typeof Mode]

  // cc - dd - yy - p - P - u - ciw - C
  // History stack not supported for line updates

  export function cc({ state, fullPath }: CommandOpts): CommandResult {
    const buffer = state.buffers[fullPath]
    const currentItems = [...buffer.items]
    const deletedItems = currentItems.splice(buffer.cursor.line, getEffectiveCount(state), createStrBufferItem(''))
    const currentBuffer: Buffer = {
      fullPath,
      items: currentItems,
      historyStack: buffer.historyStack.withNew({
        reversions: [
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
        ],
      }),
      cursor: {
        line: buffer.cursor.line,
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
    }
  }

  export function dd({ state, fullPath }: CommandOpts): CommandResult {
    const buffer = state.buffers[fullPath]
    const currentItems = [...buffer.items]
    const deletedItems = currentItems.splice(buffer.cursor.line, getEffectiveCount(state))
    if (currentItems.length === 0) {
      currentItems.push(createStrBufferItem(''))
    }
    const line = Math.min(buffer.cursor.line, currentItems.length - 1)
    const currentBuffer: Buffer = {
      fullPath: fullPath,
      items: currentItems,
      historyStack: buffer.historyStack.withNew({
        reversions: [
          {
            type: 'add',
            items: deletedItems,
            index: buffer.cursor.line,
          },
          {
            type: 'cursor',
            cursor: buffer.cursor,
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
    }
  }

  export function yy({ state, fullPath }: CommandOpts): CommandResult {
    const buffer = state.buffers[fullPath]
    const idxs: number[] = []
    const lastLine = Math.min(getEffectiveCount(state) + buffer.cursor.line, buffer.items.length)
    for (let i = buffer.cursor.line; i < lastLine; i++) {
      idxs.push(i)
    }
    return {
      ...state,
      registry: idxs.map(i => buffer.items[i]),
      count: 0,
    }
  }

  export function p({ state, fullPath }: CommandOpts): CommandResult {
    if (state.count) GenericError.Message('p not supported with count')

    const buffer = state.buffers[fullPath]
    const currentItems = [...buffer.items]
    currentItems.splice(buffer.cursor.line + 1, 0, ...state.registry)
    const currentBuffer: Buffer = {
      fullPath: buffer.fullPath,
      items: currentItems,
      historyStack: buffer.historyStack.withNew({
        reversions: [
          {
            type: 'remove',
            count: state.registry.length,
            index: buffer.cursor.line + 1,
          },
          {
            type: 'cursor',
            cursor: buffer.cursor,
          },
        ],
      }),
      cursor: {
        line: buffer.cursor.line + 1,
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
    }
  }

  export function P({ state, fullPath }: CommandOpts): CommandResult {
    if (state.count) GenericError.Message('P not supported with count')
    const buffer = state.buffers[fullPath]

    const currentItems = [...buffer.items]
    currentItems.splice(Math.max(0, buffer.cursor.line), 0, ...state.registry)
    const currentBuffer: Buffer = {
      fullPath: fullPath,
      items: currentItems,
      historyStack: buffer.historyStack.withNew({
        reversions: [
          {
            type: 'remove',
            count: state.registry.length,
            index: Math.max(0, buffer.cursor.line),
          },
          {
            type: 'cursor',
            cursor: buffer.cursor,
          },
        ],
      }),
      cursor: {
        line: buffer.cursor.line,
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
    }
  }

  export function applyUndo(state: State, fullPath: FullPath): CommandResult {
    const buffer = state.buffers[fullPath]
    const historyItem = buffer.historyStack.goPrevSafe()
    if (!historyItem || !historyItem.reversions.length) return state

    const currentItems = [...buffer.items]
    let cursor = buffer.cursor

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
      buffers: {
        ...state.buffers,
        [fullPath]: {
          ...buffer,
          items: currentItems,
          cursor,
        },
      },
      count: 0,
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

  export function esc(opts: CommandOpts): CommandResult {
    return {
      ...opts.state,
      mode: 'normal',
    }
  }

  // function lineUpdatingFn(
  //   state: PerDirectoryState,
  //   fn: (line: string) => { column: number; result: string }
  // ): PerDirectoryState {
  //   if (state.count) GenericError.Message('lineUpdatingFn not supported with count')
  //
  //   const currentItems = [...state.currentBuffer.items]
  //   const initialStr = currentItems[buffer.cursor.line].str
  //
  //   const { column, result } = fn(initialStr)
  //
  //   currentItems[buffer.cursor.line] = {
  //     ...currentItems[buffer.cursor.line],
  //     str: result,
  //   }
  //
  //   return {
  //     ...state,
  //     cursor: {
  //       line: buffer.cursor.line,
  //       column,
  //     },
  //     currentBuffer: {
  //       ...state.currentBuffer,
  //       items: currentItems,
  //     },
  //     count: 0,
  //     mode: 'insert',
  //   }
  // }
  //
  // export function ciw(state: PerDirectoryState): PerDirectoryState {
  //   return lineUpdatingFn(state, initialStr => {
  //     const bounds = getWordBounds(initialStr, buffer.cursor.column)
  //     const result = removeWord(initialStr, bounds.start, bounds.end)
  //
  //     return { column: bounds.start, result }
  //   })
  // }
  //
  // export function C(state: PerDirectoryState): PerDirectoryState {
  //   return lineUpdatingFn(state, initialStr => {
  //     return {
  //       column: buffer.cursor.column,
  //       result: initialStr.slice(0, buffer.cursor.column),
  //     }
  //   })
  // }

  export function addToCount(opts: CommandOpts, count: number): CommandResult {
    return {
      ...opts.state,
      count: opts.state.count === 0 ? count : 10 * opts.state.count + count,
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
    }
  }

  export function defaultBuffer(fullPath: string, items: BufferItem[]): Buffer {
    return {
      fullPath,
      items,
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
}

// const isWordChar = (ch: string) => /[A-Za-z0-9]/.test(ch)
// export function getWordBounds(text: string, index: number): { start: number; end: number } {
//   if (index < 0 || index >= text.length) return { start: index, end: index }
//   if (!isWordChar(text[index])) return { start: index, end: index }
//
//   let start = index
//   let end = index
//
//   while (start > 0 && isWordChar(text[start - 1])) {
//     start--
//   }
//
//   while (end < text.length - 1 && isWordChar(text[end + 1])) {
//     end++
//   }
//
//   return { start, end }
// }
//
// function removeWord(text: string, start: number, end: number): string {
//   return text.slice(0, start) + text.slice(end + 1)
// }

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
