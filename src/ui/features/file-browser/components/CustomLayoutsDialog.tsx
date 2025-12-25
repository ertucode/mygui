import { useState, forwardRef, useEffect, useRef } from "react";
import { Dialog } from "@/lib/components/dialog";
import { DialogForItem } from "@/lib/hooks/useDialogForItem";
import { useDialogStoreDialog } from "../dialogStore";
import { useSelector } from "@xstate/store/react";
import {
  layoutStore,
  layoutStoreHelpers,
  selectLayouts,
  CustomLayout,
} from "../layoutStore";
import { LayoutPreview } from "./LayoutPreview";
import { Button } from "@/lib/components/button";
import {
  TrashIcon,
  StarIcon,
  GripVerticalIcon,
  SaveIcon,
  PencilIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import { useConfirmation } from "@/lib/hooks/useConfirmation";
import { toast } from "@/lib/components/toast";
import { IJsonModel } from "flexlayout-react";

interface LayoutCardProps {
  layout?: CustomLayout;
  isCurrentLayout?: boolean;
  currentLayoutJson?: IJsonModel;
  onSave?: (name: string) => void;
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string, name: string) => void;
  onSetDefault?: (id: string) => void;
  onApply?: (layout: CustomLayout) => void;
  isDragging?: boolean;
  isOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

function LayoutCard({
  layout,
  isCurrentLayout,
  currentLayoutJson,
  onSave,
  onRename,
  onDelete,
  onSetDefault,
  onApply,
  isDragging,
  isOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: LayoutCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(layout?.name || "");
  const [currentLayoutName, setCurrentLayoutName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditName(layout?.name || "");
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editName.trim() && layout && onRename) {
      onRename(layout.id, editName.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditName(layout?.name || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (isCurrentLayout) {
        handleSaveCurrentLayout();
      } else {
        handleSaveEdit();
      }
    } else if (e.key === "Escape") {
      if (isCurrentLayout) {
        setCurrentLayoutName("");
      } else {
        handleCancelEdit();
      }
    }
  };

  const handleSaveCurrentLayout = () => {
    if (currentLayoutName.trim() && onSave) {
      onSave(currentLayoutName.trim());
      setCurrentLayoutName("");
    }
  };

  const displayLayoutJson = isCurrentLayout
    ? currentLayoutJson
    : layout?.layoutJson;

  return (
    <div
      draggable={!isCurrentLayout && !isEditing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`
        border rounded-lg p-3 flex flex-col gap-2 h-60
        ${isCurrentLayout ? "border-primary bg-primary/5" : "border-base-content/20"}
        ${isDragging ? "opacity-50" : ""}
        ${isOver ? "border-primary" : ""}
        ${!isCurrentLayout && !isEditing ? "cursor-move" : ""}
        hover:border-base-content/40 transition-colors
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        {!isCurrentLayout && (
          <GripVerticalIcon className="w-4 h-4 text-base-content/30 flex-shrink-0" />
        )}

        {isCurrentLayout ? (
          // Current layout - always shows input
          <div className="flex-1 flex gap-2 items-center h-full">
            <input
              ref={inputRef}
              type="text"
              value={currentLayoutName}
              onChange={(e) => setCurrentLayoutName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter layout name..."
              className="input input-sm input-bordered flex-1"
              autoFocus
            />
            <Button
              onClick={handleSaveCurrentLayout}
              disabled={!currentLayoutName.trim()}
              className="btn-sm"
              icon={SaveIcon}
            >
              Save
            </Button>
          </div>
        ) : isEditing ? (
          // Existing layout - editing mode
          <div className="flex-1 flex gap-2 items-center h-full">
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input input-sm input-bordered flex-1"
            />
            <button
              onClick={handleSaveEdit}
              className="btn btn-xs btn-circle btn-ghost text-success"
              title="Save"
            >
              <CheckIcon className="w-3 h-3" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="btn btn-xs btn-circle btn-ghost"
              title="Cancel"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        ) : (
          // Existing layout - display mode
          <>
            <div className="flex-1 font-medium text-sm truncate">
              {layout?.name}
            </div>
            <button
              onClick={handleStartEdit}
              className="btn btn-xs btn-circle btn-ghost"
              title="Rename"
            >
              <PencilIcon className="w-3 h-3" />
            </button>
            {layout && onSetDefault && (
              <button
                onClick={() => onSetDefault(layout.id)}
                className={`btn btn-xs btn-circle ${layout.isDefault ? "btn-primary" : "btn-ghost"}`}
                title={layout.isDefault ? "Default layout" : "Set as default"}
              >
                <StarIcon className="w-3 h-3" />
              </button>
            )}
            {layout && onDelete && (
              <button
                onClick={() => onDelete(layout.id, layout.name)}
                className="btn btn-xs btn-circle btn-ghost text-error"
                title="Delete layout"
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Preview */}
      <div
        className={`w-full h-full bg-base-100 rounded ${!isCurrentLayout && onApply ? "cursor-pointer hover:ring-2 hover:ring-primary transition-shadow" : ""}`}
        onClick={() => {
          if (!isCurrentLayout && layout && onApply) {
            onApply(layout);
          }
        }}
        title={!isCurrentLayout ? "Click to apply layout" : "Current layout"}
      >
        {displayLayoutJson && <LayoutPreview layoutJson={displayLayoutJson} />}
      </div>

      {/* Metadata */}
      <div className="text-xs text-base-content/50">
        {isCurrentLayout ? (
          <span className="font-medium">Current Layout</span>
        ) : layout ? (
          new Date(layout.createdAt).toLocaleDateString()
        ) : null}
      </div>
    </div>
  );
}

export const CustomLayoutsDialog = forwardRef<DialogForItem<{}>, {}>(
  function CustomLayoutsDialog(_props, ref) {
    const { dialogOpen, onClose } = useDialogStoreDialog<{}>(ref);
    const layouts = useSelector(layoutStore, selectLayouts);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [currentLayoutJson, setCurrentLayoutJson] =
      useState<IJsonModel | null>(null);
    const { confirm } = useConfirmation();

    useEffect(() => {
      if (dialogOpen) {
        // Load current layout when dialog opens
        import("../initializeDirectory").then(({ layoutModel }) => {
          setCurrentLayoutJson(layoutModel.toJson());
        });
      }
    }, [dialogOpen]);

    if (!dialogOpen) return null;

    const handleDragStart = (index: number) => {
      setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      setDragOverIndex(index);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (draggedIndex === null) return;

      const reordered = [...layouts];
      const [draggedItem] = reordered.splice(draggedIndex, 1);
      reordered.splice(dropIndex, 0, draggedItem);

      layoutStoreHelpers.reorderLayouts(reordered);
      setDraggedIndex(null);
      setDragOverIndex(null);
    };

    const handleDragEnd = () => {
      setDraggedIndex(null);
      setDragOverIndex(null);
    };

    const handleSaveCurrentLayout = async (name: string) => {
      if (currentLayoutJson) {
        // Get directory data from directoryStore
        const { directoryStore } = await import("../directoryStore/directory");
        const snapshot = directoryStore.getSnapshot();
        const directories = snapshot.context.directoryOrder.map((id) => {
          const directory = snapshot.context.directoriesById[id];
          return {
            id,
            ...directory.directory,
          };
        });
        const activeDirectoryId = snapshot.context.activeDirectoryId;

        const layout = layoutStoreHelpers.createLayout(
          name,
          currentLayoutJson,
          directories,
          activeDirectoryId,
        );
        layoutStoreHelpers.addLayout(layout);
        toast.show({
          title: "Layout Saved",
          message: `Layout "${name}" has been saved.`,
          severity: "success",
        });
      }
    };

    const handleRename = (id: string, name: string) => {
      layoutStoreHelpers.updateLayout(id, { name });
      toast.show({
        title: "Layout Renamed",
        message: `Layout renamed to "${name}".`,
        severity: "success",
      });
    };

    const handleDelete = (id: string, name: string) => {
      confirm({
        title: "Delete Layout",
        message: `Are you sure you want to delete the layout "${name}"?`,
        confirmText: "Delete",
        onConfirm: () => {
          layoutStoreHelpers.deleteLayout(id);
          toast.show({
            title: "Layout Deleted",
            message: `Layout "${name}" has been deleted.`,
            severity: "success",
          });
        },
      });
    };

    const handleSetDefault = (id: string) => {
      layoutStoreHelpers.setDefaultLayout(id);
    };

    const handleApplyLayout = async (layout: CustomLayout) => {
      if (!layout.directories || layout.directories.length === 0) {
        toast.show({
          title: "Cannot Apply Layout",
          message: `This layout was saved without directory data. Please re-save the layout to enable applying it.`,
          severity: "warning",
        });
        return;
      }

      confirm({
        title: "Apply Layout",
        message: `Apply layout "${layout.name}"? This will replace your current layout and directories.`,
        confirmText: "Apply",
        onConfirm: () => {
          try {
            // Save the layout to localStorage (same format as initializeDirectory.ts)
            const storage = {
              layout: layout.layoutJson,
              directories: layout.directories,
              activeDirectoryId: layout.activeDirectoryId,
            };
            localStorage.setItem(
              "mygui-flexlayout-model",
              JSON.stringify(storage),
            );

            toast.show({
              title: "Reloading...",
              message: "Reloading to apply layout.",
              severity: "info",
              timeout: 100,
            });

            // Reload the page after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 100);
          } catch (error) {
            console.error("Failed to apply layout:", error);
            toast.show({
              title: "Error",
              message: "Failed to apply layout. Please try again.",
              severity: "error",
            });
          }
        },
      });
    };

    // All layouts including current at the top
    type LayoutItem =
      | { isCurrentLayout: true; currentLayoutJson: IJsonModel | null }
      | { layout: CustomLayout; actualIndex: number };

    const allLayouts: LayoutItem[] = [
      { isCurrentLayout: true, currentLayoutJson },
      ...layouts.map((layout, index) => ({
        layout,
        actualIndex: index,
      })),
    ];

    // Distribute items into 3 columns (column by column, not row by row)
    const columnsCount = 3;
    const columns: LayoutItem[][] = [[], [], []];

    allLayouts.forEach((item, index) => {
      const columnIndex = index % columnsCount;
      columns[columnIndex].push(item);
    });

    return (
      <Dialog
        onClose={onClose}
        title="Custom Layouts"
        className="max-w-[90vw] w-full"
        style={{ height: "80vh" }}
      >
        <div className="flex flex-col h-full gap-4">
          <div className="flex-1 flex gap-4 overflow-auto">
            {columns.map((column, colIndex) => (
              <div key={colIndex} className="flex-1 flex flex-col gap-3">
                {column.map((item) => {
                  if ("isCurrentLayout" in item && item.isCurrentLayout) {
                    return (
                      <LayoutCard
                        key="current-layout"
                        isCurrentLayout
                        currentLayoutJson={item.currentLayoutJson || undefined}
                        onSave={handleSaveCurrentLayout}
                      />
                    );
                  }

                  const { layout, actualIndex } = item as {
                    layout: CustomLayout;
                    actualIndex: number;
                  };
                  const isDragging = draggedIndex === actualIndex;
                  const isOver = dragOverIndex === actualIndex;

                  return (
                    <LayoutCard
                      key={layout.id}
                      layout={layout}
                      onRename={handleRename}
                      onDelete={handleDelete}
                      onSetDefault={handleSetDefault}
                      onApply={handleApplyLayout}
                      isDragging={isDragging}
                      isOver={isOver}
                      onDragStart={() => handleDragStart(actualIndex)}
                      onDragOver={(e) => handleDragOver(e, actualIndex)}
                      onDrop={(e) => handleDrop(e, actualIndex)}
                      onDragEnd={handleDragEnd}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    );
  },
);
