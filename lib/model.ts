// Token Launch Radar Model (radar-2)

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface CategoryStats {
  category: string;
  count: number;
  raw_median: number;
  clamped_multiple: number;
  used_fallback: boolean;
}

export interface CategoryTable {
  overall_median: number;
  categories: Record<string, CategoryStats>;
}

export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  min_multiple: number;
  max_multiple: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  min_multiple: 0.05,
  max_multiple: 2.0,
};

export const MODEL_VERSION = 'radar-2';
export const EARLY_ROWS = 160;
export const LIVE_ROWS = 24;

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
    sample_size: number;
    used_fallback: boolean;
  };
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  sample_size: number;
  used_fallback: boolean;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  category_table: CategoryTable;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge']);

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

function computeMedian(arr: number[]): number {
  if (arr.length === 0) return 0.246;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function computeCategoryMultiples(protocols: SnapshotProtocol[]): CategoryTable {
  const allRatios: number[] = [];
  const catRatios: Record<string, number[]> = {};

  for (const p of protocols) {
    if (isPreToken(p)) continue;
    if (p.category && EXCLUDED_CATEGORIES.has(p.category)) continue;
    if (p.mcap_usd !== null && p.tvl_usd > 0) {
      const ratio = p.mcap_usd / p.tvl_usd;
      if (ratio > 0.01 && ratio < 50) {
        allRatios.push(ratio);
        const cat = p.category || 'Uncategorized';
        if (!catRatios[cat]) catRatios[cat] = [];
        catRatios[cat]!.push(ratio);
      }
    }
  }

  const overallMedian = round3(computeMedian(allRatios));
  const categories: Record<string, CategoryStats> = {};

  // Shrinkage parameter k = 5 for n >= 3 to stabilize small sample category multiples
  // shrinkage_multiple = (n * raw_median + k * overall_median) / (n + k)
  const SHRINKAGE_K = 5;

  for (const [cat, ratios] of Object.entries(catRatios)) {
    const rawMed = round3(computeMedian(ratios));
    const n = ratios.length;
    const usedFallback = n < 3;
    let effectiveMed = rawMed;
    if (!usedFallback) {
      effectiveMed = (n * rawMed + SHRINKAGE_K * overallMedian) / (n + SHRINKAGE_K);
    } else {
      effectiveMed = overallMedian;
    }
    const clamped = Math.max(0.05, Math.min(2.0, effectiveMed));
    categories[cat] = {
      category: cat,
      count: n,
      raw_median: rawMed,
      clamped_multiple: round3(clamped),
      used_fallback: usedFallback,
    };
  }

  return {
    overall_median: overallMedian,
    categories,
  };
}

export function getCategoryMultiple(catTable: CategoryTable, category: string | null): { multiple: number; count: number; fallback: boolean } {
  if (!category || EXCLUDED_CATEGORIES.has(category)) {
    return { multiple: Math.max(0.05, Math.min(2.0, catTable.overall_median)), count: 0, fallback: true };
  }
  const stat = catTable.categories[category];
  if (!stat || stat.count < 3) {
    return { multiple: Math.max(0.05, Math.min(2.0, catTable.overall_median)), count: stat ? stat.count : 0, fallback: true };
  }
  return { multiple: stat.clamped_multiple, count: stat.count, fallback: false };
}

export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  catTable: CategoryTable,
  model: ModelConstants = MODEL
): { implied: number; catMultiple: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null; count: number; fallback: boolean } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const { multiple: catMultiple, count, fallback } = getCategoryMultiple(catTable, protocol.category);
  const base = protocol.tvl_usd * catMultiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, catMultiple, growthPct, growthMult, maturityMult, age, count, fallback };
}

export function farmSteps(protocol: SnapshotProtocol, ageDaysVal: number | null): string[] {
  const chain = protocol.chains && protocol.chains.length > 0 ? protocol.chains[0] : 'Ethereum';
  const category = protocol.category || 'DeFi Protocol';
  const tvl = protocol.tvl_usd;
  const age = ageDaysVal ?? 365;

  let capitalTier = '$100';
  let capitalAmt = 100;
  if (tvl >= 100_000_000) { capitalTier = '$250'; capitalAmt = 250; }
  else if (tvl >= 10_000_000) { capitalTier = '$150'; capitalAmt = 150; }
  else if (tvl >= 1_000_000) { capitalTier = '$100'; capitalAmt = 100; }
  else { capitalTier = '$50'; capitalAmt = 50; }

  let holdDays = 45;
  if (age < 90) holdDays = 60;
  else if (age >= 365) holdDays = 30;

  let actionText = `Deposit ${capitalTier} into ${protocol.name}'s main protocol vault on ${chain}.`;
  if (category === 'Lending') {
    actionText = `Supply ${capitalTier} collateral in ${protocol.name}'s primary lending pool on ${chain} to accrue yield.`;
  } else if (category === 'Dexs') {
    actionText = `Provide ${capitalTier} liquidity in a major pair pool on ${protocol.name} on ${chain} to earn trading fees.`;
  } else if (category === 'Liquid Staking') {
    actionText = `Stake native tokens valued at ${capitalTier} via ${protocol.name} on ${chain} to mint liquid staking derivatives.`;
  } else if (category === 'Yield' || category === 'Yield Aggregator') {
    actionText = `Deposit ${capitalTier} into ${protocol.name}'s highest-yielding automated strategy vault on ${chain}.`;
  } else if (category === 'Basis Trading') {
    actionText = `Open a ${capitalTier} delta-neutral basis position on ${protocol.name} across spot and futures markets on ${chain}.`;
  } else if (category === 'RWA') {
    actionText = `Complete identity verification if required and deposit ${capitalTier} into ${protocol.name}'s real-world asset vault on ${chain}.`;
  } else if (category === 'Privacy') {
    actionText = `Execute private pool deposits or shielded transfers totalling ${capitalTier} on ${protocol.name} via ${chain}.`;
  }

  const s1 = `Connect non-custodial Web3 wallet to ${protocol.name} on ${chain} network with ${capitalTier} allocated capital. Cost: ~$2 gas. Time: ~5 mins.`;
  const s2 = `${actionText} Cost: $${capitalAmt} position + gas. Time: ~10 mins.`;
  const s3 = `Perform weekly qualifying activity such as rebalancing, voting on governance proposals, or interacting with sub-contracts on ${protocol.name}. Cost: ~$1 gas/week. Time: ~5 mins/week.`;
  const s4 = `Maintain position continuously for at least ${holdDays} days to pass protocol activity and loyalty snapshot thresholds. Cost: $0 ongoing. Time: Passive.`;
  const s5 = `Claim safety verification: check published links on ${protocol.name}'s official domain only; never pay fees to claim points or tokens. Cost: Free. Time: ~2 mins.`;
  const s6 = `Maintain farm log recording deposit hashes, weekly interaction history, and plan orderly exit upon protocol TGE announcement. Cost: Free. Time: ~5 mins.`;

  return [s1, s2, s3, s4, s5, s6];
}

