import { Button } from "@/lib/components/button";
import {
  TabSetNode,
  BorderNode,
  ITabSetRenderValues,
  Actions,
} from "flexlayout-react";
import { PlusIcon, Maximize2Icon } from "lucide-react";
import { layoutModel } from "../file-browser/initializeDirectory";
import { LayoutHelpers } from "../file-browser/utils/LayoutHelpers";
import { directoryHelpers } from "../file-browser/directoryStore/directoryHelpers";

export const onRenderTabSet = (
  tabSetNode: TabSetNode | BorderNode,
  renderValues: ITabSetRenderValues,
) => {
  renderValues.buttons = [];

  if (!LayoutHelpers.isDirectoryTabSet(tabSetNode)) return;

  renderValues.buttons.push(
    <Button
      key="add-directory"
      icon={PlusIcon}
      className="btn-ghost btn-sm btn-square rounded-none directory-tabset-marker"
      title="Add New Directory"
      onClick={() => {
        directoryHelpers.createDirectory({
          tabId: tabSetNode.getId(),
        });
      }}
    />,
  );

  renderValues.buttons.push(
    <Button
      key="maximize-thing"
      icon={Maximize2Icon}
      className="btn-ghost btn-sm btn-square rounded-none"
      title="Maximize Thing"
      onClick={() => {
        layoutModel.doAction(Actions.maximizeToggle(tabSetNode.getId()));
      }}
    />,
  );
};
