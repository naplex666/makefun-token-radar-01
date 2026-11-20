import type { Protocol } from './model.ts';

const LOW_FEES = new Set([
  'Arbitrum', 'Base', 'Optimism', 'Polygon', 'Solana', 'BSC', 'Avalanche',
  'Sui', 'Aptos', 'Gnosis', 'Starknet', 'zkSync Era', 'Linea', 'Scroll',
]);

interface Route {
  action: string;
  review: string;
  exit: string;
  budget: number;
  days: number;
}

const ROUTES: [RegExp, Route][] = [
  [/^(lending|risk curators|uncollateralized lending)$/i, {
    action: 'Supply one supported stablecoin to a single isolated market or lending vault. Leave borrowing and collateral loops disabled.',
    review: 'Check borrow utilization and immediately withdrawable liquidity weekly. Test a small redemption before adding funds.',
    exit: 'Redeem supplied assets; if liquidity is thin, reduce the position as liquidity returns.',
    budget: 75, days: 21,
  }],
  [/^dexs$/i, {
    action: 'Quote a $10 swap in a deep stablecoin pair. If price impact is below 0.5%, make the swap and use the remainder in a full-range or standard pool if offered.',
    review: 'Review trading fees against divergence from holding the two assets each week. Skip narrow ranges and repeated volume farming.',
    exit: 'Remove liquidity, collect fees and record the two balances before deciding whether to swap back.',
    budget: 60, days: 14,
  }],
  [/^rwa$/i, {
    action: 'Read jurisdiction, verification, minimum subscription and redemption rules. Subscribe to a cash-like pool only if eligible and the minimum fits the budget; otherwise track a public quote without depositing.',
    review: 'Record net yield and the next redemption window once a week. Check whether redemptions involve a queue or offchain processing.',
    exit: 'Submit redemption during the documented window. Allow the stated settlement period before counting capital as available.',
    budget: 100, days: 30,
  }],
  [/basis trading|derivatives|options|synthetics|leveraged/i, {
    action: 'If offered, use an unleveraged managed vault and inspect collateral, counterparties and hedges first. If exposure requires a leveraged position, log quotes on paper.',
    review: 'Check net yield after funding, borrow costs and fees weekly. Review hedge drift before keeping exposure.',
    exit: 'Request a vault redemption and check for an epoch cutoff or notice period.',
    budget: 75, days: 14,
  }],
  [/cdp|stablecoin|collateral/i, {
    action: 'Look for an unleveraged savings or stability pool using the supported stable asset. Review the peg and collateral; skip the deposit if opening debt is required.',
    review: 'Check the peg and available exit depth weekly. End the trial early if quotes diverge by more than 1% from the peg.',
    exit: 'Redeem the receipt and check available exit quotes. Keep enough gas for withdrawals.',
    budget: 60, days: 14,
  }],
  [/staking|restaking/i, {
    action: 'Check validator, slash and withdrawal terms. Test a capped stake only if the native asset minimum and unbonding period fit.',
    review: 'Check net rewards and available exit routes once a week. Record any evidence of an official campaign separately from staking yield.',
    exit: 'Submit unstake and schedule a reminder to claim after the documented unbonding period.',
    budget: 50, days: 21,
  }],
  [/governance|token locker/i, {
    action: 'Inspect available gauges, minimum lock sizes and earliest unlock. Track one gauge vote on paper if the lock exceeds your trial window.',
    review: 'Compare realized incentives after the next voting epoch and check whether incentives require an existing position.',
    exit: 'Withdraw after the documented lock expires; plan around the actual unlock date before committing.',
    budget: 40, days: 21,
  }],
  [/insurance/i, {
    action: 'Read exclusions and claim terms for one pool. Test an underwriting deposit only if its loss exposure and redemption terms fit; otherwise compare quotes on paper.',
    review: 'Check utilization, open claims and any cooldown weekly. Record premiums separately from potential losses.',
    exit: 'Request withdrawal as soon as the pool permits it and account for pending claims before redeploying.',
    budget: 50, days: 30,
  }],
  [/bridge|payments|chain|privacy/i, {
    action: 'Preview a small supported transfer to your own receiving address. Check both chains, the recipient, minimum amount and final quote before a single $10 test if supported.',
    review: 'Compare the received amount and elapsed time with the quote. Retain the transaction ID and avoid repeating transfers solely for volume.',
    exit: 'Confirm settlement at the destination and check whether returning funds would cost more than keeping them there.',
    budget: 25, days: 7,
  }],
  [/yield|capital allocator|vault|farm|liquidity manager|cedefi|indexes/i, {
    action: 'Deposit one supported asset into an unleveraged vault only after checking its underlying strategy, fee schedule and redemption queue.',
    review: 'Log share price and net return after fees weekly. Check strategy changes and simulate redemption before adding capital.',
    exit: 'Redeem vault shares in the first eligible window and compare the payout with your deposit and network costs.',
    budget: 75, days: 21,
  }],
];

const RESEARCH: Route = {
  action: 'Locate the product’s official activity or rewards rules and record one qualifying action with a quoted cost. Keep this trial on paper until the surface and terms are verified.',
  review: 'Recheck the published rules once a week and log changes to eligibility and minimum action size.',
  exit: 'End the trial after two weekly checks if no verified action fits the budget.',
  budget: 0, days: 14,
};

export function farmSteps(p: Protocol, recorded: boolean): string[] {
  const chain = p.chains.find(c => LOW_FEES.has(c)) ?? p.chains[0] ?? 'a network listed in the official docs';
  const gas = LOW_FEES.has(chain) ? '$0.10–$3' : chain === 'Ethereum' ? '$3–$30' : '$1–$10';
  const route = ROUTES.find(([pattern]) => pattern.test(p.category ?? ''))?.[1] ?? RESEARCH;
  const tx = route.budget ? `${gas} estimated network fees` : '$0 on paper';
  const bridge = p.chains.length > 1 && route.budget > 0
    ? ' If funds are elsewhere, quote the bridge both ways first and count those fees separately.'
    : '';
  return [
    `Verify ${p.name}'s official app, contracts, eligibility and supported assets on ${chain}. Record whether any campaign terms are published.${bridge} Cost: $0. Time: 10–15 min.`,
    `${route.action} Budget: up to $${route.budget} of trial capital plus ${tx}. Time: 10–20 min.`,
    `${route.review} Cost: $0 for read-only checks. Time: 5 min per check over ${route.days} days.`,
    `${route.exit} Budget: ${tx}, plus any quoted product fee. Time: 5–15 min of work plus the published settlement or unlock time.`,
    recorded
      ? 'Review current incentive rules for the recorded token and compare realized rewards against fees. Cost: $0 to review. Time: 10 min.'
      : 'Log transactions and any points shown in the official app. Stop when the trial ends if there is no documented reason to continue. Cost: $0 to review. Time: 10 min.',
  ];
}
