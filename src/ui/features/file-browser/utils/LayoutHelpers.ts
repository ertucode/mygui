import { Node, TabNode, TabSetNode } from "flexlayout-react";
import { layoutModel } from "../initializeDirectory";
import { DirectoryId } from "../directoryStore/DirectoryBase";

export namespace LayoutHelpers {
  export function getActiveTabsetThatHasDirectory() {
    const active = layoutModel.getActiveTabset();
    if (!active) return;

    if (isDirectoryTabSet(active)) return active;
  }

  export function getActiveDirectoryId() {
    const node = layoutModel.getActiveTabset()?.getSelectedNode();
    if (isDirectory(node) && node.getConfig()?.directoryId) {
      return node.getConfig()?.directoryId as DirectoryId;
    }
    return undefined;
  }

  export function isDirectory(node: Node | undefined): node is TabNode {
    return node instanceof TabNode && node.getComponent() === "directory";
  }

  export function isDirectoryStupidTypescript(node: Node | undefined) {
    return node instanceof TabNode && node.getComponent() === "directory";
  }

  export function getDirectoryId(node: TabNode) {
    return node.getConfig()?.directoryId;
  }

  export function getDirectoryIds() {
    const nodes: DirectoryId[] = [];

    layoutModel.visitNodes((node) => {
      if (node instanceof TabNode && node.getComponent() === "directory") {
        if (node.getConfig()?.directoryId) {
          nodes.push(node.getConfig()?.directoryId);
        }
      }
    });

    return nodes;
  }

  export function isDirectoryTabSet(node: Node): node is TabNode {
    const first = node.getChildren()[0];
    if (!first) return false;

    return first instanceof TabNode && first.getComponent() === "directory";
  }

  export function isSelected(node: TabNode) {
    const parent = node.getParent();
    if (parent && parent instanceof TabSetNode) {
      const selectedIndex = parent.getSelected();
      const children = parent.getChildren();
      if (selectedIndex >= 0 && selectedIndex < children.length) {
        return children[selectedIndex] === node;
      }
    }
    return false;
  }

  export function hasSiblings(node: TabNode) {
    const parent = node.getParent();
    if (parent && parent instanceof TabSetNode) {
      return parent.getChildren().length > 1;
    }
    return false;
  }

  export function parentIsActive(node: TabNode) {
    const parent = node.getParent();
    if (parent && parent instanceof TabSetNode) {
      return parent.isActive();
    }
    return false;
  }
}
