import { useSelector } from '@xstate/store/react'
import { directoryStore } from '../directoryStore/directory'
import { DirectoryContextProvider } from '../DirectoryContext'
import { FolderBreadcrumb } from './FolderBreadcrumb'
import { FileBrowserOptionsSection } from './FileBrowserOptionsSection'
import { shallowEqual } from '@xstate/store'
import { StringUtils } from '@common/StringUtils'
import { getFullPathForBuffer } from '../directoryStore/directoryPureHelpers'
import { windowStore } from '@/features/windowStore'

export function BottomToolbar() {
  const activeDirectoryId = useSelector(directoryStore, s => s.context.activeDirectoryId)

  const isCompact = useSelector(windowStore, s => s.context.isCompactWindowSize)
  if (isCompact) return undefined

  if (!activeDirectoryId) {
    return (
      <div className="h-10 bg-base-100 border-t border-base-300 flex items-center px-4">
        <div className="text-sm text-gray-500">No directory selected</div>
      </div>
    )
  }

  return (
    <div id="bottom-toolbar" className="h-10 bg-base-100 border-t border-base-300 flex items-center px-4">
      <DirectoryContextProvider directoryId={activeDirectoryId}>
        <div className="join flex-1 overflow-x-auto">
          <FolderBreadcrumb />
        </div>
      </DirectoryContextProvider>
      <div className="ml-auto flex items-center gap-2">
        <VimStatus />
        <FileBrowserOptionsSection />
      </div>
    </div>
  )
}

function VimStatus() {
  const state = useSelector(
    directoryStore,
    s => {
      const id = s.context.activeDirectoryId
      if (!id) return undefined
      const d = s.context.directoriesById[id]
      if (!d) return undefined
      const fullPath = getFullPathForBuffer(d.directory)
      if (!fullPath) return undefined
      const buffer = s.context.vim.buffers[fullPath]
      if (!buffer) return undefined
      return {
        cursor: buffer.cursor,
        count: s.context.vim.count,
        pendingFindCommand: s.context.vim.pendingFindCommand,
        pendingOperator: s.context.vim.pendingOperator,
        textObjectModifier: s.context.vim.textObjectModifier,
        mode: s.context.vim.mode,
        fuzzy: JSON.stringify(buffer.fuzzy),
      }
    },
    shallowEqual
  )

  if (!state) {
    return null
  }

  const pt = StringUtils.joinNullable('', [state.pendingOperator, state.textObjectModifier])

  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      {state.mode === 'insert' ? <span>INSERT</span> : <span>NORMAL</span>}
      {pt && <span>Pending: {pt}</span>}
      {state.pendingFindCommand && <span>Find: {state.pendingFindCommand}</span>}
      {state.count && <span>Count: {state.count}</span>}
      <span>
        {state.cursor.line + 1}:{state.cursor.column + 1}
      </span>
    </div>
  )
}
