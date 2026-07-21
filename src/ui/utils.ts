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
export const focusRing =
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";

/** lucide icon presets: 14px and 16px at 1.5 stroke (spec section 1). */
export const ICON_SM = { size: 14, strokeWidth: 1.5 } as const;
export const ICON_MD = { size: 16, strokeWidth: 1.5 } as const;
