/**
 * Global utility for scrolling table rows into view without needing refs.
 * Uses data-table-id attribute to identify tables in the DOM.
 */

export function scrollRowIntoViewIfNeeded(
  tableId: string,
  rowIndex: number,
  block: ScrollLogicalPosition = "nearest",
) {
  const table = document.querySelector(
    `table[data-table-id="${tableId}"]`,
  ) as HTMLTableElement | null;

  if (!table) {
    console.warn(`Table with id "${tableId}" not found`);
    return;
  }

  const row = table.querySelector(
    `tbody tr:nth-child(${rowIndex + 1})`,
  ) as HTMLElement | null;

  if (!row) {
    console.warn(`Row at index ${rowIndex} not found in table "${tableId}"`);
    return;
  }

  const scrollContainer = table.closest(".overflow-auto") as HTMLElement | null;

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
