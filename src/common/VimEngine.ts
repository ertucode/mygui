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

  type FullPath = string
  export type GlobalState = {
    buffers: Record<FullPath, Buffer>
    mode: Mode
    count: number
    registry: BufferItem[]
  }

  export type PerDirectoryState = {
    cursor: CursorPosition
  }

  export type States = {
    state: PerDirectoryState
    globalState: GlobalState
  }
  export type CommandOpts = {
    state: PerDirectoryState
    globalState: GlobalState
    fullPath: FullPath
  }
  export type CommandResult = {
    state: PerDirectoryState
    globalState: GlobalState
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

  export function cc({ state, globalState, fullPath }: CommandOpts): CommandResult {
    const prevCurrentBuffer = globalState.buffers[fullPath]
    const currentItems = [...prevCurrentBuffer.items]
    const deletedItems = currentItems.splice(state.cursor.line, getEffectiveCount(globalState), {
      type: 'str',
      str: '',
    })
    const currentBuffer: Buffer = {
      fullPath,
      items: currentItems,
      historyStack: prevCurrentBuffer.historyStack.withNew({
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
      state: {
        cursor: {
          line: state.cursor.line,
          column: 0,
        },
      },
      globalState: {
        count: 0,
        mode: 'insert',
        registry: deletedItems,
        buffers: {
          ...globalState.buffers,
          [fullPath]: currentBuffer,
        },
      },
    }
  }

  export function dd({ state, globalState, fullPath }: CommandOpts): CommandResult {
    const prevCurrentBuffer = globalState.buffers[fullPath]
    const currentItems = [...prevCurrentBuffer.items]
    const deletedItems = currentItems.splice(state.cursor.line, getEffectiveCount(globalState))
    const currentBuffer: Buffer = {
      fullPath: fullPath,
      items: currentItems,
      historyStack: prevCurrentBuffer.historyStack.withNew({
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
      state: {
        cursor: {
          line,
          column: Math.min(state.cursor.column, currentItems[line].str.length),
        },
      },
      globalState: {
        count: 0,
        mode: 'normal',
        registry: deletedItems,
        buffers: {
          ...globalState.buffers,
          [fullPath]: currentBuffer,
        },
      },
    }
  }

  export function yy({ state, globalState, fullPath }: CommandOpts): CommandResult {
    const currentBuffer = globalState.buffers[fullPath]
    const idxs: number[] = []
    const lastLine = Math.min(getEffectiveCount(globalState) + state.cursor.line, currentBuffer.items.length)
    for (let i = state.cursor.line; i < lastLine; i++) {
      idxs.push(i)
    }
    return {
      state,
      globalState: {
        ...globalState,
        registry: idxs.map(i => currentBuffer.items[i]),
        count: 0,
      },
    }
  }

  export function p({ state, globalState, fullPath }: CommandOpts): CommandResult {
    if (globalState.count) GenericError.Message('p not supported with count')

    const prevCurrentBuffer = globalState.buffers[fullPath]
    const currentItems = [...prevCurrentBuffer.items]
    currentItems.splice(state.cursor.line + 1, 0, ...globalState.registry)
    const currentBuffer: Buffer = {
      fullPath: prevCurrentBuffer.fullPath,
      items: currentItems,
      historyStack: prevCurrentBuffer.historyStack.withNew({
        reversions: [
          {
            type: 'remove',
            count: globalState.registry.length,
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
      state: {
        cursor: {
          line: state.cursor.line + 1,
          column: 0,
        },
      },
      globalState: {
        buffers: {
          ...globalState.buffers,
          [prevCurrentBuffer.fullPath]: currentBuffer,
        },
        count: 0,
        mode: 'normal',
        registry: globalState.registry,
      },
    }
  }

  export function P({ state, globalState, fullPath }: CommandOpts): CommandResult {
    if (globalState.count) GenericError.Message('P not supported with count')
    const prevCurrentBuffer = globalState.buffers[fullPath]

    const currentItems = [...prevCurrentBuffer.items]
    currentItems.splice(Math.max(0, state.cursor.line), 0, ...globalState.registry)
    const currentBuffer: Buffer = {
      fullPath: fullPath,
      items: currentItems,
      historyStack: prevCurrentBuffer.historyStack.withNew({
        reversions: [
          {
            type: 'remove',
            count: globalState.registry.length,
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
      state: {
        cursor: {
          line: state.cursor.line,
          column: 0,
        },
      },
      globalState: {
        buffers: {
          ...globalState.buffers,
          [fullPath]: currentBuffer,
        },
        count: 0,
        mode: 'normal',
        registry: globalState.registry,
      },
    }
  }

  export function applyUndo({ state, globalState }: States, fullPath: FullPath): CommandResult {
    const prevCurrentBuffer = globalState.buffers[fullPath]
    const historyItem = prevCurrentBuffer.historyStack.goPrevSafe()
    if (!historyItem || !historyItem.reversions.length) return { globalState, state }

    const currentItems = [...prevCurrentBuffer.items]
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
      state: {
        cursor,
      },
      globalState: {
        ...globalState,
        buffers: {
          ...globalState.buffers,
          [fullPath]: {
            ...prevCurrentBuffer,
            items: currentItems,
          },
        },
        count: 0,
      },
    }
  }

  export function u(opts: CommandOpts): CommandResult {
    let currentState: { globalState: GlobalState; state: PerDirectoryState } = opts
    const count = getEffectiveCount(currentState.globalState)

    for (let i = 0; i < count; i++) {
      currentState = applyUndo(currentState, opts.fullPath)
    }

    return {
      ...currentState,
    }
  }

  // function lineUpdatingFn(
  //   state: PerDirectoryState,
  //   fn: (line: string) => { column: number; result: string }
  // ): PerDirectoryState {
  //   if (state.count) GenericError.Message('lineUpdatingFn not supported with count')
  //
  //   const currentItems = [...state.currentBuffer.items]
  //   const initialStr = currentItems[state.cursor.line].str
  //
  //   const { column, result } = fn(initialStr)
  //
  //   currentItems[state.cursor.line] = {
  //     ...currentItems[state.cursor.line],
  //     str: result,
  //   }
  //
  //   return {
  //     ...state,
  //     cursor: {
  //       line: state.cursor.line,
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
  //     const bounds = getWordBounds(initialStr, state.cursor.column)
  //     const result = removeWord(initialStr, bounds.start, bounds.end)
  //
  //     return { column: bounds.start, result }
  //   })
  // }
  //
  // export function C(state: PerDirectoryState): PerDirectoryState {
  //   return lineUpdatingFn(state, initialStr => {
  //     return {
  //       column: state.cursor.column,
  //       result: initialStr.slice(0, state.cursor.column),
  //     }
  //   })
  // }

  export function addToCount(opts: CommandOpts, count: number): CommandResult {
    return {
      state: opts.state,
      globalState: {
        ...opts.globalState,
        count: opts.globalState.count === 0 ? count : 10 * opts.globalState.count + count,
      },
    }
  }

  function getEffectiveCount(globalState: GlobalState): number {
    return globalState.count || 1
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
