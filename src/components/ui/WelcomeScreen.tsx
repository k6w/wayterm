import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Check, ChevronRight, Rocket, Zap, Globe, GitBranch } from "lucide-react";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { getDefaultShellsVerified } from "../../lib/shell-detect";
import type { ThemeDefinition } from "../../types/theme";
import { isMac } from "../../lib/platform";

type DetectedShell = { type: string; path: string; label: string };

const mod = isMac ? "Cmd" : "Ctrl";

const SHORTCUTS = [
  { keys: `${mod}+T`, action: "New Tab" },
  { keys: `${mod}+W`, action: "Close Tab" },
  { keys: `${mod}+Shift+P`, action: "Command Palette" },
  { keys: `${mod}+B`, action: "Toggle Sidebar" },
  { keys: `${mod}+F`, action: "Search" },
  { keys: `${mod}+,`, action: "Settings" },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -56 : 56, opacity: 0 }),
};

const transition = { duration: 0.22, ease: "easeInOut" as const };

interface WelcomeScreenProps {
  onDismiss: () => void;
}

export function WelcomeScreen({ onDismiss }: WelcomeScreenProps) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [selectedShellPath, setSelectedShellPath] = useState("");
  const [shells, setShells] = useState<DetectedShell[]>([]);
  const [shellsLoading, setShellsLoading] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState("nexterm-dark");

  const themes = useThemeStore((s) => s.themes);
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const previewTheme = useThemeStore((s) => s.previewTheme);
  const update = useSettingsStore((s) => s.update);

  useEffect(() => {
    setSelectedThemeId(activeThemeId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === 1 && shells.length === 0) {
      setShellsLoading(true);
      getDefaultShellsVerified().then((detected) => {
        setShells(detected);
        if (detected.length > 0) setSelectedShellPath(detected[0].path);
        setShellsLoading(false);
      });
    }
    if (step === 2) {
      previewTheme(selectedThemeId);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const handleLaunch = () => {
    if (selectedShellPath) {
      update("general", { defaultShell: selectedShellPath });
    }
    setTheme(selectedThemeId);
    onDismiss();
  };

  return (
    <div className="relative h-full w-full flex flex-col items-center justify-center">
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        Skip
      </button>
      <div className="flex gap-1.5 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === step ? "w-6 bg-accent" : i < step ? "w-1.5 bg-accent/40" : "w-1.5 bg-overlay/10"
            }`}
          />
        ))}
      </div>

      <div className="relative w-full max-w-lg px-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          {step === 0 && (
            <motion.div
              key="s0"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="space-y-8 text-center"
            >
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Terminal size={30} className="text-accent" />
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-semibold text-text-primary mb-2">Welcome to NexTerm</h1>
                <p className="text-sm text-text-muted leading-relaxed">
                  A modern terminal emulator with SSH, Git, SFTP, and more.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-left">
                {[
                  { icon: Zap, title: "Fast", desc: "GPU-accelerated rendering" },
                  { icon: Globe, title: "SSH & SFTP", desc: "Full remote workflow" },
                  { icon: GitBranch, title: "Git", desc: "Built-in Git panel" },
                ].map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="px-3 py-3 rounded-xl bg-overlay/[0.03] border border-border"
                  >
                    <Icon size={16} className="text-accent mb-2" />
                    <p className="text-xs font-medium text-text-primary mb-0.5">{title}</p>
                    <p className="text-[11px] text-text-muted">{desc}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate(1)}
                className="flex items-center gap-2 mx-auto px-6 py-2.5 bg-accent text-white text-sm rounded-lg hover:brightness-110 transition-all font-medium"
              >
                Get started
                <ChevronRight size={15} />
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="s1"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-1">Choose your shell</h2>
                <p className="text-sm text-text-muted">Default shell for new terminal tabs.</p>
              </div>

              {shellsLoading ? (
                <div className="flex items-center justify-center py-10 text-text-muted gap-3">
                  <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  <span className="text-sm">Detecting shells…</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {shells.map((shell) => (
                    <button
                      key={shell.path}
                      onClick={() => setSelectedShellPath(shell.path)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
                        selectedShellPath === shell.path
                          ? "border-accent bg-accent/10"
                          : "border-border bg-bg-tertiary hover:border-accent/40"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-text-primary">{shell.label}</div>
                        <div className="text-xs text-text-muted font-mono mt-0.5">{shell.path}</div>
                      </div>
                      {selectedShellPath === shell.path && (
                        <Check size={15} className="text-accent shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-1">
                <button
                  onClick={() => navigate(0)}
                  className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => navigate(2)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm rounded-lg hover:brightness-110 transition-all"
                >
                  Continue
                  <ChevronRight size={15} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="s2"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-1">Pick a theme</h2>
                <p className="text-sm text-text-muted">Hover to preview. You can change this anytime.</p>
              </div>

              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-0.5">
                {(Object.values(themes) as ThemeDefinition[]).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedThemeId(t.id);
                      previewTheme(t.id);
                    }}
                    onMouseEnter={() => previewTheme(t.id)}
                    onMouseLeave={() => previewTheme(selectedThemeId)}
                    className={`rounded-lg border overflow-hidden text-left transition-all ${
                      selectedThemeId === t.id
                        ? "border-accent ring-1 ring-accent"
                        : "border-border hover:border-border"
                    }`}
                  >
                    <ThemeCard theme={t} selected={selectedThemeId === t.id} />
                  </button>
                ))}
              </div>

              <div className="flex justify-between pt-1">
                <button
                  onClick={() => {
                    previewTheme(selectedThemeId);
                    navigate(1);
                  }}
                  className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => navigate(3)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white text-sm rounded-lg hover:brightness-110 transition-all"
                >
                  Continue
                  <ChevronRight size={15} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="s3"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="space-y-7 text-center"
            >
              <div>
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center">
                    <Rocket size={26} className="text-success" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-text-primary mb-2">You're all set!</h2>
                <p className="text-sm text-text-muted">A few shortcuts to help you get started.</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-left">
                {SHORTCUTS.map((s) => (
                  <div
                    key={s.keys}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-overlay/[0.03] border border-border"
                  >
                    <kbd className="px-1.5 py-0.5 bg-overlay/[0.08] rounded text-[10px] text-text-muted font-mono shrink-0 whitespace-nowrap">
                      {s.keys}
                    </kbd>
                    <span className="text-xs text-text-secondary">{s.action}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  onClick={() => navigate(2)}
                  className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleLaunch}
                  className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white text-sm rounded-lg hover:brightness-110 transition-all font-medium"
                >
                  <Zap size={15} />
                  Launch NexTerm
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ThemeCard({ theme, selected }: { theme: ThemeDefinition; selected: boolean }) {
  return (
    <>
      <div
        className="h-10 w-full flex items-end px-2 pb-1.5 gap-1"
        style={{ backgroundColor: theme.terminal.background }}
      >
        <div className="h-1 rounded-full w-8" style={{ backgroundColor: theme.ui.accent + "bb" }} />
        <div className="h-1 rounded-full w-4" style={{ backgroundColor: theme.terminal.foreground + "44" }} />
        <div className="h-1 rounded-full w-5" style={{ backgroundColor: theme.terminal.foreground + "33" }} />
      </div>
      <div
        className="px-2 py-1.5 flex items-center justify-between gap-1"
        style={{ backgroundColor: theme.ui.bgSecondary }}
      >
        <span
          className="text-[10px] font-medium truncate"
          style={{ color: theme.ui.textSecondary }}
        >
          {theme.name}
        </span>
        {selected && (
          <div
            className="w-3 h-3 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: theme.ui.accent }}
          >
            <Check size={8} color="white" />
          </div>
        )}
      </div>
    </>
  );
}
