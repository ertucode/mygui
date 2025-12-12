import { FolderIcon, FileIcon, Trash2Icon, FolderCogIcon } from "lucide-react";
import { useFavorites, type FavoriteItem } from "../hooks/useFavorites";
import { useDirectory } from "../hooks/useDirectory";
import { FileBrowserSidebarSection } from "./FileBrowserSidebarSection";
import { TextWithIcon } from "@/lib/components/text-with-icon";
import { useDefaultPath } from "../hooks/useDefaultPath";

interface FavoritesListProps {
  favorites: ReturnType<typeof useFavorites>;
  d: ReturnType<typeof useDirectory>;
  defaultPath: ReturnType<typeof useDefaultPath>;
  className?: string;
  openFavorite: (favorite: FavoriteItem) => void;
}

export function FavoritesList({
  favorites,
  d,
  className,
  defaultPath,
  openFavorite,
}: FavoritesListProps) {
  const f = favorites.favorites;

  return (
    <FileBrowserSidebarSection
      items={f}
      header="Favorites"
      emptyMessage="No favorites yet"
      getKey={(favorite) => favorite.fullPath}
      isSelected={(favorite) => d.directory.fullName === favorite.fullPath}
      onClick={openFavorite}
      getContextMenuItems={(favorite) => [
        {
          view: <TextWithIcon icon={Trash2Icon}>Delete</TextWithIcon>,
          onClick: () => favorites.removeFavorite(favorite.fullPath),
        },
        favorite.type === "dir" && {
          view: (
            <TextWithIcon icon={FolderCogIcon}>
              Set as default path
            </TextWithIcon>
          ),
          onClick: () => defaultPath.setPath(favorite.fullPath),
        },
      ]}
      className={className}
      render={(favorite) => (
        <>
          {favorite.type === "dir" ? (
            <FolderIcon className="size-4 min-w-4 text-blue-500" />
          ) : (
            <FileIcon className="size-4 min-w-4 text-green-500" />
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
