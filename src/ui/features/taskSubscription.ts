import { getWindowElectron, homeDirectory } from '@/getWindowElectron'
import { taskStore } from './taskStore'
import { directoryHelpers } from './file-browser/directoryStore/directoryHelpers'
import { PathHelpers } from '@common/PathHelpers'
import { directoryStore } from './file-browser/directoryStore/directory'

function shouldUseClientMetadata(task: any): boolean {
  if (!task.clientMetadata) return false

  const start = new Date(task.createdIso)
  const elapsed = new Date().getTime() - start.getTime()

  // Only use clientMetadata if task completed within 5 seconds
  if (elapsed >= 5000) return false

  // Check if the user has moved the cursor since task creation
  const currentState = directoryStore.getSnapshot().context
  const directory = currentState.directoriesById[task.clientMetadata.directoryId as any]
  
  if (!directory) return false

  // Check if selection has changed
  const currentSelection = Array.from(directory.selection.indexes).sort()
  const originalSelection = [...task.clientMetadata.selection].sort()

  // If selections are different, user has moved cursor
  if (currentSelection.length !== originalSelection.length) return false
  if (!currentSelection.every((val, idx) => val === originalSelection[idx])) return false

  return true
}

function getSelectionAfterDeletion(clientMetadata: any): number | undefined {
  if (!clientMetadata?.selection || clientMetadata.selection.length === 0) return undefined

  // Find the minimum index from the original selection
  const minIndex = Math.min(...clientMetadata.selection)

  // We want to select the item just before the lowest deleted index
  // If minIndex is 0, we select 0, otherwise select minIndex - 1
  return Math.max(0, minIndex - 1)
}

export function subscribeToTasks() {
  getWindowElectron().onTaskEvent(event => {
    if (event.type !== 'result') return

    const tasks = taskStore.getSnapshot().context.tasks
    const task = tasks[event.id]
    if (!task) return

    if (task.type === 'archive' || task.type === 'unarchive') {
      const destination = task.metadata.destination
      const start = new Date(task.createdIso)
      const elapsed = new Date().getTime() - start.getTime()
      
      let fileToSelect: string | undefined
      
      if (shouldUseClientMetadata(task)) {
        fileToSelect = PathHelpers.name(destination)
      } else if (elapsed < 1000) {
        fileToSelect = PathHelpers.name(destination)
      }
      
      return directoryHelpers.checkAndReloadDirectories(
        PathHelpers.parent(PathHelpers.expandHome(homeDirectory, destination)).path,
        fileToSelect
      )
    } else if (task.type === 'delete') {
      const fullPaths = [...new Set(task.metadata.files)]
      for (const fullPath of fullPaths) {
        const directoryPath = PathHelpers.parent(fullPath).path
        
        if (shouldUseClientMetadata(task)) {
          const selectionIndex = getSelectionAfterDeletion(task.clientMetadata)
          
          // Use callback-based selection after reload
          directoryHelpers.checkAndReloadDirectories(directoryPath, (dir) => {
            if (selectionIndex !== undefined && dir.directoryData.length > 0) {
              const indexToSelect = Math.min(selectionIndex, dir.directoryData.length - 1)
              directoryStore.send({
                type: 'setSelection',
                directoryId: task.clientMetadata!.directoryId as any,
                indexes: new Set([indexToSelect]),
                last: indexToSelect,
              })
            }
            return undefined
          })
        } else {
          directoryHelpers.checkAndReloadDirectories(directoryPath, undefined)
        }
        
        return
      }
    } else if (task.type === 'vim-changes') {
      // Clear VIM buffers for affected directories
      const affectedDirectories = task.metadata.affectedDirectories
      const currentVimState = directoryStore.getSnapshot().context.vim

      // Update the VIM state
      directoryStore.send({
        type: 'updateVimState',
        state: {
          ...currentVimState,
          buffers: {},
        },
      })

      // Reload all affected directories
      for (const dir of affectedDirectories) {
        directoryHelpers.checkAndReloadDirectories(PathHelpers.expandHome(homeDirectory, dir), undefined)
      }
    }
  })
}
