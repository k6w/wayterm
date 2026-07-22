import { getEffectiveKeybindings } from "./keybindings";

/**
 * The current shortcut for a keybinding action id ("new-tab", "close-tab",
 * "split-horizontal", ...), honoring user overrides, in the keybindings format
 * the kit's Kbd understands. Undefined when the action has no binding.
 */
export function shortcutFor(actionId: string): string | undefined {
  return getEffectiveKeybindings().find((binding) => binding.id === actionId)?.keys;
}
