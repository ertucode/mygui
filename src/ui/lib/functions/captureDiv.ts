export async function captureDivAsBase64(
  element: HTMLElement,
  filter?: (node: Element) => boolean,
): Promise<string> {
  const clone = element.cloneNode(true) as HTMLElement;

  // traverse the DOM and remove all elements using the filter fn

  clone.style.position = "fixed";
  clone.style.top = "-20000px"; // off screen
  clone.style.left = "0";
  document.body.appendChild(clone);

  const rect = clone.getBoundingClientRect();
  const base64 = await window.electron.captureRect({
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  });

  document.body.removeChild(clone);

  return base64;
}
