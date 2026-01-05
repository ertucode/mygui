import { getWindowElectron, homeDirectory, windowArgs } from '@/getWindowElectron'
import { toast } from '@/lib/components/toast'
import { ResultHandlerResult } from '@/lib/hooks/useDefaultResultHandler'
import { GetFilesAndFoldersInDirectoryItem } from '@common/Contracts'
import { GenericError } from '@common/GenericError'
import { mergeMaybeSlashed } from '@common/merge-maybe-slashed'
import { PathHelpers } from '@common/PathHelpers'
import { dialogActions } from '../dialogStore'
import { createResetSelection, directoryStore, loadDirectoryInfo } from './directory'
import { directoryLoadingHelpers } from './directoryLoadingStore'
import { selectIsFavorite, favoritesStore } from '../favorites'
import { recentsStore } from '../recents'
import { fileBrowserSettingsStore, fileBrowserSettingsHelpers } from '../settings'
import { TagColor } from '../tags'
import { DirectoryDataFromSettings } from '../utils/DirectoryDataFromSettings'
import { selectSettings as selectSettingsFromStore } from '../settings'
import { FileBrowserCache } from '../FileBrowserCache'
import { directoryDerivedStores } from './directorySubscriptions'
import { directorySelection } from './directorySelection'
import { DirectoryInfo, DirectoryId, DirectoryContextDirectory, DerivedDirectoryItem } from './DirectoryBase'
import { directoryInfoEquals, getActiveDirectory, getBufferSelection } from './directoryPureHelpers'
import { initialDirectoryInfo } from '../defaultPath'
import { columnPreferencesStore } from '../columnPreferences'
import { resolveSortFromStores } from '../schemas'
import { ArchiveHelpers } from '@common/ArchiveHelpers'
import { confirmation } from '@/lib/components/confirmation'
import { Tasks } from '@common/Tasks'
import { Brands } from '@common/Brands'

export const cd = async (newDirectory: DirectoryInfo, isNew: boolean, drectoryId: DirectoryId | undefined) => {
  const context = getActiveDirectory(directoryStore.getSnapshot().context, drectoryId)
  const directoryId = context.directoryId
  if (directoryInfoEquals(newDirectory, context.directory)) return
  if (isNew)
    directoryStore.send({
      type: 'historyGoNew',
      directory: newDirectory,
      directoryId,
    })
  directoryStore.send({
    type: 'setDirectory',
    directory: newDirectory,
    directoryId,
  })
  if (newDirectory.type === 'path') {
    recentsStore.send({
      type: 'addRecent',
      item: { fullPath: newDirectory.fullPath, type: 'dir' },
    })
  }
  return loadDirectoryInfo(newDirectory, directoryId)
}

const preloadDirectory = (dir: string) => {
  return FileBrowserCache.load(dir)
}

const getFullPath = (dir: string, directoryId: DirectoryId | undefined) => {
  const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
  if (context.directory.type === 'path') {
    return mergeMaybeSlashed(context.directory.fullPath, dir)
  }
  // For tags view, we cannot merge paths
  return dir
}

const getFullPathForItem = (item: GetFilesAndFoldersInDirectoryItem, directoryId: DirectoryId) => {
  return item.fullPath ?? getFullPath(item.name, directoryId)
}

const goNextOrPrev = async (directoryId: DirectoryId | undefined, nextOrPrev: 'Next' | 'Prev') => {
  const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
  if (!context.historyStack[`has${nextOrPrev}`]) return
  directoryStore.send({ type: `historyGo${nextOrPrev}`, directoryId })
  const newContext = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
  const directoryData = await loadDirectoryInfo(newContext.directory, directoryId)
  return createCdMetadata(directoryData, context)
}

const cdWithMetadata = async (newDirectory: DirectoryInfo, isNew: boolean, directoryId: DirectoryId) => {
  const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
  const directoryData = await cd(newDirectory, isNew, directoryId)
  return createCdMetadata(directoryData, context)
}

