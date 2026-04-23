# Nexterm

A modern, cross-platform terminal emulator built with Tauri, React, and Rust. Features split panes, SSH/SFTP management, Git integration, and a glassmorphism UI with 18 built-in themes.

## Features

- **Terminal Emulator** — GPU-accelerated rendering via xterm.js WebGL, split panes (horizontal/vertical), drag-and-drop tab management
- **SSH Connections** — Password and key-based authentication, connection profiles, host key verification via `~/.ssh/known_hosts`
- **SFTP File Browser** — Browse, upload, download, rename, and delete remote files with a transfer queue and conflict resolution
- **Port Forwarding** — Local port forwards through SSH tunnels
- **Git Integration** — Branch management, commit, push, pull, stash, and diff viewer from the sidebar
- **18 Built-in Themes** — Nexterm Dark/Light, Monokai Pro, Dracula, Nord, Solarized, One Dark, Catppuccin Mocha, Tokyo Night, Gruvbox, Rose Pine, Everforest, Kanagawa, GitHub Dark, Vibrant Dark/Light — plus custom theme editor
- **Command Palette** — Quick access to all actions (`Ctrl+Shift+P`)
- **Workspaces** — Save and restore terminal layouts
- **Clipboard Manager** — Clipboard history with search
- **Buffer Persistence** — Restore terminal content across sessions
- **System Tray** — Minimize to tray, single-instance enforcement
- **Auto Updates** — Automatic updates from GitHub Releases
- **Platform Native** — Window vibrancy (macOS/Windows), context menu integration (Windows), keyboard shortcuts

## Installation

Download the latest release for your platform from the [Releases](https://github.com/k6w/nexterm-terminal-app/releases) page:

- **Windows** — `.msi` (recommended) or `.exe` installer
- **macOS** — `.dmg` (Apple Silicon and Intel)
- **Linux** — `.deb` or `.AppImage`

## Build from Source

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/) stable
- Platform-specific dependencies (see below)

### Linux Dependencies

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

### Build

```bash
npm ci
npm run tauri build
```

### Development

```bash
npm ci
npm run tauri dev
```

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|--------------|-------|
| New Tab | `Ctrl+T` | `Cmd+T` |
| Close Tab | `Ctrl+W` | `Cmd+W` |
| Next Tab | `Ctrl+Tab` | `Cmd+Tab` |
| Previous Tab | `Ctrl+Shift+Tab` | `Cmd+Shift+Tab` |
| Split Horizontal | `Ctrl+Shift+H` | `Cmd+Shift+H` |
| Split Vertical | `Ctrl+Shift+V` | `Cmd+Shift+V` |
| Toggle Sidebar | `Ctrl+B` | `Cmd+B` |
| Command Palette | `Ctrl+Shift+P` | `Cmd+Shift+P` |
| Settings | `Ctrl+,` | `Cmd+,` |
| Search | `Ctrl+F` | `Cmd+F` |

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, xterm.js (WebGL), Zustand, Framer Motion
- **Backend:** Tauri v2, Rust, rusqlite, russh, portable-pty
- **Build:** Vite 7, GitHub Actions CI/CD

## License

Copyright 2026 Nexterm
