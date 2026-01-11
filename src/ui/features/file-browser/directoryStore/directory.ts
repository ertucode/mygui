import { createStore, shallowEqual, StoreSnapshot } from '@xstate/store'
import { HistoryStack } from '@common/history-stack'
import { errorToString } from '@common/errorToString'
import { fileBrowserSettingsStore, selectSettings as selectSettingsFromStore, FileBrowserSettings } from '../settings'
import { GetFilesAndFoldersInDirectoryItem } from '@common/Contracts'
import { getWindowElectron, homeDirectory } from '@/getWindowElectron'
import { TagColor, tagsStore } from '../tags'
import { PathHelpers } from '@common/PathHelpers'
import { defaultPath, initialDirectoryInfo } from '../defaultPath'
import { toast } from '@/lib/components/toast'
import { directoryHelpers as dh } from './directoryHelpers'
import { FileBrowserCache } from '../FileBrowserCache'
import { directoryLoadingHelpers } from './directoryLoadingStore'
import { setupSubscriptions, unsubscribeDirectorySubscriptions } from './directorySubscriptions'
import {
  DirectoryContext,
  DirectoryId,
  DirectoryContextDirectory,
  DirectoryInfo,
  DirectoryLocalSort,
  DerivedDirectoryItem,
} from './DirectoryBase'
import { defaultSelection, getActiveDirectory, getFullPathForBuffer, selectBuffer } from './directoryPureHelpers'
import { errorResponseToMessage, GenericError } from '@common/GenericError'
import { useSelector } from '@xstate/store/react'
import { VimEngine } from '@common/VimEngine'

function updateDirectory(
  context: DirectoryContext,
  directoryId: DirectoryId | undefined,
  fn: (d: DirectoryContextDirectory) => DirectoryContextDirectory,
  needsUpdate?: (d: DirectoryContextDirectory) => boolean
) {
  const activeDirectory = getActiveDirectory(context, directoryId)
  if (directoryId && !activeDirectory) return context

  if (needsUpdate && !needsUpdate(activeDirectory)) return context

  const newItem = fn(activeDirectory)
  return {
    ...context,
    directoriesById: {
      ...context.directoriesById,
      [activeDirectory.directoryId]: newItem,
    },
  }
}

export function createResetSelection() {
  return {
    indexes: new Set<number>(),
    last: undefined,
  }
}

export function createDirectoryContext(directoryId: DirectoryId, directory: DirectoryInfo): DirectoryContextDirectory {
  return {
    directoryId,
    directory,
    loading: false,
    directoryData: [] as GetFilesAndFoldersInDirectoryItem[],
    error: undefined as GenericError | undefined,
    historyStack: new HistoryStack<DirectoryInfo>([directory]),
    pendingSelection: null as string | string[] | null,
    viewMode: 'list',
    localSort: undefined,
  }
}

function updateVimCursor(state: VimEngine.State, fullPath: string, line: number) {
  if (!state.buffers[fullPath]) return state
  return {
    ...state,
    buffers: {
      ...state.buffers,
      [fullPath]: {
        ...state.buffers[fullPath],
        cursor: {
          ...state.buffers[fullPath].cursor,
          line,
        },
      },
    },
  }
}

function getVimCursorFullPath(d: DirectoryContextDirectory): string | false {
  if (!d) return false
  return getFullPathForBuffer(d.directory)
}

const dummyDirectoryId = 'dummmyy' as DirectoryId // kimse dokunmadan initialize edilmeli zaten

