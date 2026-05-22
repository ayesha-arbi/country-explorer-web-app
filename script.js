const BASE = 'https://restcountries.com/v3.1';
const TIMEOUT_MS = 8000;
const MAX_COMPARE = 4;

const searchEl = document.getElementById('search');
const regionEl = document.getElementById('region');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const comparePanel = document.getElementById('compare-panel');
const compareTableWrap = document.getElementById('compare-table-wrap');
const clearCompareBtn = document.getElementById('clear-compare');
const compareCountEl = document.getElementById('compare-count');

let allCountries = [];
let compareSet = new Set();
let debounceTimer = null;

async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    // Edge case: AbortError means timeout, not a network/API failure
    if (err.name === 'AbortError') throw new Error('Request timed out. The API may be slow — try again.');
    throw err;
  }
}

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = type;
}

async function loadAll() {
  setStatus('Loading countries…', 'loading');
  try {
    const fields = 'name,flags,population,area,region,subregion,capital,currencies,languages,cca3';
    const data = await fetchWithTimeout(`${BASE}/all?fields=${fields}`);
    allCountries = data.sort((a, b) =>
      a.name.common.localeCompare(b.name.common)
    );
    setStatus(`${allCountries.length} countries loaded.`);
    render();
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

function getFiltered() {
  const query = searchEl.value.trim().toLowerCase();
  const region = regionEl.value;

  if (query.length === 1) return [];

  return allCountries.filter(c => {
    const nameMatch = !query || c.name.common.toLowerCase().includes(query);
    const regionMatch = !region || c.region === region;
    return nameMatch && regionMatch;
  });
}

function fmt(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function getCurrencies(c) {
  if (!c.currencies) return '—';
  return Object.values(c.currencies).map(v => v.name).join(', ') || '—';
}

function getLanguages(c) {
  if (!c.languages) return '—';
  return Object.values(c.languages).join(', ') || '—';
}

function getCapital(c) {
  return (c.capital && c.capital[0]) || '—';
}

function render() {
  const filtered = getFiltered();
  const query = searchEl.value.trim();

  if (query.length === 1) {
    setStatus('Type at least 2 characters to search.');
    resultsEl.innerHTML = '';
    return;
  }

  if (!filtered.length && allCountries.length) {
    setStatus(`No countries match "${query || regionEl.value}".`);
    resultsEl.innerHTML = '<p class="no-results">No results found. Try a different search or region.</p>';
    return;
  }

  const showing = Math.min(filtered.length, 120);
  setStatus(`Showing ${showing}${filtered.length > 120 ? ` of ${filtered.length}` : ''} countr${showing === 1 ? 'y' : 'ies'}.`);

  resultsEl.innerHTML = filtered.slice(0, 120).map(c => {
    const inCompare = compareSet.has(c.cca3);
    return `
    <div class="card">
      <div class="flag">${c.flags?.emoji ?? '🏳'}</div>
      <h2>${escHtml(c.name.common)}</h2>
      <div class="meta">
        Capital: <span>${escHtml(getCapital(c))}</span><br>
        Region: <span>${escHtml(c.region || '—')}</span><br>
        Population: <span>${fmt(c.population)}</span><br>
        Area: <span>${c.area != null ? fmt(Math.round(c.area)) + ' km²' : '—'}</span><br>
        Languages: <span>${escHtml(getLanguages(c))}</span>
      </div>
      <button
        class="btn-compare${inCompare ? ' selected' : ''}"
        data-cca3="${c.cca3}"
        aria-pressed="${inCompare}"
      >${inCompare ? '✓ In comparison' : '+ Compare'}</button>
    </div>`;
  }).join('');

  // Delegate button clicks
  resultsEl.querySelectorAll('.btn-compare').forEach(btn => {
    btn.addEventListener('click', () => toggleCompare(btn.dataset.cca3));
  });
}

function toggleCompare(cca3) {
  if (compareSet.has(cca3)) {
    compareSet.delete(cca3);
  } else {
    if (compareSet.size >= MAX_COMPARE) {
      setStatus(`You can compare up to ${MAX_COMPARE} countries at a time.`, 'error');
      return;
    }
    compareSet.add(cca3);
  }
  updateCompareUI();
  render();
}

function updateCompareUI() {
  compareCountEl.textContent = compareSet.size;
  clearCompareBtn.style.display = compareSet.size ? 'inline-block' : 'none';

  if (!compareSet.size) {
    comparePanel.style.display = 'none';
    return;
  }

  comparePanel.style.display = 'block';
  const countries = allCountries.filter(c => compareSet.has(c.cca3));

  const rows = [
    ['Flag', c => c.flags?.emoji ?? '🏳'],
    ['Capital', c => escHtml(getCapital(c))],
    ['Region', c => escHtml(c.region || '—')],
    ['Subregion', c => escHtml(c.subregion || '—')],
    ['Population', c => fmt(c.population)],
    ['Area (km²)', c => c.area != null ? fmt(Math.round(c.area)) : '—'],
    ['Currency', c => escHtml(getCurrencies(c))],
    ['Languages', c => escHtml(getLanguages(c))],
  ];

  compareTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Attribute</th>
          ${countries.map(c => `<th>${escHtml(c.name.common)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(([label, fn]) => `
          <tr>
            <td>${label}</td>
            ${countries.map(c => `<td>${fn(c)}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

clearCompareBtn.addEventListener('click', () => {
  compareSet.clear();
  updateCompareUI();
  render();
});


function escHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

searchEl.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 200);
});

regionEl.addEventListener('change', render);

loadAll();
