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
    if (opts.state.pendingOperator) {
      const buffer = opts.state.buffers[opts.fullPath]
      const count = getEffectiveCount(opts.state)
      const str = buffer.items[buffer.cursor.line].str
      const endCol = Math.min(str.length, buffer.cursor.column + count)

      return VimEngine.executeOperatorWithRange(opts, {
        start: buffer.cursor.column,
        end: endCol,
      })
    }

    return moveCursor(opts, (count, cursor, strLength) => ({
      line: cursor.line,
      column: Math.min(strLength - 1, cursor.column + count),
    }))
  }

  export function h(opts: CommandOpts): CommandResult {
    if (opts.state.pendingOperator) {
      const buffer = opts.state.buffers[opts.fullPath]
      const count = getEffectiveCount(opts.state)
      const startCol = Math.max(0, buffer.cursor.column - count)

      return VimEngine.executeOperatorWithRange(opts, {
        start: startCol,
        end: buffer.cursor.column,
      })
    }

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
    // If there's a text object modifier, handle it
    if (opts.state.textObjectModifier) {
      return textObjectW(opts)
    }

    // If there's a pending operator, execute it with the range
    if (opts.state.pendingOperator) {
      const buffer = opts.state.buffers[opts.fullPath]
      const str = buffer.items[buffer.cursor.line].str
      const count = getEffectiveCount(opts.state)
      let col = buffer.cursor.column

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

      return VimEngine.executeOperatorWithRange(opts, {
        start: buffer.cursor.column,
        end: col,
      })
    }

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
    // If there's a pending operator, execute it with the range
    if (opts.state.pendingOperator) {
      const buffer = opts.state.buffers[opts.fullPath]
      const str = buffer.items[buffer.cursor.line].str
      const count = getEffectiveCount(opts.state)
      let col = buffer.cursor.column

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

      return VimEngine.executeOperatorWithRange(opts, {
        start: col,
        end: buffer.cursor.column,
      })
    }

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
    // If there's a pending operator, execute it with the range
    if (opts.state.pendingOperator) {
      const buffer = opts.state.buffers[opts.fullPath]
      const str = buffer.items[buffer.cursor.line].str
      const count = getEffectiveCount(opts.state)
      let col = buffer.cursor.column

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

      return VimEngine.executeOperatorWithRange(opts, {
        start: buffer.cursor.column,
        end: col + 1, // Include the character at the end position
      })
    }

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
    // If there's a pending operator, this is a text object modifier
    if (opts.state.pendingOperator) {
      return {
        ...opts.state,
        textObjectModifier: 'i',
      }
    }

    return {
      ...opts.state,
      mode: 'insert',
    }
  }

  export function a(opts: CommandOpts): CommandResult {
    // If there's a pending operator, this is a text object modifier
    if (opts.state.pendingOperator) {
      return {
        ...opts.state,
        textObjectModifier: 'a',
      }
    }

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

  // Text object modifier functions
  export function setTextObjectModifier(opts: CommandOpts, modifier: VimEngine.TextObjectModifier): CommandResult {
    return {
      ...opts.state,
      textObjectModifier: modifier,
    }
  }

  // Helper function to find word boundaries
  function findWordBoundaries(str: string, col: number): { start: number; end: number } {
    let start = col
    let end = col

    // If we're on whitespace, find the next word
    if (!isWordChar(str[col]) && col < str.length) {
      while (end < str.length && !isWordChar(str[end])) {
        end++
      }
      start = end
    }

    // Find start of word
    while (start > 0 && isWordChar(str[start - 1])) {
      start--
    }

    // Find end of word
    while (end < str.length && isWordChar(str[end])) {
      end++
    }

    return { start, end }
  }

  // Text object: inner word
  function textObjectInnerWord(opts: CommandOpts): CommandResult {
    const buffer = opts.state.buffers[opts.fullPath]
    const str = buffer.items[buffer.cursor.line].str
    const { start, end } = findWordBoundaries(str, buffer.cursor.column)

    if (opts.state.pendingOperator) {
      return VimEngine.executeOperatorWithRange(opts, { start, end })
    }

    return opts.state
  }

  // Text object: a word (includes surrounding whitespace)
  function textObjectAroundWord(opts: CommandOpts): CommandResult {
    const buffer = opts.state.buffers[opts.fullPath]
    const str = buffer.items[buffer.cursor.line].str
    let { start, end } = findWordBoundaries(str, buffer.cursor.column)

    // Include trailing whitespace
    while (end < str.length && !isWordChar(str[end])) {
      end++
    }

    // If no trailing whitespace, include leading whitespace
    if (end === start || !isWordChar(str[end - 1])) {
      while (start > 0 && !isWordChar(str[start - 1])) {
        start--
      }
    }

    if (opts.state.pendingOperator) {
      return VimEngine.executeOperatorWithRange(opts, { start, end })
    }

    return opts.state
  }

  // Text object dispatcher - handles movements after i/a modifier
  export function textObjectW(opts: CommandOpts): CommandResult {
    if (opts.state.textObjectModifier === 'i') {
      return textObjectInnerWord(opts)
    } else if (opts.state.textObjectModifier === 'a') {
      return textObjectAroundWord(opts)
    }

    // If no text object modifier, this is just a normal w movement
    return w(opts)
  }
}
