import { useSelector } from '@xstate/store/react'
import { useDirectoryContext } from '../DirectoryContext'
import { directoryStore, selectActiveVimBuffer } from '../directoryStore/directory'
import { shallowEqual } from '@xstate/store'
import { getFullPathForBuffer } from '../directoryStore/directoryPureHelpers'
import { VimHighlight } from './VimHighlight'

export function VimCursor() {
  const directoryId = useDirectoryContext().directoryId

  const data = useSelector(
    directoryStore,
    s => {
      if (s.context.vim.mode === 'insert') return
      if (s.context.activeDirectoryId !== directoryId) return
      const vim = selectActiveVimBuffer(directoryId)(s)
      if (!vim) return
      if (vim.cursor.column === 0) return
      const fullPath = getFullPathForBuffer(s.context.directoriesById[directoryId].directory)
      const str = s.context.vim.buffers[fullPath]?.items[vim.cursor.line]?.str
      if (!str) return
      return {
        cursor: vim.cursor,
        until: str.slice(0, vim.cursor.column),
        char: str[vim.cursor.column],
      }
    },
    shallowEqual
  )

  if (!data) return null
  const { cursor } = data

  return <VimHighlight line={cursor.line} until={data.until} highlighted={data.char} colorClass="bg-red-100/50" />
}
