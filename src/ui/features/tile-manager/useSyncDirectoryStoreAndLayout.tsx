import React, { useRef, useCallback, useEffect } from "react";
import { Layout, Actions, IJsonTabNode } from "flexlayout-react";
import { directoryStore } from "../file-browser/directoryStore/directory";
import "./FlexLayoutManager.css";
import { layoutModel } from "../file-browser/initializeDirectory";
import { LayoutHelpers } from "../file-browser/utils/LayoutHelpers";

// Component factory function
export const useSyncDirectoryStoreAndLayout = ({
  layoutRef,
}: {
  layoutRef: React.RefObject<Layout | null>;
}) => {
  const isSyncingFromStore = useRef(false); // Prevent feedback loop

  // Save model to localStorage on changes
  const handleModelChange = useCallback(() => {
    // Prevent feedback loop: Don't update directoryStore if we're syncing FROM directoryStore
    if (isSyncingFromStore.current) {
      return;
    }

    const directoryId = LayoutHelpers.getActiveDirectoryId();
    if (!directoryId) return;
    directoryStore.trigger.setActiveDirectoryId({ directoryId });
  }, []);

  useEffect(() => {
    const unsub = directoryStore.subscribe((s) => {
      const directoryId = s.context.activeDirectoryId;
      if (!directoryId) return;

      let done = false;

      layoutModel.visitNodes((node) => {
        if (done) return;
        if (
          LayoutHelpers.isDirectory(node) &&
          node.getConfig()?.directoryId === directoryId
        ) {
          done = true;
          const targetTab = node;

          if (!targetTab) return;

          const tabset = targetTab.getParent();
          if (!tabset) return;

          const activeTabset = layoutModel.getActiveTabset();
          const activeTab = activeTabset?.getSelectedNode();

          // Avoid loops / redundant work
          if (
            activeTabset?.getId() === tabset.getId() &&
            activeTab?.getId() === targetTab.getId()
          ) {
            return;
          }

          // Set flag to prevent feedback loop
          isSyncingFromStore.current = true;

          // 1️⃣ Activate tabset
          layoutModel.doAction(Actions.setActiveTabset(tabset.getId()));

          const idx = tabset
            .getChildren()
            .findIndex((c) => c.getId() === targetTab?.getId());
          if (idx !== -1) {
            tabset.setSelected(idx);
          }

          // Reset flag after a brief delay to allow FlexLayout to settle
          setTimeout(() => {
            isSyncingFromStore.current = false;
          }, 100);
        }
      });
    });

    return unsub.unsubscribe;
  }, []);

  useEffect(() => {
    directoryStore.on("directoryCreated", (e) => {
      const json: IJsonTabNode = {
        component: "directory",
        name: `Directory ${Date.now()}`,
        config: { directoryId: e.directoryId },
      };
      if (e.tabId) {
        layoutRef.current?.addTabToTabSet(e.tabId, json);
      } else {
        layoutRef.current?.addTabToActiveTabSet(json);
      }
    });
  }, []);

  return {
    handleModelChange,
  };
};
