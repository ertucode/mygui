// import "../../wdyr/wdyr.js";
import './App.css'
import { FlexLayoutManager } from './features/tile-manager'
import { ConfirmationRenderer } from './lib/components/confirmation'
import { ToastRenderer } from './lib/components/toast'
import { TaskMonitor } from './features/TaskMonitor'
import { subscribeToTasks } from './features/taskSubscription'
import { useCallback } from 'react'
import { useWindowFocus } from './lib/hooks/useWindowFocus'
import { directoryStore } from './features/file-browser/directoryStore/directory'
import { directoryHelpers } from './features/file-browser/directoryStore/directoryHelpers'
import { subscribeToGenericEvents } from './features/genericEventListener'

subscribeToTasks()
subscribeToGenericEvents()

function App() {
  const handleWindowFocus = useCallback(() => {
    const context = directoryStore.getSnapshot().context

    for (const directoryId of context.directoryOrder) {
      directoryHelpers.reloadIfChanged(directoryId)
    }
  }, [])

  useWindowFocus(handleWindowFocus)

  return (
    <>
      <ToastRenderer />
      <ConfirmationRenderer />

      <FlexLayoutManager />
      <TaskMonitor />
    </>
  )
}

export default App
