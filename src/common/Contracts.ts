import { type GenericResult } from './GenericError.js'
import { TaskEvents, Tasks } from './Tasks.js'
import { type ArchiveTypes } from './ArchiveTypes.js'
import { GenericEvent } from './GenericEvent.js'
import { VimEngine } from './VimEngine.js'

export type ContextLine = {
  lineNumber: number
  content: string
  isMatch: boolean
}

export type StringSearchResult = {
  filePath: string
  matchLineNumber: number
  matchContent: string
  contextLines: ContextLine[]
}

export type ArchiveEntry = {
  name: string
  isDirectory: boolean
  size: number
  compressedSize?: number
  comment?: string
}

export type ApplicationInfo = {
  name: string
  path: string
  isDefault?: boolean
}

export type AudioMetadata = {
  title?: string
  artist?: string
  album?: string
  year?: number
  genre?: string[]
  duration?: number
  bitrate?: number
  sampleRate?: number
  numberOfChannels?: number
  picture?: {
    data: string // base64 encoded
    format: string
  }
}

export type FileCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'code'
  | 'font'
  | 'executable'
  | 'other'

export type GetFilesAndFoldersInDirectoryItem = (
  | {
      type: 'file'
      sizeStr: string
      category: FileCategory
    }
  | {
      type: 'dir'
      sizeStr: string
      category: 'folder'
    }
) & {
  modifiedAt: string | undefined | null
  modifiedTimestamp: number | undefined | null
  ext: string
  sizeStr: string | null | undefined
  size: number | undefined | null
  name: string
  fullPath?: string
  permissions?: string
}

export type PasteConflictInfo = {
  sourcePath: string
  destinationPath: string
  suggestedName: string
  type: 'file' | 'dir'
  sourceSize: number
  destSize: number
  sourceSizeStr: string
  destSizeStr: string
}

export type PasteConflictData = {
  conflicts: PasteConflictInfo[]
  exceedsLimit: boolean
  totalConflicts: number
}

export type ConflictResolution = {
  globalStrategy: 'override' | 'trash' | 'autoName' | 'skip'
  perFileOverrides?: {
    [destinationPath: string]: {
      action: 'override' | 'trash' | 'customName' | 'skip'
      customName?: string
    }
  }
}

export type EventResponseMapping = {
  docxToPdf: Promise<string>
  getFilesAndFoldersInDirectory: Promise<GenericResult<GetFilesAndFoldersInDirectoryItem[]>>
  getFileInfoByPaths: Promise<GetFilesAndFoldersInDirectoryItem[]>
  openFile: Promise<unknown>
  onDragStart: Promise<unknown>
  captureRect: Promise<unknown>
  readFilePreview: Promise<
    | {
        content: string
        isTruncated: boolean
        // Note: images, PDFs, and videos are handled directly in the frontend
        // using file:// URLs without making IPC calls
        contentType: 'text' | 'docx' | 'xlsx'
      }
    | { error: string }
    | { error: 'FILE_TOO_LARGE' }
  >
  deleteFiles: Promise<GenericResult<void>>
  applyVimChanges: Promise<GenericResult<void>>
  createFileOrFolder: Promise<GenericResult<{ path: string }>>
  renameFileOrFolder: Promise<GenericResult<{ newPath: string }>>
  batchRenameFiles: Promise<GenericResult<{ renamedPaths: Array<{ oldPath: string; newPath: string }> }>>
  getPreviewPreloadPath: string
  copyFiles: Promise<GenericResult<void>>
  setClipboardCutMode: Promise<void>
  pasteFiles: Promise<
    | { needsResolution: true; conflictData: PasteConflictData }
    | {
        needsResolution: false
        result: GenericResult<{ pastedItems: string[] }>
      }
  >
  fuzzyFileFinder: Promise<GenericResult<string[]>>
  searchStringRecursively: Promise<GenericResult<StringSearchResult[]>>
  replaceStringInFile: Promise<GenericResult<ReplaceResult>>
  replaceStringInMultipleFiles: Promise<GenericResult<ReplaceResult[]>>
  fuzzyFolderFinder: Promise<GenericResult<string[]>>
  readArchiveContents: Promise<GenericResult<ArchiveEntry[]>>
  getDirectorySizes: Promise<Record<string, number>>
  generateVideoThumbnail: Promise<string>
  generateAppIcon: Promise<string>
  getAudioMetadata: Promise<AudioMetadata | { error: string }>
  'task:event': TaskEvents
  'generic:event': GenericEvent
  'window:focus': void
  startArchive: Promise<void>
  startUnarchive: Promise<void>
  abortTask: Promise<void>
  getApplicationsForFile: Promise<ApplicationInfo[]>
  openFileWithApplication: Promise<void>
  openSelectAppWindow: Promise<string | null | undefined>
  openShell: Promise<void>
  runCommand: Promise<GenericResult<void>>
}