export const directoryStore = createStore({
  context: {
    directoriesById: {
      [dummyDirectoryId]: {
        directoryId: dummyDirectoryId,
        directory: { color: 'red', type: 'tags' },
        loading: false,
        directoryData: [] as GetFilesAndFoldersInDirectoryItem[],
        error: undefined as string | undefined,
        historyStack: new HistoryStack<DirectoryInfo>([{ color: 'red', type: 'tags' }]),
        pendingSelection: null as string | string[] | null,
        // View mode
        viewMode: 'list' as 'list' | 'grid',
        // Local sort state
        localSort: undefined,
      },
    },
    directoryOrder: [dummyDirectoryId],
    activeDirectoryId: dummyDirectoryId,
    vim: VimEngine.defaultState(),
  } as DirectoryContext,
  emits: {
    focusFuzzyInput: (_: { e: KeyboardEvent | undefined; directoryId: DirectoryId }) => {},
    directoryCreated: (_: { directoryId: DirectoryId; tabId?: string }) => {},
    directoryAdded: (_: { directoryId: DirectoryId }) => {},
    directoryRemoved: (_: { directoryId: DirectoryId }) => {},
    directoryNavigated: (_: { directoryId: DirectoryId; directory: DirectoryInfo }) => {},
    showContextMenu: (_: {
      element: HTMLElement
      index: number
      item: DerivedDirectoryItem
      directoryId: DirectoryId
    }) => {},
  },
  on: {
    focusFuzzyInput: (context, event: { e: KeyboardEvent | undefined }, enqueue) => {
      enqueue.emit.focusFuzzyInput({
        e: event.e,
        directoryId: context.activeDirectoryId,
      })
      return context
    },
    showContextMenu: (
      context,
      event: { element: HTMLElement; index: number; item: DerivedDirectoryItem; directoryId: DirectoryId },
      enqueue
    ) => {
      enqueue.emit.showContextMenu(event)
      return context
    },
    setDirectoryData: (
      context,
      event: {
        data: GetFilesAndFoldersInDirectoryItem[]
        directoryId: DirectoryId
      }
    ) => {
      const updated = updateDirectory(context, event.directoryId, d => {
        return {
          ...d,
          directoryData: event.data,
          error: undefined,
        }
      })
      return updated
    },

    setError: (context, event: { error: GenericError | undefined; directoryId: DirectoryId }) =>
      updateDirectory(context, event.directoryId, d => ({
        ...d,
        error: event.error,
      })),

    setDirectory: (context, event: { directory: DirectoryInfo; directoryId: DirectoryId }, enqueue) =>
      updateDirectory(context, event.directoryId, d => {
        enqueue.emit.directoryNavigated({
          directoryId: event.directoryId,
          directory: event.directory,
        })
        return {
          ...d,
          directory: event.directory,
        }
      }),

    historyGoNew: (context, event: { directory: DirectoryInfo; directoryId: DirectoryId | undefined }, enqueue) =>
      updateDirectory(context, event.directoryId, d => {
        d.historyStack.goNew(event.directory)
        enqueue.emit.directoryNavigated({
          directoryId: d.directoryId,
          directory: event.directory,
        })
        return d
      }),

    historyGoNext: (context, event: { directoryId: DirectoryId | undefined }, enqueue) =>
      updateDirectory(context, event.directoryId, d => {
        const nextDir = d.historyStack.goNext()
        enqueue.emit.directoryNavigated({
          directoryId: d.directoryId,
          directory: nextDir,
        })
        return {
          ...d,
          directory: nextDir,
        }
      }),

    historyGoPrev: (context, event: { directoryId: DirectoryId | undefined }, enqueue) =>
      updateDirectory(context, event.directoryId, d => {
        const prevDir = d.historyStack.goPrev()
        enqueue.emit.directoryNavigated({
          directoryId: d.directoryId,
          directory: prevDir,
        })
        return {
          ...d,
          directory: prevDir,
        }
      }),

    setPendingSelection: (
      context,
      event: {
        name: string | string[] | null
        directoryId: DirectoryId | undefined
      }
    ) =>
      updateDirectory(context, event.directoryId, d => ({
        ...d,
        pendingSelection: event.name,
      })),

    setSelection: (context, event: { indexes: Set<number>; last?: number; directoryId: DirectoryId | undefined }) => {
      const activeDir = getActiveDirectory(context, event.directoryId)
      const cursorLineFullPath = getVimCursorFullPath(activeDir)

      if (!cursorLineFullPath) {
        return context
      }

      const updatedVim = updateVimCursor(context.vim, cursorLineFullPath, event.last ?? 0)
      if (updatedVim === context.vim) return context

      const res: DirectoryContext = {
        ...context,
        vim: {
          ...updatedVim,
          buffers: {
            ...updatedVim.buffers,
            [cursorLineFullPath]: {
              ...updatedVim.buffers[cursorLineFullPath],
              selection: {
                indexes: event.indexes,
                last: event.last,
              },
            },
          },
        },
      }

      return res
    },
    selectManually: (
      context,
      event: {
        index: number
        directoryId: DirectoryId | undefined
        dontTouchWhenSelected?: boolean
      }
    ) => {
      const activeDir = getActiveDirectory(context, event.directoryId)
      const cursorLineFullPath = getVimCursorFullPath(activeDir)

      if (!cursorLineFullPath) {
        return context
      }

      // Check if already selected
      const buffer = context.vim.buffers[cursorLineFullPath]
      if (buffer?.selection.indexes.has(event.index)) {
        return context
      }

      const updatedVim = updateVimCursor(context.vim, cursorLineFullPath, event.index)
      if (updatedVim === context.vim) return context

      const res: DirectoryContext = {
        ...context,
        vim: {
          ...updatedVim,
          buffers: {
            ...updatedVim.buffers,
            [cursorLineFullPath]: {
              ...updatedVim.buffers[cursorLineFullPath],
              selection: {
                indexes: new Set([event.index]),
                last: event.index,
              },
            },
          },
        },
      }
      return res
    },
    setCursor: (
      context,
      event: { cursor: Partial<VimEngine.CursorPosition>; directoryId: DirectoryId | undefined }
    ) => {
      const activeDirectory = getActiveDirectory(context, event.directoryId)
      const fullPath = getFullPathForBuffer(activeDirectory.directory)
      const buffer = context.vim.buffers[fullPath]
      if (!buffer) return context
      const [newState, newBuffer] = VimEngine.spreadBuffers(context.vim, fullPath)
      newBuffer.cursor = {
        ...buffer.cursor,
        ...event.cursor,
      }
      return {
        ...context,
        vim: newState,
      }
    },
    toggleViewMode: (context, event: { directoryId: DirectoryId | undefined }) =>
      updateDirectory(context, event.directoryId, d => ({
        ...d,
        viewMode: d.viewMode === 'list' ? 'grid' : 'list',
      })),

    setLocalSort: (context, event: { sort: DirectoryLocalSort | undefined; directoryId: DirectoryId }) =>
      updateDirectory(context, event.directoryId, d => ({
        ...d,
        localSort: event.sort,
      })),

    setActiveDirectoryId: (context, event: { directoryId: DirectoryId }) => {
      if (context.activeDirectoryId === event.directoryId) return context
      return {
        ...context,
        activeDirectoryId: event.directoryId,
      }
    },
    createDirectory: (context, event: { tabId?: string; fullPath?: string }, enqueue) => {
      const directoryId = Math.random().toString(36).slice(2) as DirectoryId

      enqueue.emit.directoryCreated({
        directoryId,
        tabId: event.tabId,
      })

      enqueue.emit.directoryAdded({
        directoryId,
      })

      setupSubscriptions(directoryId)
      const directory: DirectoryInfo = event.fullPath
        ? { type: 'path', fullPath: event.fullPath }
        : initialDirectoryInfo
      loadDirectoryPath(event.fullPath ?? defaultPath, directoryId)

      return {
        ...context,
        directoriesById: {
          ...context.directoriesById,
          [directoryId]: createDirectoryContext(directoryId, directory),
        },
        directoryOrder: [...context.directoryOrder, directoryId],
      }
    },
    createLoadedDirectory: (
      context,
      event: {
        tabId?: string
        fullPath: string
        directoryData: GetFilesAndFoldersInDirectoryItem[]
      },
      enqueue
    ) => {
      const directoryId = Math.random().toString(36).slice(2) as DirectoryId

      enqueue.emit.directoryCreated({
        directoryId,
        tabId: event.tabId,
      })

      enqueue.emit.directoryAdded({
        directoryId,
      })

      setupSubscriptions(directoryId)
      const directory: DirectoryInfo = {
        type: 'path',
        fullPath: event.fullPath,
      }

      const directoryContext = createDirectoryContext(directoryId, directory)
      directoryContext.directoryData = event.directoryData

      return {
        ...context,
        activeDirectoryId: directoryId,
        directoriesById: {
          ...context.directoriesById,
          [directoryId]: directoryContext,
        },
        directoryOrder: [...context.directoryOrder, directoryId],
      }
    },
    removeDirectory: (context, event: { directoryId: DirectoryId }, enqueue) => {
      const newItemOrder = context.directoryOrder.filter(id => id !== event.directoryId)
      if (newItemOrder.length === context.directoryOrder.length) return context

      enqueue.emit.directoryRemoved({
        directoryId: event.directoryId,
      })

      delete context.directoriesById[event.directoryId]
      unsubscribeDirectorySubscriptions(event.directoryId)
      return {
        ...context,
        directoriesById: {
          ...context.directoriesById,
        },
        directoryOrder: newItemOrder,
      }
    },

    onDirectoriesMayHaveBeenRemoved: (context, event: { directoryIds: DirectoryId[] }, enqueue) => {
      const newItemOrder = context.directoryOrder.filter(id => !event.directoryIds.includes(id))
      if (newItemOrder.length === event.directoryIds.length) return context
      for (const directoryId of event.directoryIds) {
        enqueue.emit.directoryRemoved({
          directoryId,
        })
        delete context.directoriesById[directoryId]
        unsubscribeDirectorySubscriptions(directoryId)
      }
      return {
        ...context,
        directoriesById: {
          ...context.directoriesById,
        },
        directoryOrder: newItemOrder,
      }
    },
    initDirectories: (
      _,
      event: {
        directories: (DirectoryInfo & { id: string })[]
        activeDirectoryId: string
      }
    ) => {
      const result: DirectoryContext = {
        directoriesById: event.directories.reduce(
          (acc, directory) => {
            const directoryId = directory.id as DirectoryId
            acc[directoryId] = {
              directoryId,
              directory: directory,
              loading: false,
              directoryData: [] as GetFilesAndFoldersInDirectoryItem[],
              error: undefined as GenericError | undefined,
              historyStack: new HistoryStack<DirectoryInfo>([directory]),
              pendingSelection: null as string | string[] | null,
              // View mode
              viewMode: 'list' as 'list' | 'grid',
              // Local sort state
              localSort: undefined,
            }
            return acc
          },
          {} as Record<DirectoryId, DirectoryContextDirectory>
        ),
        directoryOrder: event.directories.map(d => d.id as DirectoryId),
        activeDirectoryId: event.activeDirectoryId as DirectoryId,
        vim: VimEngine.defaultState(),
      }
      for (const directory of event.directories) {
        const directoryId = directory.id as DirectoryId
        setupSubscriptions(directoryId)
        loadDirectoryInfo(directory, directoryId)
      }
      return result
    },
    updateVimState: (context, event: { state: VimEngine.State }) => {
      return {
        ...context,
        vim: event.state,
      }
    },
  },
})

