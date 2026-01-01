import { describe, it, expect } from 'vitest'
import { VimEngine } from './VimEngine.js'
import { HistoryStack } from './history-stack.js'

// Helper function to create a simple buffer
function createBuffer(items: string[], fullPath = '/test/file.txt'): VimEngine.Buffer {
  return {
    fullPath,
    items: items.map(str => ({ type: 'str', str })),
    historyStack: new HistoryStack<VimEngine.HistoryItem>([]),
  }
}

// Helper function to create a simple state
function createState(
  items: string[],
  cursorLine = 0,
  cursorColumn = 0,
  mode: VimEngine.Mode = 'normal',
  count = 0,
  registry: string[] = []
): VimEngine.PerDirectoryState {
  const buffer = createBuffer(items)
  return {
    buffers: { [buffer.fullPath]: buffer },
    currentBuffer: buffer,
    cursor: { line: cursorLine, column: cursorColumn },
    registry: registry.map(str => ({ type: 'str', str })),
    mode,
    count,
  }
}

// Helper to compare states (ignoring history stack)
function expectStateEqual(actual: VimEngine.PerDirectoryState, expected: Partial<VimEngine.PerDirectoryState>) {
  if (expected.cursor) {
    expect(actual.cursor).toEqual(expected.cursor)
  }
  if (expected.mode !== undefined) {
    expect(actual.mode).toBe(expected.mode)
  }
  if (expected.count !== undefined) {
    expect(actual.count).toBe(expected.count)
  }
  if (expected.currentBuffer) {
    expect(actual.currentBuffer.items).toEqual(expected.currentBuffer.items)
  }
  if (expected.registry) {
    expect(actual.registry).toEqual(expected.registry)
  }
}

interface TestCase {
  description: string
  state: VimEngine.PerDirectoryState
  operation: (state: VimEngine.PerDirectoryState) => VimEngine.PerDirectoryState
  expected: Partial<VimEngine.PerDirectoryState>
}

// Test cases for cc (change line)
const ccTestCases: TestCase[] = [
  {
    description: 'cc - should delete current line and enter insert mode',
    state: createState(['line 1', 'line 2', 'line 3'], 1, 0),
    operation: VimEngine.cc,
    expected: {
      currentBuffer: createBuffer(['line 1', '', 'line 3']),
      cursor: { line: 1, column: 0 },
      mode: 'insert',
      count: 0,
      registry: [{ type: 'str', str: 'line 2' }],
    },
  },
  {
    description: 'cc - should delete first line',
    state: createState(['line 1', 'line 2', 'line 3'], 0, 5),
    operation: VimEngine.cc,
    expected: {
      currentBuffer: createBuffer(['', 'line 2', 'line 3']),
      cursor: { line: 0, column: 0 },
      mode: 'insert',
      registry: [{ type: 'str', str: 'line 1' }],
    },
  },
  {
    description: '2cc - should delete 2 lines with count',
    state: { ...createState(['line 1', 'line 2', 'line 3'], 0, 0), count: 2 },
    operation: VimEngine.cc,
    expected: {
      currentBuffer: createBuffer(['', 'line 3']),
      cursor: { line: 0, column: 0 },
      mode: 'insert',
      count: 0,
      registry: [
        { type: 'str', str: 'line 1' },
        { type: 'str', str: 'line 2' },
      ],
    },
  },
  {
    description: '3cc - should delete all 3 lines',
    state: { ...createState(['line 1', 'line 2', 'line 3'], 0, 0), count: 3 },
    operation: VimEngine.cc,
    expected: {
      currentBuffer: createBuffer(['']),
      cursor: { line: 0, column: 0 },
      mode: 'insert',
      count: 0,
      registry: [
        { type: 'str', str: 'line 1' },
        { type: 'str', str: 'line 2' },
        { type: 'str', str: 'line 3' },
      ],
    },
  },
]

