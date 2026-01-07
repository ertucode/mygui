import { useSelector } from '@xstate/store/react'
import { useEffect, useRef, useState } from 'react'
import { directoryStore, directoryHelpers } from '../directoryStore/directory'
import { DirectoryId } from '../directoryStore/DirectoryBase'
import { directoryDerivedStores } from '../directoryStore/directorySubscriptions'
import { directorySelection } from '../directoryStore/directorySelection'
import { selectBuffer } from '../directoryStore/directoryPureHelpers'
import { VimShortcutHelper } from '../vim/VimShortcutHelper'
import { VimFuzzy } from '@common/VimFuzzy'

export type FuzzyInputProps = {
  directoryId: DirectoryId
}

export function FuzzyInput({ directoryId }: { directoryId: DirectoryId }) {
  const fuzzy = useSelector(directoryStore, s => {
    return selectBuffer(s.context, directoryId)?.fuzzy
  })
  const filteredData = directoryDerivedStores.get(directoryId)!.useFilteredDirectoryData()

  const inputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    return directoryStore.on('focusFuzzyInput', ({ e, directoryId: dId }) => {
      if (dId !== directoryId) return
      e?.preventDefault()
      inputRef.current?.focus()
    }).unsubscribe
  }, [directoryId])

  const isVisible = isFocused

  return (
    <input
      id="fuzzy-finder-input"
      type="text"
      ref={inputRef}
      className="input text-sm h-6 w-48 min-[1000px]:w-60 absolute top-2 right-2 z-10 transition-opacity duration-200 rounded-none"
      style={{
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
      placeholder="Search... (/)"
      value={fuzzy?.query ?? ''}
      onChange={e => {
        VimShortcutHelper.updateVim(opts => VimFuzzy.setFuzzyQuery(opts, e.target.value))
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false)
        VimShortcutHelper.updateVim(VimFuzzy.blurFuzzy)
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.currentTarget.blur()
          VimShortcutHelper.updateVim(VimFuzzy.blurFuzzy)
        }
        if (e.key === 'j' && e.ctrlKey)
          directorySelection.setSelection(h => Math.min(h + 1, filteredData.length - 1), directoryId)
        if (e.key === 'k' && e.ctrlKey) directorySelection.setSelection(h => Math.max(h - 1, 0), directoryId)

        if (e.key === 'n' && e.ctrlKey) VimShortcutHelper.updateVim(VimFuzzy.n)
        if (e.key === 'N' && e.ctrlKey && e.shiftKey) VimShortcutHelper.updateVim(VimFuzzy.N)

        if (e.key === 'ArrowUp') {
          e.preventDefault()
          VimShortcutHelper.updateVim(VimFuzzy.fuzzyHistoryPrev)
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          VimShortcutHelper.updateVim(VimFuzzy.fuzzyHistoryNext)
        }

        if (e.key === 'Enter') {
          directoryHelpers.openItemOnCursor(filteredData, undefined, directoryId)
          e.currentTarget.blur()
        }
      }}
    />
  )
}
