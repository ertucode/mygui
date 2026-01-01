import { Ref } from "react";
import { useDialogStoreDialog } from "../dialogStore";
import { DialogForItem } from "@/lib/hooks/useDialogForItem";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { Dialog } from "@/lib/components/dialog";
import { Button } from "@/lib/components/button";
import { SaveIcon, TrashIcon, PencilIcon } from "lucide-react";

type SavePreviewDialogMetadata = {
  deletions: GetFilesAndFoldersInDirectoryItem[];
  renames: { item: GetFilesAndFoldersInDirectoryItem; newName: string }[];
  onConfirm: () => void;
  onCancel: () => void;
};

export const SavePreviewDialog = ({
  ref,
}: {
  ref: Ref<DialogForItem<SavePreviewDialogMetadata>>;
}) => {
  const { item, dialogOpen, onClose } =
    useDialogStoreDialog<SavePreviewDialogMetadata>(ref);

  if (!dialogOpen || !item) return null;

  const { deletions, renames, onConfirm, onCancel } = item;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  return (
    <Dialog
      onClose={handleCancel}
      title="Save Changes"
      style={{ width: "600px", maxWidth: "95vw" }}
      footer={
        <>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleConfirm} className="btn-primary">
            <SaveIcon className="w-4 h-4 mr-2" />
            Confirm Changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm opacity-70">
          Review your changes before saving to the file system.
        </p>

        {deletions.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold flex items-center gap-2 text-error">
              <TrashIcon className="w-4 h-4" /> Deletions ({deletions.length})
            </h3>
            <div className="bg-base-200 rounded p-2 text-sm max-h-40 overflow-y-auto">
              {deletions.map((d) => (
                <div key={d.fullPath} className="text-error opacity-80">
                  - {d.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {renames.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold flex items-center gap-2 text-warning">
              <PencilIcon className="w-4 h-4" /> Renames ({renames.length})
            </h3>
            <div className="bg-base-200 rounded p-2 text-sm max-h-40 overflow-y-auto">
              {renames.map((r) => (
                <div key={r.item.fullPath} className="flex gap-2">
                  <span className="opacity-60">{r.item.name}</span>
                  <span>→</span>
                  <span className="font-semibold text-warning">{r.newName}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
