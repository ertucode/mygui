import { ReactNode, useState } from "react";
import { useSelector } from "@xstate/store/react";
import {
  columnPreferencesStore,
  selectGlobalPreferences,
  selectPathPreferences,
  selectGlobalSort,
  selectPathSort,
} from "../columnPreferences";
import { ColumnDef } from "@/lib/libs/table/table-types";
import {
  EyeIcon,
  EyeOffIcon,
  RefreshCcwIcon,
  ArrowUpAZIcon,
  ArrowDownAZIcon,
} from "lucide-react";
import { sortNames } from "../schemas";
import type { SortState } from "../schemas";
import { columnSortKey } from "@/lib/libs/table/useTable";

type ColumnHeaderContextMenuProps = {
  columns: ColumnDef<any>[];
  directoryPath: string;
};

export function ColumnHeaderContextMenu({
  columns,
  directoryPath,
}: ColumnHeaderContextMenuProps) {
  const globalPrefs = useSelector(
    columnPreferencesStore,
    selectGlobalPreferences,
  );
  const pathPrefs = useSelector(
    columnPreferencesStore,
    selectPathPreferences(directoryPath),
  );
  const globalSort = useSelector(columnPreferencesStore, selectGlobalSort);
  const pathSort = useSelector(
    columnPreferencesStore,
    selectPathSort(directoryPath),
  );

  // Create column IDs from columns
  const columnIds = columns.map((col) => col.id?.toString() || col.accessorKey);

  // Merge columns with preferences, maintaining order
  const getOrderedColumns = (prefs: typeof pathPrefs | typeof globalPrefs) => {
    if (!prefs || prefs.length === 0) {
      // No preferences, use default column order
      return columnIds.map((id, index) => ({
        id,
        visible: true,
        header: columns[index].headerConfigView || columns[index].header || id,
        sortKey: columnSortKey(columns[index]),
      }));
    }

    // Create a map of existing preferences
    const prefMap = new Map(prefs.map((p) => [p.id, p]));

    // Start with preferences order
    const ordered: ColumnRowProps["column"][] = [...prefs]
      .filter((p) => columnIds.includes(p.id))
      .map((p) => {
        const col = columns.find(
          (c) => (c.id?.toString() || c.accessorKey) === p.id,
        );
        return {
          id: p.id,
          visible: p.visible,
          header: col?.headerConfigView || col?.header || p.id,
          sortKey: col ? columnSortKey(col) : undefined,
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
          sortKey: columnSortKey(columns[index]),
        });
      }
    });

    return ordered;
  };

  const pathOrderedColumns = getOrderedColumns(pathPrefs);
  const globalOrderedColumns = getOrderedColumns(globalPrefs);

  const togglePathVisibility = (id: string) => {
    const newPrefs = pathOrderedColumns.map((col) => ({
      id: col.id,
      visible: col.id === id ? !col.visible : col.visible,
    }));

    columnPreferencesStore.send({
      type: "setPathPreferences",
      directoryPath,
      preferences: newPrefs,
    });
  };

  const toggleGlobalVisibility = (id: string) => {
    const newPrefs = globalOrderedColumns.map((col) => ({
      id: col.id,
      visible: col.id === id ? !col.visible : col.visible,
    }));

    columnPreferencesStore.send({
      type: "setGlobalPreferences",
      preferences: newPrefs,
    });
  };

  const movePathColumn = (fromIndex: number, toIndex: number) => {
    const newOrder = [...pathOrderedColumns];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);

    const newPrefs = newOrder.map((col) => ({
      id: col.id,
      visible: col.visible,
    }));

    columnPreferencesStore.send({
      type: "setPathPreferences",
      directoryPath,
      preferences: newPrefs,
    });
  };

  const moveGlobalColumn = (fromIndex: number, toIndex: number) => {
    const newOrder = [...globalOrderedColumns];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);

    const newPrefs = newOrder.map((col) => ({
      id: col.id,
      visible: col.visible,
    }));

    columnPreferencesStore.send({
      type: "setGlobalPreferences",
      preferences: newPrefs,
    });
  };

  const togglePathSort = (sortKey: string | number | undefined) => {
    if (sortKey == null) return;

    const p = sortNames.safeParse(sortKey);
    if (!p.success) return;

    const newSort: SortState = {
      by: p.data,
      order:
        pathSort?.by === p.data
          ? pathSort.order === "asc"
            ? "desc"
            : "asc"
          : "asc",
    };

    columnPreferencesStore.send({
      type: "setPathSort",
      directoryPath,
      sort: newSort,
    });
  };

  const toggleGlobalSort = (sortKey: string | number | undefined) => {
    if (sortKey == null) return;

    const p = sortNames.safeParse(sortKey);
    if (!p.success) return;

    const newSort: SortState = {
      by: p.data,
      order:
        globalSort?.by === p.data
          ? globalSort.order === "asc"
            ? "desc"
            : "asc"
          : "asc",
    };

    columnPreferencesStore.send({
      type: "setGlobalSort",
      sort: newSort,
    });
  };

  const clearPathPreferences = () => {
    columnPreferencesStore.send({
      type: "clearPathPreferences",
      directoryPath,
    });
  };

  const clearGlobalPreferences = () => {
    columnPreferencesStore.send({
      type: "clearGlobalPreferences",
    });
  };

  const isPathRefreshEnabled =
    (pathPrefs && pathPrefs.length > 0) || !!pathSort;
  const isGlobalRefreshEnabled =
    (globalPrefs && globalPrefs.length > 0) || !!globalSort;

  return (
    <div className="bg-base-200 rounded-xl shadow-4xl w-80 overflow-hidden">
      <h2 className="flex items-center justify-center p-2 bg-base-300">
        Column Preferences
      </h2>
      <div className="flex text-xs">
        {/* Path Preferences */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="text-xs font-semibold border-b border-base-300 p-3 pl-3.5">
            For Directory Path
          </div>
          <div className="space-y-0.5 max-h-96 overflow-y-auto flex-1">
            {pathOrderedColumns.map((col, index) => (
              <ColumnRow
                key={col.id}
                column={col}
                index={index}
                onToggle={() => togglePathVisibility(col.id)}
                onMove={movePathColumn}
                onSort={() => togglePathSort(col.sortKey)}
                currentSort={pathSort}
              />
            ))}
          </div>
          <div className="flex justify-stretch items-stretch border-t border-base-300">
            <button
              className="btn btn-xs btn-ghost gap-1 h-6 min-h-6 w-full rounded-none py-4"
              onClick={clearPathPreferences}
              disabled={!isPathRefreshEnabled}
            >
              <RefreshCcwIcon className="size-3" />
              Reset
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-base-300" />

        {/* Global Preferences */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="text-xs font-semibold border-b border-base-300 p-3 pl-3.5">
            Global
          </div>
          <div className="space-y-0.5 max-h-96 overflow-y-auto flex-1">
            {globalOrderedColumns.map((col, index) => (
              <ColumnRow
                key={col.id}
                column={col}
                index={index}
                onToggle={() => toggleGlobalVisibility(col.id)}
                onMove={moveGlobalColumn}
                onSort={() => toggleGlobalSort(col.sortKey)}
                currentSort={globalSort}
              />
            ))}
          </div>
          <div className="flex justify-stretch items-stretch border-t border-base-300">
            <button
              className="btn btn-xs btn-ghost gap-1 h-6 min-h-6 w-full rounded-none py-4"
              onClick={clearGlobalPreferences}
              disabled={!isGlobalRefreshEnabled}
            >
              <RefreshCcwIcon className="size-3" />
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type ColumnRowProps = {
  column: {
    id: string;
    visible: boolean;
    header: ReactNode;
    sortKey?: string | number;
  };
  index: number;
  onToggle: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onSort: () => void;
  currentSort: SortState | null | undefined;
};

function ColumnRow({
  column,
  index,
  onToggle,
  onMove,
  onSort,
  currentSort,
}: ColumnRowProps) {
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
      onClick={(e) => {
        if (!column.sortKey) return;
        e.stopPropagation();
        onSort();
      }}
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
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
      {column.sortKey &&
        currentSort?.by === column.sortKey &&
        (currentSort.order === "asc" ? (
          <ArrowDownAZIcon className="size-4" />
        ) : (
          <ArrowUpAZIcon className="size-4" />
        ))}
    </div>
  );
}
