import { VimEngine } from '@common/VimEngine'
import { directoryStore } from '../directoryStore/directory'
import { directoryDerivedStores } from '../directoryStore/directorySubscriptions'

export namespace VimShortcutHelper {
  export type Updater = (opts: VimEngine.CommandOpts) => VimEngine.State
  export function createHandler(updater: Updater) {
    return (e: { preventDefault: () => void } | undefined) => {
      e?.preventDefault()
      const result = getSnapshotWithInitializedVim()
      if (!result) return
      const pendingFindCommand = result.snapshot.vim.pendingFindCommand
      if (pendingFindCommand) return undefined

      initializedWithUpdater(result, updater)
    }
  }

  export function initializedWithUpdater(
    result: Exclude<ReturnType<typeof getSnapshotWithInitializedVim>, undefined>,
    updater: Updater
  ) {
    const { snapshot, fullPath, activeDirectory } = result

    const beforeCursor = snapshot.vim.buffers[fullPath].cursor
    const updated = updater({ state: snapshot.vim, fullPath })
    const afterCursor = updated.buffers[fullPath].cursor
    const isChanged = beforeCursor.line !== afterCursor.line || beforeCursor.column !== afterCursor.column

    directoryStore.trigger.updateVimState({
      state: updated,
      selection: isChanged ? { index: afterCursor.line, directoryId: activeDirectory.directoryId } : undefined,
    })
  }

  export function isSingleCharAndNoModifiers(e: KeyboardEvent | undefined): e is KeyboardEvent {
    return e?.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey
  }

  export function getSnapshotWithInitializedVim() {
    const snapshot = directoryStore.getSnapshot().context
    const activeDirectory = snapshot.directoriesById[snapshot.activeDirectoryId]
    if (!activeDirectory) return
    if (activeDirectory.directory.type !== 'path') return
    const fullPath = activeDirectory.directory.fullPath
    if (!fullPath) return

    const items = directoryDerivedStores.get(activeDirectory.directoryId)!.getFilteredDirectoryData()!
    const wasInitialized = snapshot.vim.buffers[fullPath]
    if (!wasInitialized) {
      snapshot.vim.buffers[fullPath] = VimEngine.defaultBuffer(fullPath, items as VimEngine.RealBufferItem[])
      snapshot.vim.buffers[fullPath].cursor.line = snapshot.vim.selection.last ?? 0
    }
    return {
      snapshot,
      fullPath,
      activeDirectory,
      wasInitialized,
    }
  }
}
