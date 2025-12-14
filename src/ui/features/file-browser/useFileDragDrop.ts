import { useState } from "react";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { directoryHelpers, directoryStore } from "./directory";
import { getWindowElectron } from "@/getWindowElectron";
import { toast } from "@/lib/components/toast";
import type { DirectoryId } from "./directory";

interface UseFileDragDropProps {
  directoryId: DirectoryId;
  directoryType: "path" | "tags";
  directoryFullPath?: string;
}

export function useFileDragDrop({
  directoryId,
  directoryType,
  directoryFullPath,
}: UseFileDragDropProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverRowIdx, setDragOverRowIdx] = useState<number | null>(null);

  // Handle drag start on table rows
  const handleRowDragStart = async (
    items: GetFilesAndFoldersInDirectoryItem[],
  ) => {
    // Copy files to clipboard (cut=true for move by default)
    // The cut mode can be changed to false (copy) if Alt is pressed during drop
    await directoryHelpers.handleCopy(items, true, directoryId);
  };

  // Handle drag over on the table container
  const handleTableDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);

    // Set dropEffect based on Alt key
    if (e.altKey) {
      e.dataTransfer.dropEffect = "copy";
    } else {
      e.dataTransfer.dropEffect = "move";
    }
  };

  // Handle drag leave on the table container
  const handleTableDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the container, not just moving between children
    const rect = e.currentTarget.getBoundingClientRect();
    const isOutside =
      e.clientX < rect.left ||
      e.clientX >= rect.right ||
      e.clientY < rect.top ||
      e.clientY >= rect.bottom;

    if (isOutside) {
      setIsDragOver(false);
    }
  };

  // Handle drop on the table container
  const handleTableDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Only allow drops in path directories, not in tags view
    if (directoryType !== "path" || !directoryFullPath) {
      toast.show({
        message: "Cannot drop files in tags view",
        severity: "error",
      });
      return;
    }

    const destinationDir = directoryFullPath;
    const isCopy = e.altKey; // Alt key means copy instead of move

    try {
      // If Alt key is pressed, change clipboard to copy mode instead of cut
      if (isCopy) {
        await getWindowElectron().setClipboardCutMode(false);
      }

      // The files should already be in clipboard from onDragStart
      // Use the existing paste mechanism to handle the drop
      const result = await getWindowElectron().pasteFiles(destinationDir);

      if (result.success) {
        const itemCount = result.data?.pastedItems.length ?? 0;
        toast.show({
          message: isCopy
            ? `Copied ${itemCount} item(s)`
            : `Moved ${itemCount} item(s)`,
          severity: "success",
        });

        // Activate the target directory
        directoryStore.send({
          type: "setActiveDirectoryId",
          directoryId: directoryId,
        });

        // Reload all directory panes to reflect changes
        const allDirectories =
          directoryStore.getSnapshot().context.directoryOrder;
        for (const dirId of allDirectories) {
          await directoryHelpers.reload(dirId);
        }

        // Set selection on the first pasted item in the target directory
        if (result.data?.pastedItems && result.data.pastedItems.length > 0) {
          directoryHelpers.setPendingSelection(
            result.data.pastedItems[0],
            directoryId,
          );
        }
      } else {
        toast.show(result);
      }
    } catch (error) {
      toast.show({
        message:
          error instanceof Error ? error.message : "Failed to drop files",
        severity: "error",
      });
    }
  };

  // Handle drag over on folder rows
  const handleRowDragOver = (
    e: React.DragEvent,
    idx: number,
    isFolder: boolean,
  ) => {
    // Only allow dropping on folders
    if (!isFolder) return;

    e.preventDefault();
    e.stopPropagation();
    setDragOverRowIdx(idx);
    // Set dropEffect based on Alt key
    e.dataTransfer.dropEffect = e.altKey ? "copy" : "move";
  };

  // Handle drag leave on folder rows
  const handleRowDragLeave = (e: React.DragEvent, isFolder: boolean) => {
    if (!isFolder) return;

    // Only clear if we're actually leaving the row
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const isOutside =
      e.clientX < rect.left ||
      e.clientX >= rect.right ||
      e.clientY < rect.top ||
      e.clientY >= rect.bottom;

    if (isOutside) {
      setDragOverRowIdx(null);
    }
  };

  // Handle drop on folder rows
  const handleRowDrop = async (
    e: React.DragEvent,
    item: GetFilesAndFoldersInDirectoryItem,
  ) => {
    // Only allow dropping on folders
    if (item.type !== "dir") return;

    e.preventDefault();
    e.stopPropagation();
    setDragOverRowIdx(null);

    const targetDir =
      item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId);
    const isCopy = e.altKey;

    try {
      // If Alt key is pressed, change clipboard to copy mode instead of cut
      if (isCopy) {
        await getWindowElectron().setClipboardCutMode(false);
      }

      const result = await getWindowElectron().pasteFiles(targetDir);

      if (result.success) {
        const itemCount = result.data?.pastedItems.length ?? 0;
        toast.show({
          message: isCopy
            ? `Copied ${itemCount} item(s) to ${item.name}`
            : `Moved ${itemCount} item(s) to ${item.name}`,
          severity: "success",
        });

        // Navigate to the target folder and activate this directory
        directoryHelpers.cdFull(targetDir, directoryId);
        directoryStore.send({
          type: "setActiveDirectoryId",
          directoryId: directoryId,
        });

        // Wait a bit for navigation to complete, then set selection
        setTimeout(() => {
          if (result.data?.pastedItems && result.data.pastedItems.length > 0) {
            directoryHelpers.setPendingSelection(
              result.data.pastedItems[0],
              directoryId,
            );
          }
        }, 100);

        // Reload all OTHER directory panes to reflect changes
        const allDirectories =
          directoryStore.getSnapshot().context.directoryOrder;
        for (const dirId of allDirectories) {
          if (dirId !== directoryId) {
            await directoryHelpers.reload(dirId);
          }
        }
      } else {
        toast.show(result);
      }
    } catch (error) {
      toast.show({
        message:
          error instanceof Error ? error.message : "Failed to drop files",
        severity: "error",
      });
    }
  };

  return {
    // State
    isDragOver,
    dragOverRowIdx,

    // Handlers
    handleRowDragStart,
    handleTableDragOver,
    handleTableDragLeave,
    handleTableDrop,
    handleRowDragOver,
    handleRowDragLeave,
    handleRowDrop,
  };
}
