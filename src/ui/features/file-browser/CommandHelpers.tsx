import { getWindowElectron } from "@/getWindowElectron";
import { toast } from "@/lib/components/toast";
import { CommandMetadata } from "@common/Command";

export namespace CommandHelpers {
  export async function runCommand(script: CommandMetadata, fullPath: string) {
    try {
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
}
