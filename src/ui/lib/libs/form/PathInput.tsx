import { directoryHelpers } from "@/features/file-browser/directoryStore/directory";
import { getWindowElectron } from "@/getWindowElectron";
import { Button } from "@/lib/components/button";
import { FileSearchIcon } from "lucide-react";
import React, { useState } from "react";

// TODO: add slash support for autocomplete
export function PathInput(props: React.ComponentProps<"input">) {
  const [value, setValue] = useState(props.value || "");

  async function pickFile() {
    const result = await getWindowElectron().openSelectAppWindow(
      directoryHelpers.getOpenedPath(undefined) || "/",
    );
    if (result) {
      setValue(result);
    }
  }

  return (
    <div className="flex gap-2">
      <input
        {...props}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
      />
      <Button icon={FileSearchIcon} onClick={pickFile} type="button"></Button>
    </div>
  );
}
