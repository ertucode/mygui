import { createStore } from "@xstate/store";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { RenameDialog } from "./components/RenameDialog";
import { NewItemDialog } from "./components/NewItemDialog";
import { FilePlusIcon, PencilIcon } from "lucide-react";
import { useRef, useEffect } from "react";
import { DialogForItem } from "@/lib/hooks/useDialogForItem";

// Define the dialog types that can be opened
export type DialogType = "rename" | "newItem";

// Define the metadata each dialog requires
export type DialogMetadata = {
  rename: GetFilesAndFoldersInDirectoryItem;
  newItem: GetFilesAndFoldersInDirectoryItem | {};
};

// Store context - only one dialog can be open at a time
type DialogStoreContext = {
  openDialog: DialogType | null;
  metadata: DialogMetadata[DialogType] | null;
};

// Create the initial context
const initialContext: DialogStoreContext = {
  openDialog: null,
  metadata: null,
};

// Create the store
export const dialogStore = createStore({
  context: initialContext,
  on: {
    openDialog: (
      _context: DialogStoreContext,
      event: {
        dialogType: DialogType;
        metadata: DialogMetadata[DialogType];
      },
    ) => ({
      openDialog: event.dialogType,
      metadata: event.metadata,
    }),

    closeDialog: () => initialContext,
  },
});

// Selector functions
export const selectOpenDialog = (state: ReturnType<typeof dialogStore.get>) =>
  state.context.openDialog;

export const selectDialogMetadata = (
  state: ReturnType<typeof dialogStore.get>,
) => state.context.metadata;

// Static helper functions for opening dialogs
export const dialogActions = {
  open: <T extends DialogType>(dialogType: T, metadata: DialogMetadata[T]) => {
    dialogStore.send({
      type: "openDialog",
      dialogType,
      metadata,
    });
  },
  close: () => {
    dialogStore.send({ type: "closeDialog" });
  },
};

// Dialog definitions
const dialogDefinitions = [
  {
    type: "rename" as const,
    component: RenameDialog,
    icon: PencilIcon,
    title: "Rename",
  },
  {
    type: "newItem" as const,
    component: NewItemDialog,
    icon: FilePlusIcon,
    title: "New File or Folder",
  },
] as const;

// Hook to render dialogs
export function useDialogStoreRenderer() {
  const refs = useRef(
    new Map<DialogType, DialogForItem<GetFilesAndFoldersInDirectoryItem> | null>(),
  );

  // Subscribe to store and open the appropriate dialog
  useEffect(() => {
    const subscription = dialogStore.subscribe((state) => {
      const { openDialog, metadata } = state.context;
      
      if (openDialog && metadata) {
        const ref = refs.current.get(openDialog);
        if (ref) {
          ref.show({ item: metadata as GetFilesAndFoldersInDirectoryItem });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const RenderOutside = (
    <>
      {dialogDefinitions.map((dialog) => {
        const Component = dialog.component;
        return (
          <Component
            key={dialog.type}
            ref={(ref) => {
              refs.current.set(dialog.type, ref);
            }}
          />
        );
      })}
    </>
  );

  return { RenderOutside, dialogDefinitions };
}
