import Fuse from 'fuse.js'
import { VimEngine } from './VimEngine'

export namespace VimFuzzy {
  export function setFuzzyQuery({ state, fullPath }: VimEngine.CommandOpts, query: string): VimEngine.CommandResult {
    const buffer = state.buffers[fullPath]
    if (!buffer) return state

    let fuzzyState: VimEngine.FuzzyState | undefined

    const cachedByItems = buffer.fuzzyCache.get(buffer.items)
    if (cachedByItems) {
      const matchesCached = cachedByItems.matches[query]
      fuzzyState = {
        active: true,
        fuse: cachedByItems.fuse,
        matches: matchesCached ?? calculateMatches(cachedByItems.fuse, query, cachedByItems),
        query,
      }
    } else {
      const fuse = createFuse(buffer.items)
      const cachedByItems = { fuse, matches: {} }
      buffer.fuzzyCache.set(buffer.items, cachedByItems)
      fuzzyState = {
        active: true,
        fuse,
        matches: calculateMatches(fuse, query, cachedByItems),
        query,
      }
    }

    return {
      ...state,
      buffers: {
        ...state.buffers,
        [fullPath]: {
          ...buffer,
          fuzzy: fuzzyState,
        },
      },
    }
  }

  function createFuse(items: VimEngine.BufferItem[]): Fuse<VimEngine.BufferItem> {
    return new Fuse(items, {
      threshold: 0.3,
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
    cachedByItems: VimEngine.FuzzyCacheItem
  ): VimEngine.FuzzyMatches {
    const matches = fuse.search(query)
    const result: VimEngine.FuzzyMatches = []
    for (const row of matches) {
      for (const match of row.matches!) {
        for (const [start, end] of match.indices) {
          result.push({
            row: row.refIndex,
            columns: [start, end],
          })
        }
      }
    }
    cachedByItems.matches[query] = result
    return result
  }
}