export const loadDirectoryPath = async (dir: string, _directoryId: DirectoryId | undefined, forceReload = false) => {
  const directoryId = _directoryId ?? getActiveDirectory(directoryStore.getSnapshot().context, _directoryId).directoryId
  directoryLoadingHelpers.startLoading(directoryId)
  try {
    const result = await FileBrowserCache.load(dir, forceReload)

    if (!result.success) {
      directoryStore.send({
        type: 'setError',
        error: result.error,
        directoryId,
      })
      toast.show({
        message: errorResponseToMessage(result.error),
        severity: 'error',
      })
      return undefined
    }

    directoryStore.send({
      type: 'setDirectoryData',
      data: result.data,
      directoryId,
    })
    return result.data
  } catch (e) {
    toast.show({
      message: errorToString(e),
      severity: 'error',
    })
  } finally {
    directoryLoadingHelpers.endLoading(directoryId)
  }
}

export const loadTaggedFiles = async (color: TagColor, _directoryId: DirectoryId | undefined) => {
  const directoryId = getActiveDirectory(directoryStore.getSnapshot().context, _directoryId).directoryId
  const getFilesWithTag = (color: TagColor) =>
    Object.entries(tagsStore.get().context.fileTags)
      .filter(([_, tags]) => tags.includes(color))
      .map(([path]) => path)

  directoryLoadingHelpers.startLoading(directoryId)
  try {
    const filePaths = getFilesWithTag(color)
    if (filePaths.length === 0) {
      directoryStore.send({ type: 'setDirectoryData', data: [], directoryId })
      return []
    }
    const result = await getWindowElectron().getFileInfoByPaths(filePaths)

    const staleItems = filePaths.filter(item => {
      const normalized = PathHelpers.expandHome(homeDirectory, item)
      return !result.find(i => i.fullPath === normalized)
    })
    if (staleItems.length > 0) {
      tagsStore.trigger.removeFilesFromAllTags({
        fullPaths: staleItems,
      })
    }
    directoryStore.send({
      type: 'setDirectoryData',
      data: result,
      directoryId,
    })
    return result
  } catch (e) {
    toast.show({
      message: errorToString(e),
      severity: 'error',
    })
  } finally {
    directoryLoadingHelpers.endLoading(directoryId)
  }
}

