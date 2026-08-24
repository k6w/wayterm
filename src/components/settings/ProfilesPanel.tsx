import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Plus, Terminal, Trash2, X } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { getDefaultShells } from "../../lib/shell-detect";
import { Button, EmptyState, IconButton, Input, Section, Select, cn, focusRing, ICON_MD, ICON_SM, ConfirmDialog } from "../../ui";
import { NumberInput, SettingRow, SettingsCard } from "./SettingRow";
import { createProfile, duplicateProfile, nextEnvKey, removeEnvKey, renameEnvKey } from "./profile-utils";
import type { CursorStyle, ShellProfile } from "../../types/settings";

const detectedShells = getDefaultShells();

/** Kit Select values cannot be "" (Radix reserves it): "inherit the global setting" is this sentinel. */
const DEFAULT = "__default__";
const CUSTOM_PATH = "__custom__";

const SHELL_OPTIONS = [
  ...detectedShells.map((s) => ({ value: s.path, label: s.label })),
  { value: CUSTOM_PATH, label: "Custom path…" },
];

const FONT_WEIGHT_OPTIONS = [
  { value: DEFAULT, label: "Default" },
  ...[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) })),
];

const CURSOR_OPTIONS = [
  { value: DEFAULT, label: "Default" },
  { value: "block", label: "Block" },
  { value: "underline", label: "Underline" },
  { value: "bar", label: "Bar" },
];

const LIGATURE_OPTIONS = [
  { value: DEFAULT, label: "Default" },
  { value: "true", label: "Enabled" },
  { value: "false", label: "Disabled" },
];

const isDetectedPath = (shellPath: string) => detectedShells.some((s) => s.path === shellPath);

interface ProfileEditorProps {
  profile: ShellProfile;
  customPath: boolean;
  onCustomPathChange: (on: boolean) => void;
  onChange: (changes: Partial<ShellProfile>) => void;
}

