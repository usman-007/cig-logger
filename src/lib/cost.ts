import type { Purchase, Settings, SmokeType } from "./types";
import { round, sum } from "./utils";

export interface UnitCosts {
  /** cost of a single factory-made cigarette */
  perFactory: number;
  /** cost of a single hand-rolled cigarette (tobacco + paper + filter) */
  perRolled: number;
  perGramTobacco: number;
  perPaper: number;
  perFilter: number;
  /** true when the figure is derived from real purchases rather than settings */
  sources: {
    factory: boolean;
    tobacco: boolean;
    papers: boolean;
    filters: boolean;
  };
  totals: {
    spend: number;
    cigarettesBought: number;
    tobaccoGrams: number;
    papers: number;
    filters: number;
  };
}

/**
 * Lifetime weighted averages: every purchase in a category contributes its
 * full cost and quantity, so the per-unit figure self-corrects as prices move.
 */
export function computeUnitCosts(
  purchases: Purchase[],
  settings: Settings,
): UnitCosts {
  let packSpend = 0;
  let cigarettesBought = 0;
  let tobaccoSpend = 0;
  let tobaccoGrams = 0;
  let paperSpend = 0;
  let paperCount = 0;
  let filterSpend = 0;
  let filterCount = 0;

  for (const p of purchases) {
    const qty = Number(p.quantity) || 0;
    const cost = Number(p.cost) || 0;
    switch (p.category) {
      case "pack": {
        const per = p.unitsPerItem || settings.cigarettesPerPack;
        packSpend += cost;
        cigarettesBought += qty * per;
        break;
      }
      case "carton": {
        const packs = p.unitsPerItem || settings.packsPerCarton;
        packSpend += cost;
        cigarettesBought += qty * packs * settings.cigarettesPerPack;
        break;
      }
      case "tobacco":
        tobaccoSpend += cost;
        tobaccoGrams += qty;
        break;
      case "papers":
        paperSpend += cost;
        paperCount += qty;
        break;
      case "filters":
        filterSpend += cost;
        filterCount += qty;
        break;
      default:
        break;
    }
  }

  const hasFactory = cigarettesBought > 0 && packSpend > 0;
  const hasTobacco = tobaccoGrams > 0 && tobaccoSpend > 0;
  const hasPapers = paperCount > 0 && paperSpend > 0;
  const hasFilters = filterCount > 0 && filterSpend > 0;

  const perFactory = hasFactory
    ? packSpend / cigarettesBought
    : settings.fallbackPackPrice / Math.max(1, settings.cigarettesPerPack);

  const perGramTobacco = hasTobacco ? tobaccoSpend / tobaccoGrams : 0;
  const perPaper = hasPapers ? paperSpend / paperCount : 0;
  const perFilter = hasFilters ? filterSpend / filterCount : 0;

  const rolledFromSupplies =
    perGramTobacco * settings.gramsPerRoll + perPaper + perFilter;

  return {
    perFactory,
    // Without a tobacco purchase there is nothing to derive a roll from, so
    // fall back to the factory figure rather than inventing a discount.
    perRolled: hasTobacco ? rolledFromSupplies : perFactory,
    perGramTobacco,
    perPaper,
    perFilter,
    sources: {
      factory: hasFactory,
      tobacco: hasTobacco,
      papers: hasPapers,
      filters: hasFilters,
    },
    totals: {
      spend: round(sum(purchases.map((p) => Number(p.cost) || 0))),
      cigarettesBought,
      tobaccoGrams,
      papers: paperCount,
      filters: filterCount,
    },
  };
}

export function unitCostFor(type: SmokeType, costs: UnitCosts) {
  return type === "rolled" ? costs.perRolled : costs.perFactory;
}

/** Blended cost used for "what would one more have cost" style figures. */
export function blendedUnitCost(
  costs: UnitCosts,
  mix: { factory: number; rolled: number },
) {
  const total = mix.factory + mix.rolled;
  if (total === 0) return costs.perFactory;
  return (mix.factory * costs.perFactory + mix.rolled * costs.perRolled) / total;
}
