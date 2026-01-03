import { useState, Ref, forwardRef, useEffect, useMemo } from 'react'
import { Dialog } from '@/lib/components/dialog'
import { Button } from '@/lib/components/button'
import { VimEngine } from '@common/VimEngine'
import { FileIcon, FolderIcon, PlusIcon, TrashIcon, Edit3Icon, ArrowRightIcon } from 'lucide-react'
import { useDialogStoreDialog } from '../dialogStore'
import { DialogForItem } from '@/lib/hooks/useDialogForItem'

type ChangeWithId = VimEngine.Change & { id: string }

type DirectoryChange = {
  change: ChangeWithId
  displayType: 'add' | 'remove' | 'rename' | 'move-from' | 'move-to'
  otherDirectory?: string // For cross-directory moves
}

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

  // Group changes by directory
  const directoryGroups = useMemo(() => {
    const groupMap = new Map<string, DirectoryChange[]>()

    for (const change of changesWithIds) {
      if (change.type === 'add' || change.type === 'remove') {
        // Simple add/remove - only affects one directory
        const dir = change.directory
        if (!groupMap.has(dir)) {
          groupMap.set(dir, [])
        }
        groupMap.get(dir)!.push({
          change,
          displayType: change.type,
        })
      } else if (change.type === 'rename') {
        // Check if it's a cross-directory move
        const originalDir = change.item.fullPath 
          ? change.item.fullPath.substring(0, change.item.fullPath.lastIndexOf('/'))
          : ''
        const isCrossDirectoryMove = originalDir !== change.newDirectory

        if (isCrossDirectoryMove) {
          // Show in both source and destination directories
          // In source directory: show as "move-from"
          if (!groupMap.has(originalDir)) {
            groupMap.set(originalDir, [])
          }
          groupMap.get(originalDir)!.push({
            change,
            displayType: 'move-from',
            otherDirectory: change.newDirectory,
          })

          // In destination directory: show as "move-to"
          if (!groupMap.has(change.newDirectory)) {
            groupMap.set(change.newDirectory, [])
          }
          groupMap.get(change.newDirectory)!.push({
            change,
            displayType: 'move-to',
            otherDirectory: originalDir,
          })
        } else {
          // Simple rename within same directory
          if (!groupMap.has(change.newDirectory)) {
            groupMap.set(change.newDirectory, [])
          }
          groupMap.get(change.newDirectory)!.push({
            change,
            displayType: 'rename',
          })
        }
      }
    }

    // Convert to array and sort by directory path
    return Array.from(groupMap.entries())
      .map(([directory, changes]) => ({ directory, changes }))
      .sort((a, b) => a.directory.localeCompare(b.directory))
  }, [changesWithIds])

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

  const getChangeIcon = (displayType: DirectoryChange['displayType']) => {
    switch (displayType) {
      case 'add':
        return PlusIcon
      case 'remove':
        return TrashIcon
      case 'rename':
        return Edit3Icon
      case 'move-from':
      case 'move-to':
        return ArrowRightIcon
    }
  }

  const getChangeColor = (displayType: DirectoryChange['displayType']) => {
    switch (displayType) {
      case 'add':
        return 'text-green-500'
      case 'remove':
        return 'text-red-500'
      case 'rename':
        return 'text-blue-500'
      case 'move-from':
        return 'text-orange-500'
      case 'move-to':
        return 'text-cyan-500'
    }
  }

  const getChangeDescription = (dirChange: DirectoryChange) => {
    const { change, displayType, otherDirectory } = dirChange
    
    switch (displayType) {
      case 'add':
        if (change.type !== 'add') return null
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold w-20 text-right">Add:</span>
            <FileIcon className="h-4 w-4" />
            <span className="font-mono">{change.name}</span>
          </div>
        )
      case 'remove':
        if (change.type !== 'remove') return null
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold w-20 text-right">Remove:</span>
            {change.item.type === 'file' ? (
              <FileIcon className="h-4 w-4" />
            ) : (
              <FolderIcon className="h-4 w-4" />
            )}
            <span className="font-mono">{change.item.name}</span>
          </div>
        )
      case 'rename':
        if (change.type !== 'rename') return null
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold w-20 text-right">Rename:</span>
            {change.item.type === 'file' ? (
              <FileIcon className="h-4 w-4" />
            ) : (
              <FolderIcon className="h-4 w-4" />
            )}
            <span className="font-mono">{change.item.name}</span>
            <span className="text-gray-500">→</span>
            <span className="font-mono font-semibold">{change.newName}</span>
          </div>
        )
      case 'move-from':
        if (change.type !== 'rename') return null
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold w-20 text-right">Move to:</span>
            {change.item.type === 'file' ? (
              <FileIcon className="h-4 w-4" />
            ) : (
              <FolderIcon className="h-4 w-4" />
            )}
            <span className="font-mono">{change.item.name}</span>
            <ArrowRightIcon className="h-4 w-4 text-gray-400" />
            <span className="font-mono text-sm text-gray-500">{otherDirectory}</span>
            {change.newName !== change.item.name && (
              <>
                <span className="text-gray-500">as</span>
                <span className="font-mono font-semibold">{change.newName}</span>
              </>
            )}
          </div>
        )
      case 'move-to':
        if (change.type !== 'rename') return null
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold w-20 text-right">Move from:</span>
            {change.item.type === 'file' ? (
              <FileIcon className="h-4 w-4" />
            ) : (
              <FolderIcon className="h-4 w-4" />
            )}
            <span className="font-mono text-sm text-gray-500">{otherDirectory}</span>
            <ArrowRightIcon className="h-4 w-4 text-gray-400" />
            <span className="font-mono">{change.newName}</span>
            {change.newName !== change.item.name && (
              <>
                <span className="text-gray-500">from</span>
                <span className="font-mono text-sm">{change.item.name}</span>
              </>
            )}
          </div>
        )
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
        {directoryGroups.map(group => (
          <div key={group.directory} className="mb-6 last:mb-0">
            {/* Directory header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-t sticky top-0 z-10">
              <FolderIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-300">
                {group.directory}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-500">
                ({group.changes.length} {group.changes.length === 1 ? 'change' : 'changes'})
              </span>
            </div>

            {/* Changes in this directory */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-b">
              {group.changes.map((dirChange, idx) => {
                const Icon = getChangeIcon(dirChange.displayType)
                const isSelected = selectedIds.has(dirChange.change.id)

                return (
                  <label
                    key={`${dirChange.change.id}-${dirChange.displayType}`}
                    className={`flex items-start gap-3 p-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      idx !== group.changes.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleChange(dirChange.change.id)}
                      className="mt-1 h-4 w-4 cursor-pointer"
                    />
                    <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${getChangeColor(dirChange.displayType)}`} />
                    <div className="flex-1 min-w-0">{getChangeDescription(dirChange)}</div>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  )
})
