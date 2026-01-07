import Fuse from 'fuse.js'
import { VimEngine } from './VimEngine.js'

export namespace VimFuzzy {
  export function setFuzzyQuery(
    { state, fullPath }: VimEngine.CommandOpts,
    query: string,
    dontToucHistory = false
  ): VimEngine.CommandResult {
    const buffer = state.buffers[fullPath]
    if (!buffer) return state

    if (!dontToucHistory) buffer.fuzzy.history.goLatest().cleanUp(item => !!item)

    if (!query) {
      if (!buffer.fuzzy?.query) return state

      const [newState, newBuffer] = VimEngine.spreadBuffers(state, fullPath)
      newBuffer.fuzzy = {
        ...buffer.fuzzy,
        query: undefined,
      }
      return newState
    }

    let matches: VimEngine.FuzzyMatches | undefined

    const cachedByItems = buffer.fuzzy.cache.get(buffer.items)
    if (cachedByItems) {
      matches = cachedByItems.matches[query] ?? calculateMatches(cachedByItems.fuse, query, cachedByItems)
    } else {
      const fuse = createFuse(buffer.items)
      const cachedByItems = { fuse, matches: {} }
      buffer.fuzzy.cache.set(buffer.items, cachedByItems)
      matches = calculateMatches(fuse, query, cachedByItems)
    }

    const cursor: VimEngine.CursorPosition = matches[0]
      ? {
          column: 0,
          line: matches[0].line,
        }
      : buffer.cursor

    const [newState, newBuffer] = VimEngine.spreadBuffers(state, fullPath)
    newBuffer.fuzzy = {
      ...buffer.fuzzy,
      query,
      matches,
      cycleIndex: 0,
    }
    newBuffer.cursor = cursor

    return newState
  }

  export function fuzzyHistoryPrev({ state, fullPath }: VimEngine.CommandOpts): VimEngine.CommandResult {
    const buffer = state.buffers[fullPath]
    // Son itemde şu anki durumu itele
    if (!buffer.fuzzy.history.hasNext) {
      buffer.fuzzy.history.goNew(buffer.fuzzy?.query || '')
    }
    buffer.fuzzy.history.goPrevSafe()
    const res = buffer.fuzzy.history.current()
    if (!res) return state

    return setFuzzyQuery({ state, fullPath }, res, true)
  }
  export function fuzzyHistoryNext({ state, fullPath }: VimEngine.CommandOpts): VimEngine.CommandResult {
    const res = state.buffers[fullPath].fuzzy.history.goNextSafe()
    if (!res) return state

    return setFuzzyQuery({ state, fullPath }, res, true)
  }

  export function n(opts: VimEngine.CommandOpts): VimEngine.CommandResult {
    return nOrN(opts, 1)
  }

  export function N(opts: VimEngine.CommandOpts): VimEngine.CommandResult {
    return nOrN(opts, -1)
  }

  export function blurFuzzy({ state, fullPath }: VimEngine.CommandOpts): VimEngine.CommandResult {
    const buffer = state.buffers[fullPath]
    if (!buffer || !buffer.fuzzy) return state
    if (buffer.fuzzy.query) buffer.fuzzy.history.goNew(buffer.fuzzy.query)

    const [newState, newBuffer] = VimEngine.spreadBuffers(state, fullPath)
    newBuffer.fuzzy = {
      ...buffer.fuzzy,
      query: undefined,
    }
    buffer.fuzzy.history.goLatest().cleanUp(item => !!item)

    return newState
  }

  export function nOrN({ state, fullPath }: VimEngine.CommandOpts, direction: number): VimEngine.CommandResult {
    const buffer = state.buffers[fullPath]
    if (!buffer || !buffer.fuzzy.matches.length) return state

    const matches = buffer.fuzzy.matches
    let nextIdx
    if (direction === -1) {
      nextIdx =
        (((buffer.fuzzy.cycleIndex - VimEngine.getEffectiveCount(state)) % matches.length) + matches.length) %
        matches.length
    } else {
      nextIdx = (buffer.fuzzy.cycleIndex + VimEngine.getEffectiveCount(state)) % matches.length
    }
    const cursor: VimEngine.CursorPosition = {
      column: 0,
      line: matches[nextIdx].line,
    }

    const [newState, newBuffer] = VimEngine.spreadBuffers(state, fullPath)
    newState.count = 0
    newBuffer.fuzzy = {
      ...buffer.fuzzy,
      cycleIndex: nextIdx,
    }
    newBuffer.cursor = cursor

    return newState
  }

  function createFuse(items: VimEngine.BufferItem[]): Fuse<VimEngine.BufferItem> {
    return new Fuse(items, {
      threshold: 0.2,
      minMatchCharLength: 1,
      keys: ['str'],
      shouldSort: true,
      isCaseSensitive: false,
      findAllMatches: true,
      includeMatches: true,
    })
  }

  function calculateMatches(
    fuse: Fuse<VimEngine.BufferItem>,
    query: string,
    _cachedByItems: VimEngine.FuzzyCacheItem
  ): VimEngine.FuzzyMatches {
    const matches = fuse.search(query)
    const result: VimEngine.FuzzyMatches = []
    for (const row of matches) {
      for (const match of row.matches!) {
        result.push({
          line: row.refIndex,
          columnTuples: match.indices,
        })
      }
    }
    // şimdilik cachelemeyelim
    // cachedByItems.matches[query] = result
    return result
  }
}
