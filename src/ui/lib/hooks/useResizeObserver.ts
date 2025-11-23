import { useState, useCallback, useEffect } from "react";

export function useResizeObserver() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // This ref callback is called whenever the element changes
  const ref = useCallback((node: HTMLElement | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;
    let el = element;

    while (el.offsetWidth === 0) {
      if (el.offsetWidth === 0) {
        el = el.parentElement!;
      }
    }
    setSize({
      width: el.offsetWidth * 0.9,
      height: el.offsetHeight,
    });

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setSize({
          width: entry.contentRect.width * 0.9,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [element]); // re-run effect if element changes

  return { ref, size };
}
