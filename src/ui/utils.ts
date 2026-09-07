export type ClassValue = string | false | null | undefined | 0;

/**
 * Joins class names, skipping falsy values. There is no Tailwind conflict
 * resolution, so never pass a className that fights a variant (two heights,
 * two backgrounds); add a variant instead.
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Visible keyboard focus ring for every interactive kit component. */
export const focusRing = [
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
  // Dialog marks its initially focused control (see Dialog.tsx) so the ring shows after a mouse open.
  "data-[initial-focus]:outline-solid data-[initial-focus]:outline-2 data-[initial-focus]:outline-offset-1 data-[initial-focus]:outline-focus",
].join(" ");

/** Icon size presets: 14px and 16px (spec section 1). Weight comes from the registry / IconWeightProvider. */
export const ICON_SM = { size: 14 } as const;
export const ICON_MD = { size: 16 } as const;

/** Attributes that stop macOS/WebKit rewriting code, commands, paths and hosts as prose. */
export const CODE_TEXT_ATTRS = {
  spellCheck: false,
  autoCorrect: "off",
  autoCapitalize: "off",
  autoComplete: "off",
} as const;
