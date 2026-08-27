const OVERLAY_SELECTOR = [
  "[data-radix-popper-content-wrapper]",
  "[role=listbox]",
  "[role=menu]",
  "[role=dialog]",
  "[role=alertdialog]",
].join(",");

/**
 * True while a Radix layer (select, menu, popover, dialog) is open. Radix closes the
 * topmost layer on Escape, so global Escape handlers must leave the key alone then.
 */
export function isOverlayOpen(): boolean {
  return document.querySelector(OVERLAY_SELECTOR) !== null;
}
