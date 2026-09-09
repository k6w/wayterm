import { Suspense } from "react";
import { Dialog } from "../../ui";
import { useTerminalStore } from "../../stores/terminal";
import { lazyWithPreload, whenIdle } from "../../lib/lazy";

const PaletteBody = lazyWithPreload(() => import("./PaletteBody"));

// The list content is not needed to open the palette; warm it once startup has settled.
whenIdle(() => void PaletteBody.preload());

function closePalette(): void {
  const { commandPaletteOpen, toggleCommandPalette } = useTerminalStore.getState();
  if (commandPaletteOpen) toggleCommandPalette();
}

/**
 * Command palette (Mod+Shift+P). The body mounts on every open, so the query,
 * the selection and the command list start fresh each time.
 */
export default function CommandPalette() {
  const open = useTerminalStore((s) => s.commandPaletteOpen);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closePalette();
      }}
    >
      {open && (
        <Suspense fallback={null}>
          <PaletteBody />
        </Suspense>
      )}
    </Dialog>
  );
}
