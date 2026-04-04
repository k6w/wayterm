import { useState } from "react";
import { Plus, Trash2, Terminal, ChevronDown, ChevronUp, Copy, X } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { getDefaultShells } from "../../lib/shell-detect";
import type { ShellProfile, CursorStyle } from "../../types/settings";

const detectedShells = getDefaultShells();

export default function ProfilesPanel() {
  const profiles = useSettingsStore((s) => s.settings.profiles);
  const update = useSettingsStore((s) => s.update);
  const themes = useThemeStore((s) => s.themes);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  return (
    <div className="space-y-8">
      {}
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">
          Available Shells
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {detectedShells.map((shell) => (
            <div
              key={shell.path}
              className="flex items-center gap-3 px-4 py-3 bg-bg-tertiary border border-border rounded-lg"
            >
              <Terminal size={18} className="text-accent shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary">
                  {shell.label}
                </div>
                <div className="text-xs text-text-muted font-mono truncate">
                  {shell.path}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium text-text-primary">
            Custom Profiles
          </h3>
          <button
            onClick={addProfile}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-md transition-colors"
          >
            <Plus size={14} />
            Add Profile
          </button>
        </div>

        {profiles.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-muted border border-border border-dashed rounded-lg">
            No custom profiles yet. Add a profile to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => {
              const isExpanded = expandedId === profile.id;
              const isCustomPath =
                profile.shellPath !== "" &&
                !isDetectedPath(profile.shellPath);

              return (
                <div
                  key={profile.id}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  {}
                  <div
                    className="flex justify-between items-center px-4 py-2.5 bg-bg-tertiary cursor-pointer"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : profile.id)
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-text-muted shrink-0" />
                      ) : (
                        <ChevronDown size={14} className="text-text-muted shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm text-text-primary">
                          {profile.name}
                        </div>
                        <div className="text-xs text-text-muted truncate">
                          {profile.shellPath || "No shell path"}
                          {profile.workingDirectory
                            ? ` — ${profile.workingDirectory}`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateProfile(profile);
                        }}
                        className="p-1 text-text-muted hover:text-text-primary transition-colors shrink-0"
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProfile(profile.id);
                        }}
                        className="p-1 text-text-muted hover:text-error transition-colors shrink-0"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {}
                  {isExpanded && (
                    <div className="p-4 space-y-4 border-t border-border">
                      {}
                      <div className="flex justify-between items-center gap-4">
                        <label className="text-sm text-text-secondary">
                          Name
                        </label>
                        <input
                          type="text"
                          value={profile.name}
                          onChange={(e) =>
                            updateProfile(profile.id, {
                              name: e.target.value,
                            })
                          }
                          className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
                        />
                      </div>

                      {}
                      <div className="flex justify-between items-center gap-4">
                        <label className="text-sm text-text-secondary">
                          Shell
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={
                              isDetectedPath(profile.shellPath)
                                ? profile.shellPath
                                : profile.shellPath === ""
                                  ? ""
                                  : "__custom__"
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "__custom__") {
                                updateProfile(profile.id, {
                                  shellPath: "",
                                });
                              } else {
                                updateProfile(profile.id, {
                                  shellPath: val,
                                });
                              }
                            }}
                            className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none"
                          >
                            <option value="">Select shell...</option>
                            {detectedShells.map((s) => (
                              <option key={s.path} value={s.path}>
                                {s.label}
                              </option>
                            ))}
                            <option value="__custom__">Custom...</option>
                          </select>
                          {isCustomPath && (
                            <input
                              type="text"
                              value={profile.shellPath}
                              onChange={(e) =>
                                updateProfile(profile.id, {
                                  shellPath: e.target.value,
                                })
                              }
                              placeholder="/path/to/shell"
                              className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-40"
                            />
                          )}
                        </div>
                      </div>

                      {}
                      <div className="flex justify-between items-center gap-4">
                        <label className="text-sm text-text-secondary">
                          Working Directory
                        </label>
                        <input
                          type="text"
                          value={profile.workingDirectory}
                          onChange={(e) =>
                            updateProfile(profile.id, {
                              workingDirectory: e.target.value,
                            })
                          }
                          placeholder="~"
                          className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
                        />
                      </div>

                      {}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm text-text-secondary">
                            Arguments
                          </label>
                          <button
                            onClick={() =>
                              updateProfile(profile.id, {
                                args: [...profile.args, ""],
                              })
                            }
                            className="text-xs text-accent hover:text-accent-hover"
                          >
                            + Add Argument
                          </button>
                        </div>
                        <div className="space-y-2">
                          {profile.args.map((arg, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={arg}
                                onChange={(e) => {
                                  const newArgs = [...profile.args];
                                  newArgs[i] = e.target.value;
                                  updateProfile(profile.id, { args: newArgs });
                                }}
                                placeholder="--flag=value"
                                className="flex-1 bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none"
                              />
                              <button
                                onClick={() => {
                                  const newArgs = profile.args.filter((_, idx) => idx !== i);
                                  updateProfile(profile.id, { args: newArgs });
                                }}
                                className="p-1 text-text-muted hover:text-error"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm text-text-secondary">
                            Environment Variables
                          </label>
                          <button
                            onClick={() => {
                              const key = `VAR_${Object.keys(profile.env).length + 1}`;
                              updateProfile(profile.id, {
                                env: { ...profile.env, [key]: "" },
                              });
                            }}
                            className="text-xs text-accent hover:text-accent-hover"
                          >
                            + Add Variable
                          </button>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(profile.env).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={key}
                                onChange={(e) => {
                                  const newEnv = { ...profile.env };
                                  delete newEnv[key];
                                  newEnv[e.target.value] = value;
                                  updateProfile(profile.id, { env: newEnv });
                                }}
                                placeholder="KEY"
                                className="w-32 bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none font-mono"
                              />
                              <span className="text-text-muted">=</span>
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => {
                                  updateProfile(profile.id, {
                                    env: { ...profile.env, [key]: e.target.value },
                                  });
                                }}
                                placeholder="value"
                                className="flex-1 bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none font-mono"
                              />
                              <button
                                onClick={() => {
                                  const newEnv = { ...profile.env };
                                  delete newEnv[key];
                                  updateProfile(profile.id, { env: newEnv });
                                }}
                                className="p-1 text-text-muted hover:text-error"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {}
                      <div className="pt-4 border-t border-border">
                        <h4 className="text-sm font-medium text-text-primary mb-3">
                          Appearance Overrides
                        </h4>

                        {}
                        <div className="flex justify-between items-center gap-4 mb-3">
                          <label className="text-sm text-text-secondary">
                            Theme
                          </label>
                          <select
                            value={profile.themeOverride || ""}
                            onChange={(e) =>
                              updateProfile(profile.id, {
                                themeOverride: e.target.value || null,
                              })
                            }
                            className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
                          >
                            <option value="">Default</option>
                            {Object.values(themes).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {}
                        <div className="flex justify-between items-center gap-4 mb-3">
                          <label className="text-sm text-text-secondary">
                            Font Family
                          </label>
                          <input
                            type="text"
                            value={profile.fontFamilyOverride || ""}
                            onChange={(e) =>
                              updateProfile(profile.id, {
                                fontFamilyOverride: e.target.value || null,
                              })
                            }
                            placeholder="Default"
                            className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
                          />
                        </div>

                        {}
                        <div className="flex justify-between items-center gap-4 mb-3">
                          <label className="text-sm text-text-secondary">
                            Font Size
                          </label>
                          <input
                            type="number"
                            min={8}
                            max={24}
                            value={profile.fontSizeOverride || ""}
                            onChange={(e) =>
                              updateProfile(profile.id, {
                                fontSizeOverride: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            placeholder="Default"
                            className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
                          />
                        </div>

                        {}
                        <div className="flex justify-between items-center gap-4 mb-3">
                          <label className="text-sm text-text-secondary">
                            Font Weight
                          </label>
                          <select
                            value={profile.fontWeightOverride || ""}
                            onChange={(e) =>
                              updateProfile(profile.id, {
                                fontWeightOverride: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
                          >
                            <option value="">Default</option>
                            {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
                              <option key={w} value={w}>
                                {w}
                              </option>
                            ))}
                          </select>
                        </div>

                        {}
                        <div className="flex justify-between items-center gap-4 mb-3">
                          <label className="text-sm text-text-secondary">
                            Cursor Style
                          </label>
                          <select
                            value={profile.cursorStyleOverride || ""}
                            onChange={(e) =>
                              updateProfile(profile.id, {
                                cursorStyleOverride: (e.target.value || null) as CursorStyle | null,
                              })
                            }
                            className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
                          >
                            <option value="">Default</option>
                            <option value="block">Block</option>
                            <option value="underline">Underline</option>
                            <option value="bar">Bar</option>
                          </select>
                        </div>

                        {}
                        <div className="flex justify-between items-center gap-4 mb-3">
                          <label className="text-sm text-text-secondary">
                            Scrollback Lines
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100000}
                            step={1000}
                            value={profile.scrollbackOverride || ""}
                            onChange={(e) =>
                              updateProfile(profile.id, {
                                scrollbackOverride: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            placeholder="Default"
                            className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
                          />
                        </div>

                        {}
                        <div className="flex justify-between items-center gap-4">
                          <label className="text-sm text-text-secondary">
                            Ligatures
                          </label>
                          <select
                            value={profile.ligaturesOverride === null ? "" : String(profile.ligaturesOverride)}
                            onChange={(e) =>
                              updateProfile(profile.id, {
                                ligaturesOverride: e.target.value === "" ? null : e.target.value === "true",
                              })
                            }
                            className="bg-bg-primary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
                          >
                            <option value="">Default</option>
                            <option value="true">Enabled</option>
                            <option value="false">Disabled</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
