import { GlobalShortcuts } from '@/lib/hooks/globalShortcuts'
import { VimEngine } from '@common/VimEngine'
import { VimMovements } from '@common/VimMovements'
import { directoryStore } from '../directoryStore/directory'
import { dialogActions, dialogStore } from '../dialogStore'
import { VimShortcutHelper } from './VimShortcutHelper'
import { getSnapshotWithInitializedVim } from '../directoryStore/vimHelpers'
import { confirmation } from '@/lib/components/confirmation'
import { subscribeToStores } from '@/lib/functions/storeHelpers'
import { VimFuzzy } from '@common/VimFuzzy'

const SHORTCUTS_KEY = 'vim'

const create = VimShortcutHelper.createHandler

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

  if (!VimShortcutHelper.isSingleCharAndNoModifiers(e)) {
    VimShortcutHelper.initializedWithUpdater(result, VimMovements.clearPendingFindCommand)
  } else {
    VimShortcutHelper.initializedWithUpdater(result, opts => VimMovements.executeFind(opts, pendingFindCommand, e.key))
  }
  window.removeEventListener('keydown', findCommandListener)
}

directoryStore.subscribe(s => {
  if (s.context.vim.pendingFindCommand) {
    window.addEventListener('keydown', findCommandListener)
  }
})

let subscription: (() => void) | undefined = undefined
export const VimShortcuts = {
  init: () => {
    GlobalShortcuts.create({
      key: SHORTCUTS_KEY,
      enabled: true,
      shortcuts: [
        {
          key: 'u',
          handler: create(VimEngine.u),
          label: '[VIM] Undo',
        },
        ...Array.from({ length: 10 }, (_, i) => ({
          key: i.toString(),
          handler: create(opts => VimEngine.addToCount(opts, i)),
          label: `[VIM] Count ${i}`,
        })),
        {
          key: 'p',
          handler: create(VimEngine.p),
          label: '[VIM] Paste after',
        },
        {
          key: 'P',
          handler: create(VimEngine.P),
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
        { key: 'o', handler: create(VimEngine.o), label: '[VIM] Open line' },
        { key: 'd', handler: create(VimEngine.d), label: '[VIM] Delete operator' },
        { key: 'c', handler: create(VimEngine.c), label: '[VIM] Change operator' },
        { key: 'y', handler: create(VimEngine.y), label: '[VIM] Yank operator' },
        { key: 's', handler: create(VimEngine.s), label: '[VIM] Substitute character' },
        { key: { key: 'C', shiftKey: true }, handler: create(VimEngine.C), label: '[VIM] Change to end of line' },
        { key: { key: 'D', shiftKey: true }, handler: create(VimEngine.D), label: '[VIM] Delete to end of line' },
        { key: 'i', handler: create(VimMovements.i), label: '[VIM] Insert' },
        { key: 'a', handler: create(VimMovements.a), label: '[VIM] Append' },
        { key: { key: 'A', shiftKey: true }, handler: create(VimMovements.A), label: '[VIM] Append at end' },
        { key: 'l', handler: create(VimMovements.l), label: '[VIM] Move cursor right' },
        { key: 'h', handler: create(VimMovements.h), label: '[VIM] Move cursor left' },
        { key: 'j', handler: create(VimMovements.j), label: '[VIM] Move cursor down' },
        { key: 'k', handler: create(VimMovements.k), label: '[VIM] Move cursor up' },
        { key: 'w', handler: create(VimMovements.w), label: '[VIM] Move cursor to start of word' },
        { key: 'b', handler: create(VimMovements.b), label: '[VIM] Move cursor to end of word' },
        { key: 'e', handler: create(VimMovements.e), label: '[VIM] Move cursor to end of word' },
        { key: 'f', handler: create(VimMovements.f), label: '[VIM] Move cursor to next occurrence of character' },
        { key: 'F', handler: create(VimMovements.F), label: '[VIM] Move cursor to previous occurrence of character' },
        { key: 't', handler: create(VimMovements.t), label: '[VIM] Move cursor to next occurrence of character' },
        { key: 'T', handler: create(VimMovements.T), label: '[VIM] Move cursor to previous occurrence of character' },
        { key: ';', handler: create(VimMovements.semicolon), label: '[VIM] Repeat last f/F/t/T command' },
        { key: 'n', handler: create(VimFuzzy.n), label: '[VIM] Next fuzzy match' },
        { key: { shiftKey: true, key: 'N' }, handler: create(VimFuzzy.N), label: '[VIM] Next fuzzy match (backwards)' },
        {
          key: ',',
          handler: create(VimMovements.comma),
          label: '[VIM] Repeat last f/F/t/T command in reverse direction',
        },
        // TODO: fix shortcut implementation
        {
          key: { key: '_', shiftKey: true },
          handler: create(VimMovements.underscore),
          label: '[VIM] Move to first non-blank character of line',
        },
        {
          // TODO: fix shortcut implementation
          key: { key: '$', shiftKey: true },
          handler: create(VimMovements.dollar),
          label: '[VIM] Move to end of line',
        },
        {
          key: 'Escape',
          handler: create(VimEngine.escInNormal),
          label: '[VIM] Escape to reset selection',
        },
      ],
      sequences: [],
    })
    subscription = subscribeToStores(
      [dialogStore, confirmation],
      ([dialog, confirmation]) => [!dialog.openDialog, confirmation.isOpen],
      ([dialog, confirmation]) => {
        const enabled = !dialog.openDialog && !confirmation.isOpen
        GlobalShortcuts.updateEnabled(SHORTCUTS_KEY, enabled)
      }
    )
  },
  deinit: () => {
    GlobalShortcuts.updateEnabled(SHORTCUTS_KEY, false)
    subscription?.()
  },
}
