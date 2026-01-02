import type { ColumnDef } from '@/lib/libs/table/table-types'
import { GetFilesAndFoldersInDirectoryItem } from '@common/Contracts'
import { FileCategory } from '@common/file-category'
import { FileTags, TAG_COLOR_CLASSES, TagColor } from '../tags'
import { PathHelpers } from '@common/PathHelpers'
import { useEffect, useRef, useState } from 'react'
import { directoryHelpers, directoryStore } from '../directoryStore/directory'
import { DerivedDirectoryItem, DirectoryId, DirectoryType } from '../directoryStore/DirectoryBase'
import { CategoryHelpers } from '../CategoryHelpers'
import { perDirectoryDataHelpers } from '../directoryStore/perDirectoryData'
import { getWindowElectron } from '@/getWindowElectron'
import { BluetoothSearchingIcon } from 'lucide-react'

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
}

export function createColumns(ctx: ColumnsContext): ColumnDef<DerivedDirectoryItem>[] {
  return [
    {
      header: '',
      id: 'type',
      sortKey: undefined,
      cell: row => {
        if (row.type === 'real') return <AppIconOrCategoryIcon item={row.item} ctx={ctx} />

        return <BluetoothSearchingIcon className="size-4" />
      },
      size: 24,
      headerConfigView: 'Icon',
    },
    {
      id: 'name',
      sortKey: 'name',
      header: 'Name',
      cell: (row, { index: idx }) => {
        if (row.type === 'real') return <DirectoryNameColumn row={row.item} ctx={ctx} idx={idx} />
        return row.str
      },
    },
    {
      id: 'ext',
      sortKey: 'ext',
      header: 'Ext',
      headerConfigView: 'Extension',
      size: 6,
      cell: row => <SimpleCell accessor="ext" row={row} />,
    },
    {
      id: 'size',
      sortKey: 'size',
      header: 'Size',
      size: 84,
      cell: row => <SimpleCell accessor="size" row={row} />,
    },
    {
      id: 'modifiedAt',
      sortKey: 'modifiedTimestamp',
      header: 'Modified',
      size: 148,
      cell: row => <SimpleCell accessor="modifiedAt" row={row} />,
    },
    {
      id: 'permissions',
      sortKey: undefined,
      header: 'Permissions',
      size: 140,
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

function DirectoryNameColumn({
  row,
  ctx,
  idx,
}: {
  row: GetFilesAndFoldersInDirectoryItem
  ctx: ColumnsContext
  idx: number
}) {
  const fullPath = row.fullPath ?? ctx.getFullPath(row.name)
  const tags = ctx.fileTags[fullPath]
  // Show folder name when fullPath is available (tags view)
  const parentFolder = row.fullPath ? PathHelpers.parent(row.fullPath) : null

  const [renaming, setRenaming] = useState(false)

  return (
    <div className="flex items-center min-w-0 gap-2">
      {renaming ? (
        <RenameInput row={row} ctx={ctx} setRenaming={setRenaming} />
      ) : (
        <span
          className="block truncate"
          title={row.name}
          onClick={e => {
            if (perDirectoryDataHelpers.lastClickIsRecent(ctx.directoryId, idx)) {
              return
            }
            if (e.metaKey || checkIfRowIsSelected(ctx, idx)) {
              e.preventDefault()
              setRenaming(true)
            }
          }}
        >
          {row.name}
        </span>
      )}
      {tags && <TagCircles tags={tags} />}
      {parentFolder && parentFolder.name && ctx.directoryType === 'tags' && (
        <span className="text-gray-400 text-xs truncate flex-shrink-0" title={parentFolder.path}>
          {parentFolder.path}
        </span>
      )}
    </div>
  )
}

function checkIfRowIsSelected(ctx: ColumnsContext, idx: number) {
  const snapshot = directoryStore.getSnapshot()
  if (snapshot.context.activeDirectoryId !== ctx.directoryId) return false

  const lastSelected = snapshot.context.directoriesById[ctx.directoryId]?.selection?.last
  if (lastSelected == null) return false

  return lastSelected === idx
}

function RenameInput({
  row,
  ctx,
  setRenaming,
}: {
  row: GetFilesAndFoldersInDirectoryItem
  ctx: ColumnsContext
  setRenaming: (value: boolean) => void
}) {
  const [value, setValue] = useState(row.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const c = inputRef.current
    if (!c) return
    c.focus()
    c.selectionStart = 0
    const indexOfLastDot = c.value.lastIndexOf('.')
    if (indexOfLastDot !== -1) {
      c.selectionEnd = indexOfLastDot
    }

    const closest = c.closest('tr')
    if (closest) {
      closest.draggable = false
    }

    return () => {
      if (!closest) return
      closest.draggable = true
    }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      directoryHelpers.renameItem(row, value, ctx.directoryId)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setRenaming(false)
    }
  }

  const onBlur = (e: React.FocusEvent) => {
    e.preventDefault()
    setRenaming(false)
  }

  return (
    <input
      ref={inputRef}
      className="w-full"
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onClick={e => e.stopPropagation()}
      onBlur={onBlur}
      draggable={false}
    />
  )
}
