import { useState, useRef, useEffect } from "react";
import { Dialog } from "@/lib/components/dialog";

type NewItemDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<{ success: boolean; error?: string }>;
};

export function NewItemDialog({
  isOpen,
  onClose,
  onSubmit,
}: NewItemDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setError(null);
      // Focus input when dialog opens
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onSubmit(name.trim());
      if (!result.success) {
        setError(result.error || "Failed to create item");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFolder = name.endsWith("/");

  if (!isOpen) return null;

  return (
    <Dialog onClose={onClose} className="w-96">
      <form onSubmit={handleSubmit}>
        <h3 className="font-bold text-lg mb-4">Create New Item</h3>
        <div className="form-control flex flex-col gap-3">
          <label className="label">
            <span className="label-text">
              Name {isFolder ? "(folder)" : "(file)"}
            </span>
          </label>
          <input
            ref={inputRef}
            type="text"
            className={`input input-bordered w-full ${error ? "input-error" : ""}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onClose();
              }
            }}
            disabled={isSubmitting}
          />
          {error ? (
            <label className="label">
              <span className="label-text-alt text-error">{error}</span>
            </label>
          ) : (
            <label className="label">
              <span className="label-text-alt text-base-content/60">
                End with "/" to create a folder
              </span>
            </label>
          )}
        </div>
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              `Create ${isFolder ? "Folder" : "File"}`
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
