import { useRef, useState, useEffect } from "react";
import { Upload, Trash2, Download, Palette } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import Select from "../ui/Select";
import { Button, IconButton } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import {
  SettingsSection,
  SettingRow,
  Toggle,
  SegmentedControl,
  TextField,
  SliderField,
} from "./ui";
import type { CursorStyle, AppearanceSettings } from "../../types/settings";
import { importWindowsTerminalTheme, importItermColorsTheme } from "../../lib/theme-import";
import { customThemeSave } from "../../lib/ipc";

const clampScale = (v: number) => Math.min(2, Math.max(0.5, Math.round(v * 100) / 100));

/** UI scale is applied on demand (like a game's video settings) rather than
 *  live on every drag, and accepts a typed custom value. */
function UiScaleControl({
  value,
  onApply,
}: {
  value: number;
  onApply: (v: number) => void;
}) {
  const [pending, setPending] = useState(value);
  useEffect(() => setPending(value), [value]);
  const dirty = Math.abs(pending - value) > 0.001;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={pending}
          onChange={(e) => setPending(Number(e.target.value))}
          className="h-1 w-36 cursor-pointer accent-accent"
        />
        <div className="relative inline-flex items-center">
          <input
            type="number"
            min={0.5}
            max={2}
            step={0.05}
            value={pending}
            onChange={(e) => setPending(clampScale(Number(e.target.value)))}
            className="w-20 rounded-md border border-border bg-overlay/[0.03] py-1 pl-2 pr-5 text-sm text-text-primary outline-none transition-colors focus:border-accent"
          />
          <span className="pointer-events-none absolute right-2 text-xs text-text-muted">
            x
          </span>
        </div>
      </div>
      {dirty && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setPending(value)}>
            Revert
          </Button>
          <Button size="sm" variant="primary" onClick={() => onApply(clampScale(pending))}>
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AppearancePanel() {
  const settings = useSettingsStore((s) => s.settings.appearance);
  const update = useSettingsStore((s) => s.update);
  const themes = useThemeStore((s) => s.themes);
  const activeTheme = useThemeStore((s) => s.active);
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const previewTheme = useThemeStore((s) => s.previewTheme);
  const customThemeIds = useThemeStore((s) => s.customThemeIds);
  const importTheme = useThemeStore((s) => s.importTheme);
  const removeCustomTheme = useThemeStore((s) => s.removeCustomTheme);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFormatInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [fontWarning, setFontWarning] = useState<string | null>(null);

  useEffect(() => {
    checkFont(settings.terminalFontFamily);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkFont = (fontFamily: string) => {
    if (!fontFamily.trim()) { setFontWarning(null); return; }
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const testStr = "mmmmmmmmli";
      ctx.font = "16px monospace";
      const base = ctx.measureText(testStr).width;
      ctx.font = `16px "${fontFamily}", monospace`;
      const test = ctx.measureText(testStr).width;
      setFontWarning(Math.abs(test - base) < 0.5 ? `Font "${fontFamily}" not found, falling back to monospace` : null);
    } catch {
      setFontWarning(null);
    }
  };

  const cursorOptions: { value: CursorStyle; label: string }[] = [
    { value: "block", label: "Block" },
    { value: "underline", label: "Underline" },
    { value: "bar", label: "Bar" },
  ];

  const tabPositionOptions: { value: AppearanceSettings["tabPosition"]; label: string }[] = [
    { value: "top", label: "Top" },
    { value: "bottom", label: "Bottom" },
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
  ];

  const decorationOptions: { value: AppearanceSettings["windowDecorations"]; label: string }[] = [
    { value: "custom", label: "Custom" },
    { value: "native", label: "Native" },
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

  const handleMultiFormatImportClick = () => {
    setImportError(null);
    multiFormatInputRef.current?.click();
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

    e.target.value = "";
  };

  const handleMultiFormatFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

      let theme;
      if (ext === "itermcolors") {
        theme = importItermColorsTheme(text);
      } else if (ext === "json") {
        // Try Windows Terminal format first, fall back to native NexTerm JSON
        try {
          theme = importWindowsTerminalTheme(text);
        } catch {
          // It's not a WT theme, try native NexTerm format
          const nativeTheme = await importTheme(text);
          handleThemeChange(nativeTheme.id);
          setImportError(null);
          e.target.value = "";
          return;
        }
      } else {
        throw new Error(`Unsupported file type: .${ext}. Use .json or .itermcolors`);
      }

      // Save and register
      await customThemeSave(theme.id, JSON.stringify(theme));
      const { registerTheme } = useThemeStore.getState();
      registerTheme(theme);
      // Mark as custom
      useThemeStore.setState((s) => ({
        themes: { ...s.themes, [theme.id]: theme },
        customThemeIds: new Set([...s.customThemeIds, theme.id]),
      }));
      handleThemeChange(theme.id);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import theme");
    }

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
    const sanitizedId = theme.id.replace(/[^a-zA-Z0-9-_]/g, '_');
    a.download = `${sanitizedId}.json`;
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
    <div className="space-y-8">
      <SettingsSection
        title="Theme"
        description="Applies to app and terminals"
        card={false}
      >
        <div className="grid grid-cols-3 gap-3">
          {builtinThemes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              onMouseEnter={() => previewTheme(theme.id)}
              onMouseLeave={() => previewTheme(null)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                activeThemeId === theme.id
                  ? "border-accent bg-accent/10"
                  : "border-border bg-bg-tertiary hover:border-accent/50"
              }`}
            >
              <div
                className="h-6 w-6 shrink-0 rounded-full border border-border"
                style={{ background: theme.ui.accent }}
              />
              <div className="min-w-0">
                <div className="truncate text-sm text-text-primary">{theme.name}</div>
                <div className="text-xs capitalize text-text-muted">{theme.variant}</div>
              </div>
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Custom Themes"
        card={false}
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="border border-border" onClick={handleImportClick}>
              <Upload size={12} />
              Import JSON
            </Button>
            <Button
              variant="ghost"
              className="border border-border"
              title="Import from Windows Terminal (.json) or iTerm2 (.itermcolors)"
              onClick={handleMultiFormatImportClick}
            >
              <Upload size={12} />
              Import from file
            </Button>
          </div>
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={multiFormatInputRef}
          type="file"
          accept=".json,.itermcolors"
          onChange={handleMultiFormatFileChange}
          className="hidden"
        />

        {importError && (
          <div className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
            {importError}
          </div>
        )}

        {customThemes.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {customThemes.map((theme) => (
              <div
                key={theme.id}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  activeThemeId === theme.id
                    ? "border-accent bg-accent/10"
                    : "border-border bg-bg-tertiary hover:border-accent/50"
                }`}
              >
                <button
                  onClick={() => handleThemeChange(theme.id)}
                  onMouseEnter={() => previewTheme(theme.id)}
                  onMouseLeave={() => previewTheme(null)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div
                    className="h-6 w-6 shrink-0 rounded-full border border-border"
                    style={{ background: theme.ui.accent }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm text-text-primary">{theme.name}</div>
                    <div className="text-xs capitalize text-text-muted">{theme.variant}</div>
                  </div>
                </button>
                <div className="flex shrink-0 gap-1">
                  <IconButton title="Export" onClick={() => handleExportTheme(theme.id)}>
                    <Download size={12} />
                  </IconButton>
                  <IconButton title="Delete" onClick={() => removeCustomTheme(theme.id)}>
                    <Trash2 size={12} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Palette}
            title="No custom themes"
            hint="Import a .json file to get started."
            action={{ label: "Import JSON", onClick: handleImportClick }}
          />
        )}
      </SettingsSection>

      <SettingsSection title="Font">
        <SettingRow label="Terminal font family" description="Use a monospace font">
          <div className="flex flex-col items-end gap-1">
            <TextField
              value={settings.terminalFontFamily}
              mono
              className="w-56"
              onChange={(v) => {
                update("appearance", { terminalFontFamily: v });
                checkFont(v);
              }}
            />
            {fontWarning && (
              <p className="max-w-[224px] text-right text-[11px] leading-tight text-warning">
                {fontWarning}
              </p>
            )}
          </div>
        </SettingRow>
        <SettingRow label="Terminal font size">
          <SliderField
            value={settings.terminalFontSize}
            min={8}
            max={24}
            step={1}
            format={(v) => `${v}px`}
            onChange={(v) => update("appearance", { terminalFontSize: v })}
          />
        </SettingRow>
        <SettingRow label="Font weight">
          <Select
            value={String(settings.terminalFontWeight)}
            onChange={(v) => update("appearance", { terminalFontWeight: Number(v) })}
            options={fontWeightOptions}
            className="w-28"
          />
        </SettingRow>
        <SettingRow label="Line height">
          <SliderField
            value={settings.terminalLineHeight}
            min={1.0}
            max={2.0}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={(v) => update("appearance", { terminalLineHeight: v })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Interface">
        <SettingRow label="UI font family">
          <TextField
            value={settings.uiFontFamily}
            className="w-56"
            onChange={(v) => update("appearance", { uiFontFamily: v })}
          />
        </SettingRow>
        <SettingRow label="UI scale">
          <UiScaleControl
            value={settings.uiScale}
            onApply={(v) => update("appearance", { uiScale: v })}
          />
        </SettingRow>
        <SettingRow label="Compact mode">
          <Toggle
            checked={settings.compactMode}
            onChange={(v) => update("appearance", { compactMode: v })}
          />
        </SettingRow>
        <SettingRow label="Accent color" description="Overrides the theme accent">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.accentColorOverride ?? activeTheme.ui.accent}
              onChange={(e) =>
                update("appearance", { accentColorOverride: e.target.value })
              }
              className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={settings.accentColorOverride === null}
              onClick={() => update("appearance", { accentColorOverride: null })}
            >
              Reset
            </Button>
          </div>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Cursor">
        <SettingRow label="Cursor style">
          <SegmentedControl
            value={settings.cursorStyle}
            onChange={(v) => update("appearance", { cursorStyle: v })}
            options={cursorOptions}
          />
        </SettingRow>
        <SettingRow label="Cursor blink">
          <Toggle
            checked={settings.cursorBlink}
            onChange={(v) => update("appearance", { cursorBlink: v })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Window">
        <SettingRow
          label="Vibrancy"
          description="Blur and translucency behind window"
        >
          <Toggle
            checked={settings.vibrancyEnabled}
            onChange={(v) => update("appearance", { vibrancyEnabled: v })}
          />
        </SettingRow>
        <SettingRow label="Window opacity">
          <SliderField
            value={settings.windowOpacity}
            min={0.1}
            max={1.0}
            step={0.01}
            disabled={!settings.vibrancyEnabled}
            format={(v) => v.toFixed(2)}
            onChange={(v) => update("appearance", { windowOpacity: v })}
          />
        </SettingRow>
        <SettingRow label="Blur intensity">
          <SliderField
            value={settings.blurIntensity}
            min={0}
            max={1}
            step={0.05}
            disabled={!settings.vibrancyEnabled}
            format={(v) => v.toFixed(2)}
            onChange={(v) => update("appearance", { blurIntensity: v })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Layout">
        <SettingRow label="Tab position">
          <SegmentedControl
            value={settings.tabPosition}
            onChange={(v) => update("appearance", { tabPosition: v })}
            options={tabPositionOptions}
          />
        </SettingRow>
        <SettingRow
          label="Window decorations"
          description="Requires restart"
        >
          <SegmentedControl
            value={settings.windowDecorations}
            onChange={(v) => {
              update("appearance", { windowDecorations: v });
              window.location.reload();
            }}
            options={decorationOptions}
          />
        </SettingRow>
      </SettingsSection>
    </div>
  );
}
