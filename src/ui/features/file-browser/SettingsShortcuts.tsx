import { useShortcuts } from "@/lib/hooks/useShortcuts";
import { fileBrowserSettingsStore } from "./settings";

export function SettingsShortcuts() {
  useShortcuts([
    {
      key: { key: "." },
      handler: () => {
        fileBrowserSettingsStore.trigger.toggleShowDotFiles();
      },
      label: "Toggle show dot files",
    },
  ]);
  return undefined;
}
