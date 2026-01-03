import { useSelector } from '@xstate/store/react'
import { useDirectoryContext } from './DirectoryContext'
import { directoryStore, selectActiveVimBuffer } from './directoryStore/directory'
import { shallowEqual } from '@xstate/store'

export function VimCursor() {
  const directoryId = useDirectoryContext().directoryId

  const data = useSelector(
    directoryStore,
    s => {
      const vim = selectActiveVimBuffer(directoryId)(s)
      if (!vim) return
      if (s.context.directoriesById[directoryId].directory.type !== 'path') return
      const fullPath = s.context.directoriesById[directoryId].directory.fullPath
      return {
        cursor: vim.cursor,
        content: s.context.vim.buffers[fullPath]?.items[vim.cursor.line]?.str[0],
      }
    },
    shallowEqual
  )

  if (!data) return null
  const { cursor } = data

  return (
    <div
      className="absolute bg-red-100/50 z-10 leading-none "
      style={{
        top: HEADER + PADDING + cursor.line * ROW_HEIGHT,
        left: NAME_START,
        height: CURSOR_HEIGHT,
        fontSize: fontsize,
      }}
    >
      {data.content}
    </div>
  )
}

const fontsize = `0.6875rem`

const PADDING = 7
const HEADER = 30
const ROW_HEIGHT = 25.5
const NAME_START = 40
const CURSOR_HEIGHT = ROW_HEIGHT - PADDING * 2
