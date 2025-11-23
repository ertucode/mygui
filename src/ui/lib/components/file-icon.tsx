import {
  getFileTypeIconProps,
  initializeFileTypeIcons,
} from "@fluentui/react-file-type-icons";
import { Icon } from "@fluentui/react/lib/Icon";

initializeFileTypeIcons();

export function getFileIcon(extension: string) {
  return ({ className }: { className: string }) => {
    return (
      <div className={className}>
        <Icon
          {...getFileTypeIconProps({
            extension: extension.replace(".", ""),
            size: 16,
          })}
        />
      </div>
    );
  };
}
