# Nexterm Themes

Nexterm supports 16 built-in themes and unlimited custom themes via JSON import.

## Built-in Themes

| Theme | Variant | Accent |
|-------|---------|--------|
| Nexterm Dark | dark | Blue |
| Nexterm Light | light | Blue |
| Monokai Pro | dark | Yellow |
| Dracula | dark | Purple |
| Nord | dark | Cyan |
| Solarized Dark | dark | Blue |
| Solarized Light | light | Blue |
| One Dark | dark | Blue |
| Catppuccin Mocha | dark | Mauve |
| Tokyo Night | dark | Blue |
| Gruvbox Dark | dark | Yellow |
| Gruvbox Light | light | Yellow |
| Rose Pine | dark | Iris |
| Everforest Dark | dark | Green |
| Kanagawa | dark | Blue |
| GitHub Dark | dark | Blue |

## Creating a Custom Theme

Create a `.json` file with the following structure:

```json
{
  "id": "my-custom-theme",
  "name": "My Custom Theme",
  "variant": "dark",
  "terminal": {
    "foreground": "#d4d4d4",
    "background": "#1e1e1e",
    "cursor": "#528bff",
    "cursorAccent": "#1e1e1e",
    "selection": "rgba(82, 139, 255, 0.25)",
    "ansi": [
      "#000000", "#cc0000", "#4e9a06", "#c4a000",
      "#3465a4", "#75507b", "#06989a", "#d3d7cf",
      "#555753", "#ef2929", "#8ae234", "#fce94f",
      "#729fcf", "#ad7fa8", "#34e2e2", "#eeeeec"
    ]
  },
  "ui": {
    "bgPrimary": "#1e1e1e",
    "bgSecondary": "#252526",
    "bgTertiary": "#2d2d2d",
    "textPrimary": "#e4e4e9",
    "textSecondary": "#a0a0b0",
    "textMuted": "#5a5a70",
    "accent": "#528bff",
    "accentHover": "#6b9fff",
    "border": "rgba(255, 255, 255, 0.08)",
    "borderFocus": "#528bff",
    "success": "#4ec9b0",
    "warning": "#cca700",
    "error": "#f44747"
  },
  "blur": {
    "sidebar": 20,
    "blocks": 4,
    "inputBar": 12,
    "overlay": 30
  },
  "opacity": {
    "sidebar": 0.4,
    "blocks": 0.05,
    "inputBar": 0.08
  }
}
```

## Field Reference

### Root

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (kebab-case, e.g. `"my-theme"`) |
| `name` | string | Display name shown in settings |
| `variant` | `"dark"` or `"light"` | Controls scrollbar and native UI styling |

### `terminal` — Terminal colors

| Field | Type | Description |
|-------|------|-------------|
| `foreground` | hex | Default text color |
| `background` | hex | Terminal background |
| `cursor` | hex | Cursor color |
| `cursorAccent` | hex | Text color under block cursor |
| `selection` | hex/rgba | Selection highlight |
| `ansi` | string[16] | ANSI color palette (see below) |

#### ANSI palette order

```
Index  Name           Usage
─────  ─────────────  ──────────────────────
0      Black          Normal black
1      Red            Errors, deletions
2      Green          Success, additions
3      Yellow         Warnings, highlights
4      Blue           Info, links
5      Magenta        Special keywords
6      Cyan           Strings, secondary
7      White          Normal white
8      Bright Black   Comments, muted text
9      Bright Red
10     Bright Green
11     Bright Yellow
12     Bright Blue
13     Bright Magenta
14     Bright Cyan
15     Bright White   Emphasis text
```

### `ui` — Application UI colors

| Field | Type | Description |
|-------|------|-------------|
| `bgPrimary` | hex | Main background |
| `bgSecondary` | hex | Sidebar, panels |
| `bgTertiary` | hex | Inputs, cards |
| `textPrimary` | hex | Main text |
| `textSecondary` | hex | Secondary text |
| `textMuted` | hex | Muted/disabled text |
| `accent` | hex | Primary accent (buttons, focus rings) |
| `accentHover` | hex | Accent hover state |
| `border` | hex/rgba | Default borders |
| `borderFocus` | hex | Focused element borders |
| `success` | hex | Success indicators |
| `warning` | hex | Warning indicators |
| `error` | hex | Error indicators |

### `blur` — Vibrancy blur (optional)

These values control backdrop blur when vibrancy is enabled. Defaults are used if omitted.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sidebar` | number | 20 | Sidebar blur in px |
| `blocks` | number | 4 | Content blocks blur |
| `inputBar` | number | 12 | Input/status bar blur |
| `overlay` | number | 30 | Modal overlay blur |

### `opacity` — Vibrancy opacity (optional)

Controls transparency when vibrancy is enabled. Defaults are used if omitted.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sidebar` | number | 0.4 | Sidebar opacity |
| `blocks` | number | 0.05 | Content blocks opacity |
| `inputBar` | number | 0.08 | Input bar opacity |

## Importing a Theme

1. Open **Settings** > **Appearance**
2. Click **Import JSON** in the Custom Themes section
3. Select your `.json` file
4. The theme is immediately applied and persisted

Custom themes are stored in the app database and survive updates.

## Tips

- Use `rgba()` for `selection` and `border` to get transparency
- Keep `cursorAccent` the same as your `background` for a clean cursor
- For vibrancy, use darker `bgPrimary`/`bgSecondary` values — the blur effect lightens them
- Copy an existing theme from `src/themes/` as a starting point
- The `id` must be unique and cannot conflict with built-in theme IDs
