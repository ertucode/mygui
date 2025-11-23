import React, { useEffect, useRef, useState } from "react";

export type ContextMenuProps = {
  children: React.ReactNode;
  position?: { x: number; y: number };
  ref: React.Ref<HTMLDivElement>;
};

export function ContextMenu({ children, position, ref }: ContextMenuProps) {
  return (
    <div
      ref={ref}
      className="fixed z-50"
      style={{ top: position?.y, left: position?.x }}
    >
      {children}
    </div>
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
