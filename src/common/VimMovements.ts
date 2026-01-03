import { Typescript } from './Typescript.js'
import { VimEngine } from './VimEngine.js'

type CommandOpts = VimEngine.CommandOpts
type CommandResult = VimEngine.CommandResult
type CursorPosition = VimEngine.CursorPosition

// State for f/F/t/T commands to support ; and , repetition
type FindState = {
  command: 'f' | 'F' | 't' | 'T'
  char: string
} | null

let lastFindState: FindState = null

function moveCursor(
  opts: CommandOpts,
  updater: (count: number, cursor: CursorPosition, strLength: number) => CursorPosition
): CommandResult {
  const count = getEffectiveCount(opts.state)
  const buffer = opts.state.buffers[opts.fullPath]
  const str = buffer.items[buffer.cursor.line].str
  const cursor = updater(count, opts.state.buffers[opts.fullPath].cursor, str.length)
  return {
    ...opts.state,
    buffers: {
      ...opts.state.buffers,
      [opts.fullPath]: {
        ...opts.state.buffers[opts.fullPath],
        cursor,
      },
    },
  }
}

function getEffectiveCount(state: VimEngine.State): number {
  return state.count || 1
}

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch)
}

export namespace VimMovements {
  // Basic movement commands
  export function l(opts: CommandOpts): CommandResult {
    return moveCursor(opts, (count, cursor, strLength) => ({
      line: cursor.line,
      column: Math.min(strLength - 1, cursor.column + count),
    }))
  }

  export function h(opts: CommandOpts): CommandResult {
    return moveCursor(opts, (count, cursor) => ({
      line: cursor.line,
      column: Math.max(0, cursor.column - count),
    }))
  }

  export function j(opts: CommandOpts): CommandResult {
    return moveCursor(opts, (count, cursor) => {
      const numItems = opts.state.buffers[opts.fullPath].items.length
      const dest = cursor.line + count
      return {
        line: dest > numItems - 1 ? dest % numItems : dest,
        column: cursor.column,
      }
    })
  }

  export function k(opts: CommandOpts): CommandResult {
    return moveCursor(opts, (count, cursor) => {
      const numItems = opts.state.buffers[opts.fullPath].items.length
      const dest = cursor.line - count
      return {
        line: dest < 0 ? numItems + dest : dest,
        column: cursor.column,
      }
    })
  }

  // Word movement commands
  export function w(opts: CommandOpts): CommandResult {
    return moveCursor(opts, (count, cursor, strLength) => {
      const buffer = opts.state.buffers[opts.fullPath]
      const str = buffer.items[cursor.line].str
      let col = cursor.column

      for (let i = 0; i < count; i++) {
        // Skip current word
        while (col < str.length && isWordChar(str[col])) {
          col++
        }
        // Skip whitespace
        while (col < str.length && !isWordChar(str[col])) {
          col++
        }
      }

      return {
        line: cursor.line,
        column: Math.min(strLength - 1, col),
      }
    })
  }

  export function b(opts: CommandOpts): CommandResult {
    return moveCursor(opts, (count, cursor) => {
      const buffer = opts.state.buffers[opts.fullPath]
      const str = buffer.items[cursor.line].str
      let col = cursor.column

      for (let i = 0; i < count; i++) {
        // Move back one position if we're at the start of a word
        if (col > 0) {
          col--
        }
        // Skip whitespace
        while (col > 0 && !isWordChar(str[col])) {
          col--
        }
        // Skip to beginning of word
        while (col > 0 && isWordChar(str[col - 1])) {
          col--
        }
      }

      return {
        line: cursor.line,
        column: Math.max(0, col),
      }
    })
  }

  export function e(opts: CommandOpts): CommandResult {
    return moveCursor(opts, (count, cursor, strLength) => {
      const buffer = opts.state.buffers[opts.fullPath]
      const str = buffer.items[cursor.line].str
      let col = cursor.column

      for (let i = 0; i < count; i++) {
        // Move forward one position if we're at the end of a word
        if (col < str.length - 1) {
          col++
        }
        // Skip whitespace
        while (col < str.length && !isWordChar(str[col])) {
          col++
        }
        // Skip to end of word
        while (col < str.length - 1 && isWordChar(str[col + 1])) {
          col++
        }
      }

      return {
        line: cursor.line,
        column: Math.min(strLength - 1, col),
      }
    })
  }

