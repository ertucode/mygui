import { subscribeToStores, createUseDerivedStoreValue } from '@/lib/functions/storeHelpers'
import { scrollRowIntoViewIfNeeded } from '@/lib/libs/table/globalTableScroll'
import { GetFilesAndFoldersInDirectoryItem } from '@common/Contracts'
import { directoryHelpers } from './directoryHelpers'
import { fileBrowserSettingsStore } from '../settings'
import { DirectoryDataFromSettings } from '../utils/DirectoryDataFromSettings'
import Fuse from 'fuse.js'
import { directoryStore } from './directory'
import { DerivedDirectoryItem, DirectoryId } from './DirectoryBase'
import { directorySelection } from './directorySelection'
import { columnPreferencesStore } from '../columnPreferences'
import { resolveSortFromStores, SortState } from '../schemas'

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

function filterByQuery(
  directoryData: GetFilesAndFoldersInDirectoryItem[],
  query: string
): GetFilesAndFoldersInDirectoryItem[] {
  if (!query) return directoryData

  const fuse = new Fuse(directoryData, {
    threshold: 0.3,
    minMatchCharLength: 1,
    keys: ['name'],
    shouldSort: true,
    isCaseSensitive: false,
  })

  const results = fuse.search(query)
  return results.map(result => result.item)
}

export function setupSubscriptions(directoryId: DirectoryId) {
  const subscriptions: (() => void)[] = []
  directorySubscriptions.set(directoryId, subscriptions)
  subscriptions.push(
    subscribeToStores(
      [directoryStore],
      ([s]) => [s.directoriesById[directoryId]?.directoryData],
      _ => {
        directorySelection.resetSelection(directoryId)
      }
    )
  )

  subscriptions.push(
    subscribeToStores(
      [directoryStore],
      ([s]) => [s.directoriesById[directoryId]?.selection.last],
      ([s]) => {
        const ss = s.directoriesById[directoryId]
        if (!ss) return
        if (ss.selection.last != null) {
          scrollRowIntoViewIfNeeded(ss.directoryId, ss.selection.last)
        }
      }
    )
  )

  // TODO: find a better way
  const [useSort, getSort] = createUseDerivedStoreValue(
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

  const [useFilteredDirectoryData, getFilteredDirectoryData] = createUseDerivedStoreValue(
    [directoryStore, fileBrowserSettingsStore, columnPreferencesStore],
    ([d, settings, columnPrefs]) => {
      const dir = d.directoriesById[directoryId]
      const fullPath = dir?.directory.type === 'path' ? dir.directory.fullPath : undefined
      return [
        dir?.directoryData,
        settings.settings,
        dir?.fuzzyQuery,
        JSON.stringify(resolveSortFromStores(dir, columnPrefs)),
        fullPath && d.vim.buffers[fullPath]?.items,
      ]
    },
    ([d, settings, columnPrefs]): DerivedDirectoryItem[] => {
      const dir = d.directoriesById[directoryId]
      const fullPath = dir?.directory.type === 'path' ? dir.directory.fullPath : undefined
      if (fullPath && d.vim.buffers[fullPath]?.items) return d.vim.buffers[fullPath].items

      const sort = resolveSortFromStores(dir, columnPrefs)
      const directoryData = DirectoryDataFromSettings.getDirectoryData(dir?.directoryData, settings.settings, sort)
      const filteredDirectoryData = filterByQuery(directoryData, d.directoriesById[directoryId]?.fuzzyQuery)

      return filteredDirectoryData.map(i => ({ type: 'real', str: i.name, item: i }))
    }
  )

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
            directorySelection.selectManually(newItemIndex, directoryId)
            scrollRowIntoViewIfNeeded(s.directoryId, newItemIndex)
          }
          directoryHelpers.setPendingSelection(null, directoryId)
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
