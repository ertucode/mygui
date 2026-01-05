import { dialogActions, dialogStore } from './dialogStore'
import { directoryHelpers, directoryStore, selectSelection } from './directoryStore/directory'
import { clipboardHelpers } from './clipboardHelpers'
import { favoritesStore } from './favorites'
import { layoutModel } from './initializeDirectory'
import { Actions, TabNode } from 'flexlayout-react'
import { LayoutHelpers } from './utils/LayoutHelpers'
import { DirectoryId } from './directoryStore/DirectoryBase'
import { directoryDerivedStores } from './directoryStore/directorySubscriptions'
import { directorySelection } from './directoryStore/directorySelection'
import { GlobalShortcuts } from '@/lib/hooks/globalShortcuts'
import { subscribeToStores } from '@/lib/functions/storeHelpers'
import { confirmation } from '@/lib/components/confirmation'

function getData() {
  return directoryDerivedStores.get(getActiveDirectoryId())?.getFilteredDirectoryData()!
}

function getActiveDirectoryId() {
  return directoryStore.getSnapshot().context.activeDirectoryId
}

const SHORTCUTS_KEY = 'file-browser'

function getNthLayoutDirectory(n: number) {
  let dir: DirectoryId | undefined = undefined
  let count = 0
  const nodes: DirectoryId[] = []

  layoutModel.visitNodes(node => {
    // if (dir) return;
    if (node instanceof TabNode && node.getComponent() === 'directory') {
      if (node.getConfig()?.directoryId) {
        count++
        nodes.push(node.getConfig()?.directoryId)
        if (count === n) {
          dir = node.getConfig()?.directoryId
        }
      }
    }
  })

  return dir
}

let subscription: (() => void) | undefined = undefined

