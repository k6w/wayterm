import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, KeyRound, Shield, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useSshStore } from "../../stores/ssh";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import Select from "../ui/Select";
import type { SshConnection, AuthMethod } from "../../types/ssh";

interface ConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (connection: SshConnection) => void;
  editConnection?: SshConnection | null;
}

const COLOR_TAGS = [
  { name: "red", value: "#ef4444" },
  { name: "green", value: "#22c55e" },
  { name: "blue", value: "#3b82f6" },
  { name: "yellow", value: "#eab308" },
  { name: "purple", value: "#a855f7" },
  { name: "cyan", value: "#06b6d4" },
  { name: "orange", value: "#f97316" },
  { name: "pink", value: "#ec4899" },
];

const AUTH_METHODS: { id: AuthMethod; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "password", label: "Password", icon: Lock },
  { id: "key", label: "Key", icon: KeyRound },
  { id: "agent", label: "Agent", icon: Shield },
];

function generateId(): string {
  return crypto.randomUUID();
}

function createDefaultFormState() {
  return {
    name: "",
    host: "",
    port: 22,
    username: "",
    authMethod: "password" as AuthMethod,
    password: "",
    privateKeyPath: "",
    selectedKeyId: "",
    passphrase: "",
    colorTag: null as string | null,
    startupCommands: "",
    // Advanced
    jumpHostId: null as string | null,
    themeOverride: null as string | null,
    agentForwarding: false,
    envVars: {} as Record<string, string>,
  };
}

