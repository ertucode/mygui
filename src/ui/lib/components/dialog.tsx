import { type ReactNode, useEffect, useRef } from "react";

export function Dialog({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
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
    <dialog className="modal" ref={dialogRef}>
      <div
        className="modal-box"
        style={{
          maxWidth: "80vw",
          maxHeight: "80vh",
        }}
      >
        {children}
      </div>
    </dialog>
  );
}