// TODO: Bunu selection restore icin yapıyoruz. Direkt olarak History içine koymak daha mantıklı sanki.
function createCdMetadata(
  directoryData: GetFilesAndFoldersInDirectoryItem[] | undefined,
  prevContext: DirectoryContextDirectory
) {
  const settings = selectSettingsFromStore(fileBrowserSettingsStore.get())
  const columnPrefs = columnPreferencesStore.getSnapshot().context
  return {
    directoryData:
      directoryData &&
      DirectoryDataFromSettings.getDirectoryData(
        directoryData,
        settings,
        resolveSortFromStores(prevContext, columnPrefs)
      ),
    beforeNavigation: prevContext.directory,
  }
}

const changeDirectory = async (newDirectory: string, directoryId: DirectoryId) => {
  cd(
    {
      type: 'path',
      fullPath: getFullPath(newDirectory, directoryId),
    },
    true,
    directoryId
  )
}

const openFileFull = (fullPath: string) => getWindowElectron().openFile(fullPath)
const openFile = (filePath: string, directoryId: DirectoryId) => openFileFull(getFullPath(filePath, directoryId))

type ReturnOfGoPrev = Promise<
  | {
      directoryData: GetFilesAndFoldersInDirectoryItem[] | undefined
      beforeNavigation: DirectoryInfo
    }
  | undefined
>

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Compares two directory data arrays to check if they're equal
 * Ignores size differences for directories as they may not be loaded yet
 */
function areDirectoryContentsEqual(
  oldData: GetFilesAndFoldersInDirectoryItem[],
  newData: GetFilesAndFoldersInDirectoryItem[]
): boolean {
  if (oldData.length !== newData.length) return false

  // Create maps for faster lookup
  const oldMap = new Map(oldData.map(item => [item.fullPath ?? item.name, item]))

  for (const newItem of newData) {
    const key = newItem.fullPath ?? newItem.name
    const oldItem = oldMap.get(key)

    if (!oldItem) return false

    // Check if the essential properties are the same
    if (
      oldItem.type !== newItem.type ||
      oldItem.name !== newItem.name ||
      oldItem.modifiedTimestamp !== newItem.modifiedTimestamp
    ) {
      return false
    }

    // For files, also check the size
    if (newItem.type === 'file' && oldItem.size !== newItem.size) {
      return false
    }

    // For directories, we skip size comparison as it may not be loaded yet
  }

  return true
}

