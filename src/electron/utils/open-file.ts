import { exec } from "child_process";
import { platform } from "os";
import { expandHome } from "./expand-home.js";
import { ShellHelpers } from "./ShellHelpers.js";

export function openFile(path: string) {
  const cmd = getCommand(expandHome(path));

  if (!cmd) return Promise.reject(new Error("Unsupported platform"));

  return new Promise<void>((resolve, reject) => {
    exec(cmd, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getCommand(path: string) {
  const p = platform();

  if (p === "darwin") return `open ${ShellHelpers.escape(path)}`;
  if (p === "win32") return `start "" ${ShellHelpers.escape(path)}`;
  if (p === "linux") return `xdg-open ${ShellHelpers.escape(path)}`;

  return "";
}
