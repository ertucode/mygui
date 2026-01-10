import type { ColumnDef } from '@/lib/libs/table/table-types'
import { GetFilesAndFoldersInDirectoryItem } from '@common/Contracts'
import { FileCategory } from '@common/file-category'
import { FileTags, TAG_COLOR_CLASSES, TagColor } from '../tags'
import { PathHelpers } from '@common/PathHelpers'
import { useEffect, useRef, useState } from 'react'
import { directoryStore, selectActiveVimBuffer } from '../directoryStore/directory'
import {
  DerivedDirectoryItem,
  DirectoryId,
  DirectoryType,
  RealDirectoryItem,
  StrDirectoryItem,
} from '../directoryStore/DirectoryBase'
import { CategoryHelpers } from '../CategoryHelpers'
import { getWindowElectron } from '@/getWindowElectron'
import { useSelector } from '@xstate/store/react'
import { FileQuestionIcon } from 'lucide-react'
import { VimShortcutHelper } from '../vim/VimShortcutHelper'
import { VimEngine } from '@common/VimEngine'
import { getFullPathForBuffer } from '../directoryStore/directoryPureHelpers'

function CategoryIcon({ category }: { category: FileCategory | 'folder' }) {
  const config = CategoryHelpers.get(category)
  return <config.icon className={`size-4 ${config.colorClass}`} fill={config.fill || 'transparent'} />
}

function AppIconOrCategoryIcon({ item, ctx }: { item: GetFilesAndFoldersInDirectoryItem; ctx: ColumnsContext }) {
  const [appIcon, setAppIcon] = useState<string | null>(null)

  useEffect(() => {
    if (item.type !== 'dir' || !item.name.endsWith('.app')) return
    const fullPath = ctx.getFullPath(item.name)
    if (!fullPath.startsWith('/Applications/') || fullPath.startsWith('/System/Applications/')) return

    getWindowElectron()
      .generateAppIcon(fullPath)
      .then(setAppIcon)
      .catch(() => {})
  }, [])

  if (appIcon) {
    return (
      <span className="relative flex items-center">
        <img
          src={appIcon}
          alt=""
          className="absolute top-0 size-5 object-contain translate-y-[-50%] translate-x-[calc(-.5*var(--spacing))] max-w-1000"
        />
      </span>
    )
  }

  return <CategoryIcon category={item.category} />
}

/**
 * Tag circles component for displaying file tags
 */
function TagCircles({ tags }: { tags: TagColor[] }) {
  if (tags.length === 0) return null
  return (
    <div className="flex gap-0.5 ml-1 flex-shrink-0">
      {tags.map(color => (
        <span key={color} className={`size-2 rounded-full ${TAG_COLOR_CLASSES[color].dot}`} />
      ))}
    </div>
  )
}

export interface ColumnsContext {
  fileTags: FileTags
  getFullPath: (name: string) => string
  directoryId: DirectoryId
  directoryType: DirectoryType
  isInsert: (index: number) => boolean | undefined
}

export function createColumns(ctx: ColumnsContext): ColumnDef<DerivedDirectoryItem>[] {
  return [
    {
      header: '',
      id: 'type',
      sortKey: undefined,
      cell: row => {
        if (row.type === 'real') return <AppIconOrCategoryIcon item={row.item} ctx={ctx} />

        return <FileQuestionIcon className="size-4" />
      },
      size: 24,
      headerConfigView: 'Icon',
    },
    {
      id: 'name',
      sortKey: 'name',
      header: 'Name',
      cell: (row, { index: idx }) => {
        if (ctx.isInsert(idx)) return <VimInsertItem row={row} />

        if (row.type === 'real') return <DirectoryNameCell item={row} ctx={ctx} idx={idx} />
        return <VimModeName ctx={ctx} row={row} index={idx} />
      },
    },
    {
      id: 'ext',
      sortKey: 'ext',
      header: 'Ext',
      headerConfigView: 'Extension',
      size: 60,
      cell: row => <SimpleCell accessor="ext" row={row} />,
    },
    {
      id: 'size',
      sortKey: 'size',
      header: 'Size',
      size: 72,
      cell: row => <SimpleCell accessor="sizeStr" row={row} />,
    },
    {
      id: 'modifiedAt',
      sortKey: 'modifiedTimestamp',
      header: 'Modified',
      size: 124,
      cell: row => <SimpleCell accessor="modifiedAt" row={row} />,
    },
    {
      id: 'permissions',
      sortKey: undefined,
      header: 'Permissions',
      size: 80,
      cell: row => <SimpleCell accessor="permissions" row={row} />,
    },
  ]
}

function SimpleCell({
  accessor,
  row,
}: {
  accessor: keyof GetFilesAndFoldersInDirectoryItem
  row: DerivedDirectoryItem
}) {
  const value = row.type === 'real' ? row.item[accessor] : undefined
  if (!value) return null
  return (
    <span className="block truncate" title={value.toString()}>
      {value}
    </span>
  )
}

function DirectoryNameCell({ item, ctx }: { item: RealDirectoryItem; ctx: ColumnsContext; idx: number }) {
  const row = item.item
  const fullPath = row.fullPath ?? ctx.getFullPath(row.name)
  const tags = ctx.fileTags[fullPath]
  // Show folder name when fullPath is available (tags view)
  const parentFolder = row.fullPath ? PathHelpers.parent(row.fullPath) : null

  return (
    <div className="flex items-center min-w-0 gap-2">
      <span className="block truncate leading-none" title={row.name}>
        {item.str}
      </span>
      {tags && <TagCircles tags={tags} />}
      {parentFolder && parentFolder.name && ctx.directoryType === 'tags' && (
        <span className="text-gray-400 text-xs truncate flex-shrink-0 leading-none" title={parentFolder.path}>
          {parentFolder.path}
        </span>
      )}
    </div>
  )
}

function VimModeName({ ctx, row, index }: { ctx: ColumnsContext; row: StrDirectoryItem; index: number }) {
  const isInsert = useSelector(directoryStore, s => {
    if (s.context.vim.mode !== 'insert') return false
    const directory = s.context.directoriesById[ctx.directoryId]
    if (!directory) return false
    const fullPath = getFullPathForBuffer(directory.directory)
    const buffer = s.context.vim.buffers[fullPath]
    if (!buffer) return false
    return buffer.cursor.line === index
  })

  if (!isInsert) return row.str

  return <VimInsertItem row={row} />
}

function VimInsertItem({ row }: { row: DerivedDirectoryItem }) {
  const [value, setValue] = useState(row.str)
  const inputRef = useRef<HTMLInputElement>(null)

  const onEscapeOrBlur = (e: { preventDefault: () => void } | undefined) => {
    const handler = VimShortcutHelper.createHandler(s =>
      VimEngine.esc(s, value, inputRef.current?.selectionStart && inputRef.current.selectionStart - 1)
    )
    handler(e)
  }

  const onKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
    if (e.key === 'Enter') {
      const handler = VimShortcutHelper.createHandler(s => VimEngine.enter(s, value))
      handler(e)
    } else if (e.key === 'Escape') {
      onEscapeOrBlur(e)
    }
  }

  useEffect(() => {
    const vim = selectActiveVimBuffer(undefined)(directoryStore.getSnapshot())
    if (!vim || !inputRef.current) return
    inputRef.current.selectionStart = vim.cursor.column
    inputRef.current.selectionEnd = vim.cursor.column
  }, [])

  return (
    <input
      ref={inputRef}
      className="w-full"
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onClick={e => e.stopPropagation()}
      onBlur={onEscapeOrBlur}
      autoFocus
    />
  )
}