/** The expanded body of one profile. */
function ProfileEditor({ profile, customPath, onCustomPathChange, onChange }: ProfileEditorProps) {
  const themes = useThemeStore((s) => s.themes);
  const themeOptions = [
    { value: DEFAULT, label: "Default" },
    ...Object.values(themes).map((t) => ({ value: t.id, label: t.name })),
  ];
  const envEntries = Object.entries(profile.env);

  return (
    <div className="flex flex-col gap-4 border-t border-border p-3">
      <SettingsCard>
        <SettingRow label="Name">
          {(control) => (
            <Input {...control} value={profile.name} onChange={(e) => onChange({ name: e.target.value })} className="w-56" />
          )}
        </SettingRow>
        <SettingRow label="Shell">
          {(control) => (
            <div className="flex w-56 flex-col gap-2">
              <Select
                {...control}
                value={customPath ? CUSTOM_PATH : profile.shellPath || undefined}
                placeholder="Select shell…"
                options={SHELL_OPTIONS}
                onValueChange={(v) => {
                  if (v === CUSTOM_PATH) {
                    onCustomPathChange(true);
                  } else {
                    onCustomPathChange(false);
                    onChange({ shellPath: v });
                  }
                }}
              />
              {customPath && (
                <Input
                  aria-label="Shell path"
                  value={profile.shellPath}
                  placeholder="/path/to/shell"
                  onChange={(e) => onChange({ shellPath: e.target.value })}
                  code
                />
              )}
            </div>
          )}
        </SettingRow>
        <SettingRow label="Working directory">
          {(control) => (
            <Input
              {...control}
              value={profile.workingDirectory}
              placeholder="~"
              onChange={(e) => onChange({ workingDirectory: e.target.value })}
              code
              className="w-56"
            />
          )}
        </SettingRow>
      </SettingsCard>

      <Section
        title="Arguments"
        actions={
          <Button
            size="xs"
            variant="ghost"
            leadingIcon={<Plus {...ICON_SM} />}
            onClick={() => onChange({ args: [...profile.args, ""] })}
          >
            Add argument
          </Button>
        }
      >
        {profile.args.map((arg, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              aria-label={`Argument ${i + 1}`}
              value={arg}
              placeholder="--flag=value"
              onChange={(e) => onChange({ args: profile.args.map((a, idx) => (idx === i ? e.target.value : a)) })}
              code
            />
            <IconButton
              label={`Remove argument ${i + 1}`}
              icon={<X {...ICON_SM} />}
              onClick={() => onChange({ args: profile.args.filter((_, idx) => idx !== i) })}
            />
          </div>
        ))}
      </Section>

      <Section
        title="Environment variables"
        actions={
          <Button
            size="xs"
            variant="ghost"
            leadingIcon={<Plus {...ICON_SM} />}
            onClick={() => onChange({ env: { ...profile.env, [nextEnvKey(profile.env)]: "" } })}
          >
            Add variable
          </Button>
        }
      >
        {envEntries.map(([key, value], i) => (
          // Keyed by position: renaming keeps the row (and its focus) in place.
          <div key={i} className="flex items-center gap-2">
            <Input
              aria-label={`Variable ${i + 1} name`}
              value={key}
              placeholder="KEY"
              onChange={(e) => onChange({ env: renameEnvKey(profile.env, key, e.target.value) })}
              code
              className="w-36"
            />
            <span aria-hidden className="text-fg-muted">
              =
            </span>
            <Input
              aria-label={`Variable ${i + 1} value`}
              value={value}
              placeholder="value"
              onChange={(e) => onChange({ env: { ...profile.env, [key]: e.target.value } })}
              code
            />
            <IconButton
              label={`Remove variable ${key || i + 1}`}
              icon={<X {...ICON_SM} />}
              onClick={() => onChange({ env: removeEnvKey(profile.env, key) })}
            />
          </div>
        ))}
      </Section>

      <Section title="Appearance overrides">
        <SettingsCard>
          <SettingRow label="Theme">
            {(control) => (
              <Select
                {...control}
                value={profile.themeOverride ?? DEFAULT}
                options={themeOptions}
                onValueChange={(v) => onChange({ themeOverride: v === DEFAULT ? null : v })}
                className="w-52"
              />
            )}
          </SettingRow>
          <SettingRow label="Font family">
            {(control) => (
              <Input
                {...control}
                value={profile.fontFamilyOverride ?? ""}
                placeholder="Default"
                code
                onChange={(e) => onChange({ fontFamilyOverride: e.target.value || null })}
                className="w-52"
              />
            )}
          </SettingRow>
          <SettingRow label="Font size">
            {(control) => (
              <NumberInput
                {...control}
                value={profile.fontSizeOverride}
                min={8}
                max={24}
                placeholder="Default"
                onValueChange={(v) => onChange({ fontSizeOverride: v || null })}
              />
            )}
          </SettingRow>
          <SettingRow label="Font weight">
            {(control) => (
              <Select
                {...control}
                value={profile.fontWeightOverride ? String(profile.fontWeightOverride) : DEFAULT}
                options={FONT_WEIGHT_OPTIONS}
                onValueChange={(v) => onChange({ fontWeightOverride: v === DEFAULT ? null : Number(v) })}
                className="w-52"
              />
            )}
          </SettingRow>
          <SettingRow label="Cursor style">
            {(control) => (
              <Select
                {...control}
                value={profile.cursorStyleOverride ?? DEFAULT}
                options={CURSOR_OPTIONS}
                onValueChange={(v) => onChange({ cursorStyleOverride: v === DEFAULT ? null : (v as CursorStyle) })}
                className="w-52"
              />
            )}
          </SettingRow>
          <SettingRow label="Scrollback lines">
            {(control) => (
              <NumberInput
                {...control}
                value={profile.scrollbackOverride}
                min={0}
                max={100000}
                step={1000}
                placeholder="Default"
                onValueChange={(v) => onChange({ scrollbackOverride: v || null })}
                className="w-28"
              />
            )}
          </SettingRow>
          <SettingRow label="Ligatures">
            {(control) => (
              <Select
                {...control}
                value={profile.ligaturesOverride === null ? DEFAULT : String(profile.ligaturesOverride)}
                options={LIGATURE_OPTIONS}
                onValueChange={(v) => onChange({ ligaturesOverride: v === DEFAULT ? null : v === "true" })}
                className="w-52"
              />
            )}
          </SettingRow>
        </SettingsCard>
      </Section>
    </div>
  );
}

