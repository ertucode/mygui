import { useDirectory } from "../hooks/useDirectory";
import {
  FileCategoryFilter,
  FILE_TYPE_FILTER_OPTIONS,
} from "../settings";

export type FileBrowserOptionsSectionProps = {
  d: ReturnType<typeof useDirectory>;
};
export function FileBrowserOptionsSection({
  d,
}: FileBrowserOptionsSectionProps) {
  return (
    <div className="flex gap-3">
      <label className="label">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={d.settings.showDotFiles}
          onChange={() => d.toggleShowDotFiles()}
        />
        Show dot files
      </label>
      <label className="label">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={d.settings.foldersOnTop}
          onChange={() => d.toggleFoldersOnTop()}
        />
        Folders on top
      </label>
      <select
        className="select select-sm select-bordered w-32"
        value={d.settings.fileTypeFilter ?? "all"}
        onChange={(e) =>
          d.setFileTypeFilter(e.target.value as FileCategoryFilter)
        }
      >
        {FILE_TYPE_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
