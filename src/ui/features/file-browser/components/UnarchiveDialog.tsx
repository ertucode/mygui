import { createFormDialog } from "@/lib/libs/form/createFormDialog";
import { FolderInputIcon } from "lucide-react";
import z from "zod";
import { directoryHelpers, directoryStore } from "../directoryStore/directory";
import { GenericError } from "@common/GenericError";

type UnarchiveDialogItem = {
  archiveFilePath: string;
  suggestedName: string;
  archiveType: string;
};

export const UnarchiveDialog = createFormDialog<
  UnarchiveDialogItem,
  { folderName: string },
  {}
>({
  schema: z.object({
    folderName: z.string().min(1, "Folder name is required"),
  }),
  action: async (body, _, item) => {
    if (!item?.archiveFilePath) {
      return Promise.resolve(GenericError.Message("No archive file selected"));
    }
    const result = await directoryHelpers.extractArchive(
      item.archiveFilePath,
      body.folderName,
      item.archiveType,
      directoryStore.getSnapshot().context.activeDirectoryId,
    );
    if ("success" in result) return { noResult: true };
    return result;
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
