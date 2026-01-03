import { describe, it, expect } from 'vitest'
import { VimEngine } from './VimEngine.js'
import { GetFilesAndFoldersInDirectoryItem } from './Contracts.js'
import { HistoryStack } from './history-stack.js'

// Helper to create a file item
function createFileItem(name: string, fullPath?: string): GetFilesAndFoldersInDirectoryItem {
  return {
    type: 'file',
    name,
    fullPath: fullPath || `/test/${name}`,
    ext: name.includes('.') ? `.${name.split('.').pop()}` : '',
    size: 1024,
    sizeStr: '1KB',
    category: 'other',
    modifiedAt: '2024-01-01',
    modifiedTimestamp: Date.now(),
  }
}

// Helper to create a directory item
function createDirItem(name: string, fullPath?: string): GetFilesAndFoldersInDirectoryItem {
  return {
    type: 'dir',
    name,
    fullPath: fullPath || `/test/${name}`,
    ext: '',
    size: 4096,
    sizeStr: '4KB',
    category: 'folder',
    modifiedAt: '2024-01-01',
    modifiedTimestamp: Date.now(),
  }
}

// Helper to create a RealBufferItem
function createRealBufferItem(name: string, fullPath?: string): VimEngine.RealBufferItem {
  const item = createFileItem(name, fullPath)
  return {
    type: 'real',
    item,
    str: name,
  }
}

// Helper to create a default buffer
function createBuffer(
  fullPath: string,
  items: VimEngine.RealBufferItem[]
): VimEngine.Buffer {
  return {
    fullPath,
    items: [...items],
    originalItems: [...items],
    historyStack: new HistoryStack<VimEngine.HistoryItem>([]),
    cursor: { line: 0, column: 0 },
  }
}

