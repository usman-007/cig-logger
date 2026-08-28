import type { TriggerId } from "./types";

/**
 * Chart palette provenance
 * -----------------------
 * Surface: #141b23 (the card colour). Mode: dark.
 * The eight trigger hues below were validated as an *ordered* categorical
 * palette against that surface — lightness band, chroma floor, CVD separation
 * (worst adjacent ΔE 20.7 deutan), normal-vision floor (worst adjacent ΔE 22.6)
 * and ≥3:1 contrast all pass. The slot order is the safety mechanism: colour
 * follows the trigger, never its rank, and slots are never cycled or generated.
 * Donuts cap at six segments (top five + "Other") and always carry names and
 * percentages, so identity is never colour-alone.
 *
 * Single-measure charts (cigarettes per hour, per day) use ONE hue — cigarettes
 * are always amber #d97706, money is always green #16a34a — so the same measure
 * keeps the same colour across the app.
 */
export const CHART = {
  cig: "#d97706",
  cigSoft: "rgba(217, 119, 6, 0.16)",
  money: "#16a34a",
  grid: "#212b36",
  axis: "#6d7c8d",
  surface: "#141b23",
  limit: "#93a1b1",
} as const;

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

const TRIGGER_SLOTS = [
  "#f43f5e", // 1 stress
  "#7c3aed", // 2 boredom
  "#0d9488", // 3 social
  "#2563eb", // 4 coffee
  "#16a34a", // 5 alcohol
  "#c026d3", // 6 after_meal
  "#d97706", // 7 work_break
  "#0284c7", // 8 other
] as const;

const TRIGGER_ORDER: TriggerId[] = [
  "stress",
  "boredom",
  "social",
  "coffee",
  "alcohol",
  "after_meal",
  "work_break",
  "other",
];

export function triggerColor(trigger: TriggerId | "untagged") {
  if (trigger === "untagged") return "#4a5867";
  const index = TRIGGER_ORDER.indexOf(trigger);
  return TRIGGER_SLOTS[index === -1 ? 7 : index];
}

export const tooltipSurface = {
  background: "#161e27",
  border: "1px solid #31404f",
  borderRadius: "0.75rem",
  padding: "0.55rem 0.75rem",
  boxShadow: "0 18px 40px -20px rgba(0,0,0,0.95)",
  fontSize: "0.8125rem",
  color: "#e8edf3",
} as const;
