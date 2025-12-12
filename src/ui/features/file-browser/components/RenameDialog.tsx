import { createFormDialog } from "@/lib/libs/form/createFormDialog";
import z from "zod";
import { ResultHandlerResult } from "@/lib/hooks/useDefaultResultHandler";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { PencilIcon } from "lucide-react";

export const RenameDialog = createFormDialog<
  GetFilesAndFoldersInDirectoryItem,
  { name: string },
  {
    onSubmit: (newName: string) => Promise<ResultHandlerResult>;
  }
>({
  schema: z.object({
    name: z.string(),
  }),
  action: (body, props) => props.onSubmit(body.name),
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
