import { createStore } from "@xstate/store";
import { z } from "zod";
import { createLocalStoragePersistence } from "./utils/localStorage";

const favoriteItemSchema = z.object({
  fullPath: z.string(),
  type: z.enum(["file", "dir"]),
});

const favoritesSchema = z.array(favoriteItemSchema);

export type FavoriteItem = z.infer<typeof favoriteItemSchema>;

const defaultFavorites: FavoriteItem[] = [
  {
    fullPath: "~/Documents",
    type: "dir",
  },
  {
    fullPath: "~/Downloads",
    type: "dir",
  },
  {
    fullPath: "~/Desktop",
    type: "dir",
  },
  {
    fullPath: "~/dev",
    type: "dir",
  },
];

// Create localStorage persistence helper
const favoritesPersistence = createLocalStoragePersistence(
  "file-browser-favorites",
  favoritesSchema,
);

// Create the store
export const favoritesStore = createStore({
  context: {
    favorites: favoritesPersistence.load(defaultFavorites),
  },
  on: {
    addFavorite: (context, event: { item: FavoriteItem }) => {
      // Check if already exists
      if (
        context.favorites.some((fav) => fav.fullPath === event.item.fullPath)
      ) {
        return context;
      }
      return {
        ...context,
        favorites: [...context.favorites, event.item],
      };
    },

    removeFavorite: (context, event: { fullPath: string }) => ({
      ...context,
      favorites: context.favorites.filter(
        (fav) => fav.fullPath !== event.fullPath,
      ),
    }),

    toggleFavorite: (context, event: { fullPath: string }) => {
      const isFav = context.favorites.some(
        (fav) => fav.fullPath === event.fullPath,
      );
      if (isFav) {
        return {
          ...context,
          favorites: context.favorites.filter(
            (fav) => fav.fullPath !== event.fullPath,
          ),
        };
      } else {
        const newFavorite: FavoriteItem = {
          fullPath: event.fullPath,
          type: "file",
        };
        return {
          ...context,
          favorites: [...context.favorites, newFavorite],
        };
      }
    },
  },
});

// Subscribe to store changes for persistence
favoritesStore.subscribe((state) => {
  // Persist state changes to localStorage
  favoritesPersistence.save(state.context.favorites);
});

// Selector functions for common use cases
export const selectFavorites = (state: ReturnType<typeof favoritesStore.get>) =>
  state.context.favorites;

export const selectIsFavorite =
  (fullPath: string) => (state: ReturnType<typeof favoritesStore.get>) =>
    state.context.favorites.some((fav) => fav.fullPath === fullPath);
