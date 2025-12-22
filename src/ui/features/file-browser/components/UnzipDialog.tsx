import { createFormDialog } from "@/lib/libs/form/createFormDialog";
import { FolderInputIcon } from "lucide-react";
import z from "zod";
import { directoryHelpers, directoryStore } from "../directoryStore/directory";
import { GenericError } from "@common/GenericError";

type UnzipDialogItem = { zipFilePath: string; suggestedName: string };

export const UnzipDialog = createFormDialog<
  UnzipDialogItem,
  { folderName: string },
  {}
>({
  schema: z.object({
    folderName: z.string().min(1, "Folder name is required"),
  }),
  action: (body, _, item) => {
    if (!item?.zipFilePath) {
      return Promise.resolve(GenericError.Message("No zip file selected"));
    }
    return directoryHelpers.unzipFile(
      item.zipFilePath,
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
    title: "Extract Zip Archive",
    buttonLabel: "Extract",
    buttonIcon: FolderInputIcon,
  }),
});
