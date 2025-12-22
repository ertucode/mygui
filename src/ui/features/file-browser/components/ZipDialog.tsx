import { createFormDialog } from "@/lib/libs/form/createFormDialog";
import { FileArchiveIcon } from "lucide-react";
import z from "zod";
import { directoryHelpers, directoryStore } from "../directoryStore/directory";
import { GenericError } from "@common/GenericError";

type ZipDialogItem = { filePaths: string[]; suggestedName?: string };

export const ZipDialog = createFormDialog<
  ZipDialogItem,
  { zipName: string },
  {}
>({
  schema: z.object({
    zipName: z.string().min(1, "Zip file name is required"),
  }),
  action: (body, _, item) => {
    if (!item?.filePaths || item.filePaths.length === 0) {
      return Promise.resolve(
        GenericError.Message("No files selected for zipping"),
      );
    }
    return directoryHelpers.zipFiles(
      item.filePaths,
      body.zipName,
      directoryStore.getSnapshot().context.activeDirectoryId,
    );
  },
  getConfigs: () => [
    {
      field: "zipName",
      label: "Zip file name",
      type: "input",
    },
  ],
  getFormParams: (item) => ({
    values: {
      zipName: item?.suggestedName || "archive.zip",
    },
  }),
  getTexts: () => ({
    title: "Create Zip Archive",
    buttonLabel: "Create",
    buttonIcon: FileArchiveIcon,
  }),
});
