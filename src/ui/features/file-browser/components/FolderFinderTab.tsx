import { useState, useEffect, useRef } from 'react'
import { useSelector } from '@xstate/store/react'
import { getWindowElectron } from '@/getWindowElectron'
import { FolderIcon, XIcon, FileIcon } from 'lucide-react'
import { errorResponseToMessage } from '@common/GenericError'
import { GetFilesAndFoldersInDirectoryItem } from '@common/Contracts'
import { directoryStore, directoryHelpers, selectDirectory } from '../directoryStore/directory'
import { useDebounce } from '@/lib/hooks/useDebounce'

type FolderFinderTabProps = {
  isOpen: boolean
  onClose: () => void
  showPreview: boolean
}

export function FolderFinderTab({ isOpen, onClose, showPreview }: FolderFinderTabProps) {
  const activeDirectoryId = useSelector(directoryStore, s => s.context.activeDirectoryId)
  const directory = useSelector(directoryStore, selectDirectory(activeDirectoryId))
  const [query, setQuery] = useState('')
  const [filteredFolders, setFilteredFolders] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [_isLoading, setIsLoading] = useState(false)
  const isLoading = useDebounce(_isLoading, 100)
  const [error, setError] = useState<string | null>(null)
  const [folderContents, setFolderContents] = useState<GetFilesAndFoldersInDirectoryItem[]>([])
  const [isLoadingContents, setIsLoadingContents] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load folders when dialog opens or query changes
  useEffect(() => {
    if (!isOpen) return

    const searchFolders = async () => {
      setIsLoading(true)
      setError(null)
      try {
        if (directory.type !== 'path') return
        const result = await getWindowElectron().fuzzyFolderFinder(directory.fullPath, query)
        if (result.success) {
          setFilteredFolders(result.data)
          setSelectedIndex(0)
        } else {
          setError(errorResponseToMessage(result.error) || 'Failed to load folders')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load folders')
      } finally {
        setIsLoading(false)
      }
    }

    searchFolders()
  }, [isOpen, directory, query])

  // Load folder contents when selection changes
  useEffect(() => {
    if (!isOpen || !showPreview) return

    const selectedFolder = filteredFolders[selectedIndex]
    if (!selectedFolder) {
      setFolderContents([])
      return
    }

    const loadContents = async () => {
      setIsLoadingContents(true)
      try {
        const fullPath = directoryHelpers.getFullPath(selectedFolder, activeDirectoryId)
        const result = await getWindowElectron().getFilesAndFoldersInDirectory(fullPath)
        if (result.success) {
          setFolderContents(result.data)
        } else {
          console.error('Failed to load folder contents:', result.error)
          setFolderContents([])
        }
      } catch (err) {
        console.error('Failed to load folder contents:', err)
        setFolderContents([])
      } finally {
        setIsLoadingContents(false)
      }
    }

    loadContents()
  }, [isOpen, showPreview, filteredFolders, selectedIndex])

  // Reset and focus when dialog opens
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setError(null)
      setFolderContents([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleSelect = (folderPath: string) => {
    directoryHelpers.cdFull(directoryHelpers.getFullPath(folderPath, activeDirectoryId), activeDirectoryId)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'j' && e.ctrlKey)) {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredFolders.length - 1))
    } else if (e.key === 'ArrowUp' || (e.key === 'k' && e.ctrlKey)) {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredFolders[selectedIndex]) {
        handleSelect(filteredFolders[selectedIndex])
      }
    }
  }

  const getFolderNameAndParent = (folderPath: string) => {
    const lastSlashIndex = folderPath.lastIndexOf('/')
    if (lastSlashIndex === -1) {
      return { folderName: folderPath, parent: '' }
    }
    return {
      folderName: folderPath.slice(lastSlashIndex + 1),
      parent: folderPath.slice(0, lastSlashIndex),
    }
  }

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text

    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const index = lowerText.indexOf(lowerQuery)

    if (index === -1) return text

    return (
      <>
        {text.slice(0, index)}
        <span className="bg-yellow-300 text-black">{text.slice(index, index + query.length)}</span>
        {text.slice(index + query.length)}
      </>
    )
  }

  const selectedFolder = filteredFolders[selectedIndex]
  const selectedFolderName = selectedFolder ? getFolderNameAndParent(selectedFolder).folderName : null

  return (
    <div className="flex gap-3 h-full overflow-visible">
      <div className="flex flex-col gap-3 flex-1 min-w-0 h-full">
        {/* Input section */}
        <div className="relative flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type to search folders..."
            className="input input-bordered w-full text-sm focus:outline-offset-[-2px]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Folder list section */}
        <div className="flex-1 min-h-0 border border-gray-200 rounded overflow-hidden flex flex-col">
          {isLoading && <div className="text-center text-gray-500 py-4">Loading folders...</div>}

          {error && <div className="text-center text-red-500 py-4">Error: {error}</div>}

          {!isLoading && !error && (
            <div ref={listRef} className="overflow-y-auto flex-1">
              {filteredFolders.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {query ? 'No folders found' : 'No folders in directory'}
                </div>
              ) : (
                <div>
                  {filteredFolders.map((folder, index) => {
                    const { folderName, parent } = getFolderNameAndParent(folder)
                    return (
                      <div
                        key={folder}
                        data-index={index}
                        onClick={() => handleSelect(folder)}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-base-content/10 ${
                          index === selectedIndex ? 'bg-base-content/10' : ''
                        }`}
                      >
                        <FolderIcon className="w-4 h-4 text-yellow-500" />
                        <div className="flex gap-3 items-center min-w-0 flex-1">
                          <span className="text-xs truncate">{highlightMatch(folderName, query)}</span>
                          {parent && <span className="text-xs text-gray-500 truncate">{parent}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 justify-center flex-shrink-0">
          <div>
            <kbd className="kbd">Up/Down</kbd> or <kbd className="kbd">Ctrl+J/K</kbd> to navigate
          </div>
          <div>
            <kbd className="kbd">Enter</kbd> to open folder
          </div>
        </div>
      </div>

      {/* Preview Panel - shows files in selected folder */}
      <div className="w-[400px] h-full border-gray-200 flex flex-col flex-shrink-0">
        {showPreview && selectedFolder && (
          <>
            {/* Folder header */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 flex-shrink-0">
              <FolderIcon className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium truncate">{selectedFolderName}</span>
              <span className="text-xs text-gray-400">{folderContents.length} items</span>
            </div>

            {/* Folder contents */}
            <div className="flex-1 min-h-0 overflow-auto mt-2">
              {isLoadingContents ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <span className="loading loading-spinner size-4" />
                </div>
              ) : folderContents.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">Empty folder</div>
              ) : (
                <div className="space-y-0.5">
                  {folderContents.slice(0, 50).map(item => (
                    <div key={item.name} className="flex items-center gap-2 px-2 py-1 text-xs">
                      {item.type === 'dir' ? (
                        <FolderIcon className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                      ) : (
                        <FileIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="truncate flex-1">{item.name}</span>
                      {item.type === 'file' && item.sizeStr && (
                        <span className="text-gray-400 flex-shrink-0">{item.sizeStr}</span>
                      )}
                    </div>
                  ))}
                  {folderContents.length > 50 && (
                    <div className="text-xs text-gray-400 px-2 py-1">
                      ...and {folderContents.length - 50} more items
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
