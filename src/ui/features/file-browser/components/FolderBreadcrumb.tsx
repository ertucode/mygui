import { useSelector } from "@xstate/store/react";
import {
  ContextMenu,
  ContextMenuList,
  useContextMenu,
} from "@/lib/components/context-menu";
import { tagsStore, TAG_COLOR_CLASSES, selectTagConfig } from "../tags";
import { PathHelpers } from "@common/PathHelpers";
import {
  directoryStore,
  directoryHelpers,
  selectDirectory,
} from "../directory";
import { setDefaultPath } from "../defaultPath";
import { useDirectoryContext } from "../DirectoryContext";

export function FolderBreadcrumb() {
  const menu = useContextMenu<number>();
  const tagConfig = useSelector(tagsStore, selectTagConfig);
  const directoryId = useDirectoryContext().directoryId;
  const directory = useSelector(directoryStore, selectDirectory(directoryId));

  if (directory.type === "tags") {
    const tagName = tagConfig[directory.color] || directory.color;
    return (
      <>
        <button className="join-item btn btn-xs btn-soft btn-info rounded-none flex items-center gap-3">
          <span
            className={`size-3 rounded-full ${TAG_COLOR_CLASSES[directory.color].dot}`}
          />
          <div>{tagName}</div>
        </button>
      </>
    );
  }

  const parts = PathHelpers.getFolderNameParts(directory.fullPath);

  return (
    <>
      {menu.isOpen && (
        <ContextMenu menu={menu}>
          <ContextMenuList
            items={[
              {
                onClick: () => {
                  setDefaultPath(
                    PathHelpers.reconstructDirectoryUntilIndex(
                      parts,
                      menu.item!,
                    ),
                  );
                  menu.close();
                },
                view: "Set as default path",
              },
            ]}
          />
        </ContextMenu>
      )}
      {parts.map((part, idx) => {
        return (
          <button
            key={idx}
            onClick={() =>
              directoryHelpers.cd(
                {
                  type: "path",
                  fullPath: PathHelpers.reconstructDirectoryUntilIndex(
                    parts,
                    idx,
                  ),
                },
                directoryId,
              )
            }
            onContextMenu={(e) => {
              e.preventDefault();
              menu.onRightClick(e, idx);
            }}
            className="join-item btn btn-xs btn-soft btn-info rounded-none"
          >
            {part}
          </button>
        );
      })}
    </>
  );
}
