import { useState, useEffect, useMemo, Ref, useRef } from "react";
import { Dialog } from "@/lib/components/dialog";
import { Button } from "@/lib/components/button";
import { useDialogStoreDialog } from "../dialogStore";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import {
  BatchRenameOptions,
  RenamePreview,
  generateRenamePreview,
  checkDuplicates,
  CaseConversion,
} from "../utils/batchRenameEngine";
import { useDefaultResultHandler } from "@/lib/hooks/useDefaultResultHandler";
import { directoryHelpers, directoryStore } from "../directoryStore/directory";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { DialogForItem } from "@/lib/hooks/useDialogForItem";
import { Result } from "@common/Result";
import { GenericError } from "@common/GenericError";
import z from "zod";
import { 
  SaveIcon, 
  FolderOpenIcon,
  PlayIcon,
  RotateCcwIcon 
} from "lucide-react";
import { getWindowElectron } from "@/getWindowElectron";

type BatchRenameTemplate = {
  name: string;
  options: Omit<
    BatchRenameOptions,
    "counterStart" | "counterStep" | "counterPadding"
  > & {
    counterStart: number;
    counterStep: number;
    counterPadding: number;
  };
};

const templateSchema = z.array(
  z.object({
    name: z.string(),
    options: z.any(),
  }),
);

const undoHistorySchema = z.array(
  z.array(
    z.object({
      oldPath: z.string(),
      newPath: z.string(),
    }),
  ),
);

