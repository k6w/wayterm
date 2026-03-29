import { useRef, useState } from "react";
import { Upload, Trash2, Download } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import Select from "../ui/Select";
import type { CursorStyle } from "../../types/settings";

export default function AppearancePanel() {
  const settings = useSettingsStore((s) => s.settings.appearance);
  const update = useSettingsStore((s) => s.update);
  const themes = useThemeStore((s) => s.themes);
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const customThemeIds = useThemeStore((s) => s.customThemeIds);
  const importTheme = useThemeStore((s) => s.importTheme);
  const removeCustomTheme = useThemeStore((s) => s.removeCustomTheme);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const cursorOptions: { value: CursorStyle; label: string }[] = [
    { value: "block", label: "Block" },
    { value: "underline", label: "Underline" },
    { value: "bar", label: "Bar" },
  ];

  const fontWeightOptions = [100, 200, 300, 400, 500, 600, 700, 800, 900].map(
    (w) => ({ value: String(w), label: String(w) })
  );

  const handleThemeChange = (id: string) => {
    setTheme(id);
    update("appearance", { themeId: id });
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const theme = await importTheme(text);
      handleThemeChange(theme.id);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import theme");
    }

    // Reset input so the same file can be re-imported
    e.target.value = "";
  };

  const handleExportTheme = (id: string) => {
    const theme = themes[id];
    if (!theme) return;
    const json = JSON.stringify(theme, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${theme.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const builtinThemes = Object.values(themes).filter(
    (t) => !customThemeIds.has(t.id)
  );
  const customThemes = Object.values(themes).filter((t) =>
    customThemeIds.has(t.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Theme</h3>
        <div className="grid grid-cols-3 gap-3">
          {builtinThemes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              onMouseEnter={() => setTheme(theme.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                activeThemeId === theme.id
                  ? "border-accent bg-accent/10"
                  : "border-border bg-bg-tertiary hover:border-accent/50"
              }`}
            >
              <div
                className="w-6 h-6 rounded-full border border-border shrink-0"
                style={{ background: theme.ui.accent }}
              />
              <div className="min-w-0">
                <div className="text-sm text-text-primary truncate">{theme.name}</div>
                <div className="text-xs text-text-muted capitalize">{theme.variant}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-text-primary">Custom Themes</h3>
          <button
            onClick={handleImportClick}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-border bg-bg-tertiary text-text-secondary hover:border-accent/50 hover:text-text-primary transition-colors"
          >
            <Upload size={12} />
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {importError && (
          <div className="mb-3 px-3 py-2 rounded-md bg-error/10 border border-error/30 text-xs text-error">
            {importError}
          </div>
        )}

        {customThemes.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {customThemes.map((theme) => (
              <div
                key={theme.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  activeThemeId === theme.id
                    ? "border-accent bg-accent/10"
                    : "border-border bg-bg-tertiary hover:border-accent/50"
                }`}
              >
                <button
                  onClick={() => handleThemeChange(theme.id)}
                  onMouseEnter={() => setTheme(theme.id)}
                  className="flex items-center gap-3 text-left flex-1 min-w-0"
                >
                  <div
                    className="w-6 h-6 rounded-full border border-border shrink-0"
                    style={{ background: theme.ui.accent }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm text-text-primary truncate">{theme.name}</div>
                    <div className="text-xs text-text-muted capitalize">{theme.variant}</div>
                  </div>
                </button>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleExportTheme(theme.id)}
                    className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
                    title="Export"
                  >
                    <Download size={12} />
                  </button>
                  <button
                    onClick={() => removeCustomTheme(theme.id)}
                    className="p-1 rounded text-text-muted hover:text-error transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted">
            No custom themes. Import a .json file to get started.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Font</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Font Family</label>
            <input
              type="text"
              value={settings.terminalFontFamily}
              onChange={(e) => update("appearance", { terminalFontFamily: e.target.value })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
            />
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">
              Font Size ({settings.terminalFontSize}px)
            </label>
            <input
              type="range"
              min={8}
              max={24}
              step={1}
              value={settings.terminalFontSize}
              onChange={(e) => update("appearance", { terminalFontSize: Number(e.target.value) })}
              className="w-40 accent-accent"
            />
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Font Weight</label>
            <Select
              value={String(settings.terminalFontWeight)}
              onChange={(v) => update("appearance", { terminalFontWeight: Number(v) })}
              options={fontWeightOptions}
              className="w-28"
            />
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">
              Line Height ({settings.terminalLineHeight.toFixed(1)})
            </label>
            <input
              type="range"
              min={1.0}
              max={2.0}
              step={0.1}
              value={settings.terminalLineHeight}
              onChange={(e) => update("appearance", { terminalLineHeight: Number(e.target.value) })}
              className="w-40 accent-accent"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Cursor</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Cursor Style</label>
            <div className="flex gap-2">
              {cursorOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update("appearance", { cursorStyle: opt.value })}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    settings.cursorStyle === opt.value
                      ? "bg-accent text-white border-accent"
                      : "bg-bg-tertiary text-text-secondary border-border hover:border-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Cursor Blink</label>
            <button
              onClick={() => update("appearance", { cursorBlink: !settings.cursorBlink })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings.cursorBlink ? "bg-accent" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.cursorBlink ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Window</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Vibrancy</label>
            <button
              onClick={() => update("appearance", { vibrancyEnabled: !settings.vibrancyEnabled })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings.vibrancyEnabled ? "bg-accent" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.vibrancyEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className={`flex justify-between items-center gap-4 ${settings.vibrancyEnabled ? "" : "opacity-40 pointer-events-none"}`}>
            <label className="text-sm text-text-secondary">
              Opacity ({settings.windowOpacity.toFixed(2)})
            </label>
            <input
              type="range"
              min={0.3}
              max={1.0}
              step={0.01}
              value={settings.windowOpacity}
              onChange={(e) => update("appearance", { windowOpacity: Number(e.target.value) })}
              className="w-40 accent-accent"
              disabled={!settings.vibrancyEnabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
