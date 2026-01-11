import { useEffect, useState } from 'react'
import { PreviewHelpers } from '../PreviewHelpers'
import { FileBrowserCache } from '@/features/file-browser/FileBrowserCache'
import { GetFilesAndFoldersInDirectoryItem } from '@common/Contracts'
import { GenericResult, errorResponseToMessage } from '@common/GenericError'
import { FolderIcon, FileIcon } from 'lucide-react'

type FolderPreviewProps = {
  data: PreviewHelpers.DerivedData
}

export function FolderPreview({ data }: FolderPreviewProps) {
  const [items, setItems] = useState<GetFilesAndFoldersInDirectoryItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDirectory = async () => {
      setLoading(true)
      setError(null)

      try {
        const result: GenericResult<GetFilesAndFoldersInDirectoryItem[]> = await FileBrowserCache.load(data.fullPath)

        if (result.success) {
          setItems(result.data)
        } else {
          console.log(result.error)
          setError(errorResponseToMessage(result.error))
        }
      } catch (err) {
        console.log(err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    loadDirectory()
  }, [data.fullPath])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <span className="loading loading-spinner size-10" />
      </div>
    )
  }

  if (error) {
    return <div className="flex items-center justify-center h-full text-red-500 p-4">{error}</div>
  }

  if (!items || items.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500">Empty directory</div>
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div>
          {items.map(item => (
            <div
              key={item.name}
              className="flex items-center text-[0.6875rem] gap-1 px-1 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {item.type === 'dir' ? (
                <FolderIcon className="size-3 text-blue-500 flex-shrink-0" />
              ) : (
                <FileIcon className="size-3 text-gray-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
              </div>
              {item.sizeStr && <span className="text-gray-500 dark:text-gray-400">{item.sizeStr}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