// Helper functions
export const directoryHelpers = {
  createNewItem: async (name: string, directoryId: DirectoryId): Promise<ResultHandlerResult> => {
    const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
    if (context.directory.type !== 'path') {
      return GenericError.Message('Cannot create items in tags view')
    }

    try {
      const result = await getWindowElectron().createFileOrFolder(context.directory.fullPath, name)
      if (result.success) {
        const itemName = name.endsWith('/') ? name.slice(0, -1) : name
        directoryStore.send({
          type: 'setPendingSelection',
          name: itemName,
          directoryId,
        })
        await loadDirectoryInfo(context.directory, directoryId)
      }
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      return GenericError.Message(errorMessage)
    }
  },

  createImageFromClipboard: async (name: string, directoryId: DirectoryId): Promise<ResultHandlerResult> => {
    const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
    if (context.directory.type !== 'path') {
      return GenericError.Message('Cannot create image in tags view')
    }

    try {
      const result = await getWindowElectron().createImageFromClipboard(context.directory.fullPath, name)
      if (result.success) {
        loadDirectoryInfo(context.directory, directoryId).then(() => {
          directoryStore.send({
            type: 'setPendingSelection',
            name: name,
            directoryId,
          })
        })
      }
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      return GenericError.Message(errorMessage)
    }
  },

  renameItem: async (
    item: GetFilesAndFoldersInDirectoryItem,
    newName: string,
    directoryId: DirectoryId
  ): Promise<ResultHandlerResult> => {
    try {
      if (!item) throw new Error('No item selected')
      const oldPath = item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId)
      const result = await getWindowElectron().renameFileOrFolder(oldPath, newName)
      if (result.success) {
        const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
        directoryStore.send({
          type: 'setPendingSelection',
          name: newName,
          directoryId,
        })
        await loadDirectoryInfo(context.directory, directoryId)
      }
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      return GenericError.Message(errorMessage)
    }
  },

  setPendingSelection: (name: string | string[] | null, directoryId: DirectoryId | undefined) => {
    directoryStore.send({ type: 'setPendingSelection', name, directoryId })
  },

  changeDirectory,

  cd: (dir: DirectoryInfo, directoryId: DirectoryId | undefined) => cd(dir, true, directoryId),

  cdFull: (fullPath: string, directoryId: DirectoryId | undefined) => {
    return cd({ type: 'path', fullPath }, true, directoryId)
  },

  showTaggedFiles: (color: TagColor, directoryId: DirectoryId) => {
    return cd({ type: 'tags', color }, true, directoryId)
  },

  goNext: (directoryId: DirectoryId | undefined) => {
    return goNextOrPrev(directoryId, 'Next')
  },

  goPrev: (directoryId: DirectoryId | undefined) => {
    return goNextOrPrev(directoryId, 'Prev')
  },

  goUp: async (directoryId: DirectoryId | undefined) => {
    const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
    const directory = context.directory
    // goUp only makes sense when in a path directory
    if (directory.type !== 'path') return

    const info: DirectoryInfo = {
      type: 'path',
      fullPath: PathHelpers.resolveUpDirectory(homeDirectory, directory.fullPath),
    }
    return await cdWithMetadata(info, true, context.directoryId)
  },

  toggleShowDotFiles: fileBrowserSettingsHelpers.toggleShowDotFiles,
  toggleFoldersOnTop: fileBrowserSettingsHelpers.toggleFoldersOnTop,
  setFileTypeFilter: fileBrowserSettingsHelpers.setFileTypeFilter,

  openFile,

  getFullPath,

  preloadDirectory,

  setSettings: fileBrowserSettingsHelpers.setSettings,

  reload: (directoryId: DirectoryId | undefined) => {
    const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
    return loadDirectoryInfo(context.directory, context.directoryId)
  },

  reloadIfChanged: async (directoryId: DirectoryId) => {
    const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
    if (context.directory.type === 'tags') return
    const currentData = context.directoryData

    try {
      const result = await FileBrowserCache.load(context.directory.fullPath)

      if (!result.success) {
        // Handle error - could show a toast or update error state
        console.error('Error reloading directory:', result.error)
        return
      }

      const newData = result.data
      const hasChanged = !areDirectoryContentsEqual(currentData, newData)

      if (hasChanged) {
        // Only update if the contents have actually changed
        directoryStore.send({
          type: 'setDirectoryData',
          data: newData,
          directoryId,
        })
      }
    } catch (e) {
      // If there's an error loading, don't update anything
      console.error('Error reloading directory:', e)
      return
    }
  },

  openItem: (item: GetFilesAndFoldersInDirectoryItem, directoryId: DirectoryId | undefined) => {
    const fullPath = item.fullPath || getFullPath(item.name, directoryId)
    if (item.type === 'dir') {
      if (windowArgs.isSelectAppMode) {
        if (item.name.endsWith('.app')) {
          getWindowElectron().sendSelectAppResult(fullPath)
          return
        }
      }
      cd({ type: 'path', fullPath }, true, directoryId)
    } else {
      if (windowArgs.isSelectAppMode) {
        getWindowElectron().sendSelectAppResult(fullPath)
        return
      }
      const unarchiveMetadata = ArchiveHelpers.getUnarchiveMetadata(fullPath)
      if (unarchiveMetadata) {
        dialogActions.open('unarchive', unarchiveMetadata)
        return
      }

      recentsStore.send({
        type: 'addRecent',
        item: { fullPath, type: 'file' },
      })
      openFileFull(fullPath)
    }
  },

  openFileFull,

  openItemFull: (item: { type: 'dir' | 'file'; fullPath: string }, directoryId: DirectoryId) => {
    if (item.type === 'dir') {
      directoryHelpers.cdFull(item.fullPath, directoryId)
    } else {
      directoryHelpers.openFileFull(item.fullPath)
    }
  },

  handleDelete: async (
    items: GetFilesAndFoldersInDirectoryItem[],
    _tableData: DerivedDirectoryItem[],
    _directoryId: DirectoryId | undefined
  ) => {
    const tableData = _tableData.filter(i => i.type === 'real').map(i => i.item)
    const activeDirectory = getActiveDirectory(directoryStore.getSnapshot().context, _directoryId)
    const directoryId = activeDirectory.directoryId

    const paths = items.map(item => item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId))
    const deletedNames = new Set(items.map(item => item.name))

    // Find the smallest index among items being deleted
    const deletedIndexes = items
      .map(item => tableData.findIndex(d => d.name === item.name))
      .filter(idx => idx !== -1)
      .sort((a, b) => a - b)
    const smallestDeletedIndex = deletedIndexes[0] ?? 0

    const message =
      items.length === 1
        ? `Are you sure you want to delete "${items[0].name}"?`
        : `Are you sure you want to delete ${items.length} items?`

    confirmation.trigger.confirm({
      title: 'Confirm Delete',
      message,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          // Delete all selected files/folders
          const result = await getWindowElectron().deleteFiles(
            paths,
            directoryHelpers.getClientMetadata(activeDirectory)
          )

          if (!result.success) {
            toast.show(result)
            return
          }

          // Remove from favorites if they were favorited
          paths.forEach(path => {
            if (selectIsFavorite(path)(favoritesStore.get())) {
              favoritesStore.send({ type: 'removeFavorite', fullPath: path })
            }
          })

          // Select the nearest item (prefer top, fallback to bottom)
          const remainingItems = tableData.filter(item => !deletedNames.has(item.name))
          if (remainingItems.length > 0) {
            // Find the item that should now be at or near the smallest deleted index
            const newIndex = Math.min(smallestDeletedIndex, remainingItems.length - 1)
            const itemToSelect = remainingItems[newIndex]
            directoryHelpers.setPendingSelection(itemToSelect.name, directoryId)
          } else {
            const s = createResetSelection()
            directoryStore.send({ type: 'setSelection', directoryId, ...s })
          }
          // Reload the directory without affecting history
          await directoryHelpers.reload(directoryId)
        } catch (error) {
          console.error('Error deleting files:', error)
          toast.show({
            severity: 'error',
            message: error instanceof Error ? error.message : 'Error deleting files',
          })
        }
      },
    })
  },

  onGoUpOrPrev: async (
    fn: (directoryId: DirectoryId | undefined) => ReturnOfGoPrev,
    directoryId: DirectoryId | undefined
  ) => {
    const metadata = await fn(directoryId)
    if (!metadata) return
    const { directoryData, beforeNavigation } = metadata

    setTimeout(() => {
      if (!directoryData) return
      if (beforeNavigation.type !== 'path') return
      const beforeNavigationName = PathHelpers.name(beforeNavigation.fullPath)
      const idx = directoryData.findIndex(i => i.name === beforeNavigationName)
      if (idx === -1) return
      directorySelection.selectManually(idx, directoryId)
    }, 5)
  },

  openSelectedItem: (
    data: DerivedDirectoryItem[],
    e: KeyboardEvent | undefined,
    directoryId: DirectoryId | undefined
  ) => {
    const snapshot = directoryStore.getSnapshot()
    const selection = getBufferSelection(snapshot.context, getActiveDirectory(snapshot.context, directoryId))
    const lastSelected = selection.last
    const selectionIndexes = selection.indexes
    function resolveItemToOpen() {
      if (lastSelected == null || selectionIndexes.size !== 1) {
        return data[0]
      } else {
        return data[lastSelected]
      }
    }

    const itemToOpen = resolveItemToOpen()
    if (itemToOpen.type !== 'real') return
    if (itemToOpen.item.type === 'file' && e?.key === 'l') return

    // if ((e.target as HTMLInputElement).id === "fuzzy-finder-input") {
    //   fuzzy.clearQuery();
    //   tableRef.current?.querySelector("tbody")?.focus();
    // }
    directoryHelpers.openItem(itemToOpen.item, directoryId)
  },

  openAssignTagsDialog: (fullPath: string, data: GetFilesAndFoldersInDirectoryItem[], directoryId: DirectoryId) => {
    const snapshot = directoryStore.getSnapshot()
    const selection = getBufferSelection(snapshot.context, getActiveDirectory(snapshot.context, directoryId))
    const indexes = selection.indexes
    const selectedIndexes = [...indexes.values()]
    const selectedItems = selectedIndexes.map(i => {
      const item = data[i]
      return item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId)
    })
    if (selectedItems.length > 1) {
      // Multiple files selected - use grid dialog
      dialogActions.open('multiFileTags', selectedItems)
    } else {
      // Single file - use standard dialog
      dialogActions.open('assignTags', fullPath)
    }
  },

  // Fuzzy finder helpers
  setFuzzyQuery: (query: string, directoryId: DirectoryId) => {
    directoryStore.send({ type: 'setFuzzyQuery', query, directoryId })
  },

  clearFuzzyQuery: (directoryId: DirectoryId) => {
    directoryStore.send({ type: 'clearFuzzyQuery', directoryId })
  },
  getFullPathForItem,
  getSelectedItemsOrCurrentItem(index: number, directoryId: DirectoryId) {
    const snapshot = directoryStore.getSnapshot()
    const selection = getBufferSelection(snapshot.context, getActiveDirectory(snapshot.context, directoryId))
    const tableData = directoryDerivedStores.get(directoryId)?.getFilteredDirectoryData()!
    const item = tableData[index]

    const alreadySelected = selection.indexes.has(index)
    return alreadySelected ? [...selection.indexes].map(i => tableData[i]) : [item]
  },

  isDirectoryId: (id: $Maybe<string>) => {
    return id && id.startsWith('dir-')
  },

  openFolderInNewTab: (item: GetFilesAndFoldersInDirectoryItem, directoryId: DirectoryId) => {
    if (item.type !== 'dir') return

    const fullPath = getFullPath(item.name, directoryId)
    directoryHelpers.createDirectory({
      fullPath: fullPath,
    })
  },
  openContainingFolderInNewTab: (item: GetFilesAndFoldersInDirectoryItem, directoryId: DirectoryId) => {
    const fullPath = getFullPath(item.name, directoryId)
    directoryHelpers.createDirectory({
      fullPath: PathHelpers.resolveUpDirectory(homeDirectory, PathHelpers.parent(fullPath).path),
    })
  },

  createArchive: async (
    filePaths: string[],
    archiveName: string,
    archiveType: string,
    directoryId: DirectoryId
  ): Promise<ResultHandlerResult> => {
    const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
    if (context.directory.type !== 'path') {
      return GenericError.Message('Cannot create archive in tags view')
    }

    try {
      // Ensure archive name has the correct extension
      const finalArchiveName = archiveName.endsWith(archiveType) ? archiveName : `${archiveName}${archiveType}`
      const destinationArchivePath = mergeMaybeSlashed(context.directory.fullPath, finalArchiveName)

      await getWindowElectron().startArchive(
        archiveType as any,
        filePaths,
        destinationArchivePath,
        directoryHelpers.getClientMetadata(context)
      )

      // The task system will handle the progress and reload
      return { success: true, data: { path: destinationArchivePath } }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      return GenericError.Message(errorMessage)
    }
  },

  extractArchive: async (
    archiveFilePath: string,
    targetName: string,
    archiveType: string,
    directoryId: DirectoryId,
    extractionMode: 'folder' | 'single-item' = 'folder'
  ): Promise<ResultHandlerResult> => {
    const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
    if (context.directory.type !== 'path') {
      return GenericError.Message('Cannot extract archive in tags view')
    }

    try {
      const destinationPath = mergeMaybeSlashed(context.directory.fullPath, targetName)

      await getWindowElectron().startUnarchive(
        archiveType as any,
        archiveFilePath,
        destinationPath,
        directoryHelpers.getClientMetadata(context),
        extractionMode === 'single-item'
      )

      // The task system will handle the progress and reload
      return { success: true, data: { path: destinationPath } }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      return GenericError.Message(errorMessage)
    }
  },

  loadDirectorySizes: async (directoryId: DirectoryId | undefined, specificDirName?: string): Promise<void> => {
    const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
    if (context.directory.type !== 'path') {
      toast.show({
        message: 'Cannot load directory sizes in tags view',
        severity: 'error',
      })
      return
    }

    directoryLoadingHelpers.startLoading(context.directoryId)
    try {
      const sizes = await getWindowElectron().getDirectorySizes(context.directory.fullPath, specificDirName)

      // Update the directory data with the new sizes
      const updatedData = context.directoryData.map(item => {
        if (item.type === 'dir' && sizes[item.name] !== undefined) {
          return {
            ...item,
            size: sizes[item.name],
            sizeStr: formatBytes(sizes[item.name]),
          }
        }
        return item
      })

      directoryStore.send({
        type: 'setDirectoryData',
        data: updatedData,
        directoryId: context.directoryId,
      })

      if (specificDirName) {
        toast.show({
          message: `Loaded size for ${specificDirName}`,
          severity: 'success',
        })
      } else {
        toast.show({
          message: `Loaded sizes for all directories`,
          severity: 'success',
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load directory sizes'
      toast.show({
        message: errorMessage,
        severity: 'error',
      })
    } finally {
      directoryLoadingHelpers.endLoading(context.directoryId)
    }
  },
  createDirectory: (opts: { tabId?: string; fullPath?: string }) => {
    const directory: Extract<DirectoryInfo, { type: 'path' }> = opts.fullPath
      ? { type: 'path', fullPath: opts.fullPath }
      : initialDirectoryInfo

    FileBrowserCache.load(directory.fullPath).then(result => {
      if (result.success) {
        directoryStore.trigger.createLoadedDirectory({
          fullPath: directory.fullPath,
          directoryData: result.data,
          tabId: opts.tabId,
        })
      } else {
        // If load fails, create with empty data - the error will be shown by loadDirectoryPath
        directoryStore.send({ type: 'createDirectory', ...opts })
      }
    })
  },

  getOpenedPath: (directoryId: DirectoryId | undefined) => {
    const context = getActiveDirectory(directoryStore.getSnapshot().context, directoryId)
    if (context.directory.type === 'path') return context.directory.fullPath

    return undefined
  },
  checkAndReloadDirectories(
    path: Brands.ExpandedPath,
    fileToSelect: $Maybe<string> | ((dir: DirectoryContextDirectory) => $Maybe<string | number>)
  ) {
    const directories = directoryStore.getSnapshot().context.directoriesById

    for (const dir of Object.values(directories)) {
      if (dir.directory.type === 'tags') continue

      if (PathHelpers.expandHome(homeDirectory, dir.directory.fullPath) === path) {
        directoryHelpers.reload(dir.directoryId).then(() => {
          if (fileToSelect) {
            const fs = typeof fileToSelect === 'string' ? fileToSelect : fileToSelect(dir)
            if (typeof fs === 'number') {
              directoryStore.trigger.setSelection({ directoryId: dir.directoryId, indexes: new Set([fs]) })
            } else if (fs) directoryHelpers.setPendingSelection(fs, dir.directoryId)
          }
        })

        return
      }
    }
  },
  getClientMetadata: (d: DirectoryContextDirectory): Tasks.ClientMetadata => {
    const snapshot = directoryStore.getSnapshot()
    const selection = getBufferSelection(snapshot.context, getActiveDirectory(snapshot.context, d.directoryId))
    return {
      directoryId: d.directoryId,
      selection,
    }
  },
}
