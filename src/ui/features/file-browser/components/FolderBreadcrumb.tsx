import { FolderIcon } from "lucide-react";
import { useSelector } from "@xstate/store/react";
import {
  ContextMenu,
  ContextMenuList,
  useContextMenu,
} from "@/lib/components/context-menu";
import type { useDirectory } from "../hooks/useDirectory";
import type { useDefaultPath } from "../hooks/useDefaultPath";
import { tagsStore, TAG_COLOR_CLASSES, selectTagConfig } from "../hooks/useTags";
import { PathHelpers } from "@common/PathHelpers";

export function FolderBreadcrumb({
  d,
  defaultPath,
}: {
  d: ReturnType<typeof useDirectory>;
  defaultPath: ReturnType<typeof useDefaultPath>;
}) {
  const menu = useContextMenu<number>();
  const tagConfig = useSelector(tagsStore, selectTagConfig);

  if (d.directory.type === "tags") {
    const tagName = tagConfig[d.directory.color] || d.directory.color;
    return (
      <div className="breadcrumbs text-sm py-0">
        <ul>
          <li className="flex items-center gap-1">
            <a className="flex items-center gap-3">
              {/* <TagIcon className="size-4" /> */}
              <span
                className={`size-3 rounded-full ${TAG_COLOR_CLASSES[d.directory.color].dot}`}
              />
              <div>{tagName}</div>
            </a>
          </li>
        </ul>
      </div>
    );
  }

  const parts = PathHelpers.getFolderNameParts(d.directory.fullPath);

  return (
    <div className="breadcrumbs text-sm py-0">
      {menu.isOpen && (
        <ContextMenu menu={menu}>
          <ContextMenuList
            items={[
              {
                onClick: () => {
                  defaultPath.setPath(
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
                d.cd({
                  type: "path",
                  fullPath: PathHelpers.reconstructDirectoryUntilIndex(
                    parts,
                    idx,
                  ),
                })
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
