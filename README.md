# nexterm

a terminal that does a bit more than terminals usually do. split panes, ssh and sftp, a real git panel, a database client, and a settings screen that actually looks designed. built with tauri, react and rust so it stays fast and small.

## what's in it

- **terminal** gpu-accelerated rendering (xterm.js webgl), split panes, drag-to-reorder tabs
- **ssh** password or key auth, saved connections, jump hosts, known_hosts verification
- **sftp** a dual-pane file browser with a transfer queue and conflict handling
- **port forwarding** local, remote and dynamic tunnels over ssh
- **git** stage, commit, push, pull, branches, stash and a diff viewer right in the sidebar. no repo yet? there's a button for that
- **database** postgres, mysql, sqlite and mongodb with a query editor and history
- **themes** four built in (graphite, frost, ember and paper), all checked for wcag aa contrast, plus custom json themes and iterm/windows terminal import
- **command palette** everything is a keystroke away (ctrl+shift+p)
- **snippets** save commands with variables and run them from anywhere
- **workspaces** save a layout, get it back later
- clipboard history, buffer persistence across restarts, system tray, auto updates
- **native touches** window vibrancy, proper traffic-light handling on macos, per-platform shortcuts

## install

grab the latest build for your os from the [releases](https://github.com/k6w/nexterm-terminal-app/releases) page:

- windows: `.msi` (or the `.exe` installer)
- macos: `.dmg` (apple silicon and intel)
- linux: `.deb` or `.appimage`

## build it yourself

you'll need [node](https://nodejs.org/) 22+ and [rust](https://rustup.rs/) (stable). on linux, grab the system deps first:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libudev-dev pkg-config
```

then:

```bash
npm ci
npm run tauri dev      # run it locally
npm run tauri build    # or build the installers
```

## shortcuts

| what | windows/linux | macos |
|------|---------------|-------|
| new tab | ctrl+t | cmd+t |
| close tab | ctrl+w | cmd+w |
| next tab | ctrl+tab | cmd+tab |
| previous tab | ctrl+shift+tab | cmd+shift+tab |
| split horizontal | ctrl+shift+h | cmd+shift+h |
| split vertical | ctrl+shift+v | cmd+shift+v |
| toggle sidebar | ctrl+b | cmd+b |
| command palette | ctrl+shift+p | cmd+shift+p |
| settings | ctrl+, | cmd+, |
| search | ctrl+f | cmd+f |

all of these are editable in settings.

## under the hood

- front end: react 19, typescript, tailwind v4, xterm.js, zustand, framer motion
- back end: tauri v2, rust, rusqlite, russh, portable-pty
- build: vite 7, github actions

## license

copyright 2026 nexterm
