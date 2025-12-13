import { getWindowElectron } from "@/getWindowElectron";
import z from "zod";
import { createLocalStoragePersistence } from "./utils/localStorage";

const startingDirectory = getWindowElectron().getStartingDirectory();

const defaultPathPersistence = createLocalStoragePersistence(
  "path",
  z.string(),
);

export let defaultPath =
  startingDirectory ?? defaultPathPersistence.load("~/dev/");

export function setDefaultPath(path: string) {
  defaultPath = path;
  defaultPathPersistence.save(path);
}
