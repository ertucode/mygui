import { FolderIcon, FileIcon, Trash2Icon, FolderCogIcon } from 'lucide-react'
import { useSelector } from '@xstate/store/react'
import { favoritesStore, selectFavorites, type FavoriteItem } from '../favorites'
import { FileBrowserSidebarSection } from './FileBrowserSidebarSection'
import { TextWithIcon } from '@/lib/components/text-with-icon'
import { directoryHelpers, directoryStore, selectDirectory } from '../directoryStore/directory'
import { setDefaultPath } from '../defaultPath'
import { fileDragDropHandlers } from '../fileDragDrop'

interface FavoritesListProps {
  className?: string
}

export function FavoritesList({ className }: FavoritesListProps) {
  const f = useSelector(favoritesStore, selectFavorites)
  const activeDirectoryId = useSelector(directoryStore, s => s.context.activeDirectoryId)
  const directory = useSelector(directoryStore, selectDirectory(activeDirectoryId))

  const handleReorder = (fromIndex: number, toIndex: number) => {
    favoritesStore.send({
      type: 'reorderFavorites',
      fromIndex,
      toIndex,
    })
  }

  const handleExternalDrop = (e: React.DragEvent, insertIndex: number) => {
    // Try to get dragged items from dataTransfer (HTML5 drag) or from store (native drag)
    let itemsToAdd: Array<{ fullPath: string; type: 'file' | 'dir'; name: string }> | null = null

    // First try dataTransfer (HTML5 drag)
    const dragItemsJson = e.dataTransfer.getData('application/x-mygui-drag-items')
    if (dragItemsJson) {
      try {
        itemsToAdd = JSON.parse(dragItemsJson)
      } catch (error) {
        console.error('Failed to parse drag items', error)
      }
    }

    // If not found, try from store (native drag)
    if (!itemsToAdd) {
      const activeDrag = fileDragDropHandlers.getActiveDrag()
      if (activeDrag) {
        itemsToAdd = activeDrag.items
      }
    }

    if (!itemsToAdd || itemsToAdd.length === 0) {
      return
    }

    // Add each item to favorites at the insert position
    const currentFavorites = favoritesStore.getSnapshot().context.favorites
    const newFavorites = [...currentFavorites]

    // Insert items at the specified index
    let insertOffset = 0
    for (const item of itemsToAdd) {
      // Skip if already in favorites
      if (newFavorites.some(fav => fav.fullPath === item.fullPath)) {
        continue
      }

      const favoriteItem: FavoriteItem = {
        fullPath: item.fullPath,
        type: item.type,
      }

      newFavorites.splice(insertIndex + insertOffset, 0, favoriteItem)
      insertOffset++
    }

    // Update the favorites store with the new array
    favoritesStore.send({ type: 'setFavorites', favorites: newFavorites })
  }

  return (
    <FileBrowserSidebarSection
      items={f}
      emptyMessage="No favorites yet"
      getKey={favorite => favorite.fullPath}
      isSelected={favorite => directory.type === 'path' && directory.fullPath === favorite.fullPath}
      onClick={i => directoryHelpers.openItemFull(i, activeDirectoryId)}
      getContextMenuItems={favorite => [
        {
          view: <TextWithIcon icon={Trash2Icon}>Remove from favorites</TextWithIcon>,
          onClick: () =>
            favoritesStore.send({
              type: 'removeFavorite',
              fullPath: favorite.fullPath,
            }),
        },
        favorite.type === 'dir' && {
          view: <TextWithIcon icon={FolderCogIcon}>Set as default path</TextWithIcon>,
          onClick: () => setDefaultPath(favorite.fullPath),
        },
      ]}
      className={className}
      isDraggable={true}
      onReorder={handleReorder}
      acceptsExternalDrop={true}
      onExternalDrop={handleExternalDrop}
      render={favorite => (
        <>
          {favorite.type === 'dir' ? (
            <FolderIcon className="size-4 min-w-4 text-blue-500" />
          ) : (
            <FileIcon className="size-4 min-w-4 text-green-500" />
          )}
          <span className="truncate">{favoriteName(favorite)}</span>
        </>
      )}
    />
  )
}

function favoriteName(favorite: FavoriteItem) {
  return favorite.fullPath.split('/').pop()
}
