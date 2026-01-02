import { GlobalShortcuts } from '@/lib/hooks/globalShortcuts'
import { VimEngine } from '@common/VimEngine'
import { directoryStore } from '../directoryStore/directory'
import { directoryDerivedStores } from '../directoryStore/directorySubscriptions'

const SHORTCUTS_KEY = 'vim'

function createHandler(updater: (opts: VimEngine.CommandOpts) => VimEngine.State) {
  return (e: KeyboardEvent | undefined) => {
    e?.preventDefault()
    const snapshot = directoryStore.getSnapshot().context
    const activeDirectory = snapshot.directoriesById[snapshot.activeDirectoryId]
    if (!activeDirectory) return
    if (activeDirectory.directory.type !== 'path') return
    const fullPath = activeDirectory.directory.fullPath
    if (!fullPath) return

    const items = directoryDerivedStores.get(activeDirectory.directoryId)!.getFilteredDirectoryData()!
    if (!snapshot.vim.buffers[fullPath]) {
      snapshot.vim.buffers[fullPath] = VimEngine.defaultBuffer(fullPath, items)
      snapshot.vim.buffers[fullPath].cursor.line = activeDirectory.selection.last ?? 0
    }
    const beforeCursor = snapshot.vim.buffers[fullPath].cursor
    const updated = updater({ state: snapshot.vim, fullPath })
    const afterCursor = snapshot.vim.buffers[fullPath].cursor
    const isChanged = beforeCursor.line !== afterCursor.line || beforeCursor.column !== afterCursor.column
    directoryStore.trigger.updateVimState({
      state: updated,
      selection: isChanged ? { index: afterCursor.line, directoryId: activeDirectory.directoryId } : undefined,
    })
  }
}

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
