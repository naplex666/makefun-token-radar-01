(function () {
  const RADAR = window.RADAR;
  if (!RADAR) {
    document.getElementById('app').innerHTML = '<div style="padding:2rem;color:#f87171;">Error: RADAR data not loaded.</div>';
    return;
  }

  function formatUSD(n) {
    if (n === null || n === undefined) return 'N/A';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toLocaleString();
  }

  function formatPct(n) {
    if (n === null || n === undefined) return '0.0%';
    const sign = n > 0 ? '+' : '';
    return sign + n.toFixed(1) + '%';
  }

  function parseHash() {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    return {
      view: params.get('view') || 'board',
      slug: params.get('slug') || '',
      category: params.get('category') || '',
      chain: params.get('chain') || '',
      search: params.get('search') || '',
      sort: params.get('sort') || 'rank',
      min_tvl: params.get('min_tvl') || '0'
    };
  }

  function setHash(newState) {
    const current = parseHash();
    const merged = Object.assign({}, current, newState);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== '0' && v !== 'rank' && !(k === 'slug' && merged.view !== 'detail') && !(k === 'view' && v === 'board')) {
        params.set(k, v);
      }
    }
    if (merged.view === 'detail' && merged.slug) {
      params.set('view', 'detail');
      params.set('slug', merged.slug);
    } else if (merged.view === 'live') {
      params.set('view', 'live');
    } else if (merged.view === 'model') {
      params.set('view', 'model');
    } else {
      params.delete('slug');
      if (merged.view && merged.view !== 'board') {
        params.set('view', merged.view);
      } else {
        params.delete('view');
      }
    }
    const str = params.toString();
    window.location.hash = str ? '#' + str : '';
  }

  function renderHeader() {
    const state = parseHash();
    return `
      <header>
        <div class="header-inner">
          <div class="brand">
            <div class="brand-icon">TR</div>
            <div class="brand-title">
              <h1>Token Launch Radar</h1>
              <span>Make.fun Bounty token-radar-01 • ${RADAR.model_version} • As of ${RADAR.as_of}</span>
            </div>
          </div>
          <nav class="tabs">
            <button class="${state.view === 'board' ? 'active' : ''}" onclick="window.RADAR_NAV('board')">Radar Board (${RADAR.board_size})</button>
            <button class="${state.view === 'live' ? 'active' : ''}" onclick="window.RADAR_NAV('live')">Live Market (${RADAR.live_size})</button>
            <button class="${state.view === 'model' ? 'active' : ''}" onclick="window.RADAR_NAV('model')">Model & Multiples</button>
          </nav>
        </div>
      </header>
    `;
  }

  window.RADAR_NAV = function (view) {
    setHash({ view: view, slug: '' });
  };

  function renderBoard() {
    const state = parseHash();
    let rows = [...RADAR.rows];

    if (state.category) {
      rows = rows.filter(r => r.category === state.category);
    }
    if (state.chain) {
      rows = rows.filter(r => r.chains && r.chains.includes(state.chain));
    }
    if (state.search) {
      const q = state.search.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q) || (r.category && r.category.toLowerCase().includes(q)));
    }
    const minTvlNum = parseFloat(state.min_tvl) || 0;
    if (minTvlNum > 0) {
      rows = rows.filter(r => r.tvl_usd >= minTvlNum);
    }

    if (state.sort === 'implied') {
      rows.sort((a, b) => b.implied_value_usd - a.implied_value_usd || a.rank - b.rank);
    } else if (state.sort === 'tvl') {
      rows.sort((a, b) => b.tvl_usd - a.tvl_usd || a.rank - b.rank);
    } else if (state.sort === 'change') {
      rows.sort((a, b) => (b.change_7d ?? 0) - (a.change_7d ?? 0) || a.rank - b.rank);
    } else {
      rows.sort((a, b) => a.rank - b.rank);
    }

    const categories = [...new Set(RADAR.rows.map(r => r.category).filter(Boolean))].sort();
    const allChains = new Set();
    RADAR.rows.forEach(r => { if (r.chains) r.chains.forEach(c => allChains.add(c)); });
    const chains = [...allChains].sort();

    const totalImplied = RADAR.rows.reduce((sum, r) => sum + r.implied_value_usd, 0);

    return `
      ${renderHeader()}
      <main>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">Watchlist Coverage</div>
            <div class="value">${RADAR.watchlist_size} Slugs</div>
          </div>
          <div class="stat-card">
            <div class="label">Ranked Board Rows</div>
            <div class="value">${RADAR.board_size} Protocols</div>
          </div>
          <div class="stat-card">
            <div class="label">Early Pre-Token Radar</div>
            <div class="value">${RADAR.early_size} Protocols</div>
          </div>
          <div class="stat-card">
            <div class="label">Total Implied Value</div>
            <div class="value" style="color:var(--accent);">${formatUSD(totalImplied)}</div>
          </div>
        </div>

        <div class="controls-bar">
          <input type="text" id="searchInput" placeholder="Search pre-token protocols, slugs or categories..." value="${state.search}" oninput="window.RADAR_FILTER('search', this.value)">
          <select id="catSelect" onchange="window.RADAR_FILTER('category', this.value)">
            <option value="">All Categories (${RADAR.board_size})</option>
            ${categories.map(c => `<option value="${c}" ${state.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <select id="chainSelect" onchange="window.RADAR_FILTER('chain', this.value)">
            <option value="">All Chains</option>
            ${chains.map(ch => `<option value="${ch}" ${state.chain === ch ? 'selected' : ''}>${ch}</option>`).join('')}
          </select>
          <select id="sortSelect" onchange="window.RADAR_FILTER('sort', this.value)">
            <option value="rank" ${state.sort === 'rank' ? 'selected' : ''}>Sort: Radar Rank</option>
            <option value="implied" ${state.sort === 'implied' ? 'selected' : ''}>Sort: Implied Value</option>
            <option value="tvl" ${state.sort === 'tvl' ? 'selected' : ''}>Sort: TVL</option>
            <option value="change" ${state.sort === 'change' ? 'selected' : ''}>Sort: 7d Change</option>
          </select>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Protocol</th>
                <th>Category</th>
                <th>Chains</th>
                <th>TVL</th>
                <th>7d Change</th>
                <th>Implied Value</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No protocols match the filter criteria.</td></tr>' : ''}
              ${rows.map(r => `
                <tr onclick="window.RADAR_DETAIL('${r.slug}')">
                  <td><strong>#${r.rank}</strong></td>
                  <td><strong>${r.name}</strong> <span style="font-size:0.75rem;color:var(--text-muted)">(${r.slug})</span></td>
                  <td><span class="badge cat">${r.category || 'Other'}</span></td>
                  <td>${r.chains ? r.chains.slice(0, 3).join(', ') : ''}</td>
                  <td>${formatUSD(r.tvl_usd)}</td>
                  <td class="${(r.change_7d ?? 0) >= 0 ? 'positive' : 'negative'}">${formatPct(r.change_7d)}</td>
                  <td class="implied-val">${formatUSD(r.implied_value_usd)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </main>
    `;
  }

  window.RADAR_FILTER = function (key, val) {
    const obj = {};
    obj[key] = val;
    setHash(obj);
  };

  window.RADAR_DETAIL = function (slug) {
    setHash({ view: 'detail', slug: slug });
  };

  function renderDetail() {
    const state = parseHash();
    const row = RADAR.rows.find(r => r.slug === state.slug) || RADAR.rows[0];
    if (!row) {
      return renderBoard();
    }

    const baseVal = row.tvl_usd * row.category_multiple;
    const growthFactor = row.growth_multiplier;
    const maturityFactor = row.maturity_multiplier;

    // Generate farm steps dynamically if not stored, or use row
    const capitalTier = row.tvl_usd >= 100e6 ? '$250' : row.tvl_usd >= 10e6 ? '$150' : row.tvl_usd >= 1e6 ? '$100' : '$50';
    const holdDays = (row.age_days ?? 365) < 90 ? 60 : (row.age_days ?? 365) >= 365 ? 30 : 45;
    const chain = row.chains && row.chains.length > 0 ? row.chains[0] : 'Ethereum';

    return `
      ${renderHeader()}
      <main>
        <div class="detail-view">
          <div class="detail-header">
            <div class="detail-title">
              <span class="badge cat" style="margin-bottom:0.5rem;display:inline-block;">Rank #${row.rank} • ${row.category || 'DeFi'}</span>
              <h2>${row.name}</h2>
              <div style="color:var(--text-muted);font-size:0.85rem;">Slug: <code>${row.slug}</code> • Chains: ${row.chains.join(', ')} • Listed: ${row.listed_at || 'Unknown'} (${row.age_days ?? 365} days active)</div>
            </div>
            <button class="back-btn" onclick="window.RADAR_NAV('board')">← Back to Board</button>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-bottom:1.5rem;">
            <div class="stat-card">
              <div class="label">Total Value Locked (TVL)</div>
              <div class="value">${formatUSD(row.tvl_usd)}</div>
            </div>
            <div class="stat-card">
              <div class="label">Category Multiple</div>
              <div class="value" style="color:var(--accent);">${row.category_multiple.toFixed(3)
              }x <span style="font-size:0.75rem;color:var(--text-muted);">(n=${row.sample_size}${row.used_fallback ? ', fallback' : ', shrunken k=5'})</span></div>
            </div>
            <div class="stat-card">
              <div class="label">7d Growth Change</div>
              <div class="value ${(row.change_7d ?? 0) >= 0 ? 'positive' : 'negative'}">${formatPct(row.change_7d)}</div>
            </div>
            <div class="stat-card">
              <div class="label">Implied Token Value</div>
              <div class="value" style="color:var(--success);">${formatUSD(row.implied_value_usd)}</div>
            </div>
          </div>

          <h3 style="font-size:1.1rem;margin-bottom:0.5rem;color:var(--accent);">Implied Value Formula Breakdown</h3>
          <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:0.75rem;">Formula: <code>TVL × Category Multiple × Growth Multiplier × Maturity Multiplier = Implied Value</code></p>
          
          <div class="formula-box">
            <div class="formula-row"><span>TVL</span><span>${formatUSD(row.tvl_usd)}</span></div>
            <div class="formula-row"><span>Category Multiple (${row.category || 'Uncategorized'}, n=${row.sample_size}${row.used_fallback ? ', fallback' : ''})</span><span>× ${row.category_multiple.toFixed(3)}</span></div>
            <div class="formula-row"><span>Base Valuation (TVL × Multiple)</span><span>= ${formatUSD(baseVal)}</span></div>
            <div class="formula-row"><span>Growth Multiplier (7d change ${formatPct(row.change_7d)})</span><span>× ${growthFactor.toFixed(4)}</span></div>
            <div class="formula-row"><span>Maturity Multiplier (${row.age_days ?? 365} days age)</span><span>× ${maturityFactor.toFixed(4)}</span></div>
            <div class="formula-row"><span>Final Implied Token Value</span><span>= ${formatUSD(row.implied_value_usd)}</span></div>
          </div>

          <h3 style="font-size:1.1rem;margin-top:2rem;margin-bottom:0.5rem;color:var(--accent);">Execution Farm Plan (6 Steps)</h3>
          <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1rem;">Tailored positioning plan for ${row.name} on ${chain} (Capital allocation tier: ${capitalTier}, Target hold duration: ${holdDays} days).</p>
          
          <div class="farm-steps-list">
            <div class="farm-step-card">
              <div class="step-num">1</div>
              <div class="step-text">Connect non-custodial Web3 wallet to ${row.name} on ${chain} network with ${capitalTier} allocated capital. Cost: ~$2 gas. Time: ~5 mins.</div>
            </div>
            <div class="farm-step-card">
              <div class="step-num">2</div>
              <div class="step-text">Supply/deposit ${capitalTier} into ${row.name}'s core vaults and active liquidity pools on ${chain}. Cost: $${capitalTier.slice(1)} position + gas. Time: ~10 mins.</div>
            </div>
            <div class="farm-step-card">
              <div class="step-num">3</div>
              <div class="step-text">Perform weekly qualifying activity such as governance voting, yield compounding, or interacting with sub-contracts on ${row.name}. Cost: ~$1 gas/week. Time: ~5 mins/week.</div>
            </div>
            <div class="farm-step-card">
              <div class="step-num">4</div>
              <div class="step-text">Maintain position continuously for at least ${holdDays} days to satisfy protocol activity history and snapshot eligibility requirements. Cost: $0 ongoing. Time: Passive.</div>
            </div>
            <div class="farm-step-card">
              <div class="step-num">5</div>
              <div class="step-text">Claim safety verification: check published links on ${row.name}'s official domain only; never pay fees to claim points or tokens. Cost: Free. Time: ~2 mins.</div>
            </div>
            <div class="farm-step-card">
              <div class="step-num">6</div>
              <div class="step-text">Maintain farm log recording deposit hashes, weekly interaction history, and plan orderly exit upon protocol TGE announcement. Cost: Free. Time: ~5 mins.</div>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  function renderLive() {
    return `
      ${renderHeader()}
      <main>
        <div style="margin-bottom:1.5rem;">
          <h2 style="font-size:1.5rem;margin-bottom:0.25rem;">Live Market Token View (${RADAR.live.length} protocols)</h2>
          <p style="color:var(--text-muted);font-size:0.9rem;">Top live-token protocols by market capitalization. These protocols already trade on public markets; their values are market-driven and never modeled.</p>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Protocol</th>
                <th>Category</th>
                <th>Chains</th>
                <th>TVL</th>
                <th>Market Cap</th>
                <th>7d Change</th>
              </tr>
            </thead>
            <tbody>
              ${RADAR.live.map(r => `
                <tr>
                  <td><strong>${r.name}</strong> <span style="font-size:0.75rem;color:var(--text-muted)">(${r.slug})</span></td>
                  <td><span class="badge cat">${r.category || 'Other'}</span></td>
                  <td>${r.chains ? r.chains.slice(0, 3).join(', ') : ''}</td>
                  <td>${formatUSD(r.tvl_usd)}</td>
                  <td class="implied-val">${formatUSD(r.mcap_usd)}</td>
                  <td class="${(r.change_7d ?? 0) >= 0 ? 'positive' : 'negative'}">${formatPct(r.change_7d)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </main>
    `;
  }

  function renderModel() {
    const catEntries = Object.entries(RADAR.category_table.categories);
    return `
      ${renderHeader()}
      <main>
        <div class="explainer-section">
          <h3>Token Launch Radar Model (${RADAR.model_version})</h3>
          <p>The radar scans the entire DeFi protocol universe to locate and rank pre-token protocols with high potential. Implied valuation is derived rigorously from on-chain fundamentals without speculation.</p>
          
          <div class="formula-box" style="margin:1rem 0;">
            <strong>Implied Value Formula:</strong><br>
            <code>TVL × Category Multiple × Growth Multiplier (7d change) × Maturity Multiplier (Age) = Implied Value (USD)</code>
          </div>

          <p><strong>Category Calibration:</strong> Category multiples are computed dynamically from live-token protocols in the snapshot (filtering out CEX and Bridges, ratio bounds 0.01 &lt; mcap/tvl &lt; 50). Categories with fewer than 3 live comparables fall back to the overall median (<strong>${RADAR.category_table.overall_median}</strong>). All multiples are clamped to [0.05, 2.0].</p>

          <h3 style="margin-top:1.5rem;margin-bottom:0.75rem;">Category Multiples Table</h3>
          <div class="category-table-grid">
            ${catEntries.map(([cat, stat]) => `
              <div class="cat-card">
                <div class="cat-name">${cat}</div>
                <div class="cat-stats">
                  Multiple: <strong>${stat.clamped_multiple.toFixed(3)}</strong><br>
                  Sample: n=${stat.count} ${stat.used_fallback ? '(fallback)' : ''}<br>
                  Raw Median: ${stat.raw_median.toFixed(3)}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="honest-note">
            <strong>Honesty & Integrity Policy:</strong><br>
            • Pre-token protocols record no token; they never have none.<br>
            • No airdrop promises or guarantees are made; farming plans focus on protocol usage and genuine on-chain participation.<br>
            • All data is sourced directly from the sealed snapshot as of ${RADAR.as_of}.
          </div>
        </div>
      </main>
    `;
  }

  function render() {
    const state = parseHash();
    const app = document.getElementById('app');
    if (state.view === 'detail') {
      app.innerHTML = renderDetail();
    } else if (state.view === 'live') {
      app.innerHTML = renderLive();
    } else if (state.view === 'model') {
      app.innerHTML = renderModel();
    } else {
      app.innerHTML = renderBoard();
    }
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('DOMContentLoaded', render);
  render();
})();
