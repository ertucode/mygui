import { getWindowElectron } from '@/getWindowElectron'
import { createStore } from '@xstate/store'
import { Actions } from 'flexlayout-react'
import { layoutModel } from './file-browser/initializeDirectory'
import { LayoutHelpers } from './file-browser/utils/LayoutHelpers'

export type WindowStoreContext = {
  alwaysOnTop: boolean
  isCompactWindowSize: boolean
}

export const windowStore = createStore({
  context: {
    alwaysOnTop: false,
    isCompactWindowSize: false,
  } as WindowStoreContext,
  on: {
    setState: (context: WindowStoreContext, event: Partial<WindowStoreContext>) => ({
      ...context,
      ...event,
    }),
  },
})

export namespace WindowStoreHelpers {
  export const toggleWindowSize = async () => {
    const state = windowStore.getSnapshot().context
    if (state.isCompactWindowSize) {
      // Restore window size and minimize the tabset
      await getWindowElectron().restoreWindowSize()
      windowStore.trigger.setState({ isCompactWindowSize: false })

      // Minimize the active or first directory tabset
      const activeTabSet = LayoutHelpers.getActiveOrFirstTabsetWithComponent(['directory'])

      if (activeTabSet && activeTabSet.isMaximized()) {
        layoutModel.doAction(Actions.maximizeToggle(activeTabSet.getId()))
      }
    } else {
      // Set compact window size and maximize the tabset
      await getWindowElectron().setCompactWindowSize()
      windowStore.trigger.setState({ isCompactWindowSize: true })

      // Maximize the active or first directory tabset
      const activeTabSet = LayoutHelpers.getActiveOrFirstTabsetWithComponent(['directory'])
      if (activeTabSet && !activeTabSet.isMaximized()) {
        layoutModel.doAction(Actions.maximizeToggle(activeTabSet.getId()))
      }
    }
  }

  export const toggleAlwaysOnTop = async (e: { metaKey: boolean }) => {
    const state = windowStore.getSnapshot().context
    const newValue = !state.alwaysOnTop
    await getWindowElectron().setAlwaysOnTop(newValue)
    windowStore.trigger.setState({ alwaysOnTop: newValue })

    // If metaKey is pressed, also toggle window size
    if (e.metaKey) {
      await toggleWindowSize()
    }
  }
}

import { GlobalShortcuts } from '@/lib/hooks/globalShortcuts'

const SHORTCUTS_KEY = 'windowStore'

export const WindowStoreShortcuts = {
  init: () => {
    GlobalShortcuts.create({
      key: SHORTCUTS_KEY,
      enabled: true,
      shortcuts: [
        {
          key: { key: 'F1', metaKey: true },
          handler: () => WindowStoreHelpers.toggleAlwaysOnTop({ metaKey: true }),
          label: '[Window] Toggle Always On Top and Compact',
        },
        {
          key: { key: 'F2', metaKey: true },
          handler: () => WindowStoreHelpers.toggleWindowSize(),
          label: '[Window] Toggle Compact Window Size',
        },
      ],
      sequences: [],
    })
  },
  deinit: () => {
    GlobalShortcuts.updateEnabled(SHORTCUTS_KEY, false)
  },
}
