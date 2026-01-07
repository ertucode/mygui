import { useSelector } from '@xstate/store/react'
import { useDirectoryContext } from '../DirectoryContext'
import { directoryStore, selectActiveVimBuffer } from '../directoryStore/directory'
import { shallowEqual } from '@xstate/store'
import { VimHighlight } from './VimHighlight'
import React from 'react'

export function VimFuzzyHighlight() {
  const directoryId = useDirectoryContext().directoryId

  const data = useSelector(
    directoryStore,
    s => {
      if (s.context.vim.mode === 'insert') return
      if (s.context.activeDirectoryId !== directoryId) return
      const vim = selectActiveVimBuffer(directoryId)(s)
      if (!vim || !vim.fuzzy.query || !vim.fuzzy.matches.length) return

      return {
        items: vim.items,
        matches: vim.fuzzy.matches,
        cycleIndex: vim.fuzzy.cycleIndex,
      }
    },
    shallowEqual
  )

  if (!data) return null

  return data.matches.map((match, i) => {
    const item = data.items[match.line]
    return (
      <React.Fragment key={i}>
        {match.columnTuples.map(([start, end], i2) => {
          return (
            <VimHighlight
              key={i2}
              line={match.line}
              until={item.str.slice(0, start)}
              highlighted={item.str.slice(start, end)}
              colorClass="bg-red-100/50"
            />
          )
        })}
      </React.Fragment>
    )
  })
}
