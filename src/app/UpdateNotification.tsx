import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Download, X } from "lucide-react";
import { useSettingsStore } from "../stores/settings";
import { Button, IconButton, Spinner, ICON_SM } from "../ui";

/** How long after launch the update check runs, so it never competes with startup. */
export const UPDATE_CHECK_DELAY_MS = 5000;

/** A thin banner under the title bar when a newer version is available. */
export default function UpdateNotification() {
  const checkForUpdates = useSettingsStore((s) => s.settings.general.checkForUpdates);
  const [update, setUpdate] = useState<Update | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!checkForUpdates) return;
    const timer = setTimeout(() => {
      check()
        .then((found) => {
          if (found?.available) setUpdate(found);
        })
        .catch(() => {});
    }, UPDATE_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  const handleInstall = async () => {
    if (!update) return;
    setInstalling(true);
    setProgress(0);
    try {
      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) setProgress(Math.round((downloadedBytes / totalBytes) * 100));
        }
      });
      await relaunch();
    } catch {
      setInstalling(false);
      setProgress(null);
    }
  };

  if (!update || dismissed) return null;

  return (
    <div
      role="status"
      className="flex h-8 shrink-0 items-center justify-between gap-3 border-b border-border bg-accent-subtle px-3 text-label text-fg"
    >
      <span className="flex items-center gap-2">
        <Download {...ICON_SM} aria-hidden className="text-accent-fg" />
        <span>
          nexterm <strong className="font-semibold">v{update.version}</strong> is available
        </span>
      </span>
      {installing ? (
        <span className="flex items-center gap-2 text-fg-muted">
          <Spinner label="Installing update" />
          {progress !== null ? `${progress}%` : "Installing…"}
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <Button size="xs" variant="primary" onClick={() => void handleInstall()}>
            Update and restart
          </Button>
          <IconButton label="Dismiss update" size="xs" icon={<X {...ICON_SM} />} onClick={() => setDismissed(true)} />
        </span>
      )}
    </div>
  );
}