export function parseSnapshot(text: string): Snapshot {
  const data = JSON.parse(text) as Snapshot;
  if (!data || !Array.isArray(data.protocols) || !Array.isArray(data.watchlist)) {
    throw new SnapshotError('Invalid snapshot format');
  }
  return data;
}

export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const catTable = computeCategoryMultiples(snapshot.protocols);
  const index = new Map<string, SnapshotProtocol>();
  for (const p of snapshot.protocols) {
    index.set(p.slug, p);
  }

  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) {
      chosen.set(slug, p);
    }
  }

  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);

  for (const p of early) {
    chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const res = impliedValue(p, snapshot.as_of, catTable, MODEL);
    return { p, res };
  });

  scored.sort((a, b) => b.res.implied - a.res.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.res.age,
    implied_value_usd: s.res.implied,
    model: {
      category_multiple: round4(s.res.catMultiple),
      growth_pct: s.res.growthPct,
      growth_multiplier: round4(s.res.growthMult),
      maturity_multiplier: round4(s.res.maturityMult),
      age_days: s.res.age,
      sample_size: s.res.count,
      used_fallback: s.res.fallback,
    },
    farm_steps: farmSteps(s.p, s.res.age),
  }));
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const catTable = computeCategoryMultiples(snapshot.protocols);
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);

  const radarRows: RadarRow[] = board.map((r) => ({
    rank: r.rank,
    slug: r.slug,
    name: r.name,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl_usd,
    change_7d: r.change_7d,
    mcap_usd: r.mcap_usd,
    listed_at: r.listed_at,
    age_days: r.age_days,
    implied_value_usd: r.implied_value_usd,
    category_multiple: r.model.category_multiple,
    growth_multiplier: r.model.growth_multiplier,
    maturity_multiplier: r.model.maturity_multiplier,
    sample_size: r.model.sample_size,
    used_fallback: r.model.used_fallback,
  }));

  const earlyCount = board.filter((r) => r.tvl_usd < snapshot.floor_usd).length;

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: MODEL,
    model_version: MODEL_VERSION,
    category_table: catTable,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: earlyCount,
    live_size: live.length,
    rows: radarRows,
    live,
  };

  return { board, radar };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length !== 200) return `board size is ${board.length}, expected 200`;

  const watchlistSlugs = new Set(snapshot.watchlist);
  const foundWatchlist = new Set<string>();
  for (const r of board) {
    if (watchlistSlugs.has(r.slug)) foundWatchlist.add(r.slug);
  }
  if (foundWatchlist.size !== watchlistSlugs.size) {
    return `watchlist missing ${watchlistSlugs.size - foundWatchlist.size} slugs`;
  }

  for (let i = 0; i < board.length; i++) {
    const r = board[i]!;
    if (r.rank !== i + 1) return `row ${i} has rank ${r.rank}, expected ${i + 1}`;
    if (i > 0 && r.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `row ${i + 1} implied value ${r.implied_value_usd} > row ${i} ${board[i - 1]!.implied_value_usd}`;
    }
    if (!r.farm_steps || r.farm_steps.length < 3 || r.farm_steps.length > 12) {
      return `row ${i + 1} has ${r.farm_steps ? r.farm_steps.length : 0} farm steps`;
    }
    for (const step of r.farm_steps) {
      if (typeof step !== 'string' || step.length < 20 || step.length > 600) {
        return `row ${i + 1} farm step length ${step ? step.length : 0} out of range [20, 600]`;
      }
    }
  }

  const firstImplied = board[0]!.implied_value_usd;
  const allSame = board.every((r) => r.implied_value_usd === firstImplied);
  if (allSame) return 'all implied values are equal';

  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR = ${JSON.stringify(radar, null, 2)};\n`;
}
