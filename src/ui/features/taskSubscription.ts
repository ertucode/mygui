import { getWindowElectron, homeDirectory } from '@/getWindowElectron'
import { taskStore } from './taskStore'
import { directoryHelpers } from './file-browser/directoryStore/directoryHelpers'
import { PathHelpers } from '@common/PathHelpers'

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
      const fileToSelect = elapsed < 1000 ? PathHelpers.name(destination) : undefined
      return directoryHelpers.checkAndReloadDirectories(
        PathHelpers.parent(PathHelpers.expandHome(homeDirectory, destination)).path,
        fileToSelect
      )
    } else if (task.type === 'delete') {
      const fullPaths = [...new Set(task.metadata.files)]
      for (const fullPath of fullPaths) {
        // TODO: handle fileToSelect after deletion, maybe the the actual promise can stay for 1 second
        // then we can go from there. Otherwise, we dont set file to select
        return directoryHelpers.checkAndReloadDirectories(PathHelpers.parent(fullPath).path, undefined)
      }
    }
  })
}
