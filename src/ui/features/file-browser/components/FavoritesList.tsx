import { FolderIcon, FileIcon } from "lucide-react";
import { useFavorites, type FavoriteItem } from "../hooks/useFavorites";
import { useDirectory } from "../hooks/useDirectory";
import { FileBrowserSidebarSection } from "./FileBrowserSidebarSection";

interface FavoritesListProps {
  favorites: ReturnType<typeof useFavorites>;
  d: ReturnType<typeof useDirectory>;
  className?: string;
}

export function FavoritesList({ favorites, d, className }: FavoritesListProps) {
  const f = favorites.favorites;

  return (
    <FileBrowserSidebarSection
      items={f}
      header="Favorites"
      emptyMessage="No favorites yet"
      getKey={(favorite) => favorite.fullPath}
      isSelected={(favorite) => d.directory.fullName === favorite.fullPath}
      onClick={(favorite) => d.cdFull(favorite.fullPath)}
      className={className}
      render={(favorite) => (
        <>
          {favorite.type === "dir" ? (
            <FolderIcon className="w-4 h-4 text-blue-500" />
          ) : (
            <FileIcon className="w-4 h-4 text-green-500" />
          )}
          <span className="truncate">{favoriteName(favorite)}</span>
        </>
      )}
    />
  );
}

function favoriteName(favorite: FavoriteItem) {
  return favorite.fullPath.split("/").pop();
}
