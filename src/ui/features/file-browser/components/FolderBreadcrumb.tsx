import { FolderIcon } from "lucide-react";
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
  const directory = useSelector(
    directoryStore,
    selectDirectory(directoryId),
  ).directory;

  if (directory.type === "tags") {
    const tagName = tagConfig[directory.color] || directory.color;
    return (
      <div className="breadcrumbs text-sm py-0">
        <ul>
          <li className="flex items-center gap-1">
            <a className="flex items-center gap-3">
              {/* <TagIcon className="size-4" /> */}
              <span
                className={`size-3 rounded-full ${TAG_COLOR_CLASSES[directory.color].dot}`}
              />
              <div>{tagName}</div>
            </a>
          </li>
        </ul>
      </div>
    );
  }

  const parts = PathHelpers.getFolderNameParts(directory.fullPath);

  return (
    <div className="breadcrumbs text-sm py-0">
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
      <ul>
        {parts.map((part, idx) => {
          return (
            <li
              key={idx}
              className="flex items-center gap-1"
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
            >
              <a>
                <FolderIcon className="size-4" />
                <div>{part}</div>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
