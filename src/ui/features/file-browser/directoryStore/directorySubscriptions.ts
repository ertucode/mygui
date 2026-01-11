import { subscribeToStores, createUseDerivedStoreValue } from '@/lib/functions/storeHelpers'
import { scrollRowIntoViewIfNeeded } from '@/lib/libs/table/globalTableScroll'
import { directoryHelpers } from './directoryHelpers'
import { fileBrowserSettingsStore } from '../settings'
import { DirectoryDataFromSettings } from '../utils/DirectoryDataFromSettings'
import { directoryStore } from './directory'
import { DerivedDirectoryItem, DirectoryId } from './DirectoryBase'
import { getCursorLine, getFullPathForBuffer } from './directoryPureHelpers'
import { columnPreferencesStore } from '../columnPreferences'
import { resolveSortFromStores, SortState } from '../schemas'
import { VimEngine } from '@common/VimEngine'

export const directorySubscriptions = new Map<DirectoryId, (() => void)[]>()

export const directoryDerivedStores = new Map<
  DirectoryId,
  {
    useFilteredDirectoryData: () => DerivedDirectoryItem[]
    getFilteredDirectoryData: () => DerivedDirectoryItem[] | undefined
    useSort: () => SortState
    getSort: () => SortState | undefined
  }
>()

export function setupSubscriptions(directoryId: DirectoryId) {
  const subscriptions: (() => void)[] = []
  directorySubscriptions.set(directoryId, subscriptions)

  subscriptions.push(
    subscribeToStores(
      [directoryStore],
      ([s]) => [getCursorLine(s, s.directoriesById[directoryId])],
      ([s]) => {
        const ss = s.directoriesById[directoryId]
        if (!ss) return
        const last = getCursorLine(s, s.directoriesById[directoryId])
        if (last != null) {
          scrollRowIntoViewIfNeeded(ss.directoryId, last)
        }
      }
    )
  )

  // TODO: find a better way
  const [useSort, getSort, unsubscribeSort] = createUseDerivedStoreValue(
    [directoryStore, columnPreferencesStore],
    ([d, columnPrefs]) => {
      const dir = d.directoriesById[directoryId]
      return [JSON.stringify(resolveSortFromStores(dir, columnPrefs))]
    },
    ([d, columnPrefs]) => {
      const dir = d.directoriesById[directoryId]
      const sort = resolveSortFromStores(dir, columnPrefs)
      return sort
    }
  )
  subscriptions.push(unsubscribeSort)

  const [useFilteredDirectoryData, getFilteredDirectoryData, unsubscribeFilteredDirectoryData] =
    createUseDerivedStoreValue(
      [directoryStore, fileBrowserSettingsStore, columnPreferencesStore],
      ([d, settings, columnPrefs]) => {
        const dir = d.directoriesById[directoryId]
        const fullPath = dir && getFullPathForBuffer(dir.directory)
        return [
          dir?.directoryData,
          settings.settings,
          JSON.stringify(resolveSortFromStores(dir, columnPrefs)),
          fullPath && d.vim.buffers[fullPath]?.items,
        ]
      },
      ([d, settings, columnPrefs]): DerivedDirectoryItem[] => {
        const dir = d.directoriesById[directoryId]
        if (!dir) return []
        const fullPath = dir && getFullPathForBuffer(dir.directory)
        if (fullPath && VimEngine.isActive(d.vim, fullPath)) {
          return d.vim.buffers[fullPath].items
        }

        const sort = resolveSortFromStores(dir, columnPrefs)
        const directoryData = DirectoryDataFromSettings.getDirectoryData(dir?.directoryData, settings.settings, sort)

        return directoryData.map(i => ({ type: 'real', str: i.name, item: i }))
      }
    )
  subscriptions.push(unsubscribeFilteredDirectoryData)

  directoryDerivedStores.set(directoryId, {
    useFilteredDirectoryData,
    getFilteredDirectoryData,
    useSort,
    getSort,
  })

  subscriptions.push(
    subscribeToStores(
      [directoryStore, fileBrowserSettingsStore],
      ([d, settings]) => [d.directoriesById[directoryId]?.pendingSelection, settings.settings],
      ([d]) => {
        const filteredDirectoryData = getFilteredDirectoryData()
        if (!filteredDirectoryData) return
        const s = d.directoriesById[directoryId]
        if (s.pendingSelection && filteredDirectoryData.length > 0) {
          const newItemIndex = filteredDirectoryData.findIndex(item => item.str === s.pendingSelection)
          if (newItemIndex !== -1) {
            directoryStore.trigger.setCursor({ cursor: { line: newItemIndex }, directoryId })
            scrollRowIntoViewIfNeeded(s.directoryId, newItemIndex)
          }
          directoryHelpers.setPendingSelection(null, directoryId)
        }
      }
    )
  )

  subscriptions.push(
    subscribeToStores(
      [directoryStore, fileBrowserSettingsStore],
      ([d, settings]) => [d.directoriesById[directoryId]?.directoryData, settings.settings],
      ([d]) => {
        const items = getFilteredDirectoryData()
        if (!items) return

        const snapshot = d
        const currentDir = snapshot.directoriesById[directoryId]
        if (!currentDir) return
        const fullPath = getFullPathForBuffer(currentDir.directory)
        if (!fullPath) return

        if (VimEngine.isActive(snapshot.vim, fullPath)) return

        const prevBuffer = snapshot.vim.buffers[fullPath]
        const nextBuffer = VimEngine.defaultBuffer(fullPath, items as VimEngine.RealBufferItem[])
        snapshot.vim.buffers[fullPath] = nextBuffer
        if (prevBuffer) {
          nextBuffer.cursor = VimEngine.reuseCursor(prevBuffer, nextBuffer)
        }
      }
    )
  )

  return subscriptions
}

export const unsubscribeDirectorySubscriptions = (directoryId: DirectoryId) => {
  const subscriptions = directorySubscriptions.get(directoryId)
  if (!subscriptions) return
  subscriptions.forEach(unsubscribe => unsubscribe())
  directorySubscriptions.delete(directoryId)
}

export function getFilteredData(dirId?: DirectoryId | undefined) {
  const directoryId = dirId ?? directoryStore.getSnapshot().context.activeDirectoryId
  return directoryDerivedStores.get(directoryId)?.getFilteredDirectoryData()!
}
