# Nexterm

A modern, cross-platform terminal emulator built with Tauri, React, and xterm.js. Features split panes, SSH connection management, 10 built-in themes, workspace persistence, and a glassmorphism UI.

## Features

### Terminal

- **xterm.js** with WebGL-accelerated rendering
- **Split panes** — horizontal and vertical with adjustable ratios, drag-to-resize handles, rounded corners, and gap indicators
- **Tab system** — create, close, reorder (drag-drop), rename (double-click), duplicate, and close-to-right
- **Drag-drop merging** — drag a tab onto a pane to merge it into a split layout with directional drop zones (left/right/top/bottom)
- **Detach pane to tab** — pop any split pane back out into its own tab
- **Shell detection** — auto-detects installed shells per platform:
  - **Windows:** PowerShell 7, PowerShell, CMD, Git Bash, WSL
  - **Unix:** Zsh, Bash, Fish, sh
- **Shell integration** — CWD tracking via OSC title sequences for PowerShell, Bash, Zsh, Fish, and CMD
- **Terminal caching** — xterm instances survive React unmount/remount cycles during splits without losing scrollback or session state
- **Context menu** — right-click for Copy, Paste, Select All, Clear Buffer, Reset Terminal, Split, Detach, Close Pane, and Copy Path

### SSH

- **Connection manager** — save connections with host, port, username, auth method, color tags, folders, and custom sort order
- **Authentication methods** — password, private key, or SSH agent
- **SSH key vault** — import Ed25519/RSA keys (paste PEM), stored in local SQLite database with fingerprint display and one-click public key copy
- **Key file handling** — automatic CRLF normalization, trailing newline enforcement, and platform-appropriate file permissions (Unix `chmod 600`, Windows `icacls`)
- **Jump host support** — connect through an intermediate SSH host
- **Startup commands** — run custom commands on connection with silent CWD tracking injection
- **Connection dialog** — full-featured form with color tag picker, auth method toggle, conditional fields, and jump host selection

### Workspaces

- **Save workspace** — snapshot current tab/pane layout to SQLite
- **Restore workspace** — recreate full split tree with fresh PTY sessions, remapped pane IDs, and correct shell types
- **Manage workspaces** — list, delete, and restore from sidebar with relative timestamps

### Themes

10 built-in themes with full terminal ANSI color definitions and UI token system:

| Theme | Variant |
|-------|---------|
| Nexterm Dark | Dark |
| Nexterm Light | Light |
| Monokai Pro | Dark |
| Dracula | Dark |
| Nord | Dark |
| Solarized Dark | Dark |
| Solarized Light | Light |
| One Dark | Dark |
| Catppuccin Mocha | Dark |
| Tokyo Night | Dark |

Each theme defines: terminal colors (16 ANSI + foreground/background/cursor/selection), UI colors (3 background tiers, 3 text tiers, accent, border, error/warning/success), and blur/opacity values for glassmorphism components.

Themes can be switched from the status bar, command palette, or settings.

### Command Palette

`Ctrl+Shift+P` opens a searchable command palette with:

- All keybinding actions with shortcut display
- Terminal actions (clear, reset, copy path)
- New tab per detected shell
- Theme sub-view with its own search and keyboard navigation

### Status Bar

Interactive bottom bar with:

- **Left:** Shell type (with path tooltip), CWD (click to copy), git branch (stub), pane counter (click to cycle focus), SSH indicator
- **Right:** Clear buffer, split horizontal/vertical, bell toggle, theme picker popup, command palette, settings

### Settings

7 settings panels accessible via `Ctrl+,`:

- **General** — default shell, startup behavior (new tab / restore / workspace), confirm on close
- **Appearance** — theme grid, terminal font (family/size/weight/line-height), UI font, cursor style/blink, window opacity, blur intensity, accent color override, compact mode
- **Terminal** — scrollback lines, copy on select, right-click behavior, bell style, word separators, ligatures, bracketed paste, scroll to bottom on input
- **Keybindings** — visual list of all shortcuts with click-to-record rebinding
- **SSH** — default port, default username, keepalive interval, connection timeout, saved connections list
- **Keys** — SSH key import/management
- **Profiles** — custom shell profiles with args, env vars, working directory, and per-profile theme/font overrides

### Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| New Tab | `Ctrl+T` | `Cmd+T` |
| Close Tab | `Ctrl+W` | `Cmd+W` |
| Toggle Sidebar | `Ctrl+B` | `Cmd+B` |
| Command Palette | `Ctrl+Shift+P` | `Cmd+Shift+P` |
| Settings | `Ctrl+,` | `Cmd+,` |
| Split Right | `Ctrl+Shift+D` | `Cmd+Shift+D` |
| Split Down | `Ctrl+Shift+E` | `Cmd+Shift+E` |
| Close Pane | `Ctrl+Shift+W` | `Cmd+Shift+W` |
| Detach Pane to Tab | `Ctrl+Shift+T` | `Cmd+Shift+T` |
| Next Tab | `Ctrl+Tab` | `Cmd+Tab` |
| Previous Tab | `Ctrl+Shift+Tab` | `Cmd+Shift+Tab` |
| Focus Next Pane | `Ctrl+Alt+]` | `Cmd+Alt+]` |
| Focus Previous Pane | `Ctrl+Alt+[` | `Cmd+Alt+[` |

All shortcuts are rebindable in settings.

### Sidebar

Slide-in panel (`Ctrl+B`) with:

- **Quick Actions** — new tab, new SSH connection, settings
- **Connections** — saved SSH connections with color tags, click to connect, edit/delete
- **Workspaces** — save current layout, restore/delete saved workspaces

## Tech Stack

### Frontend

| Library | Version |
|---------|---------|
| React | 19 |
| TypeScript | 5.9 |
| Vite | 7.3 |
| Tailwind CSS | 4.2 |
| xterm.js | 6.0 |
| Zustand | 5.0 |
| Framer Motion | 12.x |
| Lucide React | 0.575 |
| Tauri API | 2.10 |

### Backend (Rust)

| Crate | Version |
|-------|---------|
| Tauri | 2.x |
| portable-pty | 0.8 |
| rusqlite | 0.32 (bundled) |
| tokio | 1.x |
| serde | 1.x |
| uuid | 1.x |
| window-vibrancy | 0.5 |
| parking_lot | 0.12 |

## Architecture

```
src/
  app/              App shell, providers
  components/
    command-palette/ Searchable command palette with sub-views
    settings/        7 settings panels (General, Appearance, Terminal, Keybindings, SSH, Keys, Profiles)
    sidebar/         Sidebar with quick actions, connections tree, workspace list
    ssh/             SSH connection dialog
    terminal/        TerminalPane, SplitContainer, StatusBar, PaneContextMenu, DropZoneOverlay
    titlebar/        Custom titlebar with TabStrip, Tab, TabContextMenu, WindowControls
    ui/              Shared UI primitives
  lib/               IPC wrapper, keybindings, shell detection, terminal registry, formatters
  stores/            Zustand stores (terminal, theme, settings, ssh, workspace)
  themes/            10 JSON theme definitions
  types/             TypeScript type definitions

src-tauri/src/
  commands/          IPC command handlers (terminal, ssh, settings, workspace)
  db/                SQLite modules (connections, keys, settings, history, workspaces, migrations)
  pty/               PTY session manager
  ssh/               SSH client stubs (keys, tunnels)
  window/            Window vibrancy/blur
  theme/             Backend theme utilities
```

### State Management

5 Zustand stores manage all application state:

- **terminal** — tabs, panes, split trees, active selections, drag-drop state, UI toggles
- **theme** — active theme, theme registry, CSS variable injection
- **settings** — all user preferences with IPC persistence
- **ssh** — connections, keys, active sessions
- **workspace** — workspace CRUD with layout snapshots

### Storage

SQLite database (`nexterm.db`) in the app data directory with WAL mode:

- SSH connection profiles
- SSH keys (public + private PEM)
- User settings (key-value)
- Command history
- Workspace layouts (serialized split trees)

### Terminal Lifecycle

xterm.js instances are stored in a global registry outside React. When a pane unmounts during a split operation, the terminal DOM element and PTY session are preserved in cache. On remount, the cached terminal is reattached to the new container without losing scrollback or session state.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) stable
- [Tauri CLI](https://tauri.app/start/create-project/) v2

### Setup

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

Produces platform-specific installers in `src-tauri/target/release/bundle/`.

## Platform Support

| Platform | Shell Support | Status |
|----------|--------------|--------|
| Windows 11/10 | PowerShell 7, PowerShell, CMD, Git Bash, WSL | Primary |
| macOS 10.15+ | Zsh, Bash, Fish, sh | Supported |
| Linux | Bash, Zsh, Fish, sh | Supported |

## License

Copyright 2026 Nexterm
