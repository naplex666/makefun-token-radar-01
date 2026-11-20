import { farmSteps } from './plans.ts';

export interface Protocol {
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
  protocols: Protocol[];
  watchlist: string[];
}

const DAY = 86_400_000;
const EXCLUDED = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'Anchor BTC', 'Stablecoin Issuer']);
const VERSIONED = /\s(?:v\d+(?:\.\d+)?|\d+\.\d+)$/i;
const PRODUCT = /\b(?:wrapped|staking|staked)\b|^(?:Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
const bySlug = (a: Protocol, b: Protocol) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;

function tokenRecorded(p: Protocol) {
  return Boolean(p.gecko_id || p.symbol || (p.mcap_usd ?? 0) > 0);
}

function ageDays(p: Protocol, asOf: string) {
  const days = (Date.parse(asOf) - Date.parse(p.listed_at ?? '')) / DAY;
  return Number.isFinite(days) ? Math.max(0, Math.floor(days)) : null;
}

interface Peer {
  p: Protocol;
  ratio: number;
  weight: number;
}

// Each set is ranked by TVL proximity before the ratios are examined.
function nearest(p: Protocol, peers: Protocol[], limit: number): Peer[] {
  return peers.map(peer => ({
    p: peer,
    ratio: clamp(peer.mcap_usd! / peer.tvl_usd, 0.005, 8),
    weight: 1 / (1 + Math.abs(Math.log2(peer.tvl_usd / p.tvl_usd))),
  })).sort((a, b) => b.weight - a.weight || bySlug(a.p, b.p)).slice(0, limit);
}

function quantile(peers: Peer[], q: number) {
  const sorted = [...peers].sort((a, b) => a.ratio - b.ratio || bySlug(a.p, b.p));
  const target = q * sorted.reduce((sum, peer) => sum + peer.weight, 0);
  let cumulative = 0;
  for (const peer of sorted) {
    cumulative += peer.weight;
    if (cumulative >= target) return peer.ratio;
  }
  return sorted.at(-1)?.ratio ?? 0.25;
}

function estimate(p: Protocol, peers: Protocol[], asOf: string) {
  const broad = nearest(p, peers, 24);
  const local = nearest(p, peers.filter(peer => p.category && peer.category === p.category), 12);
  // A peer of identical TVL contributes one observation; distant peers contribute less.
  const support = local.reduce((sum, peer) => sum + peer.weight, 0);
  const share = support / (support + 4);
  const multipleAt = (q: number) => clamp(
    Math.exp(share * Math.log(quantile(local, q)) + (1 - share) * Math.log(quantile(broad, q))),
    0.02, 3,
  );
  const age = ageDays(p, asOf);
  const growth = (1 + clamp((p.change_7d ?? 0) / 100, -0.35, 0.50)) ** 0.5;
  const maturity = 0.75 + 0.25 * Math.min(1, Math.log1p((age ?? 0) / 180) / Math.log1p(1095 / 180));
  const valueAt = (q: number) => clamp(Math.round(p.tvl_usd * multipleAt(q) * growth * maturity), 1, 1e14);

  return {
    implied_value_usd: valueAt(0.5),
    age_days: age,
    model: {
      multiple: multipleAt(0.5), growth, maturity,
      low: valueAt(0.25), high: valueAt(0.75),
      localCount: local.length, broadCount: broad.length, share,
      peers: (local.length ? local : broad).slice(0, 4).map(({ p: peer, ratio }) => ({
        name: peer.name, tvl: peer.tvl_usd, ratio,
      })),
    },
  };
}

export function parseSnapshot(text: string): Snapshot {
  const data = JSON.parse(text) as Snapshot;
  if (!Array.isArray(data?.protocols) || !Array.isArray(data?.watchlist)) {
    throw new Error('Snapshot must contain protocols and watchlist arrays');
  }
  return data;
}

export function buildRadar(snapshot: Snapshot) {
  const watchlist = new Set(snapshot.watchlist);
  const recorded = snapshot.protocols.filter(tokenRecorded).map(p => ({
    ...p,
    age_days: ageDays(p, snapshot.as_of),
    farm_steps: farmSteps(p, true),
  })).sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || bySlug(a, b));
  const peers = recorded.filter(p => !EXCLUDED.has(p.category ?? '') && (p.mcap_usd ?? 0) > 0);
  const board = snapshot.protocols
    .filter(p => watchlist.has(p.slug) || (
      !tokenRecorded(p) && !EXCLUDED.has(p.category ?? '') && !VERSIONED.test(p.name) && !PRODUCT.test(p.name)
    ))
    .map(p => ({
      ...p,
      ...estimate(p, peers, snapshot.as_of),
      watchlist: watchlist.has(p.slug),
      farm_steps: farmSteps(p, false),
    }))
    .sort((a, b) => b.implied_value_usd - a.implied_value_usd || bySlug(a, b))
    .map((row, i) => ({ ...row, rank: i + 1 }));
  return {
    board,
    radar: {
      as_of: snapshot.as_of, floor_usd: snapshot.floor_usd, watchlist_size: watchlist.size,
      rows: board, recorded,
    },
  };
}

type Radar = ReturnType<typeof buildRadar>['radar'];

export function boardIssue(board: Radar['rows'], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return 'row count outside 100–4,000';
  const slugs = new Set(board.map(p => p.slug));
  if (!snapshot.watchlist.every(slug => slugs.has(slug))) return 'watchlist coverage incomplete';
  if (slugs.size !== board.length) return 'duplicate protocol';
  if (board[0]!.implied_value_usd === board.at(-1)!.implied_value_usd) return 'all values equal';
  return null;
}

export function dataScript(radar: Radar): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}
