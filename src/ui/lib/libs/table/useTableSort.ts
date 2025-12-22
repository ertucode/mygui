import { sortNames } from "@/features/file-browser/config/columns";
import { directoryHelpers } from "@/features/file-browser/directoryStore/directory";

export function onSortKey(key: $Maybe<string | number>) {
  if (key == null)
    return directoryHelpers.setSort((s) => ({
      ...s,
      by: undefined,
      order: !s.by ? "asc" : "desc",
    }));
  const p = sortNames.safeParse(key);
  if (p.success)
    return directoryHelpers.setSort((s) => ({
      ...s,
      by: p.data,
      order:
        s.by === p.data || (!p.data && !s.by) ? toggleOrder(s.order) : "asc",
    }));
  throw new Error(`Invalid key: ${key}`);
}

function toggleOrder(order: $Maybe<"asc" | "desc">) {
  return order === "asc" ? "desc" : "asc";
}
