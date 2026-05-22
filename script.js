const BASE = 'https://restcountries.com/v3.1';
const TIMEOUT_MS = 8000;
const MAX_COMPARE = 4;
const FIELDS = 'name,flags,population,area,region,subregion,capital,currencies,languages,cca3';

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
let searchAbort = null;

async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  if (searchAbort) searchAbort.abort();
  searchAbort = new AbortController();
  const timer = setTimeout(() => searchAbort.abort(), ms);
  try {
    const res = await fetch(url, { signal: searchAbort.signal });
    clearTimeout(timer);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`API error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out — try again.');
    throw err;
  }
}

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = type;
}

// Load all countries using the required ?fields= param
async function loadAll() {
  setStatus('Loading countries…');
  try {
    const data = await fetchWithTimeout(`${BASE}/all?fields=${FIELDS}`);
    allCountries = data.sort((a, b) => a.name.common.localeCompare(b.name.common));
    setStatus(`${allCountries.length} countries loaded.`);
    render();
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

// For name search, use /name/{query} endpoint which is more accurate
async function searchByName(query) {
  setStatus('Searching…');
  try {
    const data = await fetchWithTimeout(
      `${BASE}/name/${encodeURIComponent(query)}?fields=${FIELDS}`
    );
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.message.includes('timed out')) {
      setStatus(err.message, 'error');
      return null; // null = error state
    }
    return []; // 404 = no results
  }
}

// For region filter, use /region/{region} endpoint
async function searchByRegion(region) {
  setStatus('Filtering…');
  try {
    const data = await fetchWithTimeout(
      `${BASE}/region/${encodeURIComponent(region)}?fields=${FIELDS}`
    );
    return Array.isArray(data) ? data : [];
  } catch (err) {
    setStatus(err.message, 'error');
    return null;
  }
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

function escHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderCards(countries) {
  if (!countries.length) {
    resultsEl.innerHTML = '<p class="no-results">No countries found. Try a different search.</p>';
    return;
  }

  const showing = Math.min(countries.length, 120);
  setStatus(`Showing ${showing}${countries.length > 120 ? ` of ${countries.length}` : ''} countr${showing === 1 ? 'y' : 'ies'}.`);

  resultsEl.innerHTML = countries.slice(0, 120).map(c => {
    const inCompare = compareSet.has(c.cca3);
    return `
    <div class="card">
      <div class="flag">${c.flags?.emoji ?? '🏳'}</div>
      <h2>${escHtml(c.name.common)}</h2>
      <div class="meta">
        <div><span class="label">Capital</span> ${escHtml(getCapital(c))}</div>
        <div><span class="label">Region</span> ${escHtml(c.region || '—')}</div>
        <div><span class="label">Population</span> ${fmt(c.population)}</div>
        <div><span class="label">Area</span> ${c.area != null ? fmt(Math.round(c.area)) + ' km²' : '—'}</div>
        <div><span class="label">Languages</span> ${escHtml(getLanguages(c))}</div>
      </div>
      <button class="btn-compare${inCompare ? ' selected' : ''}" data-cca3="${c.cca3}">
        ${inCompare ? '✓ Remove' : '+ Compare'}
      </button>
    </div>`;
  }).join('');

  resultsEl.querySelectorAll('.btn-compare').forEach(btn => {
    btn.addEventListener('click', () => toggleCompare(btn.dataset.cca3, countries));
  });
}

async function render() {
  const query = searchEl.value.trim();
  const region = regionEl.value;

  // Use local filter when data is loaded and no active search term
  if (query.length === 0 && !region) {
    renderCards(allCountries);
    return;
  }

  if (query.length === 1) {
    setStatus('Type at least 2 characters to search.');
    resultsEl.innerHTML = '';
    return;
  }

  // Region only — use /region/ endpoint
  if (!query && region) {
    const data = await searchByRegion(region);
    if (data === null) return;
    const sorted = data.sort((a, b) => a.name.common.localeCompare(b.name.common));
    renderCards(sorted);
    return;
  }

  // Name search — use /name/ endpoint, then apply region filter client-side
  const data = await searchByName(query);
  if (data === null) return;
  const filtered = region ? data.filter(c => c.region === region) : data;
  const sorted = filtered.sort((a, b) => a.name.common.localeCompare(b.name.common));

  if (!sorted.length) {
    setStatus(`No countries match "${query}${region ? ` in ${region}` : ''}".`);
    resultsEl.innerHTML = '<p class="no-results">No results found.</p>';
    return;
  }
  renderCards(sorted);
}

function toggleCompare(cca3, currentList) {
  const source = currentList || allCountries;
  if (compareSet.has(cca3)) {
    compareSet.delete(cca3);
  } else {
    if (compareSet.size >= MAX_COMPARE) {
      setStatus(`Max ${MAX_COMPARE} countries at a time.`, 'error');
      return;
    }
    compareSet.add(cca3);
  }
  updateCompareUI();
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
          <th>Field</th>
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

searchEl.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 300);
});

regionEl.addEventListener('change', render);

loadAll();
