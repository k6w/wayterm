
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