export type StringSearchOptions = {
  directory: string
  query: string
  /** Custom working directory - can be relative (subdirectory) or absolute (starts with / or ~) */
  cwd?: string
  /** Glob patterns for files to include (e.g., "*.ts", "*.{js,jsx}") */
  includePatterns?: string[]
  /** Glob patterns for files to exclude (e.g., "node_modules/**", "*.min.js") */
  excludePatterns?: string[]
  /** Use regex search instead of literal string */
  useRegex?: boolean
  /** Case sensitive search */
  caseSensitive?: boolean
  /** Search in hidden files and directories (default: true) */
  searchHidden?: boolean
}

export type ReplaceInFileOptions = {
  filePath: string
  searchQuery: string
  replaceText: string
  useRegex?: boolean
  caseSensitive?: boolean
  replaceAll?: boolean
}

export type ReplaceResult = {
  filePath: string
  replacementCount: number
}

export type ReplaceInMultipleFilesOptions = {
  files: Array<{
    filePath: string
    lineNumber?: number
  }>
  searchQuery: string
  replaceText: string
  useRegex?: boolean
  caseSensitive?: boolean
}

export type EventRequestMapping = {
  docxToPdf: string
  getFilesAndFoldersInDirectory: string
  getFileInfoByPaths: string[]
  openFile: string
  onDragStart: {
    files: string[]
    image: string
  }
  captureRect: Rect
  readFilePreview: {
    filePath: string
    allowBigSize?: boolean
    fullSize?: boolean
  }
  deleteFiles: { filePaths: string[]; clientMetadata: Tasks.ClientMetadata }
  applyVimChanges: VimEngine.Change[]
  createFileOrFolder: {
    parentDir: string
    name: string
  }
  renameFileOrFolder: {
    fullPath: string
    newName: string
  }
  batchRenameFiles: Array<{
    fullPath: string
    newName: string
  }>
  copyFiles: { filePaths: string[]; cut: boolean }
  setClipboardCutMode: { cut: boolean }
  pasteFiles: { destinationDir: string; resolution?: ConflictResolution }
  fuzzyFileFinder: { directory: string; query: string }
  searchStringRecursively: StringSearchOptions
  replaceStringInFile: ReplaceInFileOptions
  replaceStringInMultipleFiles: ReplaceInMultipleFilesOptions
  fuzzyFolderFinder: { directory: string; query: string }
  readArchiveContents: {
    archivePath: string
    archiveType: ArchiveTypes.ArchiveType
  }
  getDirectorySizes: { parentPath: string; specificDirName?: string }
  generateVideoThumbnail: string
  generateAppIcon: string
  getAudioMetadata: string
  startArchive: {
    archiveType: ArchiveTypes.ArchiveType
    source: string[]
    destination: string
    clientMetadata: Tasks.ClientMetadata
  }
  startUnarchive: {
    archiveType: ArchiveTypes.ArchiveType
    source: string
    destination: string
    clientMetadata: Tasks.ClientMetadata
  }
  abortTask: string
  getApplicationsForFile: string
  openFileWithApplication: { filePath: string; applicationPath: string }
  openSelectAppWindow: { initialPath: string }
  openShell: string
  runCommand: { name: string; filePath: string; parameters: any }
}

export type EventRequest<Key extends keyof EventResponseMapping> = Key extends keyof EventRequestMapping
  ? EventRequestMapping[Key]
  : void

export type UnsubscribeFunction = () => void

export type Rect = {
  x: number
  y: number
  width: number
  height: number
}

