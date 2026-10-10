# wayterm themes

wayterm ships four built-in themes and imports custom themes from JSON. A theme has two parts: `chrome` (the app UI) and `terminal` (the terminal palette).

## built-in themes

| theme | id | variant | character | accent |
|---|---|---|---|---|
| Graphite (default) | `graphite` | dark | neutral grey | blue |
| Frost | `frost` | dark | cool blue-black | cyan |
| Ember | `ember` | dark | warm charcoal | amber |
| Paper | `paper` | light | light | blue |

Every built-in theme passes WCAG AA: body text reaches at least 4.5:1 on every surface it is drawn on, and the focus ring reaches 3:1. `src/themes/builtin.test.ts` enforces this.

### removed themes

The redesign replaced the 18 older built-ins (the original Dark/Light defaults, Dracula, Nord, Monokai Pro, Solarized Dark/Light, One Dark Pro, Catppuccin Mocha, Tokyo Night, Gruvbox Dark/Light, Rose Pine, Everforest Dark, Kanagawa, GitHub Dark, Vibrant Dark/Light). If you were using one, wayterm switches you to Graphite on first launch and tells you once. Custom themes you imported earlier keep working.

## creating a custom theme

The easiest start is to copy `src/themes/graphite.json` (or `paper.json` for a light theme), change `id` and `name`, and edit the colors.

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "variant": "dark",
  "chrome": {
    "canvas": "#0f1012",
    "panel": "#151618",
    "...": "all 41 chrome tokens are required, see the table below"
  },
  "terminal": {
    "foreground": "#d8dae0",
    "background": "#0f1012",
    "cursor": "#5b95ff",
    "cursorAccent": "#0f1012",
    "selection": "#2f6be066",
    "ansi": [
      "#1c1d20", "#f87171", "#4ade80", "#fbbf24",
      "#60a5fa", "#c084fc", "#22d3ee", "#d8dae0",
      "#5c5f66", "#fca5a5", "#86efac", "#fde68a",
      "#93c5fd", "#d8b4fe", "#67e8f9", "#f4f4f6"
    ]
  }
}
```

### rules

- Colors are hex only: `#rrggbb`, or `#rrggbbaa` where a token allows transparency. `rgb()`, `hsl()` and color names are rejected.
- Tokens marked **opaque** below must be `#rrggbb`.
- `id` is 1 to 64 letters, digits, `.`, `_` or `-`, and cannot be `graphite`, `frost`, `ember` or `paper`.
- `name` is 1 to 64 characters.
- `variant` is `"dark"` or `"light"`. It sets native UI bits such as scrollbars.
- Unknown fields are ignored. If something is wrong, the import error names the field, for example `chrome.canvas must be an opaque hex color (#rrggbb)`.
- Aim for the same contrast as the built-ins: 4.5:1 for text tokens on the surfaces listed in the table.

## root fields

| field | type | description |
|---|---|---|
| `id` | string | unique identifier |
| `name` | string | display name in settings and the theme pickers |
| `variant` | `"dark"` or `"light"` | light or dark native styling |
| `chrome` | object | the 41 UI tokens below |
| `terminal` | object | terminal colors |
| `blur` | object, optional | vibrancy blur in px: `sidebar` (20), `blocks` (4), `inputBar` (12), `overlay` (30) |
| `opacity` | object, optional | vibrancy opacity: `sidebar` (0.4), `blocks` (0.05), `inputBar` (0.08) |

## `chrome` tokens

| token | opaque | used for |
|---|---|---|
| `canvas` | yes | window background, the lowest surface |
| `panel` | yes | sidebars, panels, dialogs |
| `raised` | yes | cards, menus, popovers |
| `hover` | | hovered rows and buttons |
| `active` | | pressed rows and buttons |
| `scrim` | | dimmed backdrop behind dialogs (usually translucent) |
| `border` | yes | default 1px hairline |
| `borderStrong` | | input and button outlines |
| `borderSubtle` | | dividers inside a panel |
| `text` | yes | primary text (4.5:1 on canvas, panel, raised, hover, active, tabBar, tabActive, statusBar, inputBg) |
| `textSecondary` | yes | secondary text (4.5:1 on canvas, panel, raised, hover, tabBar, tabActive, statusBar) |
| `textMuted` | yes | labels, hints, status bar text (4.5:1 on canvas, panel, raised, tabBar, statusBar) |
| `textDisabled` | | disabled text (no contrast requirement) |
| `textOnAccent` | | text on accent buttons (4.5:1 on accent, accentHover, accentActive) |
| `accent` | yes | primary action, selection marks |
| `accentHover` | yes | primary action hover |
| `accentActive` | | primary action pressed |
| `accentSubtle` | | selected row background (usually translucent) |
| `accentText` | | accent-colored text and checkmarks (4.5:1 on canvas, panel, raised) |
| `focusRing` | yes | keyboard focus ring (3:1 on canvas and panel) |
| `selection` | | selected text in the UI |
| `success` | yes | success text and icons (4.5:1 on canvas and panel) |
| `successSubtle` | | success badge background |
| `warning` | yes | warning text and icons (4.5:1 on canvas and panel) |
| `warningSubtle` | | warning badge background |
| `danger` | yes | errors, destructive actions (4.5:1 on canvas and panel) |
| `dangerSubtle` | | danger badge and destructive hover background |
| `info` | | informational text and icons (4.5:1 on canvas and panel) |
| `infoSubtle` | | info badge background |
| `inputBg` | | text field and select background |
| `inputBorder` | | text field and select outline |
| `tabBar` | | tab strip background |
| `tabActive` | | active tab background |
| `statusBar` | | status bar background |
| `tooltipBg` | | tooltip background |
| `tooltipText` | | tooltip text (4.5:1 on tooltipBg) |
| `kbdBg` | | shortcut chip background |
| `kbdText` | | shortcut chip text (4.5:1 on kbdBg) |
| `scrollbarThumb` | | scrollbar thumb (usually translucent) |
| `scrollbarThumbHover` | | hovered scrollbar thumb |
| `shadow` | | shadow color of floating overlays (usually translucent) |

## `terminal` colors

| field | format | description |
|---|---|---|
| `foreground` | `#rrggbb` | default text (aim for 4.5:1 on `background`) |
| `background` | `#rrggbb` | terminal background |
| `cursor` | `#rrggbb` | cursor |
| `cursorAccent` | `#rrggbb` | text under a block cursor (usually the background) |
| `selection` | `#rrggbb` or `#rrggbbaa` | selection highlight (usually translucent) |
| `ansi` | 16 x `#rrggbb` | ANSI palette, in the order below |

```
index  name           usage
0      black          normal black
1      red            errors, deletions
2      green          success, additions
3      yellow         warnings, highlights
4      blue           info, links
5      magenta        special keywords
6      cyan           strings, secondary
7      white          normal white
8      bright black   comments, muted text
9      bright red
10     bright green
11     bright yellow
12     bright blue
13     bright magenta
14     bright cyan
15     bright white   emphasis text
```

## importing a theme

1. Open **Settings > Appearance**.
2. Click **Import JSON** in the custom themes section and pick your file.
3. The theme is applied and saved in the app database, so it survives updates.

The same section also imports Windows Terminal color schemes (`.json`) and iTerm2 presets (`.itermcolors`); wayterm derives the `chrome` tokens from the terminal colors.

### older theme files

Theme files made for wayterm before the redesign use a 13-color `ui` block instead of `chrome`. They still import: wayterm converts `ui` to `chrome` (translucent `rgba()` values are flattened onto the background). New themes should use `chrome`.
