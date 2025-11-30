import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ContextMenuProps<T> = {
  children: React.ReactNode;
  menu: ReturnType<typeof useContextMenu<T>>;
};

export function ContextMenu<T>({ children, menu }: ContextMenuProps<T>) {
  return (
    <div
      ref={menu.ref}
      className="fixed z-50"
      style={{ top: menu.position?.y, left: menu.position?.x }}
    >
      <ContextMenuContext.Provider value={menu}>
        {children}
      </ContextMenuContext.Provider>
    </div>
  );
}

export type ContextMenuItem = {
  view: React.ReactNode;
  onClick: () => void;
};

export type ContextMenuListProps = {
  items: (ContextMenuItem | false | null | undefined)[];
};

export function ContextMenuList({ items }: ContextMenuListProps) {
  const menu = useContext(ContextMenuContext);
  return (
    <ul className="menu bg-base-200 rounded-box w-56">
      {items
        .filter((i) => !!i)
        .map((item, idx) => {
          return (
            <li key={idx}>
              <a
                onClick={() => {
                  item.onClick();
                  menu.close();
                }}
              >
                {item.view}
              </a>
            </li>
          );
        })}
    </ul>
  );
}

type ContextMenuState<T> = {
  position: { x: number; y: number };
  item: T;
  element: HTMLElement;
};
export function useContextMenu<T>() {
  const [state, setState] = useState<ContextMenuState<T> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        !state?.element.contains(e.target as Node) &&
        !ref.current?.contains(e.target as Node)
      ) {
        setState(null);
      }
    };

    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);

    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [state, ref]);

  return {
    isOpen: state != null,
    onRightClick: (e: React.MouseEvent, item: T) => {
      e.preventDefault();
      setState({
        position: { x: e.clientX, y: e.clientY },
        item,
        element: e.currentTarget as HTMLElement,
      });
    },
    item: state?.item,
    position: state?.position,
    ref,
    close: () => setState(null),
  };
}

const ContextMenuContext = createContext<
  ReturnType<typeof useContextMenu<any>>
>({} as ReturnType<typeof useContextMenu>);