export const FileBrowserShortcuts = {
  init: () => {
    GlobalShortcuts.create({
      key: SHORTCUTS_KEY,
      shortcuts: [
        {
          key: ['Enter'],
          handler: e => directoryHelpers.openSelectedItem(getData(), e, undefined),
          label: 'Open item on cursor',
        },
        {
          key: { key: 'p', ctrlKey: true },
          handler: e => {
            e?.preventDefault()
            dialogActions.open('finder', { initialTab: 'files' })
          },
          label: 'Find file',
        },
        {
          key: { key: 'k', ctrlKey: true, metaKey: true },
          handler: e => {
            e?.preventDefault()
            dialogActions.open('commandPalette', {})
          },
          label: 'Show keyboard shortcuts',
        },
        {
          key: { key: 'l', ctrlKey: true, metaKey: true },
          handler: e => {
            e?.preventDefault()
            dialogActions.open('customLayouts', {})
          },
          label: 'Manage custom layouts',
        },
        {
          key: { key: 's', ctrlKey: true },
          handler: e => {
            e?.preventDefault()
            dialogActions.open('finder', { initialTab: 'strings' })
          },
          label: 'Find string',
        },
        {
          key: { key: 'f', ctrlKey: true },
          handler: e => {
            e?.preventDefault()
            dialogActions.open('finder', { initialTab: 'folders' })
          },
          label: 'Find folder',
        },
        {
          key: { key: 'o', ctrlKey: true },
          handler: _ => {
            directoryHelpers.onGoUpOrPrev(directoryHelpers.goPrev, undefined)
          },
          label: 'Go to previous directory',
        },
        {
          key: { key: 'i', ctrlKey: true },
          handler: _ => {
            directoryHelpers.onGoUpOrPrev(directoryHelpers.goNext, undefined)
          },
          label: 'Go to next directory',
        },
        {
          key: ['-'],
          handler: () => directoryHelpers.onGoUpOrPrev(directoryHelpers.goUp, undefined),
          label: 'Go up to parent directory',
        },
        {
          key: { key: 'Backspace', metaKey: true },
          handler: () => {
            const snapshot = directoryStore.getSnapshot()
            const s = selectSelection(undefined)(snapshot)
            // Command+Delete on macOS
            if (s.indexes.size === 0) return
            const data = getData()
            const itemsToDelete = [...s.indexes]
              .map(i => data[i])
              .filter(i => i.type === 'real')
              .map(i => i.item)
            directoryHelpers.handleDelete(itemsToDelete, data, undefined)
          },
          enabledIn: () => true,
          label: 'Delete selected items',
        },
        {
          key: { key: 'n', ctrlKey: true },
          handler: e => {
            e?.preventDefault()
            dialogActions.open('newItem', {})
          },
          label: 'Create new item',
        },
        {
          key: 'r',
          notKey: { key: 'r', metaKey: true },
          handler: e => {
            e?.preventDefault()
            directoryHelpers.reload(undefined)
          },
          label: 'Reload directory',
        },
        {
          key: { key: 'r', metaKey: true, shiftKey: true },
          handler: e => {
            e?.preventDefault()
            const data = getData()
            const snapshot = directoryStore.getSnapshot()
            const s = selectSelection(undefined)(snapshot)
            const itemsToRename = s.indexes.size < 1 ? data : [...s.indexes].map(i => data[i])
            const itemsToRenameMapped = itemsToRename.filter(i => i.type === 'real').map(i => i.item)
            dialogActions.open('batchRename', itemsToRenameMapped)
          },
          enabledIn: () => true,
          label: 'Batch rename selected items',
        },
        {
          key: { key: 'c', metaKey: true },
          handler: e => {
            // Check if user is selecting text
            const selection = window.getSelection()
            const s = selectSelection(undefined)(directoryStore.getSnapshot())
            if (selection && selection.toString().length > 0) {
              return // Allow default text copy
            }

            e?.preventDefault()
            if (s.indexes.size === 0) return
            const data = getData()
            const itemsToCopy = [...s.indexes].map(i => data[i])
            const itemsToCopyMapped = itemsToCopy.filter(i => i.type === 'real').map(i => i.item)
            clipboardHelpers.copy(itemsToCopyMapped, false, undefined)
          },
          enabledIn: () => true,
          label: 'Copy selected items',
        },
        {
          key: { key: 'x', metaKey: true },
          handler: e => {
            // Check if user is selecting text
            const selection = window.getSelection()
            if (selection && selection.toString().length > 0) {
              return // Allow default text cut
            }

            e?.preventDefault()
            const s = selectSelection(undefined)(directoryStore.getSnapshot())
            if (s.indexes.size === 0) return
            const data = getData()
            const itemsToCut = [...s.indexes].map(i => data[i])
            const itemsToCutMapped = itemsToCut.filter(i => i.type === 'real').map(i => i.item)
            clipboardHelpers.copy(itemsToCutMapped, true, undefined)
          },
          enabledIn: () => true,
          label: 'Cut selected items',
        },
        {
          key: { key: 'v', metaKey: true },
          handler: e => {
            // Check if user is in an input field
            const target = e?.target as HTMLElement
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
              return // Allow default paste in inputs
            }

            e?.preventDefault()
            clipboardHelpers.paste(undefined)
          },
          enabledIn: () => true,
          label: 'Paste items',
        },
        {
          key: { key: 'v', metaKey: true, ctrlKey: true },
          handler: e => {
            e?.preventDefault()
            directoryStore.send({
              type: 'toggleViewMode',
              directoryId: undefined,
            })
          },
          label: 'Toggle view mode (list/grid)',
        },
        {
          key: { key: '0', ctrlKey: true },
          handler: _ => {
            // @ts-ignore
            document.querySelector('webview')?.openDevTools()
          },
          label: 'Open dev tools',
          enabledIn: () => true,
        },
        {
          key: { key: '/' },
          handler: e => {
            directoryStore.trigger.focusFuzzyInput({ e })
          },
          label: 'Focus search',
        },
        {
          key: { key: 'l', ctrlKey: true, metaKey: true },
          handler: e => {
            e?.preventDefault()
            directoryHelpers.loadDirectorySizes(undefined)
          },
          label: 'Load directory sizes',
        },
        {
          key: { key: 't', metaKey: true },
          handler: e => {
            e?.preventDefault()
            const activeTabSet = LayoutHelpers.getActiveTabsetThatHasDirectory()
            if (!activeTabSet) return

            directoryHelpers.createDirectory({
              tabId: activeTabSet.getId(),
            })
          },
          label: 'New tab',
        },
        {
          key: { key: 'm', ctrlKey: true },
          handler: e => {
            e?.preventDefault()
            const activeTabSet = LayoutHelpers.getActiveTabsetWithComponent(['directory', 'preview'])
            if (!activeTabSet) return

            layoutModel.doAction(Actions.maximizeToggle(activeTabSet.getId()))
          },
          label: 'Maximize/Minimize',
        },
        {
          key: { key: 'm', ctrlKey: true, metaKey: true },
          handler: e => {
            e?.preventDefault()
            const activeTabSet = LayoutHelpers.getTabsetWithComponent(['preview'])
            if (!activeTabSet) return

            layoutModel.doAction(Actions.maximizeToggle(activeTabSet.getId()))
          },
          label: 'Maximize/Minimize',
        },
        {
          key: { key: 'w', metaKey: true },
          handler: e => {
            if (directoryStore.getSnapshot().context.directoryOrder.length === 1) {
              // Close the window
              return
            }
            e?.preventDefault()
            const activeTabSet = LayoutHelpers.getActiveTabsetThatHasDirectory()
            if (!activeTabSet) return

            const activeTab = LayoutHelpers.getActiveTabsetThatHasDirectory()?.getSelectedNode()
            if (!activeTab) return
            if (!LayoutHelpers.isDirectory(activeTab)) return

            layoutModel.doAction(Actions.deleteTab(activeTab.getId()))
          },
          label: 'Close tab',
        },
        {
          key: 'Escape',
          handler: () => {
            directorySelection.resetSelection(undefined)
          },
          label: 'Reset selection',
        },
        ...directorySelection.getSelectionShortcuts(),
        // Option+1 through Option+9 to open favorites
        ...Array.from({ length: 9 }, (_, i) => ({
          key: { key: `Digit${i + 1}`, isCode: true, altKey: true },
          handler: (e: KeyboardEvent | undefined) => {
            e?.preventDefault()
            const favorite = favoritesStore.get().context.favorites[i]
            if (favorite) {
              // Use the current active directory, not the one from the closure
              const currentActiveId = directoryStore.getSnapshot().context.activeDirectoryId
              directoryHelpers.openItemFull(favorite, currentActiveId)
            }
          },
          label: `Open favorite ${i + 1}`,
        })),
        ...new Array(10).fill(0).map((_, i) => ({
          key: { key: (i + 1).toString(), metaKey: true },
          handler: (e: KeyboardEvent | undefined) => {
            e?.preventDefault()
            const dir = getNthLayoutDirectory(i + 1)
            if (!dir) return

            directoryStore.send({
              type: 'setActiveDirectoryId',
              directoryId: dir,
            })
          },
          label: `Switch to pane ${i + 1}`,
        })),
      ],
      enabled: true,
      sequences: directorySelection.getSelectionSequenceShortcuts(),
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
