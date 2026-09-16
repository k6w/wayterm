# changelog

notable changes to nexterm, newest first. versions follow [semver](https://semver.org).

## v0.9.0 (unreleased)

the big one. nexterm got a full redesign, a proper design kit underneath it, and a round of ssh work that makes connecting to servers safer and quicker.

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

### ssh
- import hosts from `~/.ssh/config`
- quick connect: type `user@host:port` or an ssh config alias into the command palette, connect once or save it
- key files are referenced by path instead of copied into the app
- the host key is checked against `known_hosts` before the terminal runs ssh
- if a host key changes, a new dialog shows the saved and the presented fingerprints side by side. you confirm by typing the end of the new fingerprint, nexterm backs up `known_hosts`, replaces only that key and reconnects
- redesigned connection, host key and port forward dialogs, with inline validation and a live preview of the address

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

### faster
- sftp, serial, git, database, settings, the welcome wizard, the palette body and dialogs load on first use, with prefetch on hover or idle
- unused icon weights are stripped from the bundle (about 181 kb less)

### under the hood
- vitest, jsdom and testing library, with tauri mocks
- eslint with bans on inline styles and color literals, and a suppression ratchet that only shrinks
- lots of small fixes: macos traffic lights stay put on launch and resize, escape on a menu no longer closes settings, child shells identify as nexterm so zsh session restore stays off, and more

## v0.8.0 and earlier

see the [releases page](https://github.com/k6w/nexterm-terminal-app/releases) for older notes.
