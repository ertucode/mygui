import { useSelector } from '@xstate/store/react'
import { DerivedDirectoryItem } from './directoryStore/DirectoryBase'
import { clipboardStore } from './clipboardHelpers'

export function useClipboardState(item: DerivedDirectoryItem): { isCut: boolean } | null {
  const fullPath = item.type === 'real' ? item.item.fullPath! : null

  const isInClipboard = useSelector(
    clipboardStore,
    state => (fullPath ? state.context.filePaths.has(fullPath) : false),
    (a, b) => a === b
  )
  const isCut = useSelector(
    clipboardStore,
    state => state.context.isCut,
    (a, b) => a === b
  )

  if (!isInClipboard) return null
  return { isCut }
}
