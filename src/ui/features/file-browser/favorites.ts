import { createStore } from '@xstate/store'
import { z } from 'zod'
import { createAsyncStoragePersistence } from './utils/asyncStorage'
import { AsyncStorageKeys } from '@common/AsyncStorageKeys'

const favoriteItemSchema = z.object({
  fullPath: z.string(),
  type: z.enum(['file', 'dir']),
})

const favoritesSchema = z.array(favoriteItemSchema)

export type FavoriteItem = z.infer<typeof favoriteItemSchema>

const defaultFavorites: FavoriteItem[] = [
  {
    fullPath: '~/Documents',
    type: 'dir',
  },
  {
    fullPath: '~/Downloads',
    type: 'dir',
  },
  {
    fullPath: '~/Desktop',
    type: 'dir',
  },
  {
    fullPath: '~/dev',
    type: 'dir',
  },
]

const favoritesPersistence = createAsyncStoragePersistence(AsyncStorageKeys.favorites, favoritesSchema)

// Create the store
export const favoritesStore = createStore({
  context: {
    favorites: favoritesPersistence.load(defaultFavorites),
  },
  on: {
    addFavorite: (context, event: { item: FavoriteItem }) => {
      // Check if already exists
      if (context.favorites.some(fav => fav.fullPath === event.item.fullPath)) {
        return context
      }
      return {
        ...context,
        favorites: [...context.favorites, event.item],
      }
    },

    removeFavorite: (context, event: { fullPath: string }) => ({
      ...context,
      favorites: context.favorites.filter(fav => fav.fullPath !== event.fullPath),
    }),

    toggleFavorite: (context, event: { fullPath: string; type: 'file' | 'dir' }) => {
      const isFav = context.favorites.some(fav => fav.fullPath === event.fullPath)
      if (isFav) {
        return {
          ...context,
          favorites: context.favorites.filter(fav => fav.fullPath !== event.fullPath),
        }
      } else {
        const newFavorite: FavoriteItem = {
          fullPath: event.fullPath,
          type: event.type,
        }
        return {
          ...context,
          favorites: [...context.favorites, newFavorite],
        }
      }
    },

    reorderFavorites: (context, event: { fromIndex: number; toIndex: number }) => {
      const { fromIndex, toIndex } = event
      if (fromIndex === toIndex) return context

      const newFavorites = [...context.favorites]
      const [movedItem] = newFavorites.splice(fromIndex, 1)
      newFavorites.splice(toIndex, 0, movedItem)

      return {
        ...context,
        favorites: newFavorites,
      }
    },

    setFavorites: (context, event: { favorites: FavoriteItem[] }) => ({
      ...context,
      favorites: event.favorites,
    }),

    removeFavorites: (context, event: { fullPaths: string[] }) => {
      const newFavorites = context.favorites.filter(fav => !event.fullPaths.includes(fav.fullPath))
      return {
        ...context,
        favorites: newFavorites,
      }
    },
  },
})

// Subscribe to store changes for persistence
favoritesStore.subscribe(state => {
  favoritesPersistence.save(state.context.favorites)
})

// Selector functions for common use cases
export const selectFavorites = (state: ReturnType<typeof favoritesStore.get>) => state.context.favorites

export const selectIsFavorite = (fullPath: string) => (state: ReturnType<typeof favoritesStore.get>) =>
  state.context.favorites.some(fav => fav.fullPath === fullPath)