export type WindowElectron = {
  getFilePath: (file: File) => string
  convertDocxToPdf: (file: File) => Promise<string>
  convertDocxToPdfByPath: (filePath: string) => Promise<string>
  getFilesAndFoldersInDirectory: (directory: string) => Promise<GenericResult<GetFilesAndFoldersInDirectoryItem[]>>
  openFile: (filePath: string) => Promise<unknown>
  onDragStart: (request: EventRequestMapping['onDragStart']) => Promise<unknown>
  captureRect: (rect: Rect) => Promise<string>
  readFilePreview: (
    filePath: string,
    allowBigSize?: boolean
  ) => Promise<
    | {
        content: string
        isTruncated: boolean
        // Note: images, PDFs, and videos are handled directly in the frontend
        // using file:// URLs without making IPC calls
        contentType: 'text' | 'docx' | 'xlsx'
      }
    | { error: string }
    | { error: 'FILE_TOO_LARGE' }
  >
  deleteFiles: (filePaths: string[], clientMetadata: Tasks.ClientMetadata) => Promise<GenericResult<void>>
  applyVimChanges: (changes: VimEngine.Change[]) => Promise<GenericResult<void>>
  createFileOrFolder: (parentDir: string, name: string) => Promise<GenericResult<{ path: string }>>
  renameFileOrFolder: (fullPath: string, newName: string) => Promise<GenericResult<{ newPath: string }>>
  batchRenameFiles: (
    items: Array<{ fullPath: string; newName: string }>
  ) => Promise<GenericResult<{ renamedPaths: Array<{ oldPath: string; newPath: string }> }>>
  getPreviewPreloadPath: () => Promise<string>
  getStartingDirectory: () => string | undefined | null
  copyFiles: (filePaths: string[], cut: boolean) => Promise<GenericResult<void>>
  setClipboardCutMode: (cut: boolean) => Promise<void>
  pasteFiles: (
    destinationDir: string,
    resolution?: ConflictResolution
  ) => Promise<
    | { needsResolution: true; conflictData: PasteConflictData }
    | {
        needsResolution: false
        result: GenericResult<{ pastedItems: string[] }>
      }
  >
  fuzzyFileFinder: (directory: string, query: string) => Promise<GenericResult<string[]>>
  searchStringRecursively: (options: StringSearchOptions) => Promise<GenericResult<StringSearchResult[]>>
  replaceStringInFile: (options: ReplaceInFileOptions) => Promise<GenericResult<ReplaceResult>>
  replaceStringInMultipleFiles: (options: ReplaceInMultipleFilesOptions) => Promise<GenericResult<ReplaceResult[]>>
  fuzzyFolderFinder: (directory: string, query: string) => Promise<GenericResult<string[]>>
  getFileInfoByPaths: (filePaths: string[]) => Promise<GetFilesAndFoldersInDirectoryItem[]>
  readArchiveContents: (
    archivePath: string,
    archiveType: ArchiveTypes.ArchiveType
  ) => Promise<GenericResult<ArchiveEntry[]>>
  getDirectorySizes: (parentPath: string, specificDirName?: string) => Promise<Record<string, number>>
  generateVideoThumbnail: (filePath: string) => Promise<string>
  generateAppIcon: (filePath: string) => Promise<string>
  getAudioMetadata: (filePath: string) => Promise<AudioMetadata | { error: string }>
  onTaskEvent: (cb: (e: TaskEvents) => void) => void
  onGenericEvent: (cb: (e: GenericEvent) => void) => void
  onWindowFocus: (cb: () => void) => UnsubscribeFunction
  startArchive: (archiveType: ArchiveTypes.ArchiveType, source: string[], destination: string, clientMetadata: Tasks.ClientMetadata) => Promise<void>
  startUnarchive: (archiveType: ArchiveTypes.ArchiveType, source: string, destination: string, clientMetadata: Tasks.ClientMetadata) => Promise<void>
  abortTask: (taskId: string) => Promise<void>
  getApplicationsForFile: (filePath: string) => Promise<ApplicationInfo[]>
  openFileWithApplication: (filePath: string, applicationPath: string) => Promise<void>
  openSelectAppWindow: (initialPath: string) => Promise<string | null | undefined>
  openShell: (url: string) => Promise<void>
  isSelectAppMode: () => boolean
  sendSelectAppResult: (appPath: string | null | undefined) => void
  getWindowArgs: () => string
  runCommand: (opts: { name: string; filePath: string; parameters: any }) => Promise<GenericResult<void>>
}
