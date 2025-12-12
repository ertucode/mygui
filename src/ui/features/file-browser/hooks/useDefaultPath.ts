import { getWindowElectron } from "@/getWindowElectron";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import z from "zod";

const startingDirectory = getWindowElectron().getStartingDirectory();

export function useDefaultPath() {
  const [path, setPath] = useLocalStorage<string>(
    "path",
    z.string(),
    "~/Downloads/",
    startingDirectory,
  );
  return { path, setPath };
}
