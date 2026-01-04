import { useState, Ref, forwardRef, useEffect, useMemo, useRef } from 'react'
import { Dialog } from '@/lib/components/dialog'
import { Button } from '@/lib/components/button'
import { VimEngine } from '@common/VimEngine'
import { FileIcon, FolderIcon, PlusIcon, TrashIcon, Edit3Icon, ArrowRightIcon, CopyIcon, AlertTriangleIcon } from 'lucide-react'
import { useDialogStoreDialog } from '../dialogStore'
import { DialogForItem } from '@/lib/hooks/useDialogForItem'
import { getWindowElectron } from '@/getWindowElectron'
import { Typescript } from '@common/Typescript'

type ChangeWithId = VimEngine.Change & { id: string }

type DirectoryChange = {
  change: ChangeWithId
  changes?: ChangeWithId[] // Multiple changes grouped together (for multi-dest)
  displayType: 'add' | 'remove' | 'copy' | 'copy-from' | 'copy-to' | 'rename' | 'move-from' | 'move-to' | 'multi-dest'
  otherDirectory?: string // For cross-directory moves/copies
  destinations?: Array<{ directory: string; name: string }> // For multi-destination display
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

    // First pass: add all changes
    for (const change of changesWithIds) {
      if (change.type === 'add') {
        const dir = change.directory
        if (!groupMap.has(dir)) {
          groupMap.set(dir, [])
        }
        groupMap.get(dir)!.push({
          change,
          displayType: change.type,
        })
      } else if (change.type === 'remove') {
        const dir = change.directory
        if (!groupMap.has(dir)) {
          groupMap.set(dir, [])
        }
        groupMap.get(dir)!.push({
          change,
          displayType: change.type,
        })
      } else if (change.type === 'copy') {
        const originalDir = change.item.fullPath
          ? change.item.fullPath.substring(0, change.item.fullPath.lastIndexOf('/'))
          : ''
        const isSameDirectory = originalDir === change.newDirectory

        if (isSameDirectory) {
          if (!groupMap.has(change.newDirectory)) {
            groupMap.set(change.newDirectory, [])
          }
          groupMap.get(change.newDirectory)!.push({
            change,
            displayType: 'copy',
          })
        } else {
          if (!groupMap.has(originalDir)) {
            groupMap.set(originalDir, [])
          }
          groupMap.get(originalDir)!.push({
            change,
            displayType: 'copy-from',
            otherDirectory: change.newDirectory,
          })

          if (!groupMap.has(change.newDirectory)) {
            groupMap.set(change.newDirectory, [])
          }
          groupMap.get(change.newDirectory)!.push({
            change,
            displayType: 'copy-to',
            otherDirectory: originalDir,
          })
        }
      } else if (change.type === 'rename') {
        const originalDir = change.item.fullPath
          ? change.item.fullPath.substring(0, change.item.fullPath.lastIndexOf('/'))
          : ''
        const isCrossDirectoryMove = originalDir !== change.newDirectory

        if (isCrossDirectoryMove) {
          if (!groupMap.has(originalDir)) {
            groupMap.set(originalDir, [])
          }
          groupMap.get(originalDir)!.push({
            change,
            displayType: 'move-from',
            otherDirectory: change.newDirectory,
          })

          if (!groupMap.has(change.newDirectory)) {
            groupMap.set(change.newDirectory, [])
          }
          groupMap.get(change.newDirectory)!.push({
            change,
            displayType: 'move-to',
            otherDirectory: originalDir,
          })
        } else {
          if (!groupMap.has(change.newDirectory)) {
            groupMap.set(change.newDirectory, [])
          }
          groupMap.get(change.newDirectory)!.push({
            change,
            displayType: 'rename',
          })
        }
      } else {
        Typescript.assertUnreachable(change)
      }
    }

    // Second pass: group multiple copy/copy-from/rename/move-from with same source file into multi-dest
    for (const [directory, changes] of groupMap.entries()) {
      const sourceFileGroups = new Map<string, DirectoryChange[]>()

      for (const dirChange of changes) {
        // Group same-directory and cross-directory copies/renames
        if (
          dirChange.displayType === 'copy' ||
          dirChange.displayType === 'copy-from' ||
          dirChange.displayType === 'rename' ||
          dirChange.displayType === 'move-from'
        ) {
          const sourceFile =
            dirChange.change.type === 'copy' || dirChange.change.type === 'rename'
              ? dirChange.change.item.fullPath || dirChange.change.item.name
              : ''

          if (!sourceFileGroups.has(sourceFile)) {
            sourceFileGroups.set(sourceFile, [])
          }
          sourceFileGroups.get(sourceFile)!.push(dirChange)
        }
      }

      // Find groups with multiple destinations
      const multiDestGroups: DirectoryChange[] = []
      const singleChanges: DirectoryChange[] = []

      for (const dirChange of changes) {
        // Skip if not a groupable type
        if (
          dirChange.displayType !== 'copy' &&
          dirChange.displayType !== 'copy-from' &&
          dirChange.displayType !== 'rename' &&
          dirChange.displayType !== 'move-from'
        ) {
          singleChanges.push(dirChange)
          continue
        }

        const sourceFile =
          dirChange.change.type === 'copy' || dirChange.change.type === 'rename'
            ? dirChange.change.item.fullPath || dirChange.change.item.name
            : ''

        const group = sourceFileGroups.get(sourceFile)!
        if (group.length > 1) {
          // Check if we already created a multi-dest for this source file
          const alreadyGrouped = multiDestGroups.some(g => {
            return g.changes?.some(c => {
              const cSourceFile = c.type === 'copy' || c.type === 'rename' ? c.item.fullPath || c.item.name : ''
              return cSourceFile === sourceFile
            })
          })

          if (!alreadyGrouped) {
            // Create multi-dest entry
            multiDestGroups.push({
              change: dirChange.change,
              changes: group.map(g => g.change),
              displayType: 'multi-dest',
              destinations: group.map(g => {
                // For same-directory operations, use the directory from the change
                const destDir = g.change.type === 'copy' || g.change.type === 'rename' ? g.change.newDirectory : ''
                return {
                  directory: destDir,
                  name: g.change.type === 'copy' || g.change.type === 'rename' ? g.change.newName : '',
                }
              }),
            })
          }
        } else {
          singleChanges.push(dirChange)
        }
      }

      groupMap.set(directory, [...singleChanges, ...multiDestGroups])
    }

    return Array.from(groupMap.entries())
      .map(([directory, changes]) => ({ directory, changes }))
      .sort((a, b) => a.directory.localeCompare(b.directory))
  }, [changesWithIds])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(changesWithIds.map(c => c.id)))

  // Detect duplicate destination files
  const duplicateDestinations = useMemo(() => {
    const selectedChanges = changesWithIds.filter(c => selectedIds.has(c.id))
    const destinationMap = new Map<string, ChangeWithId[]>()

    for (const change of selectedChanges) {
      let destinationPath: string | null = null

      if (change.type === 'add') {
        destinationPath = `${change.directory}/${change.name}`
      } else if (change.type === 'copy') {
        destinationPath = `${change.newDirectory}/${change.newName}`
      } else if (change.type === 'rename') {
        destinationPath = `${change.newDirectory}/${change.newName}`
      }

      if (destinationPath) {
        if (!destinationMap.has(destinationPath)) {
          destinationMap.set(destinationPath, [])
        }
        destinationMap.get(destinationPath)!.push(change)
      }
    }

    // Find paths with multiple changes targeting them
    const duplicates: Array<{ path: string; changes: ChangeWithId[] }> = []
    for (const [path, changes] of destinationMap.entries()) {
      if (changes.length > 1) {
        duplicates.push({ path, changes })
      }
    }

    return duplicates
  }, [changesWithIds, selectedIds])

  const hasDuplicates = duplicateDestinations.length > 0

  // Reset selected IDs when changes change
  useEffect(() => {
    setSelectedIds(new Set(changesWithIds.map(c => c.id)))
    buttonRef.current?.focus()
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

  const handleApply = async () => {
    if (selectedIds.size === 0) return
    
    // Validate for duplicates before applying
    if (hasDuplicates) {
      alert('Cannot apply changes: Multiple changes are targeting the same destination path. Please deselect conflicting changes.')
      return
    }
    
    const selectedChanges = changesWithIds.filter(c => selectedIds.has(c.id)).map(({ id, ...change }) => change)

    const result = await getWindowElectron().applyVimChanges(selectedChanges)

    if (result.success) {
      onClose()
    } else {
      // Error handling - could show a toast or alert
      console.error('Failed to apply changes:', result.error)
      const errorMsg =
        result.error.type === 'message'
          ? result.error.message
          : result.error.type === 'http'
            ? result.error.message
            : 'Unknown error occurred'
      alert(`Failed to apply changes: ${errorMsg}`)
    }
  }

  const getChangeIcon = (displayType: DirectoryChange['displayType']) => {
    switch (displayType) {
      case 'add':
        return PlusIcon
      case 'remove':
        return TrashIcon
      case 'copy':
      case 'copy-from':
      case 'copy-to':
        return CopyIcon
      case 'rename':
        return Edit3Icon
      case 'move-from':
      case 'move-to':
        return ArrowRightIcon
      case 'multi-dest':
        return ArrowRightIcon
      default:
        Typescript.assertUnreachable(displayType)
    }
  }

  const getChangeColor = (displayType: DirectoryChange['displayType']) => {
    switch (displayType) {
      case 'add':
        return 'text-green-500'
      case 'remove':
        return 'text-red-500'
      case 'copy':
        return 'text-purple-500'
      case 'copy-from':
        return 'text-purple-500'
      case 'copy-to':
        return 'text-violet-500'
      case 'rename':
        return 'text-blue-500'
      case 'move-from':
        return 'text-orange-500'
      case 'move-to':
        return 'text-cyan-500'
      case 'multi-dest':
        return 'text-indigo-500'
      default:
        Typescript.assertUnreachable(displayType)
    }
  }

  const getChangeDescription = (dirChange: DirectoryChange) => {
    const { change, displayType, otherDirectory } = dirChange

    // Grid columns: [Operation] [From (Icon + Name + Path)] [Arrow] [To (Icon + Name + Path)]
    switch (displayType) {
      case 'add':
        if (change.type !== 'add') return null
        const isDirectory = change.name.endsWith('/')
        return (
          <div className="grid grid-cols-[70px_1fr] gap-2 items-center text-sm">
            <span className="font-semibold text-right text-green-600 dark:text-green-400 text-xs">Add</span>
            <div className="flex items-center gap-1.5">
              {isDirectory ? (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="font-mono text-xs">{change.name}</span>
            </div>
          </div>
        )
      case 'remove':
        if (change.type !== 'remove') return null
        return (
          <div className="grid grid-cols-[70px_1fr] gap-2 items-center text-sm">
            <span className="font-semibold text-right text-red-600 dark:text-red-400 text-xs">Remove</span>
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="font-mono text-xs">{change.item.name}</span>
            </div>
          </div>
        )
      case 'copy':
        if (change.type !== 'copy') return null
        return (
          <div className="grid grid-cols-[70px_1fr_auto_1fr] gap-2 items-center text-sm">
            <span className="font-semibold text-right text-purple-600 dark:text-purple-400 text-xs">Copy</span>
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="font-mono text-xs">{change.item.name}</span>
            </div>
            <ArrowRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="font-mono text-xs font-semibold">{change.newName}</span>
            </div>
          </div>
        )
      case 'copy-from':
        if (change.type !== 'copy') return null
        return (
          <div className="grid grid-cols-[70px_1fr_auto_1fr] gap-2 items-center text-sm">
            <span className="font-semibold text-right text-purple-600 dark:text-purple-400 text-xs">Copy</span>
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="font-mono text-xs">{change.item.name}</span>
            </div>
            <ArrowRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
              )}
              <span className="font-mono text-xs opacity-40">{otherDirectory}/</span>
              <span className="font-mono text-xs font-semibold">{change.newName}</span>
            </div>
          </div>
        )
      case 'copy-to':
        if (change.type !== 'copy') return null
        return (
          <div className="grid grid-cols-[70px_1fr_auto_1fr] gap-2 items-center text-sm">
            <span className="font-semibold text-right text-purple-600 dark:text-purple-400 text-xs">Copy</span>
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
              )}
              <span className="font-mono text-xs opacity-40">{otherDirectory}/</span>
              <span className="font-mono text-xs">{change.item.name}</span>
            </div>
            <ArrowRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="font-mono text-xs font-semibold">{change.newName}</span>
            </div>
          </div>
        )
      case 'rename':
        if (change.type !== 'rename') return null
        return (
          <div className="grid grid-cols-[70px_1fr_auto_1fr] gap-2 items-center text-sm">
            <span className="font-semibold text-right text-blue-600 dark:text-blue-400 text-xs">Rename</span>
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="font-mono text-xs">{change.item.name}</span>
            </div>
            <ArrowRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="font-mono text-xs font-semibold">{change.newName}</span>
            </div>
          </div>
        )
      case 'move-from':
        if (change.type !== 'rename') return null
        return (
          <div className="grid grid-cols-[70px_1fr_auto_1fr] gap-2 items-center text-sm">
            <span className="font-semibold text-right text-orange-600 dark:text-orange-400 text-xs">Move</span>
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="font-mono text-xs">{change.item.name}</span>
            </div>
            <ArrowRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
              )}
              <span className="font-mono text-xs opacity-40">{otherDirectory}/</span>
              <span className="font-mono text-xs font-semibold">{change.newName}</span>
            </div>
          </div>
        )
      case 'move-to':
        if (change.type !== 'rename') return null
        return (
          <div className="grid grid-cols-[70px_1fr_auto_1fr] gap-2 items-center text-sm">
            <span className="font-semibold text-right text-cyan-600 dark:text-cyan-400 text-xs">Move</span>
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
              )}
              <span className="font-mono text-xs opacity-40">{otherDirectory}/</span>
              <span className="font-mono text-xs">{change.item.name}</span>
            </div>
            <ArrowRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              {change.item.type === 'file' ? (
                <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="font-mono text-xs font-semibold">{change.newName}</span>
            </div>
          </div>
        )
      case 'multi-dest':
        if (change.type !== 'copy' && change.type !== 'rename') return null
        // Determine the operation label based on whether there's a rename (which removes original)
        const hasRename = dirChange.changes?.some(c => c.type === 'rename')
        const operationLabel = hasRename ? 'Rename' : 'Copy'
        const operationColor = hasRename ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'

        return (
          <div className="flex flex-col gap-0.5">
            <div className="grid grid-cols-[70px_1fr_auto_1fr] gap-2 items-start text-sm">
              <div className="flex items-center gap-1 justify-end pt-0.5 h-full">
                <span className={`font-semibold text-right ${operationColor} text-xs`}>{operationLabel}</span>
                {hasRename && (
                  <span className="text-xs text-red-500" title="Original will be removed">
                    ×
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 pt-0.5 h-full">
                {change.item.type === 'file' ? (
                  <FileIcon className="h-3.5 w-3.5 flex-shrink-0" />
                ) : (
                  <FolderIcon className="h-3.5 w-3.5 flex-shrink-0" />
                )}
                <span className="font-mono text-xs">{change.item.name}</span>
              </div>
              <ArrowRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                {dirChange.destinations?.map((dest, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    {change.item.type === 'file' ? (
                      <FileIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
                    ) : (
                      <FolderIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
                    )}
                    <span className="font-mono text-xs opacity-40">{dest.directory}/</span>
                    <span className="font-mono text-xs font-semibold">{dest.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      default:
        Typescript.assertUnreachable(displayType)
    }
  }

  const buttonRef = useRef<HTMLButtonElement>(null)

  if (!dialogOpen) return null

  return (
    <Dialog
      title={
        <div className="flex items-center justify-between w-full">
          <span>VIM Changes ({changes.length})</span>
          <Button onClick={toggleAll} className="btn-sm btn-ghost">
            {selectedIds.size === changesWithIds.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} className="btn-ghost">
            Cancel
          </Button>
          <Button ref={buttonRef} onClick={handleApply}>
            Apply {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
        </>
      }
    >
      <div className="overflow-y-auto max-h-[60vh]">
        {/* Duplicate destinations warning */}
        {hasDuplicates && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <div className="flex items-start gap-3">
              <AlertTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">
                  Duplicate Destinations Detected
                </h4>
                <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                  Multiple changes are targeting the same destination path. Please deselect conflicting changes:
                </p>
                <ul className="space-y-2">
                  {duplicateDestinations.map((dup, idx) => (
                    <li key={idx} className="text-sm">
                      <div className="font-mono text-red-800 dark:text-red-300 font-semibold mb-1">
                        {dup.path}
                      </div>
                      <div className="text-red-600 dark:text-red-400 pl-4">
                        Targeted by {dup.changes.length} changes
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
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

                // For multi-dest, check if all changes in the group are selected
                const isSelected =
                  dirChange.displayType === 'multi-dest'
                    ? (dirChange.changes?.every(c => selectedIds.has(c.id)) ?? false)
                    : selectedIds.has(dirChange.change.id)

                const handleToggle = () => {
                  if (dirChange.displayType === 'multi-dest' && dirChange.changes) {
                    // Toggle all changes in the multi-dest group
                    const allSelected = dirChange.changes.every(c => selectedIds.has(c.id))
                    setSelectedIds(prev => {
                      const next = new Set(prev)
                      for (const c of dirChange.changes!) {
                        if (allSelected) {
                          next.delete(c.id)
                        } else {
                          next.add(c.id)
                        }
                      }
                      return next
                    })
                  } else {
                    toggleChange(dirChange.change.id)
                  }
                }

                return (
                  <label
                    key={`${dirChange.change.id}-${dirChange.displayType}`}
                    className={`flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      idx !== group.changes.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={handleToggle}
                      className="checkbox checkbox-sm cursor-pointer"
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
