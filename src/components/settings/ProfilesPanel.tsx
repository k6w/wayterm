import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import type { ShellProfile } from "../../types/settings";

export default function ProfilesPanel() {
  const profiles = useSettingsStore((s) => s.settings.profiles);
  const update = useSettingsStore((s) => s.update);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    setEditingId(newProfile.id);
  };

  const removeProfile = (id: string) => {
    update("profiles", profiles.filter((p) => p.id !== id) as never);
    if (editingId === id) setEditingId(null);
  };

  const updateProfile = (id: string, changes: Partial<ShellProfile>) => {
    update(
      "profiles",
      profiles.map((p) => (p.id === id ? { ...p, ...changes } : p)) as never
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium text-text-primary">Shell Profiles</h3>
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
            No profiles configured. Add a profile to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="border border-border rounded-lg overflow-hidden"
              >
                <div
                  className="flex justify-between items-center px-4 py-2.5 bg-bg-tertiary cursor-pointer"
                  onClick={() => setEditingId(editingId === profile.id ? null : profile.id)}
                >
                  <div>
                    <div className="text-sm text-text-primary">{profile.name}</div>
                    <div className="text-xs text-text-muted">
                      {profile.shellPath || "No shell path"}
                      {profile.workingDirectory ? ` - ${profile.workingDirectory}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProfile(profile.id);
                    }}
                    className="p-1 text-text-muted hover:text-error transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {editingId === profile.id && (
                  <div className="p-4 space-y-4 border-t border-border">
                    <div className="flex justify-between items-center gap-4">
                      <label className="text-sm text-text-secondary">Name</label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => updateProfile(profile.id, { name: e.target.value })}
                        className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
                      />
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <label className="text-sm text-text-secondary">Shell Path</label>
                      <input
                        type="text"
                        value={profile.shellPath}
                        onChange={(e) => updateProfile(profile.id, { shellPath: e.target.value })}
                        placeholder="/bin/zsh"
                        className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
                      />
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <label className="text-sm text-text-secondary">Working Directory</label>
                      <input
                        type="text"
                        value={profile.workingDirectory}
                        onChange={(e) =>
                          updateProfile(profile.id, { workingDirectory: e.target.value })
                        }
                        placeholder="~"
                        className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
