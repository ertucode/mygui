import { VimEngine } from '@common/VimEngine'
import { directoryStore } from '../directoryStore/directory'
import { getSnapshotWithInitializedVim } from '../directoryStore/vimHelpers'

export namespace VimShortcutHelper {
  export type Updater = (opts: VimEngine.CommandOpts) => VimEngine.State
  export function createHandler(updater: Updater) {
    return (e: { preventDefault: () => void } | undefined) => {
      e?.preventDefault()
      const result = getSnapshotWithInitializedVim()
      if (!result) return
      const pendingFindCommand = result.snapshot.vim.pendingFindCommand
      if (pendingFindCommand) return undefined

      return initializedWithUpdater(result, updater)
    }
  }

  export function initializedWithUpdater(
    result: Exclude<ReturnType<typeof getSnapshotWithInitializedVim>, undefined>,
    updater: Updater
  ) {
    const { snapshot, fullPath } = result

    const state = updater({ state: snapshot.vim, fullPath })
    directoryStore.trigger.updateVimState({
      state: state,
    })
    return state
  }

  export function isSingleCharAndNoModifiers(e: KeyboardEvent | undefined): e is KeyboardEvent {
    return e?.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey
  }

  export function updateVim(updater: Updater) {
    const result = getSnapshotWithInitializedVim()
    if (!result) return

    return VimShortcutHelper.createHandler(updater)(undefined)
  }
}
