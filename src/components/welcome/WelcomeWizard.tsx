import { useEffect, useId, useRef, useState } from "react";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { selectTheme } from "../../lib/theme-selection";
import { getDefaultShellsVerified, type DetectedShell } from "../../lib/shell-detect";
import { shortcutFor } from "../../lib/shortcut-hints";
import { BUILTIN_THEMES } from "../../themes";
import { Button, Input, Kbd, Panel, Select, Slider, Spinner, cn } from "../../ui";
import { ThemePicker } from "../settings/ThemePicker";
import { SettingRow, SettingsCard } from "../settings/SettingRow";

/** Shortcut cheat-sheet on the last step: keybinding action ids, shown with the user's current keys. */
export const CHEAT_SHEET: readonly { id: string; label: string }[] = [
  { id: "new-tab", label: "New tab" },
  { id: "close-tab", label: "Close tab" },
  { id: "command-palette", label: "Command palette" },
  { id: "toggle-sidebar", label: "Toggle sidebar" },
  { id: "search-terminal", label: "Search in terminal" },
  { id: "settings", label: "Settings" },
];

const STEPS = [
  { title: "Welcome to wayterm", description: "A terminal with SSH, SFTP and Git built in. Pick a theme to start; you can change it any time." },
  { title: "Shell and font", description: "Used for every new local terminal." },
  { title: "You're all set", description: "A few shortcuts to get you going. Every action is also in the command palette." },
] as const;

interface WelcomeWizardProps {
  /** Called when the wizard is finished or skipped. */
  onDismiss: () => void;
}

/** First-run setup: theme, shell and font, then a shortcut cheat-sheet. */
export function WelcomeWizard({ onDismiss }: WelcomeWizardProps) {
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const previewTheme = useThemeStore((s) => s.previewTheme);
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const savedShell = useSettingsStore((s) => s.settings.general.defaultShell);
  const update = useSettingsStore((s) => s.update);
  const [shells, setShells] = useState<DetectedShell[] | null>(null);
  const [shellPath, setShellPath] = useState(savedShell);

  useEffect(() => {
    let cancelled = false;
    void getDefaultShellsVerified().then((detected) => {
      if (cancelled) return;
      setShells(detected);
      setShellPath((current) => current || detected[0]?.path || "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Move focus to each step's title so the step change is announced.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const next = async () => {
    if (step === 1 && shellPath) await update("general", { defaultShell: shellPath });
    if (step === STEPS.length - 1) onDismiss();
    else setStep(step + 1);
  };

  const { title, description } = STEPS[step];
  const selectedShell = shells?.find((s) => s.path === shellPath);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto p-6">
      <Panel elevation="panel" className="flex w-full max-w-[600px] flex-col">
        <section aria-labelledby={titleId} className="flex flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="flex gap-1" aria-hidden>
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1 rounded-full transition-all duration-150 ease-out",
                      i === step ? "w-5 bg-accent" : "w-1.5 bg-border-strong"
                    )}
                  />
                ))}
              </span>
              <span className="text-caption text-fg-muted">
                Step {step + 1} of {STEPS.length}
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Skip
            </Button>
          </header>

          <div className="flex flex-col gap-5 px-5 py-5">
            <div>
              <h1
                id={titleId}
                ref={headingRef}
                tabIndex={-1}
                className="text-heading font-semibold text-fg outline-none"
              >
                {title}
              </h1>
              <p className="mt-1 text-body text-fg-muted">{description}</p>
            </div>

            {step === 0 && (
              <ThemePicker
                aria-label="Theme"
                themes={BUILTIN_THEMES}
                value={activeThemeId}
                onValueChange={(id) => void selectTheme(id)}
                onPreview={previewTheme}
              />
            )}

            {step === 1 && (
              <SettingsCard>
                <SettingRow
                  label="Default shell"
                  description={
                    shells === null ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner label="Detecting shells" /> Detecting shells…
                      </span>
                    ) : (
                      <span className="font-mono">{selectedShell?.path ?? shellPath}</span>
                    )
                  }
                >
                  {(control) => (
                    <Select
                      {...control}
                      value={shellPath || undefined}
                      placeholder="Choose a shell"
                      disabled={shells === null}
                      options={(shells ?? []).map((s) => ({ value: s.path, label: s.label }))}
                      onValueChange={setShellPath}
                      className="w-52"
                    />
                  )}
                </SettingRow>
                <SettingRow label="Terminal font family">
                  {(control) => (
                    <Input
                      {...control}
                      value={appearance.terminalFontFamily}
                      onChange={(e) => update("appearance", { terminalFontFamily: e.target.value })}
                      className="w-52 font-mono"
                    />
                  )}
                </SettingRow>
                <SettingRow label="Terminal font size">
                  <Slider
                    aria-label="Terminal font size"
                    value={appearance.terminalFontSize}
                    min={8}
                    max={24}
                    format={(v) => `${v}px`}
                    onValueChange={(v) => update("appearance", { terminalFontSize: v })}
                  />
                </SettingRow>
              </SettingsCard>
            )}

            {step === 2 && (
              <dl className="grid grid-cols-2 gap-2">
                {CHEAT_SHEET.map(({ id, label }) => {
                  const keys = shortcutFor(id);
                  return (
                    <div key={id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                      <dt className="text-label text-fg-secondary">{label}</dt>
                      <dd>{keys ? <Kbd shortcut={keys} /> : <span className="text-caption text-fg-muted">Unbound</span>}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </div>

          <footer className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button variant="primary" onClick={() => void next()}>
              {step === STEPS.length - 1 ? "Start using wayterm" : "Continue"}
            </Button>
          </footer>
        </section>
      </Panel>
    </div>
  );
}
