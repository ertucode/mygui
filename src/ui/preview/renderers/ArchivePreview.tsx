import { useEffect, useState } from 'react'
import { FileArchiveIcon } from 'lucide-react'
import { getWindowElectron } from '@/getWindowElectron'
import { ArchiveEntry } from '@common/Contracts'
import { ArchiveTypes } from '@common/ArchiveTypes'
import { PreviewHelpers } from '../PreviewHelpers'
import { errorResponseToMessage } from '@common/GenericError'

export function ArchivePreview({
  data: {
    preview: { filePath, fileExt },
  },
  error,
  setError,
  loading,
  setLoading,
}: PreviewHelpers.PreviewRendererProps) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([])

  useEffect(() => {
    if (!fileExt) {
      setError('Unknown archive type')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    getWindowElectron()
      .readArchiveContents(filePath, fileExt as ArchiveTypes.ArchiveType)
      .then(result => {
        if ('error' in result) {
          setError(errorResponseToMessage(result.error))
          setEntries([])
        } else {
          setEntries(result.data)
          setError(null)
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to read archive file')
        setEntries([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [filePath, fileExt])

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

  const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0)
  const totalCompressed = entries.reduce((sum, entry) => sum + (entry.compressedSize ?? 0), 0)
  const compressionRatio = totalSize > 0 ? ((1 - totalCompressed / totalSize) * 100).toFixed(1) : '0'
  const fileSizeMB = (totalSize / 1024 / 1024).toFixed(2)

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center justify-between mb-2 bg-base-200 rounded-t-none rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <FileArchiveIcon className="size-4" />
          <span className="text-sm font-medium">
            {entries.length} {entries.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex gap-3 text-xs">
          <span>{fileSizeMB} MB</span>
          <span>{compressionRatio}% saved</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto bg-base-200 rounded-xl">
        <table className="table table-xs table-pin-rows">
          <thead>
            <tr className="bg-base-300">
              <th className="w-full">Name</th>
              <th className="text-right whitespace-nowrap">Size</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                <td className="font-mono text-[10px] break-all">
                  {entry.isDirectory ? <span className="text-blue-500">{entry.name}</span> : entry.name}
                </td>
                <td className="text-right text-[10px] whitespace-nowrap">
                  {entry.isDirectory
                    ? '-'
                    : entry.size >= 1024
                      ? `${(entry.size / 1024).toFixed(1)} KB`
                      : `${entry.size} B`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
