import { memo } from 'react'
import { useSelector } from '@xstate/store/react'
import { GetFilesAndFoldersInDirectoryItem } from '@common/Contracts'
import { useDirectoryContext } from '@/features/file-browser/DirectoryContext'
import { directoryDerivedStores } from '../../directoryStore/directorySubscriptions'
import { directoryStore } from '../../directoryStore/directory'
import { directoryHelpers } from '../../directoryStore/directory'
import { ContextMenu, useContextMenu } from '@/lib/components/context-menu'
import { FileTableRowContextMenu } from '../../FileTableRowContextMenu'
import { DerivedDirectoryItem, DirectoryId, RealDirectoryItem } from '../../directoryStore/DirectoryBase'
import { clsx } from '@/lib/functions/clsx'
import { fileDragDropStore } from '../../fileDragDrop'
import { FolderIcon } from 'lucide-react'
import { fileBrowserListItemProps } from '../../fileBrowserListItemProps'
import { SpreadsheetThumbnail } from './SpreadSheetThumbnail'
import { PDFThumbnail } from './PDFThumbnail'
import { ImageThumbnail } from './ImageThumbnail'
import { BaseThumbnail } from './BaseThumbnail'
import { fileBrowserListContainerProps } from '../../fileBrowserListContainerProps'
import { VideoThumbnail } from './VideoThumbnail'
import { AppIconThumbnail } from './AppIconThumbnail'

/*
 * SIMPLIFICATIONS:
 * Grid view can't have vim item
 *
 * */

type GridItemProps = {
  item: RealDirectoryItem
  index: number
  directoryId: DirectoryId
  onContextMenu: (e: React.MouseEvent, item: { item: DerivedDirectoryItem; index: number }) => void
}

const GridItem = memo(function GridItem({ item, index, directoryId, onContextMenu }: GridItemProps) {
  const isSelected = useSelector(directoryStore, state =>
    state.context.vim.selection.indexes.has(index)
  )

  const isDragOverThisRow = useSelector(
    fileDragDropStore,
    s => s.context.dragOverDirectoryId === directoryId && s.context.dragOverRowIdx === index && item.item.type === 'dir'
  )

  const fullPath = directoryHelpers.getFullPathForItem(item.item, directoryId)

  return (
    <div
      className={clsx(
        'group relative flex flex-col rounded-lg border border-base-300 hover:bg-base-200 cursor-pointer transition-colors select-none overflow-hidden h-36',
        isSelected && 'bg-base-content/10 ring-2 ring-primary',
        isDragOverThisRow && 'bg-primary/20 ring-2 ring-primary'
      )}
      data-list-item
      {...fileBrowserListItemProps({
        item,
        index,
        directoryId,
        onContextMenu,
      })}
    >
      <div className="h-[82%] w-full">
        <FileThumbnail item={item.item} fullPath={fullPath} />
      </div>
      <div className="h-[18%] w-full flex flex-col items-center justify-center px-2 py-1">
        <div className="text-xs text-center w-full truncate" title={item.item.name}>
          {item.item.name}
        </div>
        {/* {item.sizeStr && item.type === "file" && ( */}
        {/*   <div className="text-[10px] text-base-content/60">{item.sizeStr}</div> */}
        {/* )} */}
      </div>
    </div>
  )
})

function FileThumbnail({ item, fullPath }: { item: GetFilesAndFoldersInDirectoryItem; fullPath: string }) {
  if (item.type === 'dir') {
    // Check if this is a .app bundle in /Applications or /System/Applications
    const isApp = item.name.endsWith('.app')
    const isInApplicationsFolder = fullPath.startsWith('/Applications/') || fullPath.startsWith('/System/Applications/')

    if (isApp && isInApplicationsFolder) {
      return <AppIconThumbnail item={item} fullPath={fullPath} />
    }

    return (
      <div className="w-full h-full flex items-center justify-center">
        <FolderIcon className="w-12 h-12 text-primary" />
      </div>
    )
  }

  if (item.category === 'image') {
    return <ImageThumbnail item={item} fullPath={fullPath} />
  }

  if (item.category === 'video') {
    return <VideoThumbnail item={item} fullPath={fullPath} />
  }

  if (item.ext === '.pdf') {
    return <PDFThumbnail fullPath={fullPath} />
  }

  if (item.category === 'spreadsheet') {
    return <SpreadsheetThumbnail fullPath={fullPath} />
  }

  return <BaseThumbnail item={item} fullPath={fullPath} />
}

export const FileGridView = memo(function FileGridView() {
  const context = useDirectoryContext()
  const directoryId = context.directoryId
  const filteredDirectoryData = directoryDerivedStores.get(context.directoryId)!.useFilteredDirectoryData()

  const contextMenu = useContextMenu<{ item: DerivedDirectoryItem; index: number }>()

  const directory = useSelector(directoryStore, state =>
    state.context.directoriesById[directoryId] ? state.context.directoriesById[directoryId].directory : null
  )

  const isDragOver = useSelector(fileDragDropStore, s => s.context.dragOverDirectoryId === directoryId)

  if (!directory) {
    return null
  }

  return (
    <>
      {contextMenu.item && (
        <ContextMenu menu={contextMenu}>
          <FileTableRowContextMenu
            item={contextMenu.item.item}
            close={contextMenu.close}
            tableData={filteredDirectoryData}
            index={contextMenu.item.index}
          />
        </ContextMenu>
      )}

      <div
        data-list-id={directoryId}
        className={clsx('h-full overflow-auto p-4', isDragOver && 'ring-2 ring-primary ring-inset')}
        {...fileBrowserListContainerProps({ directoryId, directory })}
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {filteredDirectoryData.map((item, idx) => (
            <GridItem
              key={idx}
              item={item as RealDirectoryItem} // Grid view can't have vim item
              index={idx}
              directoryId={directoryId}
              onContextMenu={contextMenu.onRightClick}
            />
          ))}
        </div>
      </div>
    </>
  )
})
