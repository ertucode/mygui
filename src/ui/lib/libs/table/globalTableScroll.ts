/**
 * Global utility for scrolling table rows into view without needing refs.
 * Uses data-list-id attribute to identify tables in the DOM.
 */

export function scrollRowIntoViewIfNeeded(
  tableId: string,
  rowIndex: number,
  block: ScrollLogicalPosition = "nearest",
) {
  const tbody = document.querySelector(
    `[data-list-id="${tableId}"]`,
  ) as HTMLTableElement | null;

  if (!tbody) {
    console.warn(`Container with id "${tableId}" not found`);
    return;
  }

  const row = tbody.querySelector(
    `[data-list-item]:nth-child(${rowIndex + 1})`,
  ) as HTMLElement | null;

  if (!row) {
    console.warn(`Row at index ${rowIndex} not found in table "${tableId}"`);
    return;
  }

  const scrollContainer = tbody.closest(".overflow-auto") as HTMLElement | null;

  if (!scrollContainer) {
    console.warn(`Scroll container not found for table "${tableId}"`);
    return;
  }

  const containerRect = scrollContainer.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const isInView =
    rowRect.top >= containerRect.top && rowRect.bottom <= containerRect.bottom;

  if (!isInView) {
    row.scrollIntoView({ block });
  }
}