describe('VimEngine.aggregateChanges', () => {
  it('should return empty changes for empty state', () => {
    const state: VimEngine.State = VimEngine.defaultState()
    const result = VimEngine.aggregateChanges(state)
    
    expect(result.changes).toEqual([])
  })

  it('should return empty changes when buffer has no modifications', () => {
    const originalItems = [
      createRealBufferItem('file1.txt'),
      createRealBufferItem('file2.txt'),
      createRealBufferItem('file3.txt'),
    ]

    const buffer = createBuffer('/test/dir1', originalItems)
    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test/dir1': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    expect(result.changes).toEqual([])
  })

  it('should detect single file addition', () => {
    const originalItems = [
      createRealBufferItem('file1.txt'),
      createRealBufferItem('file2.txt'),
    ]

    const buffer = createBuffer('/test/dir1', originalItems)
    // Add a new string item
    buffer.items = [
      ...originalItems,
      VimEngine.createStrBufferItem('newfile.txt'),
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test/dir1': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    expect(result.changes).toEqual([
      {
        type: 'add',
        directory: '/test/dir1',
        name: 'newfile.txt',
      },
    ])
  })

  it('should detect single file removal', () => {
    const originalItems = [
      createRealBufferItem('file1.txt'),
      createRealBufferItem('file2.txt'),
      createRealBufferItem('file3.txt'),
    ]

    const buffer = createBuffer('/test/dir1', originalItems)
    // Remove the second file
    buffer.items = [originalItems[0], originalItems[2]]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test/dir1': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    expect(result.changes).toEqual([
      {
        type: 'remove',
        directory: '/test/dir1',
        item: originalItems[1].item,
      },
    ])
  })

  it('should detect single file rename', () => {
    const originalItems = [
      createRealBufferItem('oldname.txt'),
      createRealBufferItem('file2.txt'),
    ]

    const buffer = createBuffer('/test/dir1', originalItems)
    // Rename the first file
    buffer.items = [
      {
        type: 'real',
        item: originalItems[0].item,
        str: 'newname.txt', // Changed name
      },
      originalItems[1],
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test/dir1': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    expect(result.changes).toEqual([
      {
        type: 'rename',
        item: originalItems[0].item,
        newDirectory: '/test/dir1',
        newName: 'newname.txt',
      },
    ])
  })

  it('should detect multiple changes in single directory', () => {
    const originalItems = [
      createRealBufferItem('file1.txt'),
      createRealBufferItem('file2.txt'),
      createRealBufferItem('file3.txt'),
    ]

    const buffer = createBuffer('/test/dir1', originalItems)
    // Add, remove, and rename
    buffer.items = [
      {
        type: 'real',
        item: originalItems[0].item,
        str: 'renamed1.txt', // Rename file1
      },
      // file2.txt removed
      originalItems[2], // file3.txt unchanged
      VimEngine.createStrBufferItem('newfile.txt'), // Add new file
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test/dir1': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    // Should have 3 changes: remove, rename, add
    expect(result.changes).toHaveLength(3)
    
    const removeChange = result.changes.find(c => c.type === 'remove')
    expect(removeChange).toEqual({
      type: 'remove',
      directory: '/test/dir1',
      item: originalItems[1].item,
    })

    const renameChange = result.changes.find(c => c.type === 'rename')
    expect(renameChange).toEqual({
      type: 'rename',
      item: originalItems[0].item,
      newDirectory: '/test/dir1',
      newName: 'renamed1.txt',
    })

    const addChange = result.changes.find(c => c.type === 'add')
    expect(addChange).toEqual({
      type: 'add',
      directory: '/test/dir1',
      name: 'newfile.txt',
    })
  })

  it('should detect changes across multiple directories', () => {
    const dir1Items = [
      createRealBufferItem('file1.txt', '/dir1/file1.txt'),
      createRealBufferItem('file2.txt', '/dir1/file2.txt'),
    ]

    const dir2Items = [
      createRealBufferItem('fileA.txt', '/dir2/fileA.txt'),
      createRealBufferItem('fileB.txt', '/dir2/fileB.txt'),
    ]

    const buffer1 = createBuffer('/dir1', dir1Items)
    const buffer2 = createBuffer('/dir2', dir2Items)

    // In dir1: add a file
    buffer1.items = [
      ...dir1Items,
      VimEngine.createStrBufferItem('new1.txt'),
    ]

    // In dir2: remove a file and rename another
    buffer2.items = [
      {
        type: 'real',
        item: dir2Items[0].item,
        str: 'renamedA.txt',
      },
      // fileB.txt removed
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/dir1': buffer1,
        '/dir2': buffer2,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    expect(result.changes).toHaveLength(3)

    // Check dir1 addition
    const dir1Add = result.changes.find(c => c.type === 'add' && c.directory === '/dir1')
    expect(dir1Add).toEqual({
      type: 'add',
      directory: '/dir1',
      name: 'new1.txt',
    })

    // Check dir2 rename
    const dir2Rename = result.changes.find(c => c.type === 'rename')
    expect(dir2Rename).toEqual({
      type: 'rename',
      item: dir2Items[0].item,
      newDirectory: '/dir2',
      newName: 'renamedA.txt',
    })

    // Check dir2 removal
    const dir2Remove = result.changes.find(c => c.type === 'remove')
    expect(dir2Remove).toEqual({
      type: 'remove',
      directory: '/dir2',
      item: dir2Items[1].item,
    })
  })

  it('should ignore empty string items (whitespace only)', () => {
    const originalItems = [
      createRealBufferItem('file1.txt'),
    ]

    const buffer = createBuffer('/test/dir1', originalItems)
    // Add empty/whitespace items
    buffer.items = [
      ...originalItems,
      VimEngine.createStrBufferItem(''),
      VimEngine.createStrBufferItem('   '),
      VimEngine.createStrBufferItem('\t'),
      VimEngine.createStrBufferItem('validfile.txt'),
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test/dir1': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    // Should only detect the valid file addition, not the empty ones
    expect(result.changes).toEqual([
      {
        type: 'add',
        directory: '/test/dir1',
        name: 'validfile.txt',
      },
    ])
  })

  it('should handle complex scenario with multiple operations across directories', () => {
    // Directory 1: /projects
    const projectsItems = [
      createRealBufferItem('app.ts', '/projects/app.ts'),
      createRealBufferItem('config.json', '/projects/config.json'),
      createRealBufferItem('README.md', '/projects/README.md'),
    ]

    // Directory 2: /docs
    const docsItems = [
      createRealBufferItem('guide.md', '/docs/guide.md'),
      createRealBufferItem('api.md', '/docs/api.md'),
    ]

    // Directory 3: /assets
    const assetsItems = [
      createRealBufferItem('logo.png', '/assets/logo.png'),
    ]

    const buffer1 = createBuffer('/projects', projectsItems)
    const buffer2 = createBuffer('/docs', docsItems)
    const buffer3 = createBuffer('/assets', assetsItems)

    // /projects operations:
    // - Rename app.ts -> main.ts
    // - Remove config.json
    // - Keep README.md
    // - Add package.json
    buffer1.items = [
      {
        type: 'real',
        item: projectsItems[0].item,
        str: 'main.ts',
      },
      projectsItems[2],
      VimEngine.createStrBufferItem('package.json'),
    ]

    // /docs operations:
    // - Rename guide.md -> tutorial.md
    // - Keep api.md
    // - Add changelog.md
    buffer2.items = [
      {
        type: 'real',
        item: docsItems[0].item,
        str: 'tutorial.md',
      },
      docsItems[1],
      VimEngine.createStrBufferItem('changelog.md'),
    ]

    // /assets operations:
    // - Remove logo.png
    // - Add icon.svg
    // - Add banner.jpg
    buffer3.items = [
      VimEngine.createStrBufferItem('icon.svg'),
      VimEngine.createStrBufferItem('banner.jpg'),
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/projects': buffer1,
        '/docs': buffer2,
        '/assets': buffer3,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    // Should have 8 changes total:
    // /projects: 1 rename, 1 remove, 1 add = 3
    // /docs: 1 rename, 1 add = 2
    // /assets: 1 remove, 2 adds = 3
    expect(result.changes).toHaveLength(8)

    // Verify /projects changes
    expect(result.changes).toContainEqual({
      type: 'rename',
      item: projectsItems[0].item,
      newDirectory: '/projects',
      newName: 'main.ts',
    })
    expect(result.changes).toContainEqual({
      type: 'remove',
      directory: '/projects',
      item: projectsItems[1].item,
    })
    expect(result.changes).toContainEqual({
      type: 'add',
      directory: '/projects',
      name: 'package.json',
    })

    // Verify /docs changes
    expect(result.changes).toContainEqual({
      type: 'rename',
      item: docsItems[0].item,
      newDirectory: '/docs',
      newName: 'tutorial.md',
    })
    expect(result.changes).toContainEqual({
      type: 'add',
      directory: '/docs',
      name: 'changelog.md',
    })

    // Verify /assets changes
    expect(result.changes).toContainEqual({
      type: 'remove',
      directory: '/assets',
      item: assetsItems[0].item,
    })
    expect(result.changes).toContainEqual({
      type: 'add',
      directory: '/assets',
      name: 'icon.svg',
    })
    expect(result.changes).toContainEqual({
      type: 'add',
      directory: '/assets',
      name: 'banner.jpg',
    })
  })

  it('should handle directory items (folders) correctly', () => {
    const originalItems = [
      {
        type: 'real' as const,
        item: createDirItem('folder1'),
        str: 'folder1',
      },
      {
        type: 'real' as const,
        item: createDirItem('folder2'),
        str: 'folder2',
      },
    ]

    const buffer = createBuffer('/test', originalItems)
    
    // Rename folder1 to renamed-folder
    // Remove folder2
    // Add folder3
    buffer.items = [
      {
        type: 'real',
        item: originalItems[0].item,
        str: 'renamed-folder',
      },
      VimEngine.createStrBufferItem('folder3'),
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    expect(result.changes).toHaveLength(3)
    expect(result.changes).toContainEqual({
      type: 'rename',
      item: originalItems[0].item,
      newDirectory: '/test',
      newName: 'renamed-folder',
    })
    expect(result.changes).toContainEqual({
      type: 'remove',
      directory: '/test',
      item: originalItems[1].item,
    })
    expect(result.changes).toContainEqual({
      type: 'add',
      directory: '/test',
      name: 'folder3',
    })
  })

  it('should handle items without fullPath using name as identifier', () => {
    // Some items might not have fullPath set
    const fileItem = createFileItem('test.txt')
    delete fileItem.fullPath

    const originalItems = [
      {
        type: 'real' as const,
        item: fileItem,
        str: 'test.txt',
      },
    ]

    const buffer = createBuffer('/test', originalItems)
    
    // Rename the file
    buffer.items = [
      {
        type: 'real',
        item: fileItem,
        str: 'renamed.txt',
      },
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    expect(result.changes).toEqual([
      {
        type: 'rename',
        item: fileItem,
        newDirectory: '/test',
        newName: 'renamed.txt',
      },
    ])
  })

  it('should handle all files removed from directory', () => {
    const originalItems = [
      createRealBufferItem('file1.txt'),
      createRealBufferItem('file2.txt'),
      createRealBufferItem('file3.txt'),
    ]

    const buffer = createBuffer('/test/dir1', originalItems)
    // Remove all files
    buffer.items = []

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test/dir1': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    expect(result.changes).toHaveLength(3)
    expect(result.changes).toEqual(
      expect.arrayContaining([
        {
          type: 'remove',
          directory: '/test/dir1',
          item: originalItems[0].item,
        },
        {
          type: 'remove',
          directory: '/test/dir1',
          item: originalItems[1].item,
        },
        {
          type: 'remove',
          directory: '/test/dir1',
          item: originalItems[2].item,
        },
      ])
    )
  })

  it('should handle all new files (starting from empty directory)', () => {
    const buffer = createBuffer('/test/newdir', [])

    buffer.items = [
      VimEngine.createStrBufferItem('file1.txt'),
      VimEngine.createStrBufferItem('file2.txt'),
      VimEngine.createStrBufferItem('file3.txt'),
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test/newdir': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    expect(result.changes).toHaveLength(3)
    expect(result.changes).toEqual(
      expect.arrayContaining([
        {
          type: 'add',
          directory: '/test/newdir',
          name: 'file1.txt',
        },
        {
          type: 'add',
          directory: '/test/newdir',
          name: 'file2.txt',
        },
        {
          type: 'add',
          directory: '/test/newdir',
          name: 'file3.txt',
        },
      ])
    )
  })

  it('should NOT detect changes when only order is changed', () => {
    const originalItems = [
      createRealBufferItem('alpha.txt'),
      createRealBufferItem('beta.txt'),
      createRealBufferItem('gamma.txt'),
      createRealBufferItem('delta.txt'),
    ]

    const buffer = createBuffer('/test/dir1', originalItems)
    
    // Reorder items: same files, different order
    buffer.items = [
      originalItems[2], // gamma.txt
      originalItems[0], // alpha.txt
      originalItems[3], // delta.txt
      originalItems[1], // beta.txt
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test/dir1': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    // Order changes should not trigger any changes
    expect(result.changes).toEqual([])
  })

  it('should correctly detect changes when items are reordered AND modified', () => {
    const originalItems = [
      createRealBufferItem('file1.txt'),
      createRealBufferItem('file2.txt'),
      createRealBufferItem('file3.txt'),
      createRealBufferItem('file4.txt'),
    ]

    const buffer = createBuffer('/test/dir1', originalItems)
    
    // Reorder + rename one file + remove one + add one
    buffer.items = [
      originalItems[3], // file4.txt - moved but not changed
      {
        type: 'real',
        item: originalItems[1].item,
        str: 'renamed2.txt', // file2.txt renamed
      },
      VimEngine.createStrBufferItem('newfile.txt'), // new file added
      originalItems[0], // file1.txt - moved but not changed
      // file3.txt removed
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test/dir1': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    // Should detect: 1 rename, 1 remove, 1 add (order changes ignored)
    expect(result.changes).toHaveLength(3)
    
    expect(result.changes).toContainEqual({
      type: 'rename',
      item: originalItems[1].item,
      newDirectory: '/test/dir1',
      newName: 'renamed2.txt',
    })
    
    expect(result.changes).toContainEqual({
      type: 'remove',
      directory: '/test/dir1',
      item: originalItems[2].item,
    })
    
    expect(result.changes).toContainEqual({
      type: 'add',
      directory: '/test/dir1',
      name: 'newfile.txt',
    })
  })

  it('should handle reordering in multiple directories without false positives', () => {
    const dir1Items = [
      createRealBufferItem('a.txt', '/dir1/a.txt'),
      createRealBufferItem('b.txt', '/dir1/b.txt'),
      createRealBufferItem('c.txt', '/dir1/c.txt'),
    ]

    const dir2Items = [
      createRealBufferItem('x.txt', '/dir2/x.txt'),
      createRealBufferItem('y.txt', '/dir2/y.txt'),
      createRealBufferItem('z.txt', '/dir2/z.txt'),
    ]

    const buffer1 = createBuffer('/dir1', dir1Items)
    const buffer2 = createBuffer('/dir2', dir2Items)

    // Reorder both directories
    buffer1.items = [
      dir1Items[2], // c.txt
      dir1Items[0], // a.txt
      dir1Items[1], // b.txt
    ]

    buffer2.items = [
      dir2Items[1], // y.txt
      dir2Items[2], // z.txt
      dir2Items[0], // x.txt
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/dir1': buffer1,
        '/dir2': buffer2,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    // No changes should be detected - only order changed
    expect(result.changes).toEqual([])
  })

  it('should handle reverse order', () => {
    const originalItems = [
      createRealBufferItem('file1.txt'),
      createRealBufferItem('file2.txt'),
      createRealBufferItem('file3.txt'),
      createRealBufferItem('file4.txt'),
      createRealBufferItem('file5.txt'),
    ]

    const buffer = createBuffer('/test/dir1', originalItems)
    
    // Completely reverse the order
    buffer.items = [...originalItems].reverse()

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test/dir1': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    // Reversing order should not trigger any changes
    expect(result.changes).toEqual([])
  })

  it('should handle random shuffle without changes', () => {
    const originalItems = [
      createRealBufferItem('file1.txt'),
      createRealBufferItem('file2.txt'),
      createRealBufferItem('file3.txt'),
      createRealBufferItem('file4.txt'),
      createRealBufferItem('file5.txt'),
      createRealBufferItem('file6.txt'),
    ]

    const buffer = createBuffer('/test/dir1', originalItems)
    
    // Random shuffle: [3, 0, 5, 1, 4, 2]
    buffer.items = [
      originalItems[3],
      originalItems[0],
      originalItems[5],
      originalItems[1],
      originalItems[4],
      originalItems[2],
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/test/dir1': buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    // Random shuffle should not trigger any changes
    expect(result.changes).toEqual([])
  })

  it('should detect cross-directory move (dd from one dir, paste to another) as rename', () => {
    // Directory 1: /source with file1.txt and file2.txt
    const sourceItems = [
      createRealBufferItem('file1.txt', '/source/file1.txt'),
      createRealBufferItem('file2.txt', '/source/file2.txt'),
    ]

    // Directory 2: /target with fileA.txt
    const targetItems = [
      createRealBufferItem('fileA.txt', '/target/fileA.txt'),
    ]

    const sourceBuffer = createBuffer('/source', sourceItems)
    const targetBuffer = createBuffer('/target', targetItems)

    // Simulate dd on file1.txt from /source (removes it from source buffer)
    sourceBuffer.items = [sourceItems[1]] // Only file2.txt remains

    // Simulate paste into /target (adds file1.txt to target buffer)
    targetBuffer.items = [
      targetItems[0], // fileA.txt
      sourceItems[0], // file1.txt moved here
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/source': sourceBuffer,
        '/target': targetBuffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    // Should detect as a single rename/move operation, not remove + add
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toEqual({
      type: 'rename',
      item: sourceItems[0].item,
      newDirectory: '/target',
      newName: 'file1.txt',
    })
  })

  it('should detect cross-directory move with name change as rename', () => {
    const sourceItems = [
      createRealBufferItem('oldname.txt', '/dir1/oldname.txt'),
    ]

    const targetItems = [
      createRealBufferItem('existing.txt', '/dir2/existing.txt'),
    ]

    const sourceBuffer = createBuffer('/dir1', sourceItems)
    const targetBuffer = createBuffer('/dir2', targetItems)

    // Remove from source
    sourceBuffer.items = []

    // Add to target with new name
    targetBuffer.items = [
      targetItems[0],
      {
        type: 'real',
        item: sourceItems[0].item,
        str: 'newname.txt', // Renamed during move
      },
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/dir1': sourceBuffer,
        '/dir2': targetBuffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toEqual({
      type: 'rename',
      item: sourceItems[0].item,
      newDirectory: '/dir2',
      newName: 'newname.txt',
    })
  })

  it('should handle multiple cross-directory moves', () => {
    const dir1Items = [
      createRealBufferItem('file1.txt', '/dir1/file1.txt'),
      createRealBufferItem('file2.txt', '/dir1/file2.txt'),
    ]

    const dir2Items = [
      createRealBufferItem('fileA.txt', '/dir2/fileA.txt'),
      createRealBufferItem('fileB.txt', '/dir2/fileB.txt'),
    ]

    const buffer1 = createBuffer('/dir1', dir1Items)
    const buffer2 = createBuffer('/dir2', dir2Items)

    // Move file1.txt from dir1 to dir2
    buffer1.items = [dir1Items[1]] // Only file2.txt remains
    buffer2.items = [
      dir2Items[0],
      dir2Items[1],
      dir1Items[0], // file1.txt moved here
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/dir1': buffer1,
        '/dir2': buffer2,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toEqual({
      type: 'rename',
      item: dir1Items[0].item,
      newDirectory: '/dir2',
      newName: 'file1.txt',
    })
  })

  it('should detect dd + single paste as rename only (not copy)', () => {
    // Scenario: dd file from /source, paste once into /target
    const sourceItems = [
      createRealBufferItem('file.txt', '/source/file.txt'),
      createRealBufferItem('other.txt', '/source/other.txt'),
    ]

    const targetItems = [
      createRealBufferItem('existing.txt', '/target/existing.txt'),
    ]

    const sourceBuffer = createBuffer('/source', sourceItems)
    const targetBuffer = createBuffer('/target', targetItems)

    // Remove from source (dd)
    sourceBuffer.items = [sourceItems[1]] // only other.txt remains

    // Paste into target
    targetBuffer.items = [
      targetItems[0],
      sourceItems[0], // file.txt pasted here
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/source': sourceBuffer,
        '/target': targetBuffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    // Should be just a rename (move), not a copy
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toEqual({
      type: 'rename',
      item: sourceItems[0].item,
      newDirectory: '/target',
      newName: 'file.txt',
    })
  })

  it('should detect dd + multiple pastes as n-1 copies + 1 rename', () => {
    // Scenario: dd file from /source, paste into /target1, /target2, and /target3
    // Should generate: 2 copies + 1 rename (last paste is the rename)
    const sourceItems = [
      createRealBufferItem('file.txt', '/source/file.txt'),
      createRealBufferItem('other.txt', '/source/other.txt'),
    ]

    const target1Items = [
      createRealBufferItem('existing1.txt', '/target1/existing1.txt'),
    ]

    const target2Items = [
      createRealBufferItem('existing2.txt', '/target2/existing2.txt'),
    ]

    const target3Items = [
      createRealBufferItem('existing3.txt', '/target3/existing3.txt'),
    ]

    const sourceBuffer = createBuffer('/source', sourceItems)
    const target1Buffer = createBuffer('/target1', target1Items)
    const target2Buffer = createBuffer('/target2', target2Items)
    const target3Buffer = createBuffer('/target3', target3Items)

    // Remove from source (dd)
    sourceBuffer.items = [sourceItems[1]] // only other.txt remains

    // Paste into all three targets
    target1Buffer.items = [
      target1Items[0],
      sourceItems[0], // first paste
    ]

    target2Buffer.items = [
      target2Items[0],
      sourceItems[0], // second paste
    ]

    target3Buffer.items = [
      target3Items[0],
      sourceItems[0], // third paste (last one - this becomes the rename)
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/source': sourceBuffer,
        '/target1': target1Buffer,
        '/target2': target2Buffer,
        '/target3': target3Buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    // Should have 3 changes: 2 copies + 1 rename
    expect(result.changes).toHaveLength(3)
    
    const copyChanges = result.changes.filter(c => c.type === 'copy')
    const renameChanges = result.changes.filter(c => c.type === 'rename')
    
    expect(copyChanges).toHaveLength(2)
    expect(renameChanges).toHaveLength(1)
    
    // First two should be copies
    expect(copyChanges[0]).toEqual({
      type: 'copy',
      item: sourceItems[0].item,
      newDirectory: '/target1',
      newName: 'file.txt',
    })
    
    expect(copyChanges[1]).toEqual({
      type: 'copy',
      item: sourceItems[0].item,
      newDirectory: '/target2',
      newName: 'file.txt',
    })
    
    // Last one should be the rename
    expect(renameChanges[0]).toEqual({
      type: 'rename',
      item: sourceItems[0].item,
      newDirectory: '/target3',
      newName: 'file.txt',
    })
  })

  it('should handle dd + multiple pastes with different names', () => {
    // Scenario: dd file, paste multiple times with different names
    const sourceItems = [
      createRealBufferItem('original.txt', '/source/original.txt'),
    ]

    const target1Items: VimEngine.RealBufferItem[] = []
    const target2Items: VimEngine.RealBufferItem[] = []
    const target3Items: VimEngine.RealBufferItem[] = []

    const sourceBuffer = createBuffer('/source', sourceItems)
    const target1Buffer = createBuffer('/target1', target1Items)
    const target2Buffer = createBuffer('/target2', target2Items)
    const target3Buffer = createBuffer('/target3', target3Items)

    // Remove from source (dd)
    sourceBuffer.items = []

    // Paste into targets with different names
    target1Buffer.items = [
      {
        type: 'real',
        item: sourceItems[0].item,
        str: 'copy1.txt', // renamed
      },
    ]

    target2Buffer.items = [
      {
        type: 'real',
        item: sourceItems[0].item,
        str: 'copy2.txt', // renamed
      },
    ]

    target3Buffer.items = [
      {
        type: 'real',
        item: sourceItems[0].item,
        str: 'final.txt', // renamed (this is the final rename)
      },
    ]

    const state: VimEngine.State = {
      ...VimEngine.defaultState(),
      buffers: {
        '/source': sourceBuffer,
        '/target1': target1Buffer,
        '/target2': target2Buffer,
        '/target3': target3Buffer,
      },
    }

    const result = VimEngine.aggregateChanges(state)
    
    // Should have 3 changes: 2 copies + 1 rename
    expect(result.changes).toHaveLength(3)
    
    const copyChanges = result.changes.filter(c => c.type === 'copy')
    const renameChanges = result.changes.filter(c => c.type === 'rename')
    
    expect(copyChanges).toHaveLength(2)
    expect(renameChanges).toHaveLength(1)
    
    // Verify the copies
    expect(copyChanges).toContainEqual({
      type: 'copy',
      item: sourceItems[0].item,
      newDirectory: '/target1',
      newName: 'copy1.txt',
    })
    
    expect(copyChanges).toContainEqual({
      type: 'copy',
      item: sourceItems[0].item,
      newDirectory: '/target2',
      newName: 'copy2.txt',
    })
    
    // Verify the final rename
    expect(renameChanges[0]).toEqual({
      type: 'rename',
      item: sourceItems[0].item,
      newDirectory: '/target3',
      newName: 'final.txt',
    })
  })
})
