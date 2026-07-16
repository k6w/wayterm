
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}


export function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith("rgba(")) {
    
    return hex.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }
  if (hex.startsWith("rgb(")) {
    
    return hex.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0..1 */
  a: number;
}

const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_FUNCTION =
  /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

/**
 * Parses #rgb, #rgba, #rrggbb, #rrggbbaa, rgb() and rgba() (comma syntax).
 * Returns null for anything else, including named colors.
 */
export function parseCssColor(input: string): Rgba | null {
  const value = input.trim();
  const hex = HEX_COLOR.exec(value);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) {
      digits = digits
        .split("")
        .map((d) => d + d)
        .join("");
    }
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1,
    };
  }
  const fn = RGB_FUNCTION.exec(value);
  if (fn) {
    const r = Number(fn[1]);
    const g = Number(fn[2]);
    const b = Number(fn[3]);
    const a = fn[4] === undefined ? 1 : Number(fn[4]);
    if (r > 255 || g > 255 || b > 255 || a > 1) return null;
    return { r, g, b, a };
  }
  return null;
}

/** Alpha-composites `top` over `bottom`. The result is opaque. */
export function compositeOver(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

function toByte(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, "0");
}

/** Serializes to #rrggbb, or #rrggbbaa when `includeAlpha` and alpha < 1. */
export function toHex(color: Rgba, includeAlpha = false): string {
  const base = `#${toByte(color.r)}${toByte(color.g)}${toByte(color.b)}`;
  return includeAlpha && color.a < 1 ? base + toByte(color.a * 255) : base;
}

/** Linear mix of two colors as opaque #rrggbb: t = 0 gives `a`, t = 1 gives `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = parseCssColor(a);
  const cb = parseCssColor(b);
  if (!ca) throw new Error(`mixHex: invalid color "${a}"`);
  if (!cb) throw new Error(`mixHex: invalid color "${b}"`);
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
    a: 1,
  });
}
