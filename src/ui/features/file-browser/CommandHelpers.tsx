import { getWindowElectron, windowArgs } from "@/getWindowElectron";
import { toast } from "@/lib/components/toast";
import { CommandMetadata } from "@common/Command";
import { dialogStore } from "./dialogStore";
import { PathHelpers } from "@common/PathHelpers";
import { GenericError } from "@common/GenericError";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";

export namespace CommandHelpers {
  export async function runCommand(
    script: CommandMetadata,
    fullPath: string,
    item: GetFilesAndFoldersInDirectoryItem,
  ) {
    try {
      if (script.parameters?.length) {
        dialogStore.trigger.openDialog({
          dialogType: "runCommand",
          metadata: {
            command: script,
            fullPath: PathHelpers.expandHome(windowArgs.homeDir, fullPath),
            fileType: item.type,
          },
        });
        return;
      }
      await getWindowElectron().runCommand({
        name: script.name,
        filePath: fullPath,
        parameters: [],
      });
    } catch (err: any) {
      toast.show({
        severity: "error",
        message: `Failed to run command: ${err?.message || "Unknown error"}`,
      });
    }
  }

  export async function runCommandWithParameters(
    command: CommandMetadata,
    fullPath: string,
    parameters: Record<string, string>,
  ) {
    try {
      return await getWindowElectron().runCommand({
        name: command.name,
        filePath: fullPath,
        parameters,
      });
    } catch (err: any) {
      toast.show({
        severity: "error",
        message: `Failed to run command: ${err?.message || "Unknown error"}`,
      });
      return GenericError.Unknown(err);
    }
  }
}
