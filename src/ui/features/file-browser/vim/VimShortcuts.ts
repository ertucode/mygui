import { GlobalShortcuts } from '@/lib/hooks/globalShortcuts'
import { VimEngine } from '@common/VimEngine'
import { VimMovements } from '@common/VimMovements'
import { directoryStore } from '../directoryStore/directory'
import { directoryDerivedStores } from '../directoryStore/directorySubscriptions'
import { dialogActions } from '../dialogStore'

const SHORTCUTS_KEY = 'vim'

type Updater = (opts: VimEngine.CommandOpts) => VimEngine.State
function createHandler(updater: Updater) {
  return (e: KeyboardEvent | undefined) => {
    e?.preventDefault()
    const result = getSnapshotWithInitializedVim()
    if (!result) return
    const pendingFindCommand = result.snapshot.vim.pendingFindCommand
    if (pendingFindCommand) return undefined

    initializedWithUpdater(result, updater)
  }
}

function initializedWithUpdater(
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

function isSingleCharAndNoModifiers(e: KeyboardEvent | undefined): e is KeyboardEvent {
  return e?.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey
}

function getSnapshotWithInitializedVim() {
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
    snapshot.vim.buffers[fullPath].cursor.line = activeDirectory.selection.last ?? 0
  }
  return {
    snapshot,
    fullPath,
    activeDirectory,
    wasInitialized,
  }
}

const findCommandListener: (e: KeyboardEvent) => void = e => {
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
    return
  }
  e.preventDefault()
  e.stopImmediatePropagation()
  const result = getSnapshotWithInitializedVim()
  if (!result) return

  const pendingFindCommand = result.snapshot.vim.pendingFindCommand
  if (!pendingFindCommand) {
    window.removeEventListener('keydown', findCommandListener)
    return
  }

  if (!isSingleCharAndNoModifiers(e)) {
    initializedWithUpdater(result, VimMovements.clearPendingFindCommand)
  } else {
    initializedWithUpdater(result, opts => VimMovements.executeFind(opts, pendingFindCommand, e.key))
  }
  window.removeEventListener('keydown', findCommandListener)
}

directoryStore.subscribe(s => {
  if (s.context.vim.pendingFindCommand) {
    window.addEventListener('keydown', findCommandListener)
  }
})

export const VimShortcuts = {
  init: () => {
    GlobalShortcuts.create({
      key: SHORTCUTS_KEY,
      enabled: true,
      shortcuts: [
        {
          key: 'u',
          handler: createHandler(VimEngine.u),
          label: '[VIM] Undo',
        },
        ...Array.from({ length: 10 }, (_, i) => ({
          key: i.toString(),
          handler: createHandler(opts => VimEngine.addToCount(opts, i)),
          label: `[VIM] Count ${i}`,
        })),
        {
          key: 'p',
          handler: createHandler(VimEngine.p),
          label: '[VIM] Paste after',
        },
        {
          key: 'P',
          handler: createHandler(VimEngine.P),
          label: '[VIM] Paste before',
        },
        {
          key: { key: 's', metaKey: true },
          handler: e => {
            e?.preventDefault()

            const result = getSnapshotWithInitializedVim()
            if (!result || !result.wasInitialized) return

            const { snapshot } = result
            const { changes } = VimEngine.aggregateChanges(snapshot.vim)

            if (changes.length === 0) return

            dialogActions.open('vimChanges', { changes })
          },
          label: '[VIM] Save',
        },
        { key: 'o', handler: createHandler(VimEngine.o), label: '[VIM] Open line' },
        { key: 'i', handler: createHandler(VimMovements.i), label: '[VIM] Insert' },
        { key: 'a', handler: createHandler(VimMovements.a), label: '[VIM] Append' },
        { key: { key: 'A', shiftKey: true }, handler: createHandler(VimMovements.A), label: '[VIM] Append at end' },
        { key: 'l', handler: createHandler(VimMovements.l), label: '[VIM] Move cursor right' },
        { key: 'h', handler: createHandler(VimMovements.h), label: '[VIM] Move cursor left' },
        { key: 'w', handler: createHandler(VimMovements.w), label: '[VIM] Move cursor to start of word' },
        { key: 'b', handler: createHandler(VimMovements.b), label: '[VIM] Move cursor to end of word' },
        { key: 'e', handler: createHandler(VimMovements.e), label: '[VIM] Move cursor to end of word' },
        {
          key: 'f',
          handler: createHandler(VimMovements.f),
          label: '[VIM] Move cursor to next occurrence of character',
        },
        {
          key: 'F',
          handler: createHandler(VimMovements.F),
          label: '[VIM] Move cursor to previous occurrence of character',
        },
        {
          key: 't',
          handler: createHandler(VimMovements.t),
          label: '[VIM] Move cursor to next occurrence of character',
        },
        {
          key: 'T',
          handler: createHandler(VimMovements.T),
          label: '[VIM] Move cursor to previous occurrence of character',
        },
        {
          key: ';',
          handler: createHandler(VimMovements.semicolon),
          label: '[VIM] Repeat last f/F/t/T command',
        },
        {
          key: ',',
          handler: createHandler(VimMovements.comma),
          label: '[VIM] Repeat last f/F/t/T command in reverse direction',
        },
      ],
      sequences: [
        {
          sequence: ['d', 'd'],
          handler: createHandler(VimEngine.dd),
          label: '[VIM] Delete line',
        },
        {
          sequence: ['y', 'y'],
          handler: createHandler(VimEngine.yy),
          label: '[VIM] Yank line',
        },
        {
          sequence: ['c', 'c'],
          handler: createHandler(VimEngine.cc),
          label: '[VIM] Change line',
        },
      ],
    })
  },
  deinit: () => {
    GlobalShortcuts.updateEnabled(SHORTCUTS_KEY, false)
  },
}
