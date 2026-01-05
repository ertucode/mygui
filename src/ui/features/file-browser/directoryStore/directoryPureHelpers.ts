import { Typescript } from '@common/Typescript'
import { DirectoryContext, DirectoryContextDirectory, DirectoryId, DirectoryInfo } from './DirectoryBase'

export const defaultSelection = Object.freeze({ indexes: new Set<number>(), last: undefined })
export function getBufferSelection(state: DirectoryContext, directory: DirectoryContextDirectory) {
  if (!directory) return defaultSelection
  const fullPath = getFullPathForBuffer(directory.directory)
  return state.vim.buffers[fullPath]?.selection
}

export function getCursorLine(state: DirectoryContext, directory: DirectoryContextDirectory) {
  if (!directory) return 0
  const fullPath = getFullPathForBuffer(directory.directory)
  return state.vim.buffers[fullPath]?.cursor.line
}
export function getCursorLineForDirectoryId(state: DirectoryContext, directoryId: DirectoryId | undefined) {
  return getCursorLine(state, getActiveDirectory(state, directoryId))
}

export function selectBuffer(state: DirectoryContext, directoryId: DirectoryId | undefined) {
  const activeDirectory = getActiveDirectory(state, directoryId)
  const fullPath = getFullPathForBuffer(activeDirectory.directory)
  const buffer = state.vim.buffers[fullPath]
  return buffer
}

export function directoryInfoEquals(a: DirectoryInfo, b: DirectoryInfo): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'path' && b.type === 'path') return a.fullPath === b.fullPath
  if (a.type === 'tags' && b.type === 'tags') return a.color === b.color
  return false
}
export function getActiveDirectory(context: DirectoryContext, directoryId: DirectoryId | undefined) {
  const dirId = directoryId ?? context.activeDirectoryId
  return context.directoriesById[dirId]
}
export function getFullPathForBuffer(directory: DirectoryInfo) {
  if (directory.type === 'path') return directory.fullPath
  if (directory.type === 'tags') return `tag:${directory.color}`
  Typescript.assertUnreachable(directory)
}
