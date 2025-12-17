export const CIRCLE_COLORS = [
  "#2563eb",
  "#f97316",
  "#22c55e",
  "#d946ef",
  "#ef4444",
  "#14b8a6",
  "#a855f7",
  "#eab308",
];

export const DEFAULT_CIRCLE_COLOR = CIRCLE_COLORS[0];
export const CLICKED_CIRCLE_COLOR = "#6b7280";

export const getPaletteColor = (index: number) =>
  CIRCLE_COLORS[index % CIRCLE_COLORS.length];
