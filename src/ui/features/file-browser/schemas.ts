import z from 'zod'
import { DirectoryContextDirectory, type DirectoryLocalSort } from './directoryStore/DirectoryBase'

export const sortNames = z.enum(['name', 'modifiedTimestamp', 'size', 'ext'])
export type SortName = z.infer<typeof sortNames>

export const columnPreferenceSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
})

export const columnPreferencesSchema = z.array(columnPreferenceSchema)

export const sortStateSchema = z.object({
  by: sortNames.nullish(),
  order: z.enum(['asc', 'desc']).nullish(),
})

export type SortState = z.infer<typeof sortStateSchema>

export type SortContext = {
  global: SortState | undefined
  local: SortState | undefined
  directory: DirectoryLocalSort | undefined
}
export function resolveSort(sort: SortContext): SortState {
  const localOrGlobal = sort.local ?? sort.global
  if ((sort.directory && sort.directory.basedOn === localOrGlobal) || localOrGlobal == null) {
    return sort.directory?.actual ?? { by: undefined, order: undefined }
  }

  return localOrGlobal ?? { by: undefined, order: undefined }
}

export function resolveSortFromStores(dir: DirectoryContextDirectory, columnPrefs: ColumnPreferenceStore) {
  if (!dir) return { by: undefined, order: undefined }
  return resolveSort({
    directory: dir.localSort,
    global: columnPrefs.global.sort,
    local: dir.directory.type === 'path' ? columnPrefs?.path[dir.directory.fullPath]?.sort : undefined,
  })
}

export type ColumnPreference = z.infer<typeof columnPreferenceSchema>

// Schema for preferences with sort state
export const preferencesWithSortSchema = z.object({
  columns: columnPreferencesSchema,
  sort: sortStateSchema.optional(),
})

// Schema for per-directory column preferences
export const perDirectoryPreferencesSchema = z.record(
  z.string(), // directory path
  preferencesWithSortSchema
)

export type ColumnPreferenceStore = {
  global: z.infer<typeof preferencesWithSortSchema>
  path: z.infer<typeof perDirectoryPreferencesSchema>
}
