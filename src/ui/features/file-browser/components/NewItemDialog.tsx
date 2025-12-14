import { createFormDialog } from "@/lib/libs/form/createFormDialog";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { FilePlusIcon } from "lucide-react";
import z from "zod";
import { directoryHelpers, directoryStore } from "../directory";

export const NewItemDialog = createFormDialog<
  GetFilesAndFoldersInDirectoryItem,
  { name: string },
  {}
>({
  schema: z.object({
    name: z.string(),
  }),
  action: (body, _) =>
    directoryHelpers.createNewItem(
      body.name,
      directoryStore.getSnapshot().context.activeDirectoryId,
    ),
  getConfigs: () => [
    {
      field: "name",
      label: 'Name (End with "/" to create a folder)',
      type: "input",
    },
  ],
  getFormParams: (item) => ({
    defaultValues: {
      name: item?.name,
    },
  }),
  getTexts: () => ({
    title: "New File or Folder",
    buttonLabel: "Create",
    buttonIcon: FilePlusIcon,
  }),
});
