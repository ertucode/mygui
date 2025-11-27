import { FolderIcon } from "lucide-react";
import {
  ContextMenu,
  ContextMenuList,
  useContextMenu,
} from "@/lib/components/context-menu";
import type { useDirectory } from "../hooks/useDirectory";
import type { useDefaultPath } from "../hooks/useDefaultPath";

function getFolderNameParts(dir: string) {
  return dir.split("/").filter(Boolean);
}

function reconstructDirectory(parts: string[], idx: number) {
  return parts.slice(0, idx + 1).join("/") + "/";
}

export function FolderBreadcrumb({
  d,
  defaultPath,
}: {
  d: ReturnType<typeof useDirectory>;
  defaultPath: ReturnType<typeof useDefaultPath>;
}) {
  const parts = getFolderNameParts(d.directory.fullName);
  const menu = useContextMenu<number>();

  return (
    <div className="breadcrumbs text-sm">
      {menu.isOpen && (
        <ContextMenu menu={menu}>
          <ContextMenuList
            items={[
              {
                onClick: () => {
                  defaultPath.setPath(reconstructDirectory(parts, menu.item!));
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
                  fullName: reconstructDirectory(parts, idx),
                  name: part,
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
