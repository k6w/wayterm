import { useState } from "react";
import { Plus, Trash2, Terminal, ChevronDown, ChevronUp, Copy, X } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { getDefaultShells } from "../../lib/shell-detect";
import Select from "../ui/Select";
import { Button, IconButton } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";
import { SettingsSection, SettingRow, TextField, NumberField } from "./ui";
import type { ShellProfile, CursorStyle } from "../../types/settings";

const detectedShells = getDefaultShells();
const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

export default function ProfilesPanel() {
  const profiles = useSettingsStore((s) => s.settings.profiles);
  const update = useSettingsStore((s) => s.update);
  const themes = useThemeStore((s) => s.themes);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [customPathIds, setCustomPathIds] = useState<Set<string>>(new Set());

  const addProfile = () => {
    const newProfile: ShellProfile = {
      id: crypto.randomUUID(),
      name: "New Profile",
      shellPath: "",
      args: [],
      env: {},
      workingDirectory: "",
      icon: "terminal",
      themeOverride: null,
      fontFamilyOverride: null,
      fontSizeOverride: null,
      fontWeightOverride: null,
      cursorStyleOverride: null,
      scrollbackOverride: null,
      ligaturesOverride: null,
    };
    update("profiles", [...profiles, newProfile] as never);
    setExpandedId(newProfile.id);
  };

  const removeProfile = (id: string) => {
    update("profiles", profiles.filter((p) => p.id !== id) as never);
    if (expandedId === id) setExpandedId(null);
  };

  const updateProfile = (id: string, changes: Partial<ShellProfile>) => {
    update(
      "profiles",
      profiles.map((p) => (p.id === id ? { ...p, ...changes } : p)) as never
    );
  };

  const duplicateProfile = (profile: ShellProfile) => {
    const newProfile: ShellProfile = {
      ...profile,
      id: crypto.randomUUID(),
      name: `${profile.name} (Copy)`,
    };
    update("profiles", [...profiles, newProfile] as never);
    setExpandedId(newProfile.id);
  };

  const isDetectedPath = (shellPath: string) =>
    detectedShells.some((s) => s.path === shellPath);

  const setCustomMode = (id: string, on: boolean) =>
    setCustomPathIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const isCustomPath = (profile: ShellProfile) =>
    customPathIds.has(profile.id) ||
    (profile.shellPath !== "" && !isDetectedPath(profile.shellPath));

  const shellOptions = [
    ...detectedShells.map((s) => ({ value: s.path, label: s.label })),
    { value: "__custom__", label: "Custom path…" },
  ];

  const themeOptions = [
    { value: "", label: "Default" },
    ...Object.values(themes).map((t) => ({ value: t.id, label: t.name })),
  ];

  const profileToDelete = profiles.find((p) => p.id === deleteId) ?? null;

  return (
    <div className="space-y-8">
      <SettingsSection
        title="Available Shells"
        card={false}
      >
        {detectedShells.length === 0 ? (
          <EmptyState
            icon={Terminal}
            title="No shells detected"
            hint="Nexterm couldn't find any shells on this system."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {detectedShells.map((shell) => (
              <div
                key={shell.path}
                className="flex items-center gap-3 rounded-lg border border-border bg-bg-tertiary px-4 py-3"
              >
                <Terminal size={18} className="shrink-0 text-accent" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary">
                    {shell.label}
                  </div>
                  <div className="truncate font-mono text-xs text-text-muted">
                    {shell.path}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Custom Profiles"
        description="Reusable shell launch configurations"
        card={false}
        action={
          <Button variant="primary" size="sm" onClick={addProfile}>
            <Plus size={14} />
            Add Profile
          </Button>
        }
      >
        {profiles.length === 0 ? (
          <EmptyState
            icon={Terminal}
            title="No custom profiles yet"
            hint="Add a profile to save a shell, working directory, and appearance overrides."
            action={{ label: "Add Profile", onClick: addProfile }}
          />
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => {
              const isExpanded = expandedId === profile.id;
              const customPath = isCustomPath(profile);

              return (
                <div
                  key={profile.id}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <div
                    className="flex cursor-pointer items-center justify-between gap-2 bg-bg-tertiary px-4 py-2.5"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : profile.id)
                    }
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {isExpanded ? (
                        <ChevronUp size={14} className="shrink-0 text-text-muted" />
                      ) : (
                        <ChevronDown size={14} className="shrink-0 text-text-muted" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm text-text-primary">
                          {profile.name}
                        </div>
                        <div className="truncate text-xs text-text-muted">
                          {profile.shellPath || "No shell path"}
                          {profile.workingDirectory
                            ? ` · ${profile.workingDirectory}`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex shrink-0 items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconButton
                        title="Duplicate"
                        onClick={() => duplicateProfile(profile)}
                      >
                        <Copy size={14} />
                      </IconButton>
                      <IconButton
                        title="Delete"
                        onClick={() => setDeleteId(profile.id)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-5 border-t border-border p-4">
                      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                        <SettingRow label="Name" htmlFor={`name-${profile.id}`}>
                          <TextField
                            id={`name-${profile.id}`}
                            value={profile.name}
                            onChange={(v) => updateProfile(profile.id, { name: v })}
                            className="w-56"
                          />
                        </SettingRow>

                        <SettingRow label="Shell">
                          <div className="flex w-52 flex-col gap-2">
                            <Select
                              value={
                                customPath ? "__custom__" : profile.shellPath
                              }
                              placeholder="Select shell…"
                              onChange={(v) => {
                                if (v === "__custom__") {
                                  setCustomMode(profile.id, true);
                                } else {
                                  setCustomMode(profile.id, false);
                                  updateProfile(profile.id, { shellPath: v });
                                }
                              }}
                              options={shellOptions}
                              className="w-full"
                            />
                            {customPath && (
                              <TextField
                                value={profile.shellPath}
                                onChange={(v) =>
                                  updateProfile(profile.id, { shellPath: v })
                                }
                                placeholder="/path/to/shell"
                                mono
                                className="w-full"
                              />
                            )}
                          </div>
                        </SettingRow>

                        <SettingRow label="Working Directory">
                          <TextField
                            value={profile.workingDirectory}
                            onChange={(v) =>
                              updateProfile(profile.id, { workingDirectory: v })
                            }
                            placeholder="~"
                            className="w-56"
                          />
                        </SettingRow>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-primary">
                            Arguments
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateProfile(profile.id, {
                                args: [...profile.args, ""],
                              })
                            }
                          >
                            <Plus size={12} />
                            Add Argument
                          </Button>
                        </div>
                        {profile.args.length > 0 && (
                          <div className="space-y-2">
                            {profile.args.map((arg, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <TextField
                                  value={arg}
                                  onChange={(v) => {
                                    const newArgs = [...profile.args];
                                    newArgs[i] = v;
                                    updateProfile(profile.id, { args: newArgs });
                                  }}
                                  placeholder="--flag=value"
                                  mono
                                  className="flex-1"
                                />
                                <IconButton
                                  title="Remove argument"
                                  onClick={() =>
                                    updateProfile(profile.id, {
                                      args: profile.args.filter(
                                        (_, idx) => idx !== i
                                      ),
                                    })
                                  }
                                >
                                  <X size={14} />
                                </IconButton>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-primary">
                            Environment Variables
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const key = `VAR_${Object.keys(profile.env).length + 1}`;
                              updateProfile(profile.id, {
                                env: { ...profile.env, [key]: "" },
                              });
                            }}
                          >
                            <Plus size={12} />
                            Add Variable
                          </Button>
                        </div>
                        {Object.keys(profile.env).length > 0 && (
                          <div className="space-y-2">
                            {Object.entries(profile.env).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2">
                                <TextField
                                  value={key}
                                  onChange={(v) => {
                                    const newEnv = { ...profile.env };
                                    delete newEnv[key];
                                    newEnv[v] = value;
                                    updateProfile(profile.id, { env: newEnv });
                                  }}
                                  placeholder="KEY"
                                  mono
                                  className="w-32"
                                />
                                <span className="text-text-muted">=</span>
                                <TextField
                                  value={value}
                                  onChange={(v) =>
                                    updateProfile(profile.id, {
                                      env: { ...profile.env, [key]: v },
                                    })
                                  }
                                  placeholder="value"
                                  mono
                                  className="flex-1"
                                />
                                <IconButton
                                  title="Remove variable"
                                  onClick={() => {
                                    const newEnv = { ...profile.env };
                                    delete newEnv[key];
                                    updateProfile(profile.id, { env: newEnv });
                                  }}
                                >
                                  <X size={14} />
                                </IconButton>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-text-primary">
                          Appearance Overrides
                        </h4>
                        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                          <SettingRow label="Theme">
                            <Select
                              value={profile.themeOverride || ""}
                              onChange={(v) =>
                                updateProfile(profile.id, {
                                  themeOverride: v || null,
                                })
                              }
                              options={themeOptions}
                              className="w-52"
                            />
                          </SettingRow>

                          <SettingRow label="Font Family">
                            <TextField
                              value={profile.fontFamilyOverride || ""}
                              onChange={(v) =>
                                updateProfile(profile.id, {
                                  fontFamilyOverride: v || null,
                                })
                              }
                              placeholder="Default"
                              className="w-56"
                            />
                          </SettingRow>

                          <SettingRow label="Font Size">
                            <NumberField
                              value={(profile.fontSizeOverride ?? "") as number}
                              min={8}
                              max={24}
                              onChange={(v) =>
                                updateProfile(profile.id, {
                                  fontSizeOverride: v || null,
                                })
                              }
                              className="w-24"
                            />
                          </SettingRow>

                          <SettingRow label="Font Weight">
                            <Select
                              value={
                                profile.fontWeightOverride
                                  ? String(profile.fontWeightOverride)
                                  : ""
                              }
                              onChange={(v) =>
                                updateProfile(profile.id, {
                                  fontWeightOverride: v ? Number(v) : null,
                                })
                              }
                              options={[
                                { value: "", label: "Default" },
                                ...FONT_WEIGHTS.map((w) => ({
                                  value: String(w),
                                  label: String(w),
                                })),
                              ]}
                              className="w-52"
                            />
                          </SettingRow>

                          <SettingRow label="Cursor Style">
                            <Select
                              value={profile.cursorStyleOverride || ""}
                              onChange={(v) =>
                                updateProfile(profile.id, {
                                  cursorStyleOverride: (v || null) as
                                    | CursorStyle
                                    | null,
                                })
                              }
                              options={[
                                { value: "", label: "Default" },
                                { value: "block", label: "Block" },
                                { value: "underline", label: "Underline" },
                                { value: "bar", label: "Bar" },
                              ]}
                              className="w-52"
                            />
                          </SettingRow>

                          <SettingRow label="Scrollback Lines">
                            <NumberField
                              value={(profile.scrollbackOverride ?? "") as number}
                              min={0}
                              max={100000}
                              step={1000}
                              onChange={(v) =>
                                updateProfile(profile.id, {
                                  scrollbackOverride: v || null,
                                })
                              }
                              className="w-32"
                            />
                          </SettingRow>

                          <SettingRow label="Ligatures">
                            <Select
                              value={
                                profile.ligaturesOverride === null
                                  ? ""
                                  : String(profile.ligaturesOverride)
                              }
                              onChange={(v) =>
                                updateProfile(profile.id, {
                                  ligaturesOverride:
                                    v === "" ? null : v === "true",
                                })
                              }
                              options={[
                                { value: "", label: "Default" },
                                { value: "true", label: "Enabled" },
                                { value: "false", label: "Disabled" },
                              ]}
                              className="w-52"
                            />
                          </SettingRow>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>

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
