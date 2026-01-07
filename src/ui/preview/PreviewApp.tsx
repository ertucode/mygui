import { useEffect, useState } from 'react'
import { fileSizeTooLarge } from '@common/file-size-too-large'
import { getCategoryFromExtension, isImageExtension, isVideoExtension } from '@common/file-category'
import { NO_PREVIEW_EXTENSIONS } from '@common/no-preview-extensions'
import { ArchiveTypes } from '@common/ArchiveTypes'
import { ImagePreview } from './renderers/ImagePreview'
import { PdfPreview } from './renderers/PdfPreview'
import { DocxPreview } from './renderers/DocxPreview'
import { XlsxPreview } from './renderers/XlsxPreview'
import { VideoPreview } from './renderers/VideoPreview'
import { VideoUnsupportedPreview } from './renderers/VideoUnsupportedPreview'
import { ArchivePreview } from './renderers/ArchivePreview'
import { AudioPreview } from './renderers/AudioPreview'
import { TextPreview } from './renderers/TextPreview'
import { FolderPreview } from './renderers/FolderPreview'
import { PathHelpers } from '@common/PathHelpers'
import { PreviewHelpers } from './PreviewHelpers'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { Button } from '@/lib/components/button'
import { EyeIcon } from 'lucide-react'

export function PreviewApp() {
  const [data, setData] = useState<PreviewHelpers.DerivedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [allowBigSize, setAllowBigSize] = useState(false)
  const [_loading, setLoading] = useState(false)
  const loading = useDebounce(_loading, 100)

  // Listen for messages from parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'preview-file') {
        const data = event.data.payload as PreviewHelpers.MessageData
        const contentType = getContentType(data)
        const fullPath = PathHelpers.expandHome(event.data.payload.homePath, data.filePath)

        setError(null)
        if (!data.isFile) {
          setData({
            preview: data,
            contentType: 'text',
            fullPath,
            shouldSkipPreview: false,
            isTooLarge: false,
            fileSizeLimit: Infinity,
          })
          return
        }

        const ext = data.fileExt || ''
        const shouldSkipPreview = NO_PREVIEW_EXTENSIONS.has(ext)
        const { isTooLarge, limit: fileSizeLimit } = data.fileSize
          ? fileSizeTooLarge(ext, data.fileSize)
          : { isTooLarge: false, limit: Infinity }
        setData({
          preview: data,
          contentType,
          fullPath,
          shouldSkipPreview,
          isTooLarge,
          fileSizeLimit,
        })
        setAllowBigSize(false)
      }

      if (event.data?.type === 'preview-anyway') {
        setAllowBigSize(true)
        setError(null)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  if (!data?.preview?.filePath) {
    return <div className="flex items-center justify-center h-full text-gray-500">No file selected</div>
  }

  if (data.shouldSkipPreview) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 p-4">
        Preview not available for this file type
      </div>
    )
  }

  if ((data.isTooLarge && !allowBigSize) || error === 'FILE_TOO_LARGE') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-4 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md text-gray-700 dark:text-gray-300">
        <div className="text-lg font-semibold">File too large for preview</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {((data.preview.fileSize ?? 0) / 1024 / 1024).toFixed(2)} MB / {data.fileSizeLimit} MB
        </div>
        <Button
          className="btn btn-sm mt-2 flex items-center gap-2"
          onClick={() => setAllowBigSize(true)}
          icon={EyeIcon}
        >
          Preview anyway
        </Button>
      </div>
    )
  }

  if (error) {
    return <div className="flex items-center justify-center h-full text-red-500 p-4">{error}</div>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <span className="loading loading-spinner size-10" />
      </div>
    )
  }

  const Renderer = getRenderer(data)

  return (
    <Renderer
      data={data}
      error={error}
      setError={setError}
      loading={loading}
      setLoading={setLoading}
      allowBigSize={allowBigSize}
    />
  )
}

function getRenderer(data: PreviewHelpers.DerivedData) {
  if (!data.preview?.isFile) return FolderPreview
  if (data.contentType === 'image') return ImagePreview
  if (data.contentType === 'pdf') return PdfPreview
  if (data.contentType === 'docx') return DocxPreview
  if (data.contentType === 'xlsx') return XlsxPreview
  if (data.contentType === 'video') return VideoPreview
  if (data.contentType === 'video-unsupported') return VideoUnsupportedPreview
  if (data.contentType === 'archive') return ArchivePreview
  if (data.contentType === 'audio') return AudioPreview
  return TextPreview
}

function getContentType(previewData: $Maybe<PreviewHelpers.MessageData>): PreviewHelpers.ContentType {
  if (!previewData?.filePath) {
    return 'text'
  }

  if (!previewData.fileExt) return 'text'

  const ext = PathHelpers.ensureDot(previewData.fileExt)

  if (isImageExtension(ext)) return 'image'
  if (PreviewHelpers.PDF_EXTENSIONS.has(ext)) return 'pdf'
  if (PreviewHelpers.DOCX_EXTENSIONS.has(ext)) return 'docx'
  if (PreviewHelpers.XLSX_EXTENSIONS.has(ext)) return 'xlsx'
  if (isVideoExtension(ext)) return PreviewHelpers.PLAYABLE_VIDEO_EXTENSIONS.has(ext) ? 'video' : 'video-unsupported'
  if (ArchiveTypes.SupportedExtensions.has(ext as ArchiveTypes.ArchiveType)) return 'archive'

  const c = getCategoryFromExtension(ext)
  if (c === 'audio') return 'audio'

  return 'text'
}