export const loadDirectoryInfo = async (info: DirectoryInfo, directoryId: DirectoryId | undefined) => {
  if (info.type === 'path') {
    return loadDirectoryPath(info.fullPath, directoryId, true)
  } else {
    return loadTaggedFiles(info.color, directoryId)
  }
}

export const directoryHelpers = dh

// Selectors
export const selectDirectory = (directoryId: DirectoryId | undefined) => (state: StoreSnapshot<DirectoryContext>) =>
  getActiveDirectory(state.context, directoryId).directory

export const selectLoading = (directoryId: DirectoryId | undefined) => (state: StoreSnapshot<DirectoryContext>) =>
  getActiveDirectory(state.context, directoryId).loading

export const selectRawDirectoryData =
  (directoryId: DirectoryId | undefined) => (state: StoreSnapshot<DirectoryContext>) =>
    getActiveDirectory(state.context, directoryId).directoryData

export const selectHasNext = (directoryId: DirectoryId | undefined) => (state: StoreSnapshot<DirectoryContext>) =>
  getActiveDirectory(state.context, directoryId).historyStack.hasNext

export const selectHasPrev = (directoryId: DirectoryId | undefined) => (state: StoreSnapshot<DirectoryContext>) =>
  getActiveDirectory(state.context, directoryId).historyStack.hasPrev

