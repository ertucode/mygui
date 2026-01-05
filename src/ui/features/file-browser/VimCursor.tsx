import { useSelector } from '@xstate/store/react'
import { useDirectoryContext } from './DirectoryContext'
import { directoryStore, selectActiveVimBuffer } from './directoryStore/directory'
import { shallowEqual } from '@xstate/store'
import { getFullPathForBuffer } from './directoryStore/directoryPureHelpers'

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

  return (
    <div
      className="absolute z-10 whitespace-pre flex items-center select-none"
      style={{
        top: HEADER + cursor.line * ROW_HEIGHT,
        left: NAME_START,
        height: ROW_HEIGHT,
        fontSize: fontsize,
      }}
      data-cursor={directoryId}
    >
      <span className="opacity-0 h-full flex items-center">{data.until}</span>

      <span className="bg-red-100/50 h-full flex items-center">{data.char}</span>
    </div>
  )
}

const fontsize = `0.6875rem`

const HEADER = 30
const ROW_HEIGHT = 25.5
const NAME_START = 40
