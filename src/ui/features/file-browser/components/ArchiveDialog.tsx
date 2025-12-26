import { createFormDialog } from "@/lib/libs/form/createFormDialog";
import { FileArchiveIcon } from "lucide-react";
import z from "zod";
import { directoryHelpers, directoryStore } from "../directoryStore/directory";
import { GenericError } from "@common/GenericError";
import { ArchiveTypes } from "@common/ArchiveTypes";

type ArchiveDialogItem = { filePaths: string[]; suggestedName?: string };

export const ArchiveDialog = createFormDialog<
  ArchiveDialogItem,
  { archiveName: string; archiveType: string },
  {}
>({
  schema: z.object({
    archiveName: z.string().min(1, "Archive name is required"),
    archiveType: z.string(),
  }),
  action: (body, _, item) => {
    if (!item?.filePaths || item.filePaths.length === 0) {
      return Promise.resolve(
        GenericError.Message("No files selected for archiving"),
      );
    }
    return directoryHelpers.createArchive(
      item.filePaths,
      body.archiveName,
      body.archiveType as ArchiveTypes.ArchiveType,
      directoryStore.getSnapshot().context.activeDirectoryId,
    );
  },
  getConfigs: () => [
    {
      field: "archiveName",
      label: "Archive name",
      type: "input",
    },
    {
      field: "archiveType",
      label: "Archive type",
      type: "select",
      options: ArchiveTypes.Types.map((type) => ({
        value: type.extension,
        label: type.label,
      })),
    },
  ],
  getFormParams: (item) => ({
    values: {
      archiveName: item?.suggestedName || "archive",
      archiveType: ".zip",
    },
  }),
  getTexts: () => ({
    title: "Create Archive",
    buttonLabel: "Create",
    buttonIcon: FileArchiveIcon,
  }),
});
