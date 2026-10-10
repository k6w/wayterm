# Changelog

Notable changes to Wayterm, newest first. Versions follow [Semantic Versioning](https://semver.org).

## 0.10.0 - 2026-10-10

The first release as Wayterm.

- Nexterm is now Wayterm. The app, its installers and the repository (now [k6w/wayterm](https://github.com/k6w/wayterm)) carry the new name
- Wayterm is open source under the Apache License 2.0. Keep the NOTICE file and credit the project when you reuse it
- Releases are published in one step after every platform has built, so the update feed always lists every platform
- If you use Nexterm 0.9.0, install Wayterm 0.10.0 once from the releases page. It's a new app identity, so it won't arrive through Nexterm's updater, and it brings your data over on first start
- On first start Wayterm copies your settings, connections, keys, history and scrollback from the old Nexterm data folder, which it leaves untouched
- Shells started by Wayterm see `TERM_PROGRAM=wayterm`. If you added the remote snippet from Settings > Terminal to a server, replace it with the new one

## 0.9.0 - 2026-10-09

Released as Nexterm, before the rename to Wayterm.

The big one. Nexterm got a full redesign, a proper design kit underneath it, command blocks, workspaces that bring back everything you had open, and a round of SSH work that makes connecting to servers safer and quicker.

### Command blocks
- Each command and its output is its own block, with a gutter that shows whether it's running, succeeded or failed, and how long it took
- Click the gutter to select a block, Shift-click to select a range. `⌘↑` / `⌘↓` jump between blocks (`Ctrl+Shift+↑` / `Ctrl+Shift+↓` on Windows and Linux), add Shift to extend the selection, `⌘C` copies the selected output and Escape clears it
- Hover a block for a small toolbar: copy the command, the output or both, re-run it, open the output in a viewer, or copy it as text to share. The same actions are in the right-click menu
- Re-run only types at an idle prompt. Commands Nexterm can't vouch for are pasted for you to review instead of run
- Block keys only apply at the shell prompt, so Vim, tmux and other full-screen apps keep theirs
- Powered by shell integration for zsh, bash and fish, set up automatically for local shells without touching your dotfiles. Prompt and exit marks are signed with a per-session secret, so program output can't fake a block
- Shell integration also reports the working directory, gives exact durations and exit codes to long-command notifications, and records commands in history
- For remote hosts, Settings has a snippet per shell you can paste into the server's rc file
- The status bar tells you when a shell didn't pick up the integration
- Shell integration and command blocks are on by default, and both can be turned off in Settings → Terminal

### Workspaces
- A workspace saves your tabs, splits and panes: local shells with their folders, SSH and SFTP sessions (quick connects too) and serial ports
- Open one to replace your current tabs or add to them, from the sidebar or the command palette
- Each pane can have its own startup commands, which run once the shell is ready
- Rename, duplicate, update from the current layout, and see when each one was last opened
- The last session or a chosen workspace can come back on launch
- Older saved workspaces are migrated to the new format

### Look and feel
- Four new themes: Graphite (the new default), Frost, Ember and Paper. Each covers the app and the terminal palette, and each passes WCAG AA contrast, checked by a test
- The 18 older built-in themes are gone. If you used one, you're moved to Graphite once and told about it. Imported custom themes keep working
- A new design kit with shared buttons, inputs, dialogs, menus, tooltips and toasts, and bundled Inter and JetBrains Mono
- Phosphor icons, with a filled weight for active states
- Window vibrancy follows the theme, and a blur intensity slider fades it smoothly
- A density setting: compact or comfortable
- A three-step welcome wizard on first launch

### Window and terminal
- A unified 36px title bar with the command palette and settings (splitting lives in the status bar)
- An activity bar with a docked, resizable side panel that remembers its width
- Side panel toolbars adapt to the panel's width, down to icon-only buttons with tooltips
- Hairline split panes with a wider divider hit area. Every pane shares the same glass backing as the sidebar
- Inactive pane dimming is softer by default and can be turned off or tuned in Settings > Appearance
- Dragging a tab onto a pane splits it, with drop zones for each side
- Pane controls (detach, close) show on hover and stay out of the way of your output
- Each pane tracks its working directory from the shell's foreground process, so it works in zsh and every other shell
- New local terminals use the shell you picked in Settings, otherwise your login shell
- The search bar shows a match count and key hints
- Native `⌘C` copies land in clipboard history
- Terminals in hidden tabs no longer get resized to nothing
- Command history keeps the newest 10,000 commands

### SSH
- Import hosts from `~/.ssh/config`
- Quick connect: type `user@host:port` or an SSH config alias into the command palette, then connect once or save it
- Key files are referenced by path instead of copied into the app
- The host key is checked against `known_hosts` before the terminal runs SSH
- If a host key changes, a new dialog shows the saved and the presented fingerprints side by side. You confirm by typing the end of the new fingerprint; Nexterm backs up `known_hosts`, replaces only that key and reconnects
- Redesigned connection, host key and port forward dialogs, with inline validation and a live preview of the address
- Saving a connection with environment variables works again, and save errors show up in the dialog
- Nexterm no longer types a `PROMPT_COMMAND` line into remote shells when you connect. Add the snippet from Settings > Terminal to your server's shell config for command blocks and folder tracking over SSH

### Panels
- Command palette rebuilt: suggested items, recents, highlighted matches, drill-in lists and theme swatches
- SFTP: a dual-pane browser with a sortable file table, breadcrumbs, a transfer queue and a conflict dialog. A failed connection shows a retry button
- Git: grouped changes, a commit box, a diff viewer that shows real diffs for staged, unstaged and untracked files, friendlier empty states and work tree detection from subfolders
- Database: a new connection dialog whose fields follow the driver, a query editor, and a dense results grid that scrolls both ways. Query text and results are kept per connection
- Clipboard history, snippets and port forwards moved onto the new kit

### Settings
- Rebuilt with grouped navigation and a search that jumps to and highlights the matching row
- A keybindings table with key glyphs, search and conflict badges
- Appearance with theme cards, live opacity and blur sliders, and the density setting
- Shell lists come from `/etc/shells` and show your current value

### Platforms
- macOS: a monochrome tray icon that matches the menu bar, and traffic lights that stay put on launch and resize
- Windows: the build no longer pulls in Unix-only helpers, the default shell comes from `COMSPEC`, and the tray owns the window icon (Linux too)

### Faster
- SFTP, serial, Git, database, settings, the welcome wizard, the palette body and dialogs load on first use, with prefetch on hover or idle
- Unused icon weights are stripped from the bundle (about 181 KB less)

### Under the hood
- Vitest, jsdom and Testing Library, with Tauri mocks
- ESLint with bans on inline styles and color literals, and a suppression ratchet that only shrinks
- Lots of small fixes: Escape on a menu no longer closes Settings, child shells identify as Nexterm so zsh session restore stays off, and more

## 0.8.0 and earlier

See the [releases page](https://github.com/k6w/wayterm/releases) for older notes.