export default function ConnectionDialog({
  isOpen,
  onClose,
  onSave,
  editConnection,
}: ConnectionDialogProps) {
  const [form, setForm] = useState(createDefaultFormState());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");
  const storedKeys = useSshStore((s) => s.keys);
  const allConnections = useSshStore((s) => s.connections);
  const theme = useThemeStore((s) => s.active);
  const themes = useThemeStore((s) => s.themes);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);

  const cardBg = vibrancy
    ? hexToRgba(theme.ui.bgPrimary, vibrancyAlpha(windowOpacity) * 0.92)
    : theme.ui.bgPrimary;

  useEffect(() => {
    if (isOpen) {
      if (editConnection) {
        setForm({
          name: editConnection.name,
          host: editConnection.host,
          port: editConnection.port,
          username: editConnection.username,
          authMethod: editConnection.authMethod,
          password: "",
          privateKeyPath: "",
          selectedKeyId: editConnection.privateKeyId ?? "",
          passphrase: "",
          colorTag: editConnection.colorTag,
          startupCommands: editConnection.startupCommands ?? "",
          jumpHostId: editConnection.jumpHostId ?? null,
          themeOverride: editConnection.themeOverride ?? null,
          agentForwarding: editConnection.agentForwarding ?? false,
          envVars: editConnection.envVars ?? {},
        });
      } else {
        setForm(createDefaultFormState());
      }
      setAdvancedOpen(false);
      setNewEnvKey("");
      setNewEnvVal("");
    }
  }, [isOpen, editConnection]);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const now = new Date().toISOString();

      const connection: SshConnection = {
        id: editConnection?.id ?? generateId(),
        name: form.name.trim(),
        host: form.host.trim(),
        port: form.port,
        username: form.username.trim(),
        authMethod: form.authMethod,
        privateKeyId: form.selectedKeyId || null,
        jumpHostId: form.jumpHostId,
        startupCommands: form.startupCommands.trim() || null,
        colorTag: form.colorTag,
        folderPath: editConnection?.folderPath ?? "/",
        sortOrder: editConnection?.sortOrder ?? 0,
        themeOverride: form.themeOverride,
        agentForwarding: form.agentForwarding,
        envVars: form.envVars,
        createdAt: editConnection?.createdAt ?? now,
        updatedAt: now,
      };

      onSave(connection);
    },
    [form, editConnection, onSave]
  );

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addEnvVar = () => {
    const k = newEnvKey.trim();
    const v = newEnvVal.trim();
    if (!k) return;
    setForm((prev) => ({ ...prev, envVars: { ...prev.envVars, [k]: v } }));
    setNewEnvKey("");
    setNewEnvVal("");
  };

  const removeEnvVar = (key: string) => {
    setForm((prev) => {
      const next = { ...prev.envVars };
      delete next[key];
      return { ...prev, envVars: next };
    });
  };

  const inputClasses =
    "bg-bg-tertiary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:border-accent outline-none w-full transition-colors";

  const labelClasses = "text-sm text-text-secondary mb-1.5 block";

  const keyOptions = [
    { value: "", label: "Use path below instead" },
    ...storedKeys.map((k) => ({
      value: k.id,
      label: `${k.name} (${k.algorithm})`,
    })),
  ];

  // Jump host options: all connections except the one being edited
  const jumpHostOptions = [
    { value: "", label: "None" },
    ...allConnections
      .filter((c) => c.id !== editConnection?.id)
      .map((c) => ({ value: c.id, label: `${c.name} (${c.host}:${c.port})` })),
  ];

  // Theme override options
  const themeOptions = [
    { value: "", label: "Default (inherit)" },
    ...Object.values(themes).map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-lg rounded-xl border border-border overflow-hidden"
            style={{
              backgroundColor: cardBg,
              backdropFilter: vibrancy ? "blur(24px) saturate(1.4)" : undefined,
              WebkitBackdropFilter: vibrancy ? "blur(24px) saturate(1.4)" : undefined,
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-medium text-text-primary">
                {editConnection ? "Edit Connection" : "New Connection"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className={labelClasses}>Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className={inputClasses}
                  placeholder="My Server"
                  required
                />
              </div>

              <div className="grid grid-cols-[1fr_100px] gap-3">
                <div>
                  <label className={labelClasses}>Host</label>
                  <input
                    type="text"
                    value={form.host}
                    onChange={(e) => updateField("host", e.target.value)}
                    className={inputClasses}
                    placeholder="hostname or IP"
                    required
                  />
                </div>
                <div>
                  <label className={labelClasses}>Port</label>
                  <input
                    type="number"
                    value={form.port}
                    onChange={(e) => updateField("port", parseInt(e.target.value, 10) || 22)}
                    className={inputClasses}
                    min={1}
                    max={65535}
                  />
                </div>
              </div>

              <div>
                <label className={labelClasses}>Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => updateField("username", e.target.value)}
                  className={inputClasses}
                  placeholder="root"
                  required
                />
              </div>

              <div>
                <label className={labelClasses}>Auth Method</label>
                <div className="flex gap-2">
                  {AUTH_METHODS.map((method) => {
                    const Icon = method.icon;
                    const isSelected = form.authMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => updateField("authMethod", method.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors flex-1 justify-center ${
                          isSelected
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:border-border-focus"
                        }`}
                      >
                        <Icon size={14} />
                        {method.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.authMethod === "password" && (
                <div>
                  <label className={labelClasses}>Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    className={inputClasses}
                    placeholder="Enter password"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Stored in memory only for this session
                  </p>
                </div>
              )}

              {form.authMethod === "key" && (
                <div className="space-y-3">
                  {storedKeys.length > 0 && (
                    <div>
                      <label className={labelClasses}>Stored Key</label>
                      <Select
                        value={form.selectedKeyId}
                        onChange={(v) => updateField("selectedKeyId", v)}
                        options={keyOptions}
                      />
                    </div>
                  )}
                  {!form.selectedKeyId && (
                    <div>
                      <label className={labelClasses}>Private Key Path</label>
                      <input
                        type="text"
                        value={form.privateKeyPath}
                        onChange={(e) => updateField("privateKeyPath", e.target.value)}
                        className={inputClasses}
                        placeholder="~/.ssh/id_ed25519"
                      />
                    </div>
                  )}
                  <div>
                    <label className={labelClasses}>Passphrase (optional)</label>
                    <input
                      type="password"
                      value={form.passphrase}
                      onChange={(e) => updateField("passphrase", e.target.value)}
                      className={inputClasses}
                      placeholder="Key passphrase"
                      autoComplete="off"
                    />
                  </div>
                </div>
              )}

              {form.authMethod === "agent" && (
                <div className="rounded-lg border border-border bg-bg-tertiary px-4 py-3">
                  <p className="text-sm text-text-secondary">
                    SSH agent forwarding will be used. Make sure your SSH agent is running
                    and has the appropriate keys loaded.
                  </p>
                </div>
              )}

              <div>
                <label className={labelClasses}>Color Tag</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateField("colorTag", null)}
                    className={`w-6 h-6 rounded-full border-2 transition-colors ${
                      form.colorTag === null
                        ? "border-accent bg-bg-tertiary"
                        : "border-border bg-bg-tertiary hover:border-border-focus"
                    }`}
                    title="None"
                  >
                    {form.colorTag === null && (
                      <X size={12} className="text-text-muted mx-auto" />
                    )}
                  </button>
                  {COLOR_TAGS.map((color) => {
                    const isSelected = form.colorTag === color.name;
                    return (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => updateField("colorTag", color.name)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          isSelected
                            ? "border-white scale-110"
                            : "border-transparent hover:scale-110"
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelClasses}>Startup Commands</label>
                <textarea
                  value={form.startupCommands}
                  onChange={(e) => updateField("startupCommands", e.target.value)}
                  className={`${inputClasses} resize-none min-h-[80px]`}
                  placeholder="Commands to run after connection (optional)"
                  rows={3}
                />
              </div>

              {/* Advanced section */}
              <div className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((prev) => !prev)}
                  className="flex items-center justify-between w-full px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  <span className="font-medium">Advanced</span>
                  <ChevronDown
                    size={14}
                    className={`text-text-muted transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {advancedOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
                        {/* Jump Host */}
                        <div>
                          <label className={labelClasses}>Jump Host (ProxyJump)</label>
                          <Select
                            value={form.jumpHostId ?? ""}
                            onChange={(v) => updateField("jumpHostId", v || null)}
                            options={jumpHostOptions}
                          />
                          <p className="mt-1 text-xs text-text-muted">
                            Connect through this host as a bastion/jump server
                          </p>
                        </div>

                        {/* Terminal Theme Override */}
                        <div>
                          <label className={labelClasses}>Terminal Theme Override</label>
                          <Select
                            value={form.themeOverride ?? ""}
                            onChange={(v) => updateField("themeOverride", v || null)}
                            options={themeOptions}
                          />
                        </div>

                        {/* Agent Forwarding */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm text-text-secondary">Agent Forwarding</span>
                            <p className="text-xs text-text-muted mt-0.5">Forward your SSH agent to the remote host</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateField("agentForwarding", !form.agentForwarding)}
                            className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                              form.agentForwarding ? "bg-accent" : "bg-bg-tertiary border border-border"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                form.agentForwarding ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Environment Variables */}
                        <div>
                          <label className={labelClasses}>Environment Variables</label>
                          {Object.keys(form.envVars).length > 0 && (
                            <div className="mb-2 space-y-1.5">
                              {Object.entries(form.envVars).map(([k, v]) => (
                                <div key={k} className="flex items-center gap-2">
                                  <span className="flex-1 min-w-0 px-2 py-1.5 bg-bg-tertiary border border-border rounded-md text-xs font-mono text-text-primary truncate">
                                    {k}={v}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeEnvVar(k)}
                                    className="shrink-0 p-1 text-text-muted hover:text-error transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newEnvKey}
                              onChange={(e) => setNewEnvKey(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEnvVar(); } }}
                              className="flex-1 bg-bg-tertiary border border-border rounded-md px-2 py-1.5 text-xs text-text-primary focus:border-accent outline-none font-mono"
                              placeholder="KEY"
                            />
                            <input
                              type="text"
                              value={newEnvVal}
                              onChange={(e) => setNewEnvVal(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEnvVar(); } }}
                              className="flex-1 bg-bg-tertiary border border-border rounded-md px-2 py-1.5 text-xs text-text-primary focus:border-accent outline-none font-mono"
                              placeholder="value"
                            />
                            <button
                              type="button"
                              onClick={addEnvVar}
                              disabled={!newEnvKey.trim()}
                              className="shrink-0 p-1.5 rounded-md border border-border bg-bg-tertiary text-text-muted hover:text-accent hover:border-accent disabled:opacity-40 transition-colors"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-bg-tertiary border border-border hover:border-accent text-text-primary rounded-md transition-colors"
                >
                  Save
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-md transition-colors font-medium"
                >
                  Save & Connect
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
