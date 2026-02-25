import { useState } from "react";
import { Plus, Trash2, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { getDefaultShells } from "../../lib/shell-detect";
import type { ShellProfile } from "../../types/settings";

const detectedShells = getDefaultShells();

export default function ProfilesPanel() {
  const profiles = useSettingsStore((s) => s.settings.profiles);
  const update = useSettingsStore((s) => s.update);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addProfile = () => {
    const newProfile: ShellProfile = {
      id: crypto.randomUUID(),
      name: "New Profile",
      shellPath: "",
      args: [],
      env: {},
      workingDirectory: "",
      themeOverride: null,
      fontOverride: null,
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

  const isDetectedPath = (shellPath: string) =>
    detectedShells.some((s) => s.path === shellPath);

  return (
    <div className="space-y-8">
      {/* Available Shells */}
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

      {/* Custom Profiles */}
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
                  {/* Collapsible header */}
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
                            ? ` \u2014 ${profile.workingDirectory}`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProfile(profile.id);
                      }}
                      className="p-1 text-text-muted hover:text-error transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="p-4 space-y-4 border-t border-border">
                      {/* Name */}
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

                      {/* Shell Path - dropdown + optional custom input */}
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

                      {/* Working Directory */}
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
