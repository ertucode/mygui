import { createFormDialog } from "@/lib/libs/form/createFormDialog";
import z from "zod";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { PencilIcon } from "lucide-react";
import { directoryHelpers, directoryStore } from "../directoryStore/directory";

export const RenameDialog = createFormDialog<
  GetFilesAndFoldersInDirectoryItem,
  { name: string },
  {}
>({
  schema: z.object({
    name: z.string(),
  }),
  action: (body, _, item) =>
    directoryHelpers.renameItem(
      item,
      body.name,
      directoryStore.getSnapshot().context.activeDirectoryId,
    ),
  getConfigs: () => [
    {
      field: "name",
      label: "Name",
      type: "input",
    },
  ],
  getFormParams: (item) => ({
    values: {
      name: item?.name!,
    },
  }),
  getTexts: () => ({
    title: "Rename",
    buttonLabel: "Rename",
    buttonIcon: PencilIcon,
  }),
});
