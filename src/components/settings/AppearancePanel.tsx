import { useMemo, useState } from "react";
import { Icon } from "../../ui/icons";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { selectTheme } from "../../lib/theme-selection";
import { missingFontWarning } from "../../lib/font-check";
import { pickFile } from "../../lib/pick-file";
import { BUILTIN_THEMES, DEFAULT_THEME_ID } from "../../themes";
import { Badge, Button, EmptyState, IconButton, Input, ListRow, Section, SegmentedControl, Select, Slider, Switch } from "../../ui";
import { SettingRow, SettingsCard } from "./SettingRow";
import { ThemePicker } from "./ThemePicker";
import { THEME_FILE_ACCEPT, exportThemeFile, importThemeFile } from "./theme-files";
import type { AppearanceSettings, CursorStyle, Density } from "../../types/settings";

const CURSOR_OPTIONS: { value: CursorStyle; label: string }[] = [
  { value: "block", label: "Block" },
  { value: "underline", label: "Underline" },
  { value: "bar", label: "Bar" },
];

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
];

const TAB_POSITION_OPTIONS: { value: AppearanceSettings["tabPosition"]; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const DECORATION_OPTIONS: { value: AppearanceSettings["windowDecorations"]; label: string }[] = [
  { value: "custom", label: "Custom" },
  { value: "native", label: "Native" },
];

const FONT_WEIGHT_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => ({
  value: String(w),
  label: String(w),
}));

const clampScale = (v: number) => Math.min(2, Math.max(0.5, Math.round(v * 100) / 100));

const percent = (v: number) => `${Math.round(v * 100)}%`;

/**
 * UI scale is applied on demand (like a game's video settings) rather than
 * live while dragging. Remount it with key={value} so the pending value
 * follows outside changes.
 */
