import { useState, Ref, forwardRef, useEffect } from 'react'
import { Dialog } from '@/lib/components/dialog'
import { Button } from '@/lib/components/button'
import { VimEngine } from '@common/VimEngine'
import { FileIcon, FolderIcon, PlusIcon, TrashIcon, Edit3Icon } from 'lucide-react'
import { useDialogStoreDialog } from '../dialogStore'
import { DialogForItem } from '@/lib/hooks/useDialogForItem'

type ChangeWithId = VimEngine.Change & { id: string }

export const VimChangesDialog = forwardRef(function VimChangesDialog(
  _props: {},
  ref: Ref<DialogForItem<{ changes: VimEngine.Change[] }>>
) {
  const { dialogOpen, item, onClose } = useDialogStoreDialog(ref)
  
  const changes = item?.changes ?? []
  const changesWithIds: ChangeWithId[] = changes.map((change, idx) => ({
    ...change,
    id: `${change.type}-${idx}`,
  }))

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(changesWithIds.map(c => c.id))
  )

  // Reset selected IDs when changes change
  useEffect(() => {
    setSelectedIds(new Set(changesWithIds.map(c => c.id)))
  }, [changes.length])

  const toggleChange = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === changesWithIds.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(changesWithIds.map(c => c.id)))
    }
  }

  const handleApply = () => {
    const selectedChanges = changesWithIds
      .filter(c => selectedIds.has(c.id))
      .map(({ id, ...change }) => change)
    
    console.log('Applying changes:', selectedChanges)
    // TODO: Implement the actual file operations here
    
    onClose()
  }

  const getChangeIcon = (type: VimEngine.Change['type']) => {
    switch (type) {
      case 'add':
        return PlusIcon
      case 'remove':
        return TrashIcon
      case 'rename':
        return Edit3Icon
    }
  }

  const getChangeColor = (type: VimEngine.Change['type']) => {
    switch (type) {
      case 'add':
        return 'text-green-500'
      case 'remove':
        return 'text-red-500'
      case 'rename':
        return 'text-blue-500'
    }
  }

  const getChangeDescription = (change: VimEngine.Change) => {
    switch (change.type) {
      case 'add':
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold">Add:</span>
            <FileIcon className="h-4 w-4" />
            <span className="font-mono">{change.name}</span>
            <span className="text-gray-500">in</span>
            <FolderIcon className="h-4 w-4" />
            <span className="font-mono text-sm text-gray-400">{change.directory}</span>
          </div>
        )
      case 'remove':
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold">Remove:</span>
            {change.item.type === 'file' ? (
              <FileIcon className="h-4 w-4" />
            ) : (
              <FolderIcon className="h-4 w-4" />
            )}
            <span className="font-mono">{change.item.name}</span>
            <span className="text-gray-500">from</span>
            <FolderIcon className="h-4 w-4" />
            <span className="font-mono text-sm text-gray-400">{change.directory}</span>
          </div>
        )
      case 'rename': {
        // Extract original directory from item's fullPath
        const originalDir = change.item.fullPath 
          ? change.item.fullPath.substring(0, change.item.fullPath.lastIndexOf('/'))
          : ''
        const isCrossDirectoryMove = originalDir !== change.newDirectory
        
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {isCrossDirectoryMove ? 'Move:' : 'Rename:'}
              </span>
              {change.item.type === 'file' ? (
                <FileIcon className="h-4 w-4" />
              ) : (
                <FolderIcon className="h-4 w-4" />
              )}
              <span className="font-mono">{change.item.name}</span>
              <span className="text-gray-500">→</span>
              <span className="font-mono font-semibold">{change.newName}</span>
            </div>
            {isCrossDirectoryMove && (
              <div className="flex items-center gap-2 text-sm ml-6 text-gray-600 dark:text-gray-400">
                <FolderIcon className="h-3 w-3" />
                <span className="font-mono text-xs">{originalDir}</span>
                <span>→</span>
                <FolderIcon className="h-3 w-3" />
                <span className="font-mono text-xs">{change.newDirectory}</span>
              </div>
            )}
          </div>
        )
      }
    }
  }

  if (!dialogOpen) return null

  return (
    <Dialog
      title={
        <div className="flex items-center justify-between w-full">
          <span>VIM Changes ({changes.length})</span>
          <button
            onClick={toggleAll}
            className="text-sm font-normal hover:underline text-blue-500"
          >
            {selectedIds.size === changesWithIds.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} className="btn-ghost">
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={selectedIds.size === 0}>
            Apply {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
        </>
      }
    >
      <div className="overflow-y-auto max-h-[60vh]">
        {changesWithIds.map(change => {
          const Icon = getChangeIcon(change.type)
          const isSelected = selectedIds.has(change.id)

          return (
            <label
              key={change.id}
              className="flex items-start gap-3 p-3 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleChange(change.id)}
                className="mt-1 h-4 w-4 cursor-pointer"
              />
              <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${getChangeColor(change.type)}`} />
              <div className="flex-1 min-w-0">{getChangeDescription(change)}</div>
            </label>
          )
        })}
      </div>
    </Dialog>
  )
})
