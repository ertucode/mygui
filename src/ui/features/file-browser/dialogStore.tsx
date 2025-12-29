import { createStore } from "@xstate/store";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { RenameDialog } from "./components/RenameDialog";
import { BatchRenameDialog } from "./components/BatchRenameDialog";
import { NewItemDialog } from "./components/NewItemDialog";
import { AssignTagsDialog } from "./components/AssignTagsDialog";
import { MultiFileTagsDialog } from "./components/MultiFileTagsDialog";
import { FinderDialog, FinderTab } from "./components/FinderDialog";
import { ArchiveDialog } from "./components/ArchiveDialog";
import { UnarchiveDialog } from "./components/UnarchiveDialog";
import { CommandPalette } from "./components/CommandPalette";
import { CustomLayoutsDialog } from "./components/CustomLayoutsDialog";
import { PasteConflictDialog } from "./components/PasteConflictDialog";
import { FilePlusIcon, PencilIcon, TagIcon, SearchIcon, FileArchiveIcon, FolderInputIcon, KeyboardIcon, PencilLineIcon, LayoutGridIcon, FileWarningIcon } from "lucide-react";
import { useRef, useEffect, Ref } from "react";
import { DialogForItem, useDialogForItem } from "@/lib/hooks/useDialogForItem";
import { useSelector } from "@xstate/store/react";

// Define the dialog types that can be opened
export type DialogType =
  | "rename"
  | "batchRename"
  | "newItem"
  | "assignTags"
  | "multiFileTags"
  | "finder"
  | "archive"
  | "unarchive"
  | "commandPalette"
  | "customLayouts"
  | "pasteConflict";

// Define the metadata each dialog requires
export type DialogMetadata = {
  rename: GetFilesAndFoldersInDirectoryItem;
  batchRename: GetFilesAndFoldersInDirectoryItem[];
  newItem: GetFilesAndFoldersInDirectoryItem | {};
  assignTags: string;
  multiFileTags: string[];
  finder: { initialTab?: FinderTab };
  archive: { filePaths: string[]; suggestedName?: string };
  unarchive: { archiveFilePath: string; suggestedName: string; archiveType: string };
  commandPalette: {};
  customLayouts: {};
  pasteConflict: {
    conflictData: import("@common/Contracts").PasteConflictData;
    destinationDir: string;
    onResolve: (resolution: import("@common/Contracts").ConflictResolution) => void;
    onCancel: () => void;
  };
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
    type: "batchRename" as const,
    component: BatchRenameDialog,
    icon: PencilLineIcon,
    title: "Batch Rename",
  },
  {
    type: "newItem" as const,
    component: NewItemDialog,
    icon: FilePlusIcon,
    title: "New File or Folder",
  },
  {
    type: "assignTags" as const,
    component: AssignTagsDialog,
    icon: TagIcon,
    title: "Assign Tags",
  },
  {
    type: "multiFileTags" as const,
    component: MultiFileTagsDialog,
    icon: TagIcon,
    title: "Assign Tags (Multiple Files)",
  },
  {
    type: "finder" as const,
    component: FinderDialog,
    icon: SearchIcon,
    title: "Finder",
  },
  {
    type: "archive" as const,
    component: ArchiveDialog,
    icon: FileArchiveIcon,
    title: "Create Archive",
  },
  {
    type: "unarchive" as const,
    component: UnarchiveDialog,
    icon: FolderInputIcon,
    title: "Extract Archive",
  },
  {
    type: "commandPalette" as const,
    component: CommandPalette,
    icon: KeyboardIcon,
    title: "Keyboard Shortcuts",
  },
  {
    type: "customLayouts" as const,
    component: CustomLayoutsDialog,
    icon: LayoutGridIcon,
    title: "Custom Layouts",
  },
  {
    type: "pasteConflict" as const,
    component: PasteConflictDialog,
    icon: FileWarningIcon,
    title: "Paste Conflicts",
  },
] as const;

// Hook to render dialogs
export function useDialogStoreRenderer() {
  const refs = useRef(new Map<DialogType, DialogForItem<any> | null>());

  // Subscribe to store and open the appropriate dialog
  useEffect(() => {
    const subscription = dialogStore.subscribe((state) => {
      const { openDialog, metadata } = state.context;

      if (openDialog && metadata) {
        const ref = refs.current.get(openDialog);
        if (ref) {
          ref.show({ item: metadata });
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
            ref={(ref: DialogForItem<any> | null) => {
              refs.current.set(dialog.type, ref);
            }}
          />
        );
      })}
    </>
  );

  return { RenderOutside, dialogDefinitions };
}

export function useIsDialogOpen() {
  return !!useSelector(dialogStore, (s) => s.context.openDialog);
}

export function useDialogStoreDialog<TItem>(ref?: Ref<DialogForItem<TItem>>) {
  const dialogs = useDialogForItem<TItem>(ref);

  const onClose = () => {
    dialogs.setDialogOpen(false);
    dialogStore.trigger.closeDialog();
  };

  return {
    ...dialogs,
    onClose,
  };
}
