import { describe, it, expect } from 'vitest'
import { VimEngine } from '@common/VimEngine'

// Helper to create a file item
function createFileItem(name: string, fullPath: string): any {
  return {
    type: 'file',
    name,
    fullPath,
    ext: name.includes('.') ? `.${name.split('.').pop()}` : '',
    size: 1024,
    sizeStr: '1KB',
    category: 'other',
    modifiedAt: '2024-01-01',
    modifiedTimestamp: Date.now(),
  }
}

type ChangeWithId = VimEngine.Change & { id: string }

type DirectoryChange = {
  change: ChangeWithId
  changes?: ChangeWithId[] // Multiple changes grouped together (for multi-dest)
  displayType: 'add' | 'remove' | 'copy' | 'copy-from' | 'copy-to' | 'rename' | 'move-from' | 'move-to' | 'multi-dest'
  otherDirectory?: string // For cross-directory moves/copies
  destinations?: Array<{ directory: string; name: string }> // For multi-destination display
}

// Extract grouping logic into a testable function
function groupChangesByDirectory(changesWithIds: ChangeWithId[]) {
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
    }
  }

    // Second pass: group multiple copy/copy-from/rename/move-from with same source file into multi-dest
    for (const [directory, changes] of groupMap.entries()) {
      const sourceFileGroups = new Map<string, DirectoryChange[]>()
      
      for (const dirChange of changes) {
        // Group same-directory and cross-directory copies/renames
        if (dirChange.displayType === 'copy' || dirChange.displayType === 'copy-from' || 
            dirChange.displayType === 'rename' || dirChange.displayType === 'move-from') {
          const sourceFile = dirChange.change.type === 'copy' || dirChange.change.type === 'rename'
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
        if (dirChange.displayType !== 'copy' && dirChange.displayType !== 'copy-from' && 
            dirChange.displayType !== 'rename' && dirChange.displayType !== 'move-from') {
          singleChanges.push(dirChange)
          continue
        }

        const sourceFile = dirChange.change.type === 'copy' || dirChange.change.type === 'rename'
          ? dirChange.change.item.fullPath || dirChange.change.item.name
          : ''
        
        const group = sourceFileGroups.get(sourceFile)!
        if (group.length > 1) {
          // Check if we already created a multi-dest for this source file
          const alreadyGrouped = multiDestGroups.some(g => {
            return g.changes?.some(c => {
              const cSourceFile = c.type === 'copy' || c.type === 'rename'
                ? c.item.fullPath || c.item.name
                : ''
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
                const destDir = g.change.type === 'copy' || g.change.type === 'rename'
                  ? g.change.newDirectory
                  : ''
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
}

describe('VimChangesDialog grouping logic', () => {
  it('should group simple add in correct directory', () => {
    const changes: ChangeWithId[] = [
      {
        id: '1',
        type: 'add',
        directory: '/dir1',
        name: 'newfile.txt',
      },
    ]

    const result = groupChangesByDirectory(changes)

    expect(result).toHaveLength(1)
    expect(result[0].directory).toBe('/dir1')
    expect(result[0].changes).toHaveLength(1)
    expect(result[0].changes[0].displayType).toBe('add')
  })

  it('should group simple remove in correct directory', () => {
    const changes: ChangeWithId[] = [
      {
        id: '1',
        type: 'remove',
        directory: '/dir1',
        item: createFileItem('file.txt', '/dir1/file.txt'),
      },
    ]

    const result = groupChangesByDirectory(changes)

    expect(result).toHaveLength(1)
    expect(result[0].directory).toBe('/dir1')
    expect(result[0].changes).toHaveLength(1)
    expect(result[0].changes[0].displayType).toBe('remove')
  })

  it('should show same-directory copy as single entry', () => {
    const changes: ChangeWithId[] = [
      {
        id: '1',
        type: 'copy',
        item: createFileItem('file.txt', '/dir1/file.txt'),
        newDirectory: '/dir1',
        newName: 'file-copy.txt',
      },
    ]

    const result = groupChangesByDirectory(changes)

    expect(result).toHaveLength(1)
    expect(result[0].directory).toBe('/dir1')
    expect(result[0].changes).toHaveLength(1)
    expect(result[0].changes[0].displayType).toBe('copy')
  })

  it('should show cross-directory copy in both directories', () => {
    const changes: ChangeWithId[] = [
      {
        id: '1',
        type: 'copy',
        item: createFileItem('file.txt', '/source/file.txt'),
        newDirectory: '/target',
        newName: 'file.txt',
      },
    ]

    const result = groupChangesByDirectory(changes)

    expect(result).toHaveLength(2)
    
    const sourceDir = result.find(r => r.directory === '/source')
    expect(sourceDir).toBeDefined()
    expect(sourceDir!.changes).toHaveLength(1)
    expect(sourceDir!.changes[0].displayType).toBe('copy-from')
    expect(sourceDir!.changes[0].otherDirectory).toBe('/target')

    const targetDir = result.find(r => r.directory === '/target')
    expect(targetDir).toBeDefined()
    expect(targetDir!.changes).toHaveLength(1)
    expect(targetDir!.changes[0].displayType).toBe('copy-to')
    expect(targetDir!.changes[0].otherDirectory).toBe('/source')
  })

  it('should show same-directory rename as single entry', () => {
    const changes: ChangeWithId[] = [
      {
        id: '1',
        type: 'rename',
        item: createFileItem('oldname.txt', '/dir1/oldname.txt'),
        newDirectory: '/dir1',
        newName: 'newname.txt',
      },
    ]

    const result = groupChangesByDirectory(changes)

    expect(result).toHaveLength(1)
    expect(result[0].directory).toBe('/dir1')
    expect(result[0].changes).toHaveLength(1)
    expect(result[0].changes[0].displayType).toBe('rename')
  })

  it('should show cross-directory move in both directories', () => {
    const changes: ChangeWithId[] = [
      {
        id: '1',
        type: 'rename',
        item: createFileItem('file.txt', '/source/file.txt'),
        newDirectory: '/target',
        newName: 'file.txt',
      },
    ]

    const result = groupChangesByDirectory(changes)

    expect(result).toHaveLength(2)
    
    const sourceDir = result.find(r => r.directory === '/source')
    expect(sourceDir).toBeDefined()
    expect(sourceDir!.changes).toHaveLength(1)
    expect(sourceDir!.changes[0].displayType).toBe('move-from')
    expect(sourceDir!.changes[0].otherDirectory).toBe('/target')

    const targetDir = result.find(r => r.directory === '/target')
    expect(targetDir).toBeDefined()
    expect(targetDir!.changes).toHaveLength(1)
    expect(targetDir!.changes[0].displayType).toBe('move-to')
    expect(targetDir!.changes[0].otherDirectory).toBe('/source')
  })

  it('should handle multiple copies from same source (dd + 3 pastes) - now grouped', () => {
    const changes: ChangeWithId[] = [
      {
        id: '1',
        type: 'copy',
        item: createFileItem('file.txt', '/source/file.txt'),
        newDirectory: '/target1',
        newName: 'file.txt',
      },
      {
        id: '2',
        type: 'copy',
        item: createFileItem('file.txt', '/source/file.txt'),
        newDirectory: '/target2',
        newName: 'file.txt',
      },
      {
        id: '3',
        type: 'rename',
        item: createFileItem('file.txt', '/source/file.txt'),
        newDirectory: '/target3',
        newName: 'file.txt',
      },
    ]

    const result = groupChangesByDirectory(changes)

    // Should have 4 directories: source, target1, target2, target3
    expect(result).toHaveLength(4)
    
    // Source directory should show a single multi-dest entry (grouped)
    const sourceDir = result.find(r => r.directory === '/source')
    expect(sourceDir).toBeDefined()
    expect(sourceDir!.changes).toHaveLength(1)
    expect(sourceDir!.changes[0].displayType).toBe('multi-dest')
    expect(sourceDir!.changes[0].changes).toHaveLength(3)
    
    // Each target directory should show its respective operation
    const target1 = result.find(r => r.directory === '/target1')
    expect(target1).toBeDefined()
    expect(target1!.changes[0].displayType).toBe('copy-to')

    const target2 = result.find(r => r.directory === '/target2')
    expect(target2).toBeDefined()
    expect(target2!.changes[0].displayType).toBe('copy-to')

    const target3 = result.find(r => r.directory === '/target3')
    expect(target3).toBeDefined()
    expect(target3!.changes[0].displayType).toBe('move-to')
  })

  it('should handle multiple changes in multiple directories', () => {
    const changes: ChangeWithId[] = [
      {
        id: '1',
        type: 'add',
        directory: '/dir1',
        name: 'new1.txt',
      },
      {
        id: '2',
        type: 'remove',
        directory: '/dir1',
        item: createFileItem('old1.txt', '/dir1/old1.txt'),
      },
      {
        id: '3',
        type: 'copy',
        item: createFileItem('file.txt', '/dir2/file.txt'),
        newDirectory: '/dir3',
        newName: 'file.txt',
      },
    ]

    const result = groupChangesByDirectory(changes)

    expect(result).toHaveLength(3)
    
    const dir1 = result.find(r => r.directory === '/dir1')
    expect(dir1!.changes).toHaveLength(2)

    const dir2 = result.find(r => r.directory === '/dir2')
    expect(dir2!.changes).toHaveLength(1)
    expect(dir2!.changes[0].displayType).toBe('copy-from')

    const dir3 = result.find(r => r.directory === '/dir3')
    expect(dir3!.changes).toHaveLength(1)
    expect(dir3!.changes[0].displayType).toBe('copy-to')
  })

  it('should group multiple copies/moves from same source into multi-dest in source directory', () => {
    const changes: ChangeWithId[] = [
      {
        id: '1',
        type: 'copy',
        item: createFileItem('file.txt', '/source/file.txt'),
        newDirectory: '/target1',
        newName: 'file.txt',
      },
      {
        id: '2',
        type: 'copy',
        item: createFileItem('file.txt', '/source/file.txt'),
        newDirectory: '/target2',
        newName: 'file-renamed.txt',
      },
      {
        id: '3',
        type: 'rename',
        item: createFileItem('file.txt', '/source/file.txt'),
        newDirectory: '/target3',
        newName: 'final.txt',
      },
    ]

    const result = groupChangesByDirectory(changes)

    // Source directory should have a single multi-dest entry
    const sourceDir = result.find(r => r.directory === '/source')
    expect(sourceDir).toBeDefined()
    expect(sourceDir!.changes).toHaveLength(1)
    expect(sourceDir!.changes[0].displayType).toBe('multi-dest')
    expect(sourceDir!.changes[0].changes).toHaveLength(3)
    expect(sourceDir!.changes[0].destinations).toEqual([
      { directory: '/target1', name: 'file.txt' },
      { directory: '/target2', name: 'file-renamed.txt' },
      { directory: '/target3', name: 'final.txt' },
    ])

    // Each target directory should still show its respective operation
    const target1 = result.find(r => r.directory === '/target1')
    expect(target1).toBeDefined()
    expect(target1!.changes[0].displayType).toBe('copy-to')

    const target2 = result.find(r => r.directory === '/target2')
    expect(target2).toBeDefined()
    expect(target2!.changes[0].displayType).toBe('copy-to')

    const target3 = result.find(r => r.directory === '/target3')
    expect(target3).toBeDefined()
    expect(target3!.changes[0].displayType).toBe('move-to')
  })

  it('should handle dd + paste multiple times in SAME directory - group into multi-dest', () => {
    // dd file.txt, then paste it 3 times in the same directory with different names
    const changes: ChangeWithId[] = [
      {
        id: '1',
        type: 'copy',
        item: createFileItem('file.txt', '/dir1/file.txt'),
        newDirectory: '/dir1',
        newName: 'file-copy1.txt',
      },
      {
        id: '2',
        type: 'copy',
        item: createFileItem('file.txt', '/dir1/file.txt'),
        newDirectory: '/dir1',
        newName: 'file-copy2.txt',
      },
      {
        id: '3',
        type: 'rename',
        item: createFileItem('file.txt', '/dir1/file.txt'),
        newDirectory: '/dir1',
        newName: 'file-final.txt',
      },
    ]

    const result = groupChangesByDirectory(changes)

    // Should only have one directory
    expect(result).toHaveLength(1)
    expect(result[0].directory).toBe('/dir1')
    
    // Should group into a single multi-dest entry since same source file
    expect(result[0].changes).toHaveLength(1)
    expect(result[0].changes[0].displayType).toBe('multi-dest')
    expect(result[0].changes[0].changes).toHaveLength(3)
    expect(result[0].changes[0].destinations).toEqual([
      { directory: '/dir1', name: 'file-copy1.txt' },
      { directory: '/dir1', name: 'file-copy2.txt' },
      { directory: '/dir1', name: 'file-final.txt' },
    ])
  })
})
