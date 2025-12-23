import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "../functions/clsx";

export function Dialog({
  title,
  children,
  onClose,
  className,
  style,
  footer,
}: {
  title?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
  footer?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (children) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [children]);

  useEffect(() => {
    if (!dialogRef.current) return;
    const listener = (e: Event) => {
      if (e.target === dialogRef.current) {
        onClose?.();
      }
    };
    document.addEventListener("click", listener);
    return () => {
      document.removeEventListener("click", listener);
    };
  }, [onClose, dialogRef.current]);

  return (
    <dialog className="modal" ref={dialogRef} onClose={onClose}>
      <div
        className={cn(
          "modal-box max-w-[80vw] max-h-[80vh] flex flex-col gap-3",
          className,
        )}
        style={style}
      >
        {title && <h3 className="font-bold text-lg flex-shrink-0">{title}</h3>}
        <div className="flex-1 min-h-0">{children}</div>
        <div className="self-end flex-shrink-0 flex gap-3 items-center">
          {footer && footer}
        </div>
      </div>
    </dialog>
  );
}
