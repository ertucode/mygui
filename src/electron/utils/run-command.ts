import { getServerConfig } from "../server-config.js";
import { exec } from "child_process";

export async function runCommand(opts: { name: string; filePath: string }) {
  const { name, filePath } = opts;
  const config = await getServerConfig();
  const script = config.commands?.find((s) => s.name === name);
  if (!script) {
    console.error(`Script ${name} not found in config`);
    return;
  }

  const command = script.command.replace("{{path}}", filePath);
  return new Promise<void>((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running script ${name}:`, error);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`Error running script ${name}:`, stderr);
        reject(stderr);
        return;
      }
      console.log(`Script ${name} ran successfully:`, stdout);
      resolve();
    });
  });
}