export const BatchRenameDialog = ({
  ref,
}: {
  ref: Ref<DialogForItem<GetFilesAndFoldersInDirectoryItem[]>>;
}) => {
  const {
    item: items,
    dialogOpen,
    onClose,
  } = useDialogStoreDialog<GetFilesAndFoldersInDirectoryItem[]>(ref);
  const [templates, setTemplates] = useLocalStorage(
    "batchRenameTemplates",
    templateSchema,
    [],
  );
  const [undoHistory, setUndoHistory] = useLocalStorage(
    "batchRenameUndoHistory",
    undoHistorySchema,
    [],
  );

  const [options, setOptions] = useState<BatchRenameOptions>({
    mask: "[N][E]",
    caseConversion: "none",
    counterStart: 1,
    counterStep: 1,
    counterPadding: 3,
  });

  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [multiString, setMultiString] = useState(false);

  const [templateName, setTemplateName] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const maskInputRef = useRef<HTMLInputElement>(null);

  const { onResult } = useDefaultResultHandler();

  // Function to insert placeholder at cursor position
  const insertPlaceholder = (placeholder: string) => {
    const input = maskInputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentMask = options.mask;

    const newMask =
      currentMask.substring(0, start) +
      placeholder +
      currentMask.substring(end);

    setOptions((prev) => ({ ...prev, mask: newMask }));

    // Set cursor position after the inserted placeholder
    setTimeout(() => {
      input.focus();
      const newPosition = start + placeholder.length;
      input.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  // Update options when find/replace changes
  useEffect(() => {
    setOptions((prev) => ({
      ...prev,
      findReplace: findText
        ? {
            find: findText,
            replace: replaceText,
            useRegex,
            multiString,
          }
        : undefined,
    }));
  }, [findText, replaceText, useRegex, multiString]);

  // Generate preview
  const previews = useMemo<RenamePreview[]>(() => {
    if (!items || items.length === 0) return [];
    items.forEach((item) => {
      item.fullPath = directoryHelpers.getFullPathForItem(
        item,
        directoryStore.getSnapshot().context.activeDirectoryId,
      );
    });
    const rawPreviews = generateRenamePreview(items, options);
    return checkDuplicates(rawPreviews);
  }, [items, options]);

  const hasErrors = previews.some((p) => p.error);
  const unchangedCount = previews.filter(
    (p) => p.oldName === p.newName && !p.error,
  ).length;

  async function handleRename() {
    if (!items || hasErrors) return;

    const activeDirectoryId =
      directoryStore.getSnapshot().context.activeDirectoryId;

    try {
      // Filter out unchanged items and prepare batch rename request
      const itemsToRename = previews
        .filter((p) => p.oldName !== p.newName && !p.error)
        .map((p) => ({
          fullPath: p.item.fullPath!,
          newName: p.newName,
        }));

      if (itemsToRename.length === 0) {
        onResult(
          GenericError.Message("No changes to apply"),
          {}
        );
        return;
      }

      // Call batch rename API
      const result = await getWindowElectron().batchRenameFiles(itemsToRename);

      if (!result.success) {
        onResult(result, {});
        return;
      }

      // Save to undo history
      setUndoHistory((prev) => [...prev, result.data.renamedPaths].slice(-10));

      // Reload directory to show renamed files
      await directoryHelpers.reload(activeDirectoryId);

      onResult(Result.Success(undefined), {
        success: () => {
          onClose();
        },
      });
    } catch (error) {
      onResult(
        GenericError.Message(
          error instanceof Error ? error.message : "Failed to rename files",
        ),
        {},
      );
    }
  }

  function saveTemplate() {
    if (!templateName.trim()) return;

    const template: BatchRenameTemplate = {
      name: templateName,
      options: {
        mask: options.mask,
        findReplace: options.findReplace,
        caseConversion: options.caseConversion,
        counterStart: options.counterStart,
        counterStep: options.counterStep,
        counterPadding: options.counterPadding,
      },
    };

    setTemplates((prev) => [
      ...prev.filter((t) => t.name !== templateName),
      template,
    ]);
    setTemplateName("");
  }

  function loadTemplate(template: BatchRenameTemplate) {
    setOptions({
      ...template.options,
      counterStart: template.options.counterStart,
      counterStep: template.options.counterStep,
      counterPadding: template.options.counterPadding,
    });
    if (template.options.findReplace) {
      setFindText(template.options.findReplace.find);
      setReplaceText(template.options.findReplace.replace);
      setUseRegex(template.options.findReplace.useRegex);
      setMultiString(template.options.findReplace.multiString);
    }
    setShowTemplates(false);
  }

  function deleteTemplate(templateName: string) {
    setTemplates((prev) => prev.filter((t) => t.name !== templateName));
  }

  async function handleUndo() {
    if (undoHistory.length === 0) return;

    const lastOperation = undoHistory[undoHistory.length - 1];
    const activeDirectoryId =
      directoryStore.getSnapshot().context.activeDirectoryId;

    try {
      // Reverse the renames - swap oldPath and newPath
      const itemsToRename = lastOperation.map(({ oldPath, newPath }) => ({
        fullPath: newPath,
        newName: oldPath.substring(oldPath.lastIndexOf("/") + 1),
      }));

      const result = await getWindowElectron().batchRenameFiles(itemsToRename);

      if (!result.success) {
        onResult(result, {});
        return;
      }

      // Remove from history
      setUndoHistory((prev) => prev.slice(0, -1));

      // Reload directory to show undone renames
      await directoryHelpers.reload(activeDirectoryId);

      onResult(Result.Success(undefined), {});
    } catch (error) {
      onResult(
        GenericError.Message(
          error instanceof Error ? error.message : "Failed to undo",
        ),
        {},
      );
    }
  }

  if (!dialogOpen) return null;

  return (
    <Dialog
      onClose={onClose}
      title="Batch Rename"
      style={{ width: "900px", maxWidth: "90vw" }}
      footer={
        <>
          {undoHistory.length > 0 && (
            <Button onClick={handleUndo} icon={RotateCcwIcon}>
              Undo Last Operation
            </Button>
          )}
          <Button
            onClick={handleRename}
            icon={PlayIcon}
            disabled={hasErrors || !items || items.length === 0}
          >
            Rename {items?.length || 0} Items
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Mask Input and Counter Settings - Combined */}
        <div>
          <label className="label py-1">
            <span className="label-text text-xs font-semibold">
              Rename Mask
            </span>
            <span className="label-text-alt text-xs opacity-60">
              Use \[N\] for literal "[N]"
            </span>
          </label>
          <div className="flex gap-2">
            {/* Mask Input */}
            <div className="flex-1 form-control">
              <input
                ref={maskInputRef}
                type="text"
                value={options.mask}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, mask: e.target.value }))
                }
                className="input input-bordered input-sm"
                placeholder="[N] - [C].[E]"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                <button
                  onClick={() => insertPlaceholder("[N]")}
                  className="btn btn-xs btn-ghost"
                  type="button"
                >
                  [N] Name
                </button>
                <button
                  onClick={() => insertPlaceholder("[N1-5]")}
                  className="btn btn-xs btn-ghost"
                  type="button"
                >
                  [N1-5] Chars
                </button>
                <button
                  onClick={() => insertPlaceholder("[E]")}
                  className="btn btn-xs btn-ghost"
                  type="button"
                >
                  [E] Ext
                </button>
                <button
                  onClick={() => insertPlaceholder("[C]")}
                  className="btn btn-xs btn-ghost"
                  type="button"
                >
                  [C] Counter
                </button>
                <button
                  onClick={() => insertPlaceholder("[d]")}
                  className="btn btn-xs btn-ghost"
                  type="button"
                >
                  [d] Date
                </button>
                <button
                  onClick={() => insertPlaceholder("[t]")}
                  className="btn btn-xs btn-ghost"
                  type="button"
                >
                  [t] Time
                </button>
                <button
                  onClick={() => insertPlaceholder("[P]")}
                  className="btn btn-xs btn-ghost"
                  type="button"
                >
                  [P] Parent
                </button>
              </div>
            </div>

            {/* Counter Settings - Compact on the right */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="text-xs opacity-60 w-10">Start:</span>
                <input
                  type="number"
                  value={options.counterStart}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      counterStart: parseInt(e.target.value) || 1,
                    }))
                  }
                  className="input input-bordered input-xs w-14 text-center"
                  min="0"
                  max="99"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs opacity-60 w-10">Step:</span>
                <input
                  type="number"
                  value={options.counterStep}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      counterStep: parseInt(e.target.value) || 1,
                    }))
                  }
                  className="input input-bordered input-xs w-14 text-center"
                  min="1"
                  max="99"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs opacity-60 w-10">Pad:</span>
                <input
                  type="number"
                  value={options.counterPadding}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      counterPadding: parseInt(e.target.value) || 1,
                    }))
                  }
                  className="input input-bordered input-xs w-14 text-center"
                  min="1"
                  max="9"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Find & Replace */}
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text text-xs font-semibold">
              Find & Replace
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              className="input input-bordered input-sm"
              placeholder="Find (use | for multi-string)"
            />
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="input input-bordered input-sm"
              placeholder="Replace with (can use [N], $1, $2...)"
            />
          </div>
          <div className="flex justify-between items-start mt-1">
            <div className="flex gap-4">
              <label className="label cursor-pointer gap-1 justify-start py-1">
                <input
                  type="checkbox"
                  checked={useRegex}
                  onChange={(e) => setUseRegex(e.target.checked)}
                  className="checkbox checkbox-xs"
                />
                <span className="label-text text-xs">Use RegEx</span>
              </label>
              <label className="label cursor-pointer gap-1 justify-start py-1">
                <input
                  type="checkbox"
                  checked={multiString}
                  onChange={(e) => setMultiString(e.target.checked)}
                  disabled={useRegex}
                  className="checkbox checkbox-xs"
                />
                <span className="label-text text-xs">Multi-string (|)</span>
              </label>
            </div>
            <div className="text-xs opacity-60">
              Masks & capture groups ($1, $2) supported
            </div>
          </div>
        </div>

        {/* Case Conversion */}
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text text-xs font-semibold">
              Case Conversion
            </span>
          </label>
          <select
            value={options.caseConversion}
            onChange={(e) =>
              setOptions((prev) => ({
                ...prev,
                caseConversion: e.target.value as CaseConversion,
              }))
            }
            className="select select-bordered select-sm"
          >
            <option value="none">No Change</option>
            <option value="upper">UPPERCASE</option>
            <option value="lower">lowercase</option>
            <option value="sentence">Sentence case</option>
            <option value="title">Title Case</option>
          </select>
        </div>

        {/* Template Management */}
        <div className="flex flex-col gap-2 border-t pt-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="input input-bordered input-sm flex-1"
              placeholder="Template name"
            />
            <Button
              onClick={saveTemplate}
              icon={SaveIcon}
              disabled={!templateName.trim()}
            >
              Save
            </Button>
            <Button
              onClick={() => setShowTemplates(!showTemplates)}
              icon={FolderOpenIcon}
            >
              {showTemplates ? "Hide" : "Load"}
            </Button>
          </div>

          {showTemplates && templates.length > 0 && (
            <div className="menu bg-base-200 rounded-box max-h-32 overflow-y-auto p-1">
              {templates.map((template) => (
                <div
                  key={template.name}
                  className="flex justify-between items-center px-2 py-1 hover:bg-base-300 rounded text-sm"
                >
                  <span className="flex-1">{template.name}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => loadTemplate(template)}
                      className="btn btn-xs btn-primary"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.name)}
                      className="btn btn-xs btn-error"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-1 border-t pt-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold">
              Preview ({previews.length} items)
            </label>
            <div className="text-xs">
              {hasErrors && (
                <span className="text-error mr-2 font-semibold">
                  Has errors!
                </span>
              )}
              {unchangedCount > 0 && (
                <span className="opacity-60">{unchangedCount} unchanged</span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto max-h-64 border rounded-lg">
            <table className="table table-zebra table-pin-rows table-xs">
              <thead>
                <tr>
                  <th className="w-5">#</th>
                  <th>Old Name</th>
                  <th>New Name</th>
                  <th className="w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {previews.map((preview, idx) => (
                  <tr key={idx} className={preview.error ? "bg-error/10" : ""}>
                    <td className="opacity-50">{idx + 1}</td>
                    <td className="font-mono text-xs">{preview.oldName}</td>
                    <td className="font-mono text-xs">{preview.newName}</td>
                    <td>
                      {preview.error ? (
                        <span className="badge badge-error badge-xs">
                          {preview.error}
                        </span>
                      ) : preview.oldName === preview.newName ? (
                        <span className="badge badge-ghost badge-xs">
                          Unchanged
                        </span>
                      ) : (
                        <span className="badge badge-success badge-xs">
                          Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
