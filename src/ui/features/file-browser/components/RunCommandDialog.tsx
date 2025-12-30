import { Ref } from "react";
import { useDialogStoreDialog } from "../dialogStore";
import { DialogForItem } from "@/lib/hooks/useDialogForItem";
import { CommandMetadata } from "@common/Command";
import { FormDialogForm } from "@/lib/libs/form/createFormDialog";
import z from "zod";
import { TerminalIcon } from "lucide-react";
import { CommandHelpers } from "../CommandHelpers";
import { FormFieldConfig } from "@/lib/libs/form/FormFieldFromConfig";

type Item = { command: CommandMetadata; fullPath: string };

export const RunCommandDialog = ({
  ref,
}: {
  ref: Ref<DialogForItem<Item>>;
}) => {
  const dialog = useDialogStoreDialog<Item>(ref);

  const parameters = dialog.item?.command.parameters;

  if (!parameters?.length) return undefined;

  return (
    <FormDialogForm
      dialog={dialog}
      schema={z.record(z.string(), z.string())}
      action={(body, item) =>
        CommandHelpers.runCommandWithParameters(
          item.command,
          item.fullPath,
          body,
        )
      }
      getConfigs={() =>
        parameters.map((p): FormFieldConfig<string> => {
          const label = p.label || p.name;
          if (p.type === "string") {
            return {
              field: p.name,
              label,
              type: "input",
            };
          }
          if (p.type === "path") {
            return {
              field: p.name,
              label,
              type: "path",
            };
          }
          return {
            field: p.name,
            label,
            type: "select",
            options: p.type === "select" ? p.options : [],
          };
        })
      }
      getFormParams={(_) => ({
        defaultValues: {},
      })}
      getTexts={(item) => ({
        title: item ? `Run Command: ${item.command}` : "Run Command",
        buttonLabel: "Run Command",
        buttonIcon: TerminalIcon,
      })}
    />
  );
};
