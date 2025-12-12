import { WindowElectron } from "@common/Contracts";

export function getWindowElectron() {
  return (window as any).electron as WindowElectron;
}
