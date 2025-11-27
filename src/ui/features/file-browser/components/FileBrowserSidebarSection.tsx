import { type ReactNode } from "react";
import { clsx } from "@/lib/functions/clsx";

interface FileBrowserSidebarSectionProps<T> {
  items: T[];
  render: (item: T) => ReactNode;
  emptyMessage: ReactNode;
  header: ReactNode;
  isSelected: (item: T) => boolean;
  onClick: (item: T) => void;
  getKey: (item: T) => string;
  className?: string;
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
}: FileBrowserSidebarSectionProps<T>) {
  return (
    <div
      className={clsx("flex flex-col gap-1 min-w-48 max-w-48 pr-2", className)}
    >
      <h3 className="text-sm font-semibold pl-2">{header}</h3>
      <div className="flex flex-col gap-1 overflow-y-auto">
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
            >
              {render(item)}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