export default function ProfilesPanel() {
  const profiles = useSettingsStore((s) => s.settings.profiles);
  const update = useSettingsStore((s) => s.update);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [customPathIds, setCustomPathIds] = useState<Set<string>>(new Set());

  const save = (next: ShellProfile[]) => update("profiles", next as never);

  const addProfile = () => {
    const profile = createProfile(crypto.randomUUID());
    void save([...profiles, profile]);
    setExpandedId(profile.id);
  };

  const removeProfile = (id: string) => {
    void save(profiles.filter((p) => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const updateProfile = (id: string, changes: Partial<ShellProfile>) => {
    void save(profiles.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  };

  const copyProfile = (profile: ShellProfile) => {
    const copy = duplicateProfile(profile, crypto.randomUUID());
    void save([...profiles, copy]);
    setExpandedId(copy.id);
  };

  const setCustomMode = (id: string, on: boolean) =>
    setCustomPathIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const isCustomPath = (profile: ShellProfile) =>
    customPathIds.has(profile.id) || (profile.shellPath !== "" && !isDetectedPath(profile.shellPath));

  const profileToDelete = profiles.find((p) => p.id === deleteId) ?? null;
  const addButton = (
    <Button size="sm" variant="primary" leadingIcon={<Plus {...ICON_SM} />} onClick={addProfile}>
      Add profile
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <Section title="Available shells">
        {detectedShells.length === 0 ? (
          <EmptyState
            icon={<Terminal {...ICON_MD} />}
            title="No shells detected"
            description="nexterm could not find any shells on this system."
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {detectedShells.map((shell) => (
              <div key={shell.path} className="flex items-center gap-3 rounded-lg border border-border bg-panel px-3 py-2">
                <Terminal {...ICON_MD} aria-hidden className="shrink-0 text-fg-muted" />
                <div className="min-w-0">
                  <p className="text-body font-medium text-fg">{shell.label}</p>
                  <p className="truncate font-mono text-label text-fg-muted">{shell.path}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Custom profiles" description="Reusable shell launch configurations" actions={addButton}>
        {profiles.length === 0 ? (
          <EmptyState
            icon={<Terminal {...ICON_MD} />}
            title="No custom profiles yet"
            description="Add a profile to save a shell, working directory and appearance overrides."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {profiles.map((profile) => {
              const expanded = expandedId === profile.id;
              const bodyId = `profile-${profile.id}`;
              return (
                <div key={profile.id} className="overflow-hidden rounded-lg border border-border bg-panel">
                  <div className="flex items-center gap-1 pr-2">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={bodyId}
                      onClick={() => setExpandedId(expanded ? null : profile.id)}
                      className={cn(
                        "flex min-h-row min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-hover",
                        focusRing
                      )}
                    >
                      {expanded ? (
                        <ChevronDown {...ICON_SM} aria-hidden className="shrink-0 text-fg-muted" />
                      ) : (
                        <ChevronRight {...ICON_SM} aria-hidden className="shrink-0 text-fg-muted" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-body text-fg">{profile.name}</span>
                        <span className="block truncate font-mono text-label text-fg-muted">
                          {profile.shellPath || "No shell path"}
                          {profile.workingDirectory ? ` · ${profile.workingDirectory}` : ""}
                        </span>
                      </span>
                    </button>
                    <IconButton
                      label={`Duplicate ${profile.name}`}
                      icon={<Copy {...ICON_SM} />}
                      onClick={() => copyProfile(profile)}
                    />
                    <IconButton
                      label={`Delete ${profile.name}`}
                      icon={<Trash2 {...ICON_SM} />}
                      onClick={() => setDeleteId(profile.id)}
                    />
                  </div>
                  {expanded && (
                    <div id={bodyId}>
                      <ProfileEditor
                        profile={profile}
                        customPath={isCustomPath(profile)}
                        onCustomPathChange={(on) => setCustomMode(profile.id, on)}
                        onChange={(changes) => updateProfile(profile.id, changes)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete profile"
        message={`Delete "${profileToDelete?.name ?? "this profile"}"? This can't be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteId) removeProfile(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
