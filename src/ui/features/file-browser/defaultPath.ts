import { getWindowElectron } from "@/getWindowElectron";
import z from "zod";
import { createLocalStoragePersistence } from "./utils/localStorage";
import type { DirectoryInfo } from "./directory";

const startingDirectory = getWindowElectron().getStartingDirectory();

const defaultPathPersistence = createLocalStoragePersistence(
  "path",
  z.string(),
);

export let defaultPath =
  startingDirectory ?? defaultPathPersistence.load("~/dev/");

function getDirectoryInfo(dir: string): DirectoryInfo {
  const idx = dir.indexOf("/");
  if (idx === -1) throw new Error("Invalid directory name");
  return { type: "path", fullPath: dir };
}
export const initialDirectoryInfo = getDirectoryInfo(defaultPath);

export function setDefaultPath(path: string) {
  defaultPath = path;
  defaultPathPersistence.save(path);
}
