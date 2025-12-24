import { ReactNode, useState } from "react";
import { useSelector } from "@xstate/store/react";
import {
  columnPreferencesStore,
  selectGlobalPreferences,
  selectLocalPreferences,
} from "../columnPreferences";
import { ColumnDef } from "@/lib/libs/table/table-types";
import { EyeIcon, EyeOffIcon, RefreshCcwIcon } from "lucide-react";

type ColumnHeaderContextMenuProps = {
  columns: ColumnDef<any>[];
  directoryPath: string;
};

export function ColumnHeaderContextMenu({
  columns,
  directoryPath,
}: ColumnHeaderContextMenuProps) {
  const [activeTab, setActiveTab] = useState<"local" | "global">("local");

  const globalPrefs = useSelector(
    columnPreferencesStore,
    selectGlobalPreferences,
  );
  const localPrefs = useSelector(
    columnPreferencesStore,
    selectLocalPreferences(directoryPath),
  );

  // Create column IDs from columns
  const columnIds = columns.map((col) => col.id?.toString() || col.accessorKey);

  // Get current preferences for the active tab
  const currentPrefs = activeTab === "local" ? localPrefs : globalPrefs;

  // Merge columns with preferences, maintaining order
  const getOrderedColumns = () => {
    if (!currentPrefs || currentPrefs.length === 0) {
      // No preferences, use default column order
      return columnIds.map((id, index) => ({
        id,
        visible: true,
        header: columns[index].headerConfigView || columns[index].header || id,
      }));
    }

    // Create a map of existing preferences
    const prefMap = new Map(currentPrefs.map((p) => [p.id, p]));

    // Start with preferences order
    const ordered: ColumnRowProps["column"][] = [...currentPrefs]
      .filter((p) => columnIds.includes(p.id))
      .map((p) => {
        const col = columns.find(
          (c) => (c.id?.toString() || c.accessorKey) === p.id,
        );
        return {
          id: p.id,
          visible: p.visible,
          header: col?.headerConfigView || col?.header || p.id,
        };
      });

    // Add any new columns that aren't in preferences
    columnIds.forEach((id, index) => {
      if (!prefMap.has(id)) {
        ordered.push({
          id,
          visible: true,
          header:
            columns[index].headerConfigView || columns[index].header || id,
        });
      }
    });

    return ordered;
  };

  const orderedColumns = getOrderedColumns();

  const toggleVisibility = (id: string) => {
    const newPrefs = orderedColumns.map((col) =>
      col.id === id
        ? { id: col.id, visible: !col.visible }
        : { id: col.id, visible: col.visible },
    );

    if (activeTab === "local") {
      columnPreferencesStore.send({
        type: "setLocalPreferences",
        directoryPath,
        preferences: newPrefs,
      });
    } else {
      columnPreferencesStore.send({
        type: "setGlobalPreferences",
        preferences: newPrefs,
      });
    }
  };

  const moveColumn = (fromIndex: number, toIndex: number) => {
    const newOrder = [...orderedColumns];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);

    const newPrefs = newOrder.map((col) => ({
      id: col.id,
      visible: col.visible,
    }));

    if (activeTab === "local") {
      columnPreferencesStore.send({
        type: "setLocalPreferences",
        directoryPath,
        preferences: newPrefs,
      });
    } else {
      columnPreferencesStore.send({
        type: "setGlobalPreferences",
        preferences: newPrefs,
      });
    }
  };

  const clearPreferences = () => {
    if (activeTab === "local") {
      columnPreferencesStore.send({
        type: "clearLocalPreferences",
        directoryPath,
      });
    } else {
      columnPreferencesStore.send({
        type: "clearGlobalPreferences",
      });
    }
  };

  return (
    <div className="bg-base-200 rounded-box w-64 shadow-xl text-xs">
      {/* Tabs */}
      <div role="tablist" className="tabs tabs-lift flex">
        <a
          role="tab"
          className={`tab tab-xs text-xs flex-grow-1 ${activeTab === "local" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("local")}
        >
          Current Directory
        </a>
        <a
          role="tab"
          className={`tab tab-xs text-xs flex-grow-1 ${activeTab === "global" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("global")}
        >
          Global
        </a>
      </div>

      {/* Column list */}
      <div className="space-y-0.5 max-h-96 overflow-y-auto">
        {orderedColumns.map((col, index) => (
          <ColumnRow
            key={col.id}
            column={col}
            index={index}
            onToggle={() => toggleVisibility(col.id)}
            onMove={moveColumn}
          />
        ))}
      </div>

      {/* Clear button */}
      <div className="flex justify-between items-center border-t border-base-300">
        <button
          className="btn btn-xs btn-ghost gap-1 h-6 min-h-6 w-full"
          onClick={clearPreferences}
          disabled={!currentPrefs || currentPrefs.length === 0}
        >
          <RefreshCcwIcon className="size-3" />
          Reset
        </button>
      </div>
    </div>
  );
}

type ColumnRowProps = {
  column: { id: string; visible: boolean; header: ReactNode };
  index: number;
  onToggle: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
};

function ColumnRow({ column, index, onToggle, onMove }: ColumnRowProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (fromIndex !== index) {
      onMove(fromIndex, index);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded cursor-move hover:bg-base-300 ${
        dragOver ? "bg-primary/20 ring-1 ring-primary" : ""
      }`}
    >
      <button
        onClick={onToggle}
        className="btn btn-xs btn-ghost btn-square flex-shrink-0 h-5 w-5 min-h-5 p-0"
      >
        {column.visible ? (
          <EyeIcon className="size-3" />
        ) : (
          <EyeOffIcon className="size-3 opacity-50" />
        )}
      </button>
      <span
        className={`flex-1 truncate text-xs ${!column.visible ? "opacity-50 line-through" : ""}`}
      >
        {column.header}
      </span>
    </div>
  );
}
