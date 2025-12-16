import { Button } from "@/lib/components/button";
import {
  ClockIcon,
  CogIcon,
  EyeIcon,
  FoldersIcon,
  HeartIcon,
  TagIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import {
  TabsBarConfig,
  DraggableTitle,
  StretchBarConfig,
} from "react-tile-pane";
import { DirectoryId, directoryStore, selectDirectory } from "./directory";
import { clsx } from "@/lib/functions/clsx";
import { FileBrowserOptionsSection } from "./components/FileBrowserOptionsSection";
import { useSelector } from "@xstate/store/react";

export const thickness = 32;

function getIcon(name: string) {
  if (name === "favorites") return HeartIcon;
  if (name === "recents") return ClockIcon;
  if (name === "tags") return TagIcon;
  if (name === "options") return CogIcon;
  if (name === "preview") return EyeIcon;
  return FoldersIcon;
}

function SimpleHeader({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold flex-shrink-0">{children}</h4>;
}

function getTabBarComponent(name: string) {
  if (!name) return;
  if (name === "favorites") return <SimpleHeader>Favorites</SimpleHeader>;
  if (name === "recents") return <SimpleHeader>Recents</SimpleHeader>;
  if (name === "tags") return <SimpleHeader>Tags</SimpleHeader>;
  if (name === "options")
    return (
      <div className="py-1">
        <FileBrowserOptionsSection />
      </div>
    );
  if (name === "preview") return <SimpleHeader>Preview</SimpleHeader>;
  if (name.startsWith("dir-")) {
    // const directoryId = name.replace("dir-", "") as DirectoryId;
    // return <FileBrowserNavigationAndInputSection directoryId={directoryId} />;
    return undefined;
  }

  return "todo";
}

function DirectoryTabLabel({ directoryId }: { directoryId: DirectoryId }) {
  const directory = useSelector(directoryStore, selectDirectory(directoryId));

  if (directory.type !== "path") return null;

  return (
    <span className="text-xs truncate max-w-[200px]">{directory.fullPath}</span>
  );
}

export const tabBarConfig: () => TabsBarConfig = () => ({
  render({ tabs, onTab, action }) {
    return (
      <div className="flex justify-between items-center group relative z-100 h-[32px]">
        <div className="flex items-center w-full">
          <div className="flex items-center overflow-x-auto">
            {tabs.map((tab, i) => {
              const tabStr = tab as string;
              const Icon = getIcon(tabStr);
              const isActive = tabs.length > 1 && i === onTab;
              const isDirectory = tabStr.startsWith("dir-");
              const directoryId = isDirectory
                ? (tabStr.replace("dir-", "") as DirectoryId)
                : null;

              return (
                <DraggableTitle
                  className={clsx(
                    "h-[32px] cursor-move select-none flex items-center justify-center flex-shrink-0",
                    isDirectory ? "min-w-fit" : "aspect-square",
                    isActive && "bg-base-300",
                  )}
                  name={tab}
                  key={tab}
                  onClick={() => action.switchTab(i)}
                >
                  {isDirectory && directoryId ? (
                    <button className="btn btn-ghost btn-sm flex items-center gap-1 rounded-none">
                      <Icon className="size-4 flex-shrink-0" />
                      {isDirectory && directoryId && (
                        <DirectoryTabLabel directoryId={directoryId} />
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center px-1">
                      <Icon className="size-4 flex-shrink-0" />
                    </div>
                  )}
                </DraggableTitle>
              );
            })}
          </div>
          {getTabBarComponent(tabs[onTab] as string)}
        </div>
        <Button
          className="btn btn-xs btn-ghost btn-info hidden group-hover:block absolute right-0"
          onClick={() => action.closeTab(onTab)}
          icon={XIcon}
        ></Button>
      </div>
    );
  },
  thickness,
  position: "top",
  preBox: {
    isRow: false,
    isReverse: false,
  },
});

export const stretchBar: StretchBarConfig = {
  className: "left-stretch-bar",
  style: (isRow) => ({ cursor: isRow ? "ew-resize" : "ns-resize" }),
  position: "previous",
};

export const theme = () => ({
  tabBar: tabBarConfig(),
  stretchBar,
});
