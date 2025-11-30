import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "../functions/clsx";

export function Dialog({
  children,
  onClose,
  className,
}: {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
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
      <div className={cn("modal-box max-w-[80vw] max-h-[80vh]", className)}>
        {children}
      </div>
    </dialog>
  );
}
