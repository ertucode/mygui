import { FolderIcon, FileIcon, Trash2Icon, FolderCogIcon } from "lucide-react";
import { useSelector } from "@xstate/store/react";
import {
  favoritesStore,
  selectFavorites,
  type FavoriteItem,
} from "../favorites";
import { FileBrowserSidebarSection } from "./FileBrowserSidebarSection";
import { TextWithIcon } from "@/lib/components/text-with-icon";
import {
  directoryHelpers,
  directoryStore,
  selectDirectory,
} from "../directory";
import { setDefaultPath } from "../defaultPath";

interface FavoritesListProps {
  className?: string;
}

export function FavoritesList({ className }: FavoritesListProps) {
  const f = useSelector(favoritesStore, selectFavorites);
  const activeDirectoryId = useSelector(
    directoryStore,
    (s) => s.context.activeDirectoryId,
  );
  const directory = useSelector(
    directoryStore,
    selectDirectory(activeDirectoryId),
  );

  return (
    <FileBrowserSidebarSection
      items={f}
      header="Favorites"
      emptyMessage="No favorites yet"
      getKey={(favorite) => favorite.fullPath}
      isSelected={(favorite) =>
        directory.type === "path" && directory.fullPath === favorite.fullPath
      }
      onClick={(i) => directoryHelpers.openItemFull(i, activeDirectoryId)}
      getContextMenuItems={(favorite) => [
        {
          view: <TextWithIcon icon={Trash2Icon}>Delete</TextWithIcon>,
          onClick: () =>
            favoritesStore.send({
              type: "removeFavorite",
              fullPath: favorite.fullPath,
            }),
        },
        favorite.type === "dir" && {
          view: (
            <TextWithIcon icon={FolderCogIcon}>
              Set as default path
            </TextWithIcon>
          ),
          onClick: () => setDefaultPath(favorite.fullPath),
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
