import { GetFilesAndFoldersInDirectoryItem } from '@common/Contracts'
import { HistoryStack } from '@common/history-stack'
import { TagColor } from '../tags'
import { SortState } from '../schemas'
import { GenericError } from '@common/GenericError'
import { VimEngine } from '@common/VimEngine'
import { Brands } from '@common/Brands'

export type DirectoryInfo = { type: 'path'; fullPath: string } | { type: 'tags'; color: TagColor }
export type DirectoryType = DirectoryInfo['type']

export type DirectoryId = Brands.DirectoryId
export type DerivedDirectoryItem = VimEngine.BufferItem
export type RealDirectoryItem = Extract<DerivedDirectoryItem, { type: 'real' }>
export type StrDirectoryItem = Extract<DerivedDirectoryItem, { type: 'str' }>

export type DirectoryLocalSort = {
  actual: SortState
  basedOn: SortState | undefined
}

export type DirectoryContextDirectory = {
  directoryId: DirectoryId
  directory: DirectoryInfo
  loading: boolean
  directoryData: GetFilesAndFoldersInDirectoryItem[]
  error: GenericError | undefined
  historyStack: HistoryStack<DirectoryInfo>
  pendingSelection: string | string[] | null
  viewMode: 'list' | 'grid'
  localSort: DirectoryLocalSort | undefined
}

export type DirectoryContext = {
  directoriesById: { [id: DirectoryId]: DirectoryContextDirectory }
  directoryOrder: DirectoryId[]
  activeDirectoryId: DirectoryId
  vim: VimEngine.State
}
