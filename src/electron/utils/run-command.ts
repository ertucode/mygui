import { homedir } from "os";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { PathHelpers } from "../../common/PathHelpers.js";
import { Result } from "../../common/Result.js";
import { getServerConfig } from "../server-config.js";
import { exec } from "child_process";
import { TaskManager } from "../TaskManager.js";

export async function runCommand(opts: {
  name: string;
  filePath: string;
  parameters: Record<string, string>;
}) {
  const { name, filePath, parameters } = opts;
  const config = await getServerConfig();
  const script = config.commands?.find((s) => s.name === name);
  if (!script) {
    console.error(`Script ${name} not found in config`);
    return GenericError.Message(`Script ${name} not found in config`);
  }

  let command = script.command.replace("{{path}}", filePath);

  if (parameters) {
    for (const [key, value] of Object.entries(parameters)) {
      const parameterDef = script.parameters!.find((p) => p.name === key);
      const val =
        parameterDef?.type === "path"
          ? PathHelpers.expandHome(homedir(), value)
          : value;
      command = command.replaceAll(`{{${key}}}`, val);
    }
  }

  TaskManager.create({
    type: "run-command",
    metadata: {
      command,
      parameters,
      fullPath: filePath,
    },
    progress: 0,
  });

  return new Promise<GenericResult<void>>((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running script ${name}:`, error);
        resolve(GenericError.Unknown(error));
        return;
      }
      if (stderr) {
        console.error(`Error running script ${name}:`, stderr);
        resolve(GenericError.Unknown(stderr));
        return;
      }
      console.log(`Script ${name} ran successfully:`, stdout);
      resolve(Result.Success(undefined));
    });
  });
}
