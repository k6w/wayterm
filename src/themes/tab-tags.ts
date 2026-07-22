/**
 * Preset tab color tags (tab context menu > Set Color). The hex value is what
 * gets persisted with the workspace, so these values must never change.
 */
export interface TabTagColor {
  label: string;
  value: string;
}

export const TAB_TAG_COLORS: readonly TabTagColor[] = [
  { label: "Rose", value: "#f38ba8" },
  { label: "Green", value: "#a6e3a1" },
  { label: "Yellow", value: "#f9e2af" },
  { label: "Blue", value: "#89b4fa" },
  { label: "Purple", value: "#cba6f7" },
  { label: "Teal", value: "#94e2d5" },
  { label: "Peach", value: "#fab387" },
];
