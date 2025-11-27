import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import z from "zod";

export function useDefaultPath() {
  const [path, setPath] = useLocalStorage<string>("path", z.string(), "~/");
  return { path, setPath };
}
