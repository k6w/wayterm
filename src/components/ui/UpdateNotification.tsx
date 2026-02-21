import { useState, useEffect, useCallback } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useSettingsStore } from "../../stores/settings";
import { X, Download, RefreshCw } from "lucide-react";

export default function UpdateNotification() {
  const checkForUpdates = useSettingsStore(
    (s) => s.settings.general.checkForUpdates
  );
  const [update, setUpdate] = useState<Update | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!checkForUpdates) return;
    // Delay the check so it doesn't compete with startup
    const timer = setTimeout(() => {
      check()
        .then((u) => {
          if (u?.available) setUpdate(u);
        })
        .catch(() => {});
    }, 5000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  const handleInstall = useCallback(async () => {
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
          if (totalBytes > 0) {
            setProgress(Math.round((downloadedBytes / totalBytes) * 100));
          }
        }
      });
      await relaunch();
    } catch {
      setInstalling(false);
      setProgress(null);
    }
  }, [update]);

  if (!update || dismissed) return null;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-accent/20 border-b border-accent/30 text-xs text-text-primary shrink-0">
      <div className="flex items-center gap-2">
        <Download size={13} />
        <span>
          Nexterm <strong>v{update.version}</strong> is available
        </span>
      </div>
      <div className="flex items-center gap-2">
        {installing ? (
          <span className="flex items-center gap-1.5 text-text-muted">
            <RefreshCw size={12} className="animate-spin" />
            {progress !== null ? `${progress}%` : "Installing..."}
          </span>
        ) : (
          <button
            onClick={handleInstall}
            className="px-2 py-0.5 rounded bg-accent text-white hover:bg-accent/80 transition-colors cursor-pointer"
          >
            Update & Restart
          </button>
        )}
        {!installing && (
          <button
            onClick={() => setDismissed(true)}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