export const selectSettings = (): FileBrowserSettings => {
  return selectSettingsFromStore(fileBrowserSettingsStore.get())
}

export const selectPendingSelection =
  (directoryId: DirectoryId | undefined) => (state: StoreSnapshot<DirectoryContext>) =>
    getActiveDirectory(state.context, directoryId).pendingSelection

export const selectSelection = (directoryId: DirectoryId | undefined) => (state: StoreSnapshot<DirectoryContext>) => {
  const activeDirectory = getActiveDirectory(state.context, directoryId)
  const fullPath = getFullPathForBuffer(activeDirectory.directory)
  const buffer = state.context.vim.buffers[fullPath]
  return buffer?.selection ?? defaultSelection
}

export const selectCursorLine = (directoryId: DirectoryId | undefined) => (state: StoreSnapshot<DirectoryContext>) => {
  return selectBuffer(state.context, directoryId)?.cursor.line
}

export const selectViewMode = (directoryId: DirectoryId | undefined) => (state: StoreSnapshot<DirectoryContext>) =>
  getActiveDirectory(state.context, directoryId).viewMode

export const selectError = (directoryId: DirectoryId | undefined) => (state: StoreSnapshot<DirectoryContext>) =>
  getActiveDirectory(state.context, directoryId).error

// TODO: better name
export function useRowState(index: number, directoryId: DirectoryId | undefined) {
  return useSelector(
    directoryStore,
    s => {
      const buffer = selectBuffer(s.context, directoryId)
      if (!buffer) return { isSelected: false, isCursor: false }
      return {
        isSelected: buffer.selection.indexes.has(index),
        isCursor: buffer.cursor.line === index,
      }
    },
    shallowEqual
  )
}
export const selectActiveVimBuffer =
  (directoryId: DirectoryId | undefined) => (state: StoreSnapshot<DirectoryContext>) => {
    const activeDirectory = getActiveDirectory(state.context, directoryId)
    if (!activeDirectory) return undefined
    const fullPath = getFullPathForBuffer(activeDirectory.directory)
    return state.context.vim.buffers[fullPath]
  }
