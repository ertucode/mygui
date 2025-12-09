import { type ReactNode } from "react";
import { clsx } from "@/lib/functions/clsx";
import {
  ContextMenu,
  ContextMenuList,
  useContextMenu,
  type ContextMenuItem,
} from "@/lib/components/context-menu";

interface FileBrowserSidebarSectionProps<T> {
  items: T[];
  render: (item: T) => ReactNode;
  emptyMessage: ReactNode;
  header: ReactNode;
  isSelected: (item: T) => boolean;
  onClick: (item: T) => void;
  getKey: (item: T) => string;
  className?: string;
  getContextMenuItems?: (item: T) => ContextMenuItem[];
}

export function FileBrowserSidebarSection<T>({
  items,
  render,
  emptyMessage,
  header,
  isSelected,
  onClick,
  getKey,
  className = "",
  getContextMenuItems,
}: FileBrowserSidebarSectionProps<T>) {
  const contextMenu = useContextMenu<T>();

  return (
    <>
      <div
        className={clsx("flex flex-col gap-1 pr-2 overflow-hidden", className)}
      >
        <h3 className="text-sm font-semibold pl-2 flex-shrink-0">{header}</h3>
        <div className="flex flex-col gap-1 overflow-y-auto min-h-0 flex-1">
          {items.length === 0 ? (
            <div className="text-xs text-gray-500 pl-2">{emptyMessage}</div>
          ) : (
            items.map((item) => (
              <button
                key={getKey(item)}
                className={clsx(
                  "flex items-center gap-2 hover:bg-base-200 rounded text-xs py-1 px-2 cursor-pointer",
                  isSelected(item) && "bg-base-300",
                )}
                onClick={() => onClick(item)}
                onContextMenu={
                  getContextMenuItems
                    ? (e) => contextMenu.onRightClick(e, item)
                    : undefined
                }
              >
                {render(item)}
              </button>
            ))
          )}
        </div>
      </div>
      {contextMenu.isOpen && contextMenu.item && getContextMenuItems && (
        <ContextMenu menu={contextMenu}>
          <ContextMenuList items={getContextMenuItems(contextMenu.item)} />
        </ContextMenu>
      )}
    </>
  );
}
