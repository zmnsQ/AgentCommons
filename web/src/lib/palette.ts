export const PALETTES = [
  { id: "jade", zh: "青玉", en: "Jade" },
  { id: "lake", zh: "湖蓝", en: "Lake" },
  { id: "iris", zh: "鸢尾", en: "Iris" },
  { id: "rose", zh: "玫瑰", en: "Rose" },
  { id: "amber", zh: "琥珀", en: "Amber" },
  { id: "slate", zh: "石墨", en: "Graphite" },
] as const;

export type Palette = typeof PALETTES[number]["id"];

export function isPalette(value: unknown): value is Palette {
  return PALETTES.some(palette => palette.id === value);
}

export function readPalette(): Palette {
  try {
    const value = localStorage.getItem("ap_palette");
    if (isPalette(value)) return value;
  } catch { /* Storage may be unavailable in a private window. */ }
  return "jade";
}

export function applyPalette(palette: Palette): void {
  document.documentElement.setAttribute("data-palette", palette);
  try { localStorage.setItem("ap_palette", palette); } catch { /* Keep the session choice. */ }
}
