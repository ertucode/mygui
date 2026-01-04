import { createFormDialog } from "@/lib/libs/form/createFormDialog";
import { ImageIcon } from "lucide-react";
import z from "zod";
import { directoryHelpers, directoryStore } from "../directoryStore/directory";

export const CreateImageDialog = createFormDialog<
  {},
  { name: string }
>({
  schema: z.object({
    name: z.string().min(1, "Name is required"),
  }),
  action: (body, _) =>
    directoryHelpers.createImageFromClipboard(
      body.name,
      directoryStore.getSnapshot().context.activeDirectoryId,
    ),
  getConfigs: () => [
    {
      field: "name",
      label: "Image file name (e.g., screenshot.png)",
      type: "input",
    },
  ],
  getFormParams: () => ({
    defaultValues: {
      name: "image.png",
    },
  }),
  getTexts: () => ({
    title: "Create Image from Clipboard",
    buttonLabel: "Create",
    buttonIcon: ImageIcon,
  }),
});
