import { useState, useEffect, useMemo, Ref } from "react";
import { Dialog } from "@/lib/components/dialog";
import { Button } from "@/lib/components/button";
import { useDialogStoreDialog } from "../dialogStore";
import { FileWarningIcon } from "lucide-react";
import { DialogForItem } from "@/lib/hooks/useDialogForItem";
import type {
  PasteConflictData,
  ConflictResolution,
} from "@common/Contracts";

type PasteConflictDialogMetadata = {
  conflictData: PasteConflictData;
  destinationDir: string;
  onResolve: (resolution: ConflictResolution) => void;
  onCancel: () => void;
};

type PerFileAction = "useGlobal" | "override" | "trash" | "customName" | "skip";

export const PasteConflictDialog = ({
  ref,
}: {
  ref: Ref<DialogForItem<PasteConflictDialogMetadata>>;
}) => {
  const { item, dialogOpen, onClose } =
    useDialogStoreDialog<PasteConflictDialogMetadata>(ref);

  const [globalStrategy, setGlobalStrategy] = useState<
    "override" | "trash" | "autoName" | "skip"
  >("autoName");
  const [perFileActions, setPerFileActions] = useState<
    Map<
      string,
      {
        action: PerFileAction;
        customName?: string;
      }
    >
  >(new Map());

  // Reset state when dialog opens
  useEffect(() => {
    if (dialogOpen && item?.conflictData) {
      setGlobalStrategy("autoName");
      // Initialize per-file actions with default custom names
      const initialActions = new Map<
        string,
        { action: PerFileAction; customName?: string }
      >();
      item.conflictData.conflicts.forEach((conflict) => {
        initialActions.set(conflict.destinationPath, {
          action: "useGlobal",
          customName: conflict.suggestedName,
        });
      });
      setPerFileActions(initialActions);
    }
  }, [dialogOpen, item?.conflictData]);

  function validateCustomName(name: string): {
    valid: boolean;
    error?: string;
  } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: "Name cannot be empty" };
    }

    const invalidChars = /[\/\\:*?"<>|]/;
    if (invalidChars.test(name)) {
      return {
        valid: false,
        error: 'Invalid characters: / \\ : * ? " < > |',
      };
    }

    return { valid: true };
  }

  function checkDuplicateDestinations(): Map<string, number> {
    const destinations = new Map<string, number>();
    const duplicates = new Map<string, number>();

    if (!item?.conflictData) return duplicates;

    item.conflictData.conflicts.forEach((conflict) => {
      const action = perFileActions.get(conflict.destinationPath);
      let finalPath = conflict.destinationPath;

      if (action?.action === "customName" && action.customName) {
        const dir = conflict.destinationPath.substring(
          0,
          conflict.destinationPath.lastIndexOf("/"),
        );
        finalPath = `${dir}/${action.customName}`;
      } else if (action?.action === "skip") {
        return; // Skip this check
      } else if (
        action?.action === "useGlobal" ||
        action?.action === "override"
      ) {
        if (globalStrategy === "autoName") {
          const dir = conflict.destinationPath.substring(
            0,
            conflict.destinationPath.lastIndexOf("/"),
          );
          finalPath = `${dir}/${conflict.suggestedName}`;
        } else if (globalStrategy === "skip") {
          return;
        }
      }

      const count = destinations.get(finalPath) || 0;
      destinations.set(finalPath, count + 1);
      if (count > 0) {
        duplicates.set(finalPath, count + 1);
      }
    });

    return duplicates;
  }

  const duplicates = useMemo(
    () => checkDuplicateDestinations(),
    [perFileActions, globalStrategy, item?.conflictData],
  );

  const validationErrors = useMemo(() => {
    const errors = new Map<string, string>();
    if (!item?.conflictData) return errors;

    item.conflictData.conflicts.forEach((conflict) => {
      const action = perFileActions.get(conflict.destinationPath);
      if (action?.action === "customName" && action.customName) {
        const validation = validateCustomName(action.customName);
        if (!validation.valid) {
          errors.set(conflict.destinationPath, validation.error!);
        }
      }
    });

    return errors;
  }, [perFileActions, item?.conflictData]);

  const hasErrors =
    validationErrors.size > 0 || duplicates.size > 0;

  function buildResolution(): ConflictResolution {
    const perFileOverrides: ConflictResolution["perFileOverrides"] = {};
    let hasOverrides = false;

    perFileActions.forEach((config, destPath) => {
      if (config.action !== "useGlobal") {
        hasOverrides = true;
        if (config.action === "customName") {
          perFileOverrides![destPath] = {
            action: "customName",
            customName: config.customName,
          };
        } else {
          perFileOverrides![destPath] = {
            action: config.action as "override" | "trash" | "skip",
          };
        }
      }
    });

    return {
      globalStrategy,
      perFileOverrides: hasOverrides ? perFileOverrides : undefined,
    };
  }

  function handlePaste() {
    if (hasErrors || !item) return;
    const resolution = buildResolution();
    item.onResolve(resolution);
    onClose();
  }

  function handleCancel() {
    if (!item) return;
    item.onCancel();
    onClose();
  }

  function updatePerFileAction(
    destPath: string,
    action: PerFileAction,
    customName?: string,
  ) {
    setPerFileActions((prev) => {
      const newMap = new Map(prev);
      newMap.set(destPath, { action, customName });
      return newMap;
    });
  }

  if (!dialogOpen || !item?.conflictData) return null;

  const { conflicts, exceedsLimit, totalConflicts } = item.conflictData;

  return (
    <Dialog
      onClose={handleCancel}
      title="Paste Conflicts"
      style={{ width: "1100px", maxWidth: "95vw" }}
      footer={
        <>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button onClick={handlePaste} disabled={hasErrors}>
            Paste
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Warning Banner */}
        {exceedsLimit && (
          <div className="alert alert-warning">
            <FileWarningIcon className="w-5 h-5" />
            <span>
              More than 20 conflicts detected (showing 20 of {totalConflicts}).
              Select a global strategy to handle all conflicts.
            </span>
          </div>
        )}

        {/* Global Strategy */}
        <div className="form-control border rounded-lg p-3 bg-base-200">
          <label className="label py-1">
            <span className="label-text font-semibold">
              Apply to all conflicts:
            </span>
          </label>
          <div className="flex gap-4 flex-wrap">
            <label className="label cursor-pointer gap-2 justify-start">
              <input
                type="radio"
                className="radio radio-sm"
                checked={globalStrategy === "trash"}
                onChange={() => setGlobalStrategy("trash")}
                autoFocus
              />
              <span className="label-text">Move to Trash & Replace</span>
            </label>
            <label className="label cursor-pointer gap-2 justify-start">
              <input
                type="radio"
                className="radio radio-sm"
                checked={globalStrategy === "override"}
                onChange={() => setGlobalStrategy("override")}
              />
              <span className="label-text">Override All</span>
            </label>
            <label className="label cursor-pointer gap-2 justify-start">
              <input
                type="radio"
                className="radio radio-sm"
                checked={globalStrategy === "autoName"}
                onChange={() => setGlobalStrategy("autoName")}
              />
              <span className="label-text">Auto-Generate Names</span>
            </label>
            <label className="label cursor-pointer gap-2 justify-start">
              <input
                type="radio"
                className="radio radio-sm"
                checked={globalStrategy === "skip"}
                onChange={() => setGlobalStrategy("skip")}
              />
              <span className="label-text">Skip All</span>
            </label>
          </div>
        </div>

        {/* Duplicate Errors */}
        {duplicates.size > 0 && (
          <div className="alert alert-error">
            <span>
              Duplicate destination paths detected:
              {Array.from(duplicates.entries()).map(([path, count]) => (
                <div key={path} className="text-xs mt-1">
                  {path} ({count} files)
                </div>
              ))}
            </span>
          </div>
        )}

        {/* Conflicts Table */}
        <div className="overflow-x-auto max-h-96 border rounded-lg">
          <table className="table table-zebra table-pin-rows table-xs">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>Source Path</th>
                <th className="w-24">Source Size</th>
                <th className="w-24">Dest Size</th>
                <th className="w-40">Action</th>
                <th className="w-52">New Name</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((conflict, idx) => {
                const action =
                  perFileActions.get(conflict.destinationPath) ||
                  ({ action: "useGlobal", customName: conflict.suggestedName } as const);
                const error = validationErrors.get(conflict.destinationPath);

                return (
                  <tr key={conflict.destinationPath}>
                    <td className="opacity-50 text-xs">{idx + 1}</td>
                    <td className="font-mono text-[11px]">
                      {conflict.sourcePath}
                    </td>
                    <td className="text-xs text-right">
                      {conflict.sourceSizeStr}
                    </td>
                    <td className="text-xs text-right">
                      {conflict.destSizeStr}
                    </td>
                    <td>
                      <select
                        className="select select-bordered select-xs w-full"
                        value={action.action}
                        onChange={(e) => {
                          const newAction = e.target.value as PerFileAction;
                          updatePerFileAction(
                            conflict.destinationPath,
                            newAction,
                            newAction === "customName"
                              ? conflict.suggestedName
                              : undefined,
                          );
                        }}
                      >
                        <option value="useGlobal">Use Global</option>
                        <option value="trash">Move to Trash</option>
                        <option value="override">Override</option>
                        <option value="customName">Custom Name</option>
                        <option value="skip">Skip</option>
                      </select>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          className={`input input-bordered input-xs w-full ${
                            error ? "input-error" : ""
                          }`}
                          value={action.customName || ""}
                          disabled={action.action !== "customName"}
                          onChange={(e) => {
                            updatePerFileAction(
                              conflict.destinationPath,
                              "customName",
                              e.target.value,
                            );
                          }}
                          placeholder={
                            action.action === "customName"
                              ? "Enter new name"
                              : ""
                          }
                        />
                        {error && (
                          <span className="text-error text-xs">{error}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
};