// Test cases for dd (delete line)
const ddTestCases: TestCase[] = [
  {
    description: 'dd - should delete current line and stay in normal mode',
    state: createState(['line 1', 'line 2', 'line 3'], 1, 0),
    operation: VimEngine.dd,
    expected: {
      currentBuffer: createBuffer(['line 1', 'line 3']),
      cursor: { line: 1, column: 0 },
      mode: 'normal',
      count: 0,
      registry: [{ type: 'str', str: 'line 2' }],
    },
  },
  {
    description: 'dd - should delete last line and move cursor up',
    state: createState(['line 1', 'line 2', 'line 3'], 2, 0),
    operation: VimEngine.dd,
    expected: {
      currentBuffer: createBuffer(['line 1', 'line 2']),
      cursor: { line: 1, column: 0 },
      mode: 'normal',
      registry: [{ type: 'str', str: 'line 3' }],
    },
  },
  {
    description: '2dd - should delete 2 lines with count',
    state: { ...createState(['line 1', 'line 2', 'line 3'], 1, 0), count: 2 },
    operation: VimEngine.dd,
    expected: {
      currentBuffer: createBuffer(['line 1']),
      cursor: { line: 0, column: 0 },
      mode: 'normal',
      count: 0,
      registry: [
        { type: 'str', str: 'line 2' },
        { type: 'str', str: 'line 3' },
      ],
    },
  },
  {
    description: 'dd - should keep one empty line when deleting all content',
    state: createState(['only line'], 0, 0),
    operation: VimEngine.dd,
    expected: {
      currentBuffer: createBuffer(['']),
      cursor: { line: 0, column: 0 },
      mode: 'normal',
      registry: [{ type: 'str', str: 'only line' }],
    },
  },
  {
    description: 'dd - should adjust cursor column if line is shorter',
    state: createState(['long line here', 'short'], 0, 10),
    operation: VimEngine.dd,
    expected: {
      currentBuffer: createBuffer(['short']),
      cursor: { line: 0, column: 5 },
      mode: 'normal',
    },
  },
]

// Test cases for yy (yank line)
const yyTestCases: TestCase[] = [
  {
    description: 'yy - should copy current line without changing buffer',
    state: createState(['line 1', 'line 2', 'line 3'], 1, 0),
    operation: VimEngine.yy,
    expected: {
      currentBuffer: createBuffer(['line 1', 'line 2', 'line 3']),
      cursor: { line: 1, column: 0 },
      mode: 'normal',
      count: 0,
      registry: [{ type: 'str', str: 'line 2' }],
    },
  },
  {
    description: '2yy - should copy 2 lines with count',
    state: { ...createState(['line 1', 'line 2', 'line 3'], 0, 0), count: 2 },
    operation: VimEngine.yy,
    expected: {
      currentBuffer: createBuffer(['line 1', 'line 2', 'line 3']),
      cursor: { line: 0, column: 0 },
      mode: 'normal',
      count: 0,
      registry: [
        { type: 'str', str: 'line 1' },
        { type: 'str', str: 'line 2' },
      ],
    },
  },
  {
    description: 'yy - should copy last line',
    state: createState(['line 1', 'line 2', 'line 3'], 2, 5),
    operation: VimEngine.yy,
    expected: {
      cursor: { line: 2, column: 5 },
      mode: 'normal',
      count: 0,
      registry: [{ type: 'str', str: 'line 3' }],
    },
  },
  {
    description: '10yy - should not copy beyond buffer length',
    state: { ...createState(['line 1', 'line 2'], 0, 0), count: 10 },
    operation: VimEngine.yy,
    expected: {
      count: 0,
      registry: [
        { type: 'str', str: 'line 1' },
        { type: 'str', str: 'line 2' },
      ],
    },
  },
]

// Test cases for p (paste after)
const pTestCases: TestCase[] = [
  {
    description: 'p - should paste after current line',
    state: createState(['line 1', 'line 2'], 0, 0, 'normal', 0, ['pasted']),
    operation: VimEngine.p,
    expected: {
      currentBuffer: createBuffer(['line 1', 'pasted', 'line 2']),
      cursor: { line: 1, column: 0 },
      mode: 'normal',
      count: 0,
      registry: [{ type: 'str', str: 'pasted' }],
    },
  },
  {
    description: 'p - should paste multiple lines after current line',
    state: createState(['line 1', 'line 2'], 0, 0, 'normal', 0, ['paste 1', 'paste 2']),
    operation: VimEngine.p,
    expected: {
      currentBuffer: createBuffer(['line 1', 'paste 1', 'paste 2', 'line 2']),
      cursor: { line: 1, column: 0 },
      mode: 'normal',
    },
  },
  {
    description: 'p - should paste at end of buffer',
    state: createState(['line 1'], 0, 0, 'normal', 0, ['new line']),
    operation: VimEngine.p,
    expected: {
      currentBuffer: createBuffer(['line 1', 'new line']),
      cursor: { line: 1, column: 0 },
      mode: 'normal',
    },
  },
]

