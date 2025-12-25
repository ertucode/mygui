import { createFormDialog } from "@/lib/libs/form/createFormDialog";
import { FolderInputIcon } from "lucide-react";
import z from "zod";
import { directoryHelpers, directoryStore } from "../directoryStore/directory";
import { GenericError } from "@common/GenericError";

type ExtractArchiveDialogItem = { archivePath: string; suggestedName: string };

export const ExtractArchiveDialog = createFormDialog<
  ExtractArchiveDialogItem,
  { folderName: string },
  {}
>({
  schema: z.object({
    folderName: z.string().min(1, "Folder name is required"),
  }),
  action: (body, _, item) => {
    if (!item?.archivePath) {
      return Promise.resolve(GenericError.Message("No archive file selected"));
    }
    return directoryHelpers.extractArchive(
      item.archivePath,
      body.folderName,
      directoryStore.getSnapshot().context.activeDirectoryId,
    );
  },
  getConfigs: () => [
    {
      field: "folderName",
      label: "Extract to folder",
      type: "input",
    },
  ],
  getFormParams: (item) => ({
    values: {
      folderName: item?.suggestedName || "extracted",
    },
  }),
  getTexts: () => ({
    title: "Extract Archive",
    buttonLabel: "Extract",
    buttonIcon: FolderInputIcon,
  }),
});
