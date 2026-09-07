import { Icon } from "../../ui/icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSettingsStore } from "../../stores/settings";
import { isMac } from "../../lib/platform";
import { cn, focusRing } from "../../ui";

// Windows/Linux caption buttons keep the native 46px-wide geometry, so they
// are styled with kit tokens rather than the square kit IconButton.
const CAPTION = cn(
  "flex h-full w-[46px] items-center justify-center text-fg-muted transition-colors duration-150 ease-out",
  focusRing
);

export default function WindowControls() {
  const closeToTray = useSettingsStore((s) => s.settings.general.closeToTray);
  if (isMac) return null;
  const appWindow = getCurrentWindow();

  return (
    <div data-no-drag className="flex h-full shrink-0 items-stretch">
      <button
        type="button"
        aria-label="Minimize"
        className={cn(CAPTION, "hover:bg-hover hover:text-fg")}
        onClick={() => void appWindow.minimize()}
      >
        <Icon name="minimize" size="md" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Maximize"
        className={cn(CAPTION, "hover:bg-hover hover:text-fg")}
        onClick={() => void appWindow.toggleMaximize()}
      >
        <Icon name="maximize" size="sm" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Close"
        className={cn(CAPTION, "hover:bg-danger hover:text-fg-on-accent")}
        onClick={() => void (closeToTray ? appWindow.hide() : appWindow.close())}
      >
        <Icon name="close" size="md" aria-hidden />
      </button>
    </div>
  );
}