  // Insert mode commands
  export function i(opts: CommandOpts): CommandResult {
    return {
      ...opts.state,
      mode: 'insert',
    }
  }

  export function a(opts: CommandOpts): CommandResult {
    const r = moveCursor(opts, (_count, cursor, strLength) => ({
      column: Math.min(strLength - 1, cursor.column + 1),
      line: cursor.line,
    }))
    r.mode = 'insert'
    return r
  }

  export function A(opts: CommandOpts): CommandResult {
    const r = moveCursor(opts, (_count, cursor, strLength) => ({
      column: strLength,
      line: cursor.line,
    }))
    r.mode = 'insert'
    return r
  }

  // Character find commands - these just return state, actual movement happens via executeFind
  export function f(opts: CommandOpts): CommandResult {
    return { ...opts.state, pendingFindCommand: 'f' }
  }

  export function F(opts: CommandOpts): CommandResult {
    return { ...opts.state, pendingFindCommand: 'F' }
  }

  export function t(opts: CommandOpts): CommandResult {
    return { ...opts.state, pendingFindCommand: 't' }
  }

  export function T(opts: CommandOpts): CommandResult {
    return { ...opts.state, pendingFindCommand: 'T' }
  }

  export function clearPendingFindCommand(opts: CommandOpts): CommandResult {
    return { ...opts.state, pendingFindCommand: null }
  }

  export function executeFind(
    opts: CommandOpts,
    command: 'f' | 'F' | 't' | 'T',
    char: string,
    dontStoreFindState?: boolean
  ): CommandResult {
    if (!dontStoreFindState) {
      lastFindState = { command, char }
    }

    let result: CommandResult

    switch (command) {
      case 'f':
        result = moveCursor(opts, (count, cursor) => {
          const buffer = opts.state.buffers[opts.fullPath]
          const str = buffer.items[cursor.line].str
          let col = cursor.column

          for (let i = 0; i < count; i++) {
            let found = false
            for (let j = col + 1; j < str.length; j++) {
              if (str[j] === char) {
                col = j
                found = true
                break
              }
            }
            if (!found) break
          }

          return {
            line: cursor.line,
            column: col,
          }
        })
        break

      case 'F':
        result = moveCursor(opts, (count, cursor) => {
          const buffer = opts.state.buffers[opts.fullPath]
          const str = buffer.items[cursor.line].str
          let col = cursor.column

          for (let i = 0; i < count; i++) {
            let found = false
            for (let j = col - 1; j >= 0; j--) {
              if (str[j] === char) {
                col = j
                found = true
                break
              }
            }
            if (!found) break
          }

          return {
            line: cursor.line,
            column: col,
          }
        })
        break

      case 't':
        result = moveCursor(opts, (count, cursor) => {
          const buffer = opts.state.buffers[opts.fullPath]
          const str = buffer.items[cursor.line].str
          let col = cursor.column

          for (let i = 0; i < count; i++) {
            let found = false
            for (let j = col + 1; j < str.length; j++) {
              if (str[j] === char) {
                col = j - 1
                found = true
                break
              }
            }
            if (!found) break
          }

          return {
            line: cursor.line,
            column: col,
          }
        })
        break

      case 'T':
        result = moveCursor(opts, (count, cursor) => {
          const buffer = opts.state.buffers[opts.fullPath]
          const str = buffer.items[cursor.line].str
          let col = cursor.column

          for (let i = 0; i < count; i++) {
            let found = false
            for (let j = col - 1; j >= 0; j--) {
              if (str[j] === char) {
                col = j + 1
                found = true
                break
              }
            }
            if (!found) break
          }

          return {
            line: cursor.line,
            column: col,
          }
        })
        break
      default:
        Typescript.assertUnreachable(command)
    }

    result.pendingFindCommand = null
    return result
  }

  // Repeat find commands
  export function semicolon(opts: CommandOpts): CommandResult {
    if (!lastFindState) return opts.state

    const { command, char } = lastFindState
    return executeFind(opts, command, char, true)
  }

  export function comma(opts: CommandOpts): CommandResult {
    if (!lastFindState) return opts.state

    const { command, char } = lastFindState
    // Reverse direction
    const reverseCommand: 'f' | 'F' | 't' | 'T' =
      command === 'f' ? 'F' : command === 'F' ? 'f' : command === 't' ? 'T' : 't'

    return executeFind(opts, reverseCommand, char, true)
  }
}
