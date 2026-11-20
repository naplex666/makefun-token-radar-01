(() => {
  const get = id => document.getElementById(id);
  const data = window.RADAR;
  if (!data) {
    get('missing').hidden = false;
    return;
  }

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
  const exact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const usd = n => n == null ? 'Unreported' : money.format(n);
  const pct = n => n == null ? 'Unreported' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
  const factor = n => `${n.toFixed(3)}×`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const category = r => r.category || 'Uncategorized';
  const pageSize = 8;
  const filters = ['search', 'status', 'category', 'chain', 'watch'];
  const index = new Map([...data.rows, ...data.recorded].map(row => [row.slug, row]));
  let page = 0;
  let sortKey = 'rank';
  let direction = 1;

  get('date').textContent = data.as_of;
  get('date').dateTime = data.as_of;
  const early = () => get('status').value === 'early';
  const universe = () => early() ? data.rows : data.recorded;

  function options(id, values, label) {
    const control = get(id);
    const previous = control.value;
    const unique = [...new Set(values)].sort((a, b) => a.localeCompare(b));
    control.replaceChildren(new Option(label, ''), ...unique.map(v => new Option(v, v)));
    if (unique.includes(previous)) control.value = previous;
  }

  function updateOptions() {
    options('category', universe().map(category), 'All categories');
    options('chain', universe().flatMap(r => r.chains), 'All chains');
    get('watch').disabled = !early();
    if (!early()) get('watch').checked = false;
  }

  function filtered() {
    const query = get('search').value.trim().toLowerCase();
    const cat = get('category').value;
    const chain = get('chain').value;
    return universe().filter(r =>
      (!query || `${r.name} ${r.slug}`.toLowerCase().includes(query)) &&
      (!cat || category(r) === cat) &&
      (!chain || r.chains.includes(chain)) &&
      (!get('watch').checked || r.watchlist)
    );
  }

  function kpis(pairs) {
    return pairs.map(([label, value]) => `<div class="kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
  }

  function renderStats(rows) {
    const tvls = rows.map(r => r.tvl_usd).sort((a, b) => a - b);
    const mid = Math.floor(tvls.length / 2);
    const median = !tvls.length ? null : (tvls[mid] + tvls[Math.floor((tvls.length - 1) / 2)]) / 2;
    const values = rows.map(r => early() ? r.implied_value_usd : r.mcap_usd).filter(n => n != null);
    get('stats').innerHTML = kpis([
      ['Matching protocols', rows.length],
      early() ? ['Watchlist coverage in view', `${rows.filter(r => r.watchlist).length} / ${data.watchlist_size}`] :
        ['With reported market cap', values.length],
      ['Median TVL', median == null ? '—' : usd(median)],
      [early() ? 'Highest implied value' : 'Highest market cap', values.length ? usd(Math.max(...values)) : '—'],
    ]);
  }

  // Both data sets arrive sorted by their own value. Select leaders from the
  // filtered set before table sorting so the chart remains a value comparison.
  function renderPlot(rows) {
    get('chart-title').textContent = early() ? 'Launch value ranges' : 'Recorded market caps';
    get('chart-note').textContent = early()
      ? 'Five highest matches. Dot = implied value, band = middle 50% of peer estimates.'
      : 'Five highest matches with a reported market cap.';
    const leaders = rows.filter(r => early() || r.mcap_usd > 0).slice(0, 5);
    const plot = get('plot');
    if (!leaders.length) {
      plot.innerHTML = '<p>No values to plot for this view.</p>';
      return;
    }

    const largest = Math.max(...leaders.map(r => early() ? r.model.high : r.mcap_usd));
    const unit = 10 ** Math.floor(Math.log10(largest));
    const tick = [0.25, 0.5, 1, 2.5].map(n => n * unit).find(n => n * 4 >= largest);
    const position = n => 100 * n / (tick * 4);
    plot.innerHTML = leaders.map(r => {
      const value = early() ? r.implied_value_usd : r.mcap_usd;
      const left = early() ? position(r.model.low) : 0;
      const right = early() ? position(r.model.high) : position(value);
      const label = early() ? `${usd(r.model.low)} to ${usd(r.model.high)}; estimate ${usd(value)}` : usd(value);
      return `<div class="plot-row" data-watch="${Boolean(r.watchlist)}">
        <button class="plot-name" data-slug="${esc(r.slug)}" title="${esc(label)}">${esc(r.name)}</button>
        <div class="track" aria-hidden="true"><span class="range" style="left:${left}%;width:${right - left}%"></span>
        <span class="marker" style="left:${position(value)}%"></span></div>
        <strong>${usd(value)}</strong>
      </div>`;
    }).join('') + `<div class="plot-row" aria-hidden="true"><span></span><div class="axis">${[0, 1, 2, 3, 4].map(i => `<span>${usd(i * tick)}</span>`).join('')}</div></div>`;
  }

  function sortRows(rows) {
    return [...rows].sort((a, b) => {
      const x = sortKey === 'category' ? category(a) : a[sortKey];
      const y = sortKey === 'category' ? category(b) : b[sortKey];
      if (x == null || y == null) return (x == null) - (y == null);
      const cmp = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return direction * cmp;
    });
  }

  function renderTable(rows) {
    const valueKey = early() ? 'implied_value_usd' : 'mcap_usd';
    const columns = [
      ...(early() ? [['rank', 'Rank']] : []),
      ['name', 'Protocol'], ['category', 'Category'], ['tvl_usd', 'TVL'],
      ['change_7d', '7-day TVL change'], [valueKey, early() ? 'Implied value' : 'Market cap'],
    ];
    get('columns').innerHTML = columns.map(([key, label]) => {
      const active = sortKey === key;
      return `<th scope="col"${active ? ` aria-sort="${direction > 0 ? 'ascending' : 'descending'}"` : ''}>
        <button data-sort="${key}">${label}${active ? (direction > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;
    }).join('');
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    page = Math.min(page, pages - 1);
    const start = page * pageSize;
    get('rows').innerHTML = sortRows(rows).slice(start, start + pageSize).map(r => `<tr>
      ${early() ? `<td>#${r.rank}</td>` : ''}
      <td><button class="protocol" data-slug="${esc(r.slug)}">${esc(r.name)}</button>
        ${r.watchlist ? '<span class="flag">Watchlist</span>' : ''}</td>
      <td>${esc(category(r))}</td><td>${usd(r.tvl_usd)}</td>
      <td class="${r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : ''}">${pct(r.change_7d)}</td>
      <td class="value">${usd(r[valueKey])}</td></tr>`).join('') ||
      `<tr><td colspan="${columns.length}">No matches. Clear a filter or reset the board.</td></tr>`;
    get('board-title').textContent = early() ? 'Ranked protocols' : 'Protocols with recorded tokens';
    get('results').textContent = rows.length
      ? `${start + 1}–${Math.min(start + pageSize, rows.length)} of ${rows.length} matches · Select a protocol for its plan`
      : '0 matches';
    get('page').textContent = `${page + 1} / ${pages}`;
    get('prev').disabled = page === 0;
    get('next').disabled = page >= pages - 1;
  }

  function render() {
    const rows = filtered();
    renderStats(rows);
    renderPlot(rows);
    renderTable(rows);
  }

  function showDetail(row) {
    const m = row.model;
    get('detail-name').textContent = row.name;
    get('detail-tag').textContent = m
      ? `Rank #${row.rank} · No token recorded${row.watchlist ? ' · Watchlist' : ''}`
      : `Token recorded${row.symbol ? ` · ${row.symbol}` : ''}`;
    const age = row.age_days == null ? 'Unreported' : `${row.age_days.toLocaleString('en-US')} days`;
    get('detail-body').innerHTML = `
      <p>${esc(category(row))} · ${esc(row.chains.join(', ') || 'Chain unreported')}</p>
      <div class="kpis detail-kpis">${kpis([
        [m ? 'Implied launch value' : 'Recorded market cap', usd(m ? row.implied_value_usd : row.mcap_usd)],
        ['TVL', usd(row.tvl_usd)], ['7-day TVL change', pct(row.change_7d)], ['Tracking age', age],
      ])}</div>
      <div class="detail-grid"><section>${m ? `
        <h3>How the estimate adds up</h3>
        <p>${usd(row.tvl_usd)} TVL × ${factor(m.multiple)} peers × ${factor(m.growth)} growth × ${factor(m.maturity)} maturity.</p>
        <p><strong>${exact.format(row.implied_value_usd)}</strong> implied value. Peer spread: ${usd(m.low)}–${usd(m.high)}.</p>
        <p>${m.localCount} category peers, ${m.broadCount} broad peers. Category contributes ${(100 * m.share).toFixed(1)}% to the log blend.</p>
        <h3>Nearest ${m.localCount ? 'category' : 'broad'} peers</h3>
        <ul class="peers">${m.peers.map(peer => `<li><strong>${esc(peer.name)}</strong><br>${usd(peer.tvl)} TVL · ${factor(peer.ratio)} cap / TVL</li>`).join('')}</ul>` : `
        <h3>Snapshot record</h3>
        <p>Market cap is shown as recorded. This protocol sits outside the launch ranking.</p>`}
      </section><section>
        <h3>Trial plan</h3>
        <p>Quoted fees and published terms take priority. Trial amounts are estimates and rewards are unconfirmed.</p>
        <ol class="steps">${row.farm_steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>
      </section></div>`;
    get('detail').showModal();
  }

  for (const id of filters) {
    get(id).addEventListener(id === 'search' ? 'input' : 'change', () => {
      if (id === 'status') {
        sortKey = early() ? 'rank' : 'mcap_usd';
        direction = early() ? 1 : -1;
        updateOptions();
      }
      page = 0;
      render();
    });
  }

  get('reset').addEventListener('click', () => {
    get('search').value = get('chain').value = get('category').value = '';
    get('status').value = 'early';
    get('watch').checked = false;
    page = 0;
    sortKey = 'rank';
    direction = 1;
    updateOptions();
    render();
  });

  get('prev').addEventListener('click', () => { page--; renderTable(filtered()); });
  get('next').addEventListener('click', () => { page++; renderTable(filtered()); });
  get('columns').addEventListener('click', event => {
    const button = event.target.closest('[data-sort]');
    if (!button) return;
    const key = button.dataset.sort;
    direction = sortKey === key ? -direction : ['rank', 'name', 'category'].includes(key) ? 1 : -1;
    sortKey = key;
    page = 0;
    renderTable(filtered());
    get('columns').querySelector(`[data-sort="${key}"]`).focus();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-slug]');
    if (button) showDetail(index.get(button.dataset.slug));
  });

  updateOptions();
  render();
})();
