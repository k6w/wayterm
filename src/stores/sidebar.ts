import { create } from "zustand";
import { useSettingsStore } from "./settings";

export type SidebarSection = "connections" | "git" | "database" | "clipboard" | "tunnels";

export const SIDEBAR_DEFAULT_WIDTH = 260;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 420;
/** Width changes arrive on every pointer move; persist once the drag settles. */
export const SIDEBAR_WIDTH_SAVE_DELAY_MS = 300;

/** Whole pixels within 200..420; anything that is not a finite number becomes 260. */
export function clampSidebarWidth(px: unknown): number {
  if (typeof px !== "number" || !Number.isFinite(px)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.round(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, px)));
}

interface SidebarState {
  /** Panel shown while expanded. Not persisted; starts on connections. */
  section: SidebarSection;
  collapsed: boolean;
  width: number;
  /** Adopt the persisted prefs once settings have loaded. Tolerates bad values. */
  hydrate: (prefs: { sidebarCollapsed?: unknown; sidebarWidth?: unknown }) => void;
  /** Cmd/Ctrl+B. */
  toggle: () => void;
  /** Expand and show `section`. */
  show: (section: SidebarSection) => void;
  /** Activity bar click: collapse when `section` is already showing, else show it. */
  activate: (section: SidebarSection) => void;
  setWidth: (px: number) => void;
}

let widthSaveTimer: ReturnType<typeof setTimeout> | null = null;

function persistCollapsed(collapsed: boolean) {
  void useSettingsStore
    .getState()
    .update("appearance", { sidebarCollapsed: collapsed })
    .catch(() => {});
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  section: "connections",
  collapsed: true,
  width: SIDEBAR_DEFAULT_WIDTH,

  hydrate: ({ sidebarCollapsed, sidebarWidth }) =>
    set({
      collapsed: typeof sidebarCollapsed === "boolean" ? sidebarCollapsed : true,
      width: clampSidebarWidth(sidebarWidth),
    }),

  toggle: () => {
    const collapsed = !get().collapsed;
    set({ collapsed });
    persistCollapsed(collapsed);
  },

  show: (section) => {
    const wasCollapsed = get().collapsed;
    set({ section, collapsed: false });
    if (wasCollapsed) persistCollapsed(false);
  },

  activate: (section) => {
    const { collapsed, section: current } = get();
    if (!collapsed && current === section) {
      set({ collapsed: true });
      persistCollapsed(true);
      return;
    }
    get().show(section);
  },

  setWidth: (px) => {
    const width = clampSidebarWidth(px);
    if (width === get().width) return;
    set({ width });
    if (widthSaveTimer) clearTimeout(widthSaveTimer);
    widthSaveTimer = setTimeout(() => {
      widthSaveTimer = null;
      void useSettingsStore
        .getState()
        .update("appearance", { sidebarWidth: get().width })
        .catch(() => {});
    }, SIDEBAR_WIDTH_SAVE_DELAY_MS);
  },
}));