// Test cases for P (paste before)
const PTestCases: TestCase[] = [
  {
    description: 'P - should paste before current line',
    state: createState(['line 1', 'line 2'], 1, 0, 'normal', 0, ['pasted']),
    operation: VimEngine.P,
    expected: {
      currentBuffer: createBuffer(['line 1', 'pasted', 'line 2']),
      cursor: { line: 1, column: 0 },
      mode: 'normal',
      registry: [{ type: 'str', str: 'pasted' }],
    },
  },
  {
    description: 'P - should paste before first line',
    state: createState(['line 1', 'line 2'], 0, 5, 'normal', 0, ['new first']),
    operation: VimEngine.P,
    expected: {
      currentBuffer: createBuffer(['new first', 'line 1', 'line 2']),
      cursor: { line: 0, column: 0 },
      mode: 'normal',
    },
  },
  {
    description: 'P - should paste multiple lines before current line',
    state: createState(['line 1', 'line 2'], 1, 0, 'normal', 0, ['paste 1', 'paste 2']),
    operation: VimEngine.P,
    expected: {
      currentBuffer: createBuffer(['line 1', 'paste 1', 'paste 2', 'line 2']),
      cursor: { line: 1, column: 0 },
      mode: 'normal',
    },
  },
]

// Test cases for u (undo)
const uTestCases: TestCase[] = [
  {
    description: 'u - should undo dd operation',
    state: (() => {
      const initial = createState(['line 1', 'line 2', 'line 3'], 1, 0)
      const afterDd = VimEngine.dd(initial)
      return afterDd
    })(),
    operation: VimEngine.u,
    expected: {
      currentBuffer: createBuffer(['line 1', 'line 2', 'line 3']),
      cursor: { line: 1, column: 0 },
    },
  },
  {
    description: 'u - should undo cc operation and restore line',
    state: (() => {
      const initial = createState(['line 1', 'line 2', 'line 3'], 1, 0)
      const afterCc = VimEngine.cc(initial)
      return afterCc
    })(),
    operation: VimEngine.u,
    expected: {
      currentBuffer: createBuffer(['line 1', 'line 2', 'line 3']),
      cursor: { line: 1, column: 0 },
    },
  },
  {
    description: '2u - should undo 2 operations',
    state: (() => {
      let state = createState(['line 1', 'line 2', 'line 3', 'line 4'], 0, 0)
      state = VimEngine.dd(state) // Deletes "line 1"
      state = VimEngine.dd(state) // Deletes "line 2"
      state = VimEngine.dd(state) // Deletes "line 3"
      state.count = 2
      return state
    })(),
    operation: VimEngine.u,
    expected: {
      // Undoes last 2 deletions, restoring "line 3" then "line 2"
      currentBuffer: createBuffer(['line 2', 'line 3', 'line 4']),
      count: 0,
    },
  },
]

// Test cases for ciw (change inner word)
const ciwTestCases: TestCase[] = [
  {
    description: 'ciw - should delete word under cursor',
    state: createState(['hello world'], 0, 0),
    operation: VimEngine.ciw,
    expected: {
      currentBuffer: createBuffer([' world']),
      cursor: { line: 0, column: 0 },
      mode: 'insert',
      count: 0,
    },
  },
  {
    description: 'ciw - should delete word in middle',
    state: createState(['hello world foo'], 0, 6),
    operation: VimEngine.ciw,
    expected: {
      currentBuffer: createBuffer(['hello  foo']),
      cursor: { line: 0, column: 6 },
      mode: 'insert',
    },
  },
  {
    description: 'ciw - should delete word at end',
    state: createState(['hello world'], 0, 8),
    operation: VimEngine.ciw,
    expected: {
      currentBuffer: createBuffer(['hello ']),
      cursor: { line: 0, column: 6 },
      mode: 'insert',
    },
  },
  {
    description: 'ciw - should delete single character if not word (space)',
    state: createState(['hello   world'], 0, 6),
    operation: VimEngine.ciw,
    expected: {
      currentBuffer: createBuffer(['hello  world']),
      cursor: { line: 0, column: 6 },
      mode: 'insert',
    },
  },
  {
    description: 'ciw - should handle alphanumeric words',
    state: createState(['test123 abc'], 0, 4),
    operation: VimEngine.ciw,
    expected: {
      currentBuffer: createBuffer([' abc']),
      cursor: { line: 0, column: 0 },
      mode: 'insert',
    },
  },
]

// Test cases for C (change to end of line)
const CTestCases: TestCase[] = [
  {
    description: 'C - should delete from cursor to end of line',
    state: createState(['hello world'], 0, 6),
    operation: VimEngine.C,
    expected: {
      currentBuffer: createBuffer(['hello ']),
      cursor: { line: 0, column: 6 },
      mode: 'insert',
      count: 0,
    },
  },
  {
    description: 'C - should delete everything from column 0',
    state: createState(['hello world'], 0, 0),
    operation: VimEngine.C,
    expected: {
      currentBuffer: createBuffer(['']),
      cursor: { line: 0, column: 0 },
      mode: 'insert',
    },
  },
  {
    description: 'C - from middle of word',
    state: createState(['test'], 0, 2),
    operation: VimEngine.C,
    expected: {
      currentBuffer: createBuffer(['te']),
      cursor: { line: 0, column: 2 },
      mode: 'insert',
    },
  },
]

