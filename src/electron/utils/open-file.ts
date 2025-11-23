import { exec } from "child_process";
import { platform } from "os";
import { expandHome } from "./expand-home.js";

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

  if (p === "darwin") return `open "${path}"`;
  if (p === "win32") return `start "" "${path}"`;
  if (p === "linux") return `xdg-open "${path}"`;

  return "";
}
