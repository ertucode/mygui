import { useCallback, useEffect, useRef, useState } from "react";

type ResizeDirection = "left" | "right";

interface UseResizablePanelOptions {
  storageKey: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  direction: ResizeDirection;
}

export function useResizablePanel({
  storageKey,
  defaultWidth,
  minWidth = 100,
  maxWidth = 600,
  direction,
}: UseResizablePanelOptions) {
  const [width, setWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = Number(stored);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error reading from localStorage:", e);
    }
    return defaultWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const currentWidth = useRef(width);

  // Keep currentWidth ref in sync with state
  useEffect(() => {
    currentWidth.current = width;
  }, [width]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    setIsDragging(true);
    startX.current = e.clientX;
    startWidth.current = currentWidth.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;

      const delta = e.clientX - startX.current;
      // "left" = panel is on the left, handle is on the right, drag right to grow
      // "right" = panel is on the right, handle is on the left, drag left to grow
      const newWidth =
        direction === "left"
          ? startWidth.current + delta
          : startWidth.current - delta;

      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(clampedWidth);
      currentWidth.current = clampedWidth;
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        setIsDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        // Save to localStorage on mouse up
        try {
          localStorage.setItem(storageKey, String(currentWidth.current));
        } catch (e) {
          console.error("Error saving to localStorage:", e);
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [direction, minWidth, maxWidth, storageKey]);

  return {
    width,
    isDragging,
    handleMouseDown,
  };
}

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  direction: ResizeDirection;
  className?: string;
}

export function ResizeHandle({
  onMouseDown,
  direction,
  className = "",
}: ResizeHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`
        w-1 flex-shrink-0 cursor-col-resize 
        hover:bg-base-300 active:bg-primary/50
        transition-colors duration-150
        ${direction === "left" ? "mr-2" : "ml-2"}
        ${className}
      `}
      style={{ minWidth: "4px" }}
    />
  );
}