// Test cases for addToCount
const addToCountTestCases: TestCase[] = [
  {
    description: 'addToCount - should set count from 0',
    state: createState(['line 1'], 0, 0),
    operation: s => VimEngine.addToCount(s, 3),
    expected: {
      count: 3,
    },
  },
  {
    description: 'addToCount - should build multi-digit count',
    state: { ...createState(['line 1'], 0, 0), count: 3 },
    operation: s => VimEngine.addToCount(s, 5),
    expected: {
      count: 35,
    },
  },
  {
    description: 'addToCount - should build 3-digit count',
    state: { ...createState(['line 1'], 0, 0), count: 12 },
    operation: s => VimEngine.addToCount(s, 7),
    expected: {
      count: 127,
    },
  },
]

// Combine all test cases
const allTestCases: TestCase[] = [
  ...ccTestCases,
  ...ddTestCases,
  ...yyTestCases,
  ...pTestCases,
  ...PTestCases,
  ...uTestCases,
  ...ciwTestCases,
  ...CTestCases,
  ...addToCountTestCases,
]

describe('VimEngine', () => {
  allTestCases.forEach(testCase => {
    it(testCase.description, () => {
      const result = testCase.operation(testCase.state)
      expectStateEqual(result, testCase.expected)
    })
  })
})

