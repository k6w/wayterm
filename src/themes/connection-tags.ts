/**
 * Connection color tags (connection dialog > Color tag). The `name` is what
 * gets saved as SshConnection.colorTag, so names must never change. The
 * sidebar's connection tree maps the same names to these colors.
 */
export interface ConnectionTagColor {
  name: string;
  label: string;
  value: string;
}

export const CONNECTION_TAG_COLORS: readonly ConnectionTagColor[] = [
  { name: "red", label: "Red", value: "#ef4444" },
  { name: "green", label: "Green", value: "#22c55e" },
  { name: "blue", label: "Blue", value: "#3b82f6" },
  { name: "yellow", label: "Yellow", value: "#eab308" },
  { name: "purple", label: "Purple", value: "#a855f7" },
  { name: "cyan", label: "Cyan", value: "#06b6d4" },
  { name: "orange", label: "Orange", value: "#f97316" },
  { name: "pink", label: "Pink", value: "#ec4899" },
];