function UiScaleControl({ value, onApply }: { value: number; onApply: (v: number) => void }) {
  const [pending, setPending] = useState(value);
  const dirty = Math.abs(pending - value) > 0.001;
  return (
    <div className="flex flex-col items-end gap-2">
      <Slider
        aria-label="UI scale"
        value={pending}
        min={0.5}
        max={2}
        step={0.05}
        format={percent}
        onValueChange={(v) => setPending(clampScale(v))}
      />
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
  // Continuous controls: the window follows the drag live, the value is saved once it settles.
  const updateLive = useSettingsStore((s) => s.updateLive);
  const themes = useThemeStore((s) => s.themes);
  const activeTheme = useThemeStore((s) => s.active);
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const previewTheme = useThemeStore((s) => s.previewTheme);
  const customThemeIds = useThemeStore((s) => s.customThemeIds);
  const importTheme = useThemeStore((s) => s.importTheme);
  const removeCustomTheme = useThemeStore((s) => s.removeCustomTheme);
  const [importError, setImportError] = useState<string | null>(null);

  const fontWarning = useMemo(() => missingFontWarning(settings.terminalFontFamily), [settings.terminalFontFamily]);
  const customThemes = Object.values(themes).filter((t) => customThemeIds.has(t.id));

  const handleImport = async () => {
    setImportError(null);
    const file = await pickFile(THEME_FILE_ACCEPT);
    if (!file) return;
    try {
      const theme = await importThemeFile(file, importTheme);
      await selectTheme(theme.id);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import theme");
    }
  };

  const handleDelete = async (id: string) => {
    const wasActive = activeThemeId === id;
    await removeCustomTheme(id);
    // The store falls back to the default theme for this session; save that too.
    if (wasActive) await selectTheme(DEFAULT_THEME_ID);
  };

  const importButton = (
    <Button size="sm" leadingIcon={<Icon name="import" size="sm" />} onClick={() => void handleImport()}>
      Import theme…
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <Section title="Theme" description="Applies to the app and every terminal">
        <ThemePicker
          aria-label="Theme"
          themes={BUILTIN_THEMES}
          value={activeThemeId}
          onValueChange={(id) => void selectTheme(id)}
          onPreview={previewTheme}
        />
      </Section>

      <Section
        title="Custom themes"
        description="wayterm (.json), Windows Terminal (.json) or iTerm2 (.itermcolors)"
        actions={importButton}
      >
        {importError && (
          <p role="alert" className="rounded-md border border-danger bg-danger-subtle px-3 py-2 text-label text-danger">
            {importError}
          </p>
        )}
        {customThemes.length === 0 ? (
          <EmptyState
            icon={<Icon name="theme" size="md" />}
            title="No custom themes"
            description="Import a theme file to add it here."
          />
        ) : (
          <SettingsCard className="p-1">
            {customThemes.map((theme) => (
              <ListRow
                key={theme.id}
                label={theme.name}
                description={<span className="capitalize">{theme.variant}</span>}
                selected={activeThemeId === theme.id}
                trailing={activeThemeId === theme.id ? <Badge tone="accent">Active</Badge> : undefined}
                onSelect={() => void selectTheme(theme.id)}
                onPointerEnter={() => previewTheme(theme.id)}
                onPointerLeave={() => previewTheme(null)}
                actions={
                  <>
                    <IconButton
                      label={`Export ${theme.name}`}
                      icon={<Icon name="export" size="sm" />}
                      onClick={() => exportThemeFile(theme)}
                    />
                    <IconButton
                      label={`Delete ${theme.name}`}
                      icon={<Icon name="delete" size="sm" />}
                      onClick={() => void handleDelete(theme.id)}
                    />
                  </>
                }
              />
            ))}
          </SettingsCard>
        )}
      </Section>

      <Section title="Font">
        <SettingsCard>
          <SettingRow label="Terminal font family" description={fontWarning ?? "Use a monospace font"} stacked>
            {(control) => (
              <Input
                {...control}
                value={settings.terminalFontFamily}
                invalid={fontWarning !== null}
                onChange={(e) => update("appearance", { terminalFontFamily: e.target.value })}
                className="font-mono"
              />
            )}
          </SettingRow>
          <SettingRow label="Terminal font size">
            <Slider
              aria-label="Terminal font size"
              value={settings.terminalFontSize}
              min={8}
              max={24}
              format={(v) => `${v}px`}
              onValueChange={(v) => update("appearance", { terminalFontSize: v })}
            />
          </SettingRow>
          <SettingRow label="Font weight">
            {(control) => (
              <Select
                {...control}
                value={String(settings.terminalFontWeight)}
                onValueChange={(v) => update("appearance", { terminalFontWeight: Number(v) })}
                options={FONT_WEIGHT_OPTIONS}
                className="w-28"
              />
            )}
          </SettingRow>
          <SettingRow label="Line height">
            <Slider
              aria-label="Line height"
              value={settings.terminalLineHeight}
              min={1}
              max={2}
              step={0.1}
              format={(v) => v.toFixed(1)}
              onValueChange={(v) => update("appearance", { terminalLineHeight: v })}
            />
          </SettingRow>
        </SettingsCard>
      </Section>

      <Section title="Interface">
        <SettingsCard>
          <SettingRow label="UI font family" stacked>
            {(control) => (
              <Input
                {...control}
                value={settings.uiFontFamily}
                onChange={(e) => update("appearance", { uiFontFamily: e.target.value })}
              />
            )}
          </SettingRow>
          <SettingRow label="UI scale">
            <UiScaleControl
              key={settings.uiScale}
              value={settings.uiScale}
              onApply={(v) => update("appearance", { uiScale: v })}
            />
          </SettingRow>
          <SettingRow label="Density" description="Height of controls and list rows">
            <SegmentedControl
              aria-label="Density"
              value={settings.density}
              onValueChange={(v) => update("appearance", { density: v })}
              options={DENSITY_OPTIONS}
            />
          </SettingRow>
          <SettingRow label="Accent color" description="Overrides the theme accent">
            {(control) => (
              <>
                <input
                  {...control}
                  type="color"
                  value={settings.accentColorOverride ?? activeTheme.chrome.accent}
                  onChange={(e) => update("appearance", { accentColorOverride: e.target.value })}
                  className="h-control w-10 cursor-pointer rounded-md border border-input-border bg-input p-0.5"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={settings.accentColorOverride === null}
                  onClick={() => update("appearance", { accentColorOverride: null })}
                >
                  Reset
                </Button>
              </>
            )}
          </SettingRow>
        </SettingsCard>
      </Section>

      <Section title="Cursor">
        <SettingsCard>
          <SettingRow label="Cursor style">
            <SegmentedControl
              aria-label="Cursor style"
              value={settings.cursorStyle}
              onValueChange={(v) => update("appearance", { cursorStyle: v })}
              options={CURSOR_OPTIONS}
            />
          </SettingRow>
          <SettingRow label="Cursor blink">
            {(control) => (
              <Switch
                {...control}
                checked={settings.cursorBlink}
                onCheckedChange={(v) => update("appearance", { cursorBlink: v })}
              />
            )}
          </SettingRow>
        </SettingsCard>
      </Section>

      <Section title="Window">
        <SettingsCard>
          <SettingRow label="Vibrancy" description="Blur and translucency behind the window">
            {(control) => (
              <Switch
                {...control}
                checked={settings.vibrancyEnabled}
                onCheckedChange={(v) => update("appearance", { vibrancyEnabled: v })}
              />
            )}
          </SettingRow>
          <SettingRow label="Window opacity">
            <Slider
              aria-label="Window opacity"
              value={settings.windowOpacity}
              min={0.1}
              max={1}
              step={0.01}
              disabled={!settings.vibrancyEnabled}
              format={percent}
              onValueChange={(v) => updateLive("appearance", { windowOpacity: v })}
            />
          </SettingRow>
          <SettingRow label="Blur intensity" description="How frosted the translucent window looks">
            <Slider
              aria-label="Blur intensity"
              value={settings.blurIntensity}
              min={0}
              max={1}
              step={0.05}
              disabled={!settings.vibrancyEnabled}
              format={percent}
              onValueChange={(v) => updateLive("appearance", { blurIntensity: v })}
            />
          </SettingRow>
        </SettingsCard>
      </Section>

      <Section title="Layout">
        <SettingsCard>
          <SettingRow label="Tab position">
            <SegmentedControl
              aria-label="Tab position"
              value={settings.tabPosition}
              onValueChange={(v) => update("appearance", { tabPosition: v })}
              options={TAB_POSITION_OPTIONS}
            />
          </SettingRow>
          <SettingRow label="Dim inactive panes" description="Fade split panes that don't have focus">
            {(control) => (
              <Switch
                {...control}
                checked={settings.dimInactivePanes}
                onCheckedChange={(v) => update("appearance", { dimInactivePanes: v })}
              />
            )}
          </SettingRow>
          <SettingRow label="Dim strength">
            <Slider
              aria-label="Dim strength"
              value={settings.inactivePaneDim}
              min={0}
              max={0.6}
              step={0.05}
              disabled={!settings.dimInactivePanes}
              format={percent}
              onValueChange={(v) => updateLive("appearance", { inactivePaneDim: v })}
            />
          </SettingRow>
          <SettingRow label="Window decorations" description="Reloads the window">
            <SegmentedControl
              aria-label="Window decorations"
              value={settings.windowDecorations}
              onValueChange={(v) => {
                void update("appearance", { windowDecorations: v }).then(() => window.location.reload());
              }}
              options={DECORATION_OPTIONS}
            />
          </SettingRow>
        </SettingsCard>
      </Section>
    </div>
  );
}
