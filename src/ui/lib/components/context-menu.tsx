import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export type ContextMenuProps<T> = {
  children: React.ReactNode;
  menu: ReturnType<typeof useContextMenu<T>>;
};

export function ContextMenu<T>({ children, menu }: ContextMenuProps<T>) {
  const [position, setPosition] = useState(menu.position);
  useLayoutEffect(() => {
    if (!menu || !menu.position || !menu.ref.current) return;

    const dialog = menu.ref.current;
    const { innerWidth, innerHeight } = window;
    const rect = dialog.getBoundingClientRect();

    let x = menu.position.x;
    let y = menu.position.y;

    // Right overflow
    if (x + rect.width > innerWidth) {
      x = innerWidth - rect.width - 8;
    }

    // Bottom overflow
    if (y + rect.height > innerHeight) {
      y = innerHeight - rect.height - 8;
    }

    // Left / Top safety
    x = Math.max(8, x);
    y = Math.max(8, y);

    if (x !== menu.position.x || y !== menu.position.y) {
      setPosition((prev) => (prev ? { ...prev, x, y } : { x, y }));
    } else {
      setPosition(menu.position);
    }
  }, [menu.position]);

  return (
    <div
      ref={menu.ref}
      className="fixed z-50"
      style={{ top: position?.y, left: position?.x }}
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
    <ul className="menu menu-sm bg-base-200 rounded-box w-56">
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

    const keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setState(null);
      }
    };

    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    document.addEventListener("keydown", keydownHandler);

    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("keydown", keydownHandler);
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
