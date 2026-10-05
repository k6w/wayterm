# changelog

notable changes to nexterm, newest first. versions follow [semver](https://semver.org).

## 0.9.0 - 2026-10-09

the big one. nexterm got a full redesign, a proper design kit underneath it, command blocks, workspaces that bring back everything you had open, and a round of ssh work that makes connecting to servers safer and quicker.

### command blocks
- each command and its output is its own block, with a gutter that shows whether it's running, succeeded or failed, and how long it took
- click the gutter to select a block, shift+click to select a range. `⌘↑` / `⌘↓` jump between blocks (`ctrl+shift+↑` / `ctrl+shift+↓` on windows and linux), add shift to extend the selection, `⌘C` copies the selected output and escape clears it
- hover a block for a small toolbar: copy the command, the output or both, re-run it, open the output in a viewer, or copy it as text to share. the same actions are in the right-click menu
- re-run only types at an idle prompt. commands nexterm can't vouch for are pasted for you to review instead of run
- block keys only apply at the shell prompt, so vim, tmux and other full-screen apps keep theirs
- powered by shell integration for zsh, bash and fish, set up automatically for local shells without touching your dotfiles. prompt and exit marks are signed with a per-session secret, so program output can't fake a block
- shell integration also reports the working directory, gives exact durations and exit codes to long-command notifications, and records commands in history
- for remote hosts, settings has a snippet per shell you can paste into the server's rc file
- the status bar tells you when a shell didn't pick up the integration
- shell integration and command blocks are on by default and both can be turned off in settings, terminal

### workspaces
- a workspace saves your tabs, splits and panes: local shells with their folders, ssh and sftp sessions (quick connects too) and serial ports
- open one to replace your current tabs or add to them, from the sidebar or the command palette
- each pane can have its own startup commands, which run once the shell is ready
- rename, duplicate, update from the current layout, and see when each one was last opened
- the last session or a chosen workspace can come back on launch
- older saved workspaces are migrated to the new format

### look and feel
- four new themes: graphite (the new default), frost, ember and paper. each covers the app and the terminal palette, and each passes wcag aa contrast, checked by a test
- the 18 older built-in themes are gone. if you used one, you're moved to graphite once and told about it. imported custom themes keep working
- a new design kit with shared buttons, inputs, dialogs, menus, tooltips and toasts, and bundled inter and jetbrains mono
- phosphor icons, with a filled weight for active states
- window vibrancy follows the theme, and a blur intensity slider fades it smoothly
- a density setting: compact or comfortable
- a three-step welcome wizard on first launch

### window and terminal
- a unified 36px title bar with the palette, split and settings buttons
- an activity bar with a docked, resizable side panel that remembers its width
- hairline split panes with focus dimming and a wider divider hit area
- dragging a tab onto a pane splits it, with drop zones for each side
- pane controls (detach, close) show on hover and stay out of the way of your output
- each pane tracks its working directory from the shell's foreground process, so it works in zsh and every other shell
- new local terminals use the shell you picked in settings, otherwise your login shell
- the search bar shows a match count and key hints
- native `⌘C` copies land in clipboard history
- terminals in hidden tabs no longer get resized to nothing
- command history keeps the newest 10,000 commands

### ssh
- import hosts from `~/.ssh/config`
- quick connect: type `user@host:port` or an ssh config alias into the command palette, connect once or save it
- key files are referenced by path instead of copied into the app
- the host key is checked against `known_hosts` before the terminal runs ssh
- if a host key changes, a new dialog shows the saved and the presented fingerprints side by side. you confirm by typing the end of the new fingerprint, nexterm backs up `known_hosts`, replaces only that key and reconnects
- redesigned connection, host key and port forward dialogs, with inline validation and a live preview of the address
- saving a connection with env vars works again, and save errors show up in the dialog

### panels
- command palette rebuilt: suggested items, recents, highlighted matches, drill-in lists and theme swatches
- sftp: a dual-pane browser with a sortable file table, breadcrumbs, a transfer queue and a conflict dialog. a failed connection shows a retry button
- git: grouped changes, a commit box, a diff viewer that shows real diffs for staged, unstaged and untracked files, friendlier empty states and work tree detection from subfolders
- database: a new connection dialog whose fields follow the driver, a query editor, and a dense results grid that scrolls both ways. query text and results are kept per connection
- clipboard history, snippets and port forwards moved onto the new kit

### settings
- rebuilt with grouped navigation and a search that jumps to and highlights the matching row
- a keybindings table with key glyphs, search and conflict badges
- appearance with theme cards, live opacity and blur sliders, and the density setting
- shell lists come from `/etc/shells` and show your current value

### platforms
- macos: a monochrome tray icon that matches the menu bar, and traffic lights that stay put on launch and resize
- windows: the build no longer pulls in unix-only helpers, the default shell comes from `COMSPEC`, and the tray owns the window icon (linux too)

### faster
- sftp, serial, git, database, settings, the welcome wizard, the palette body and dialogs load on first use, with prefetch on hover or idle
- unused icon weights are stripped from the bundle (about 181 kb less)

### under the hood
- vitest, jsdom and testing library, with tauri mocks
- eslint with bans on inline styles and color literals, and a suppression ratchet that only shrinks
- lots of small fixes: escape on a menu no longer closes settings, child shells identify as nexterm so zsh session restore stays off, and more

## v0.8.0 and earlier

see the [releases page](https://github.com/k6w/nexterm-terminal-app/releases) for older notes.
