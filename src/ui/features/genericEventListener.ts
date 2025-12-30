import { getWindowElectron } from "@/getWindowElectron";
import { directoryHelpers } from "./file-browser/directoryStore/directoryHelpers";

getWindowElectron().onGenericEvent((e) => {
  if (e.type === "reload-path") {
    directoryHelpers.checkAndReloadDirectories(e.path, undefined);
  } else {
    const _exhaustiveCheck: never = e?.type;
    return _exhaustiveCheck;
  }
});
