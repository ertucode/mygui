import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { z } from "zod";

const favoriteItemSchema = z.object({
  fullPath: z.string(),
  type: z.enum(["file", "dir"]),
});

const favoritesSchema = z.array(favoriteItemSchema);

export type FavoriteItem = z.infer<typeof favoriteItemSchema>;

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage(
    "file-browser-favorites",
    favoritesSchema,
    [
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
    ],
  );

  const addFavorite = (item: FavoriteItem) => {
    setFavorites((prev) => {
      // Check if already exists
      if (prev.some((fav) => fav.fullPath === item.fullPath)) {
        return prev;
      }
      return [...prev, item];
    });
  };

  const removeFavorite = (fullPath: string) => {
    setFavorites((prev) => prev.filter((fav) => fav.fullPath !== fullPath));
  };

  const toggleFavorite = (fullPath: string) => {
    const isFav = isFavorite(fullPath);
    if (isFav) {
      removeFavorite(fullPath);
    } else {
      addFavorite({ fullPath, type: "file" });
    }
  };

  const isFavorite = (fullPath: string) => {
    return favorites.some((fav) => fav.fullPath === fullPath);
  };

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
  };
}
