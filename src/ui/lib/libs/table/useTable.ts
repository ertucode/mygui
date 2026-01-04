import { useMemo } from 'react'
import type { ColumnDef } from './table-types'

export type TableMetadata<T> = ReturnType<typeof useTable<T>>

export type UseTableOptions<T> = {
  columns: ColumnDef<T>[]
  data: T[]
}

export function useTable<T>(opts: UseTableOptions<T>) {
  const { columns: cols, data } = opts
  const headers = useMemo(() => {
    return cols.map(col => {
      const value = resolveColumnHeaderValue(col)

      return {
        value,
        id: columnId(col),
        sortKey: columnSortKey(col),
      }
    })
  }, [cols])

  const rows = useMemo(() => {
    return data.map((item, idx) => {
      return {
        cells: cols.map((col, colIdx) => {
          const value = resolveColumnCellValue(col, item, idx)
          return {
            value,
            id: headers[colIdx].id,
            size: col.size,
          }
        }),
        id: getId(item),
      }
    })
  }, [data, cols])

  return {
    headers,
    rows,
    data,
  }
}

function resolveColumnHeaderValue<T>(col: ColumnDef<T>) {
  if (col.header != null) return col.header
  return 'N/A'
}

function resolveColumnCellValue<T>(col: ColumnDef<T>, item: T, idx: number) {
  return col.cell(item, { index: idx })
}

function columnId<T>(col: ColumnDef<T>) {
  return col.id
}

export function columnSortKey<T>(col: ColumnDef<T>) {
  if (col.sortKey) return col.sortKey
  if (col.id) return col.id
  return undefined
}

const weakMap = new WeakMap<any, any>()
let nextId = 1
function getId(obj: any) {
  let id = weakMap.get(obj)
  if (id !== undefined) return id
  id = nextId++
  weakMap.set(obj, id)
  return id
}