// Multi-operation workflow tests
describe('VimEngine - Multi-operation workflows', () => {
  it('yy, p, dd, u should restore to state after paste', () => {
    let state = createState(['line 1', 'line 2', 'line 3'], 1, 0)

    // Yank line 2
    state = VimEngine.yy(state)
    expect(state.registry).toHaveLength(1)
    expect(state.registry[0].str).toBe('line 2')

    // Paste after line 2 (creates duplicate)
    state = VimEngine.p(state)
    expect(state.currentBuffer.items).toHaveLength(4)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 2', 'line 2', 'line 3'])
    expect(state.cursor.line).toBe(2)

    // Delete the pasted line
    state = VimEngine.dd(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 2', 'line 3'])

    // Undo the deletion - should restore pasted line
    state = VimEngine.u(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 2', 'line 2', 'line 3'])
  })

  it('dd, dd, dd, 3u should restore all deleted lines', () => {
    let state = createState(['line 1', 'line 2', 'line 3', 'line 4'], 0, 0)

    // Delete 3 lines one by one
    state = VimEngine.dd(state)
    state = VimEngine.dd(state)
    state = VimEngine.dd(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 4'])

    // Undo all 3 deletions
    state.count = 3
    state = VimEngine.u(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 2', 'line 3', 'line 4'])
  })

  it('cc, type new line (simulated), u should restore original line', () => {
    let state = createState(['original line', 'line 2'], 0, 0)

    // Change line (cc)
    state = VimEngine.cc(state)
    expect(state.mode).toBe('insert')
    expect(state.currentBuffer.items[0].str).toBe('')

    // Simulate typing "new line" (we'll manually update the buffer)
    state = {
      ...state,
      currentBuffer: {
        ...state.currentBuffer,
        items: [{ type: 'str', str: 'new line' }, ...state.currentBuffer.items.slice(1)],
      },
      mode: 'normal',
    }

    // Undo should restore "original line"
    state = VimEngine.u(state)
    expect(state.currentBuffer.items[0].str).toBe('original line')
  })

  it('dd, p, P, u, u should undo both pastes', () => {
    let state = createState(['line 1', 'line 2', 'line 3'], 1, 0)

    // Delete line 2
    state = VimEngine.dd(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 3'])
    expect(state.registry[0].str).toBe('line 2')

    // Paste after (restores line 2)
    state = VimEngine.p(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 3', 'line 2'])

    // Paste before (creates another copy)
    state = VimEngine.P(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 3', 'line 2', 'line 2'])

    // Undo P
    state = VimEngine.u(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 3', 'line 2'])

    // Undo p
    state = VimEngine.u(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 3'])
  })

  it('yy, dd, p should paste deleted line, not yanked line', () => {
    let state = createState(['line 1', 'line 2', 'line 3'], 0, 0)

    // Yank line 1
    state = VimEngine.yy(state)
    expect(state.registry[0].str).toBe('line 1')

    // Delete line 2 (overwrites registry)
    state = { ...state, cursor: { line: 1, column: 0 } }
    state = VimEngine.dd(state)
    expect(state.registry[0].str).toBe('line 2')

    // Paste should paste "line 2", not "line 1"
    state = VimEngine.p(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 3', 'line 2'])
  })

  it('2dd, u, dd, 2u should handle mixed counts correctly', () => {
    let state = createState(['line 1', 'line 2', 'line 3', 'line 4', 'line 5'], 0, 0)

    // Delete 2 lines
    state.count = 2
    state = VimEngine.dd(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 3', 'line 4', 'line 5'])

    // Undo (restores 2 lines)
    state = VimEngine.u(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 2', 'line 3', 'line 4', 'line 5'])

    // Delete 1 line
    state = VimEngine.dd(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 2', 'line 3', 'line 4', 'line 5'])

    // Undo 2 times (should undo dd and 2dd)
    state.count = 2
    state = VimEngine.u(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 2', 'line 3', 'line 4', 'line 5'])
  })

  it('cc, undo, cc again should work correctly', () => {
    let state = createState(['line 1', 'line 2', 'line 3'], 1, 0)

    // Change line 2
    state = VimEngine.cc(state)
    expect(state.currentBuffer.items[1].str).toBe('')

    // Undo
    state = VimEngine.u(state)
    expect(state.currentBuffer.items[1].str).toBe('line 2')

    // Change line 2 again
    state = VimEngine.cc(state)
    expect(state.currentBuffer.items[1].str).toBe('')
    expect(state.mode).toBe('insert')
  })

  it('complex workflow: dd, yy, p, cc, u, u should maintain correct state', () => {
    let state = createState(['line 1', 'line 2', 'line 3', 'line 4'], 0, 0)

    // Delete line 1
    state = VimEngine.dd(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 2', 'line 3', 'line 4'])

    // Yank line 2 (now at index 0)
    state = VimEngine.yy(state)
    expect(state.registry[0].str).toBe('line 2')

    // Paste after line 2
    state = VimEngine.p(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 2', 'line 2', 'line 3', 'line 4'])
    expect(state.cursor.line).toBe(1)

    // Change the pasted line
    state = VimEngine.cc(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 2', '', 'line 3', 'line 4'])

    // Undo cc
    state = VimEngine.u(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 2', 'line 2', 'line 3', 'line 4'])

    // Undo p
    state = VimEngine.u(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 2', 'line 3', 'line 4'])
  })

  it('P at start of file, then multiple undos', () => {
    let state = createState(['line 1', 'line 2'], 0, 0, 'normal', 0, ['new line'])

    // Paste before line 1
    state = VimEngine.P(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['new line', 'line 1', 'line 2'])

    // Delete the new first line
    state = VimEngine.dd(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 2'])

    // Undo dd
    state = VimEngine.u(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['new line', 'line 1', 'line 2'])

    // Undo P
    state = VimEngine.u(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 2'])
  })

  it('multiple cc operations with undo', () => {
    let state = createState(['line 1', 'line 2', 'line 3'], 0, 0)

    // cc line 1
    state = VimEngine.cc(state)
    expect(state.currentBuffer.items[0].str).toBe('')

    // Move to line 2 and cc
    state = { ...state, cursor: { line: 1, column: 0 }, mode: 'normal' }
    state = VimEngine.cc(state)
    expect(state.currentBuffer.items[1].str).toBe('')

    // Move to line 3 and cc
    state = { ...state, cursor: { line: 2, column: 0 }, mode: 'normal' }
    state = VimEngine.cc(state)
    expect(state.currentBuffer.items[2].str).toBe('')

    // Undo all 3 cc operations
    state.count = 3
    state = VimEngine.u(state)
    expect(state.currentBuffer.items.map(i => i.str)).toEqual(['line 1', 'line 2', 'line 3'])
  })

  it('registry persists across operations correctly', () => {
    let state = createState(['a', 'b', 'c', 'd'], 0, 0)

    // Yank 'a'
    state = VimEngine.yy(state)
    const firstRegistry = [...state.registry]

    // Move and yank 'b'
    state = { ...state, cursor: { line: 1, column: 0 } }
    state = VimEngine.yy(state)
    expect(state.registry[0].str).toBe('b')
    expect(state.registry).not.toEqual(firstRegistry)

    // Delete 'c' - should update registry
    state = { ...state, cursor: { line: 2, column: 0 } }
    state = VimEngine.dd(state)
    expect(state.registry[0].str).toBe('c')

    // Paste should paste 'c'
    state = VimEngine.p(state)
    expect(state.currentBuffer.items[state.cursor.line].str).toBe('c')
  })
})
