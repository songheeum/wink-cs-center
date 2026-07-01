const state = {
  config: null,
  rows: [],
  filtered: [],
  view: 'home',
  search: '',
  filters: { month: 'all', type: 'all', category: 'all', handler: 'all' },
  ui: { openGroups: { tech: true, general: true }, activeCat: '' }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const pct = (value, total) => total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';
const clean = (v) => String(v ?? '').replace(/\r/g, '').trim();

const SVG = (inner) => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICONS = {
  home: SVG('<path d="M3 9.5 12 3l9 6.5"/><path d="M5 9v11h14V9"/><path d="M9.5 20v-6h5v6"/>'),
  book: SVG('<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v14H6.5A1.5 1.5 0 0 0 5 18.5z"/><path d="M5 18.5A1.5 1.5 0 0 1 6.5 17H19v4H6.5A1.5 1.5 0 0 1 5 19.5z"/>'),
  chart: SVG('<path d="M3 3v18h18"/><rect x="7" y="12" width="2.6" height="5" rx=".6"/><rect x="11.7" y="8" width="2.6" height="9" rx=".6"/><rect x="16.4" y="14" width="2.6" height="3" rx=".6"/>'),
  note: SVG('<path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>'),
  star: SVG('<path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>'),
  sync: SVG('<path d="M21 3v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 21v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>'),
  wifi: SVG('<path d="M2 8.6a16 16 0 0 1 20 0"/><path d="M5 12.5a11 11 0 0 1 14 0"/><path d="M8.5 16.3a6 6 0 0 1 7 0"/><path d="M12 20h.01"/>'),
  app: SVG('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>'),
  video: SVG('<rect x="2.5" y="5" width="19" height="13" rx="2.5"/><path d="M10 9.2v4.6l4-2.3z" fill="currentColor" stroke="none"/>'),
  keyboard: SVG('<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7.5 14h9"/>'),
  shield: SVG('<path d="M12 22s8-4 8-10V5.5L12 2.5 4 5.5V12c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  message: SVG('<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.4 8.4 0 0 1-3.7-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/>'),
  image: SVG('<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-4.5-4.5L5 21"/>'),
  file: SVG('<path d="M14 2.5H6.5A2 2 0 0 0 4.5 4.5v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5"/><path d="M8.5 13h7M8.5 17h7"/>'),
  tech: SVG('<path d="M14.6 6.3a4 4 0 0 0-5.3 5.3l-6 6a2 2 0 1 0 2.8 2.8l6-6a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.2-.5-.5-2.2z"/>'),
  general: SVG('<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.4 8.4 0 0 1-3.7-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>'),
  default: SVG('<circle cx="12" cy="12" r="3.2"/>')
};

const UI_SVG = {
  search: SVG('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>'),
  bell: SVG('<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  sun: SVG('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')
};

const firstToken = (s) => String(s).split('/')[0].trim();

init();

async function init() {
  try {
    state.config = await fetchJson('./app.json');
    renderNav();
    bindChrome();
    await loadData();
    applyFilters();
    render();
  } catch (error) {
    console.error(error);
    $('#pageRoot').innerHTML = `
      <div class="empty-state">
        <h2>데이터를 불러오지 못했습니다.</h2>
        <p>app.json의 CSV 주소와 구글시트 공개 설정을 확인해주세요.</p>
      </div>`;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`config load failed: ${res.status}`);
  return res.json();
}

async function loadData() {
  let table;
  let firstError = null;

  try {
    table = await loadCsvViaFetch(state.config.csvUrl);
  } catch (error) {
    firstError = error;
    console.warn('CSV fetch failed. Trying Google Visualization JSONP fallback.', error);
    table = await loadCsvViaGvizJsonp(state.config.csvUrl);
  }

  try {
    hydrateRowsFromTable(table);
  } catch (error) {
    if (firstError) {
      console.warn('Original CSV fetch error was:', firstError);
    }
    throw error;
  }
}

async function loadCsvViaFetch(csvUrl) {
  const res = await fetch(csvUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`csv load failed: ${res.status}`);
  const csvText = await res.text();
  return parseCSV(csvText);
}

function hydrateRowsFromTable(table) {
  const headerIndex = table.findIndex(row =>
    row.some(cell => clean(cell).includes('접수일')) &&
    row.some(cell => clean(cell).includes('상태'))
  );

  if (headerIndex < 0) {
    console.error('CSV/GViz table preview:', table.slice(0, 5));
    throw new Error('CSV header row not found');
  }

  const headers = table[headerIndex].map(clean);
  const dataRows = table
    .slice(headerIndex + 1)
    .filter(row => clean(row[0]) || clean(row[4]) || clean(row[9]) || clean(row[11]));

  const col = buildColumnMap(headers);
  const privateIndexes = new Set(state.config.privacy.privateColumnIndexes || []);
  const privateNames = state.config.privacy.privateColumnNames || [];

  state.rows = dataRows
    .map(row => normalizeRow(row, headers, col, privateIndexes, privateNames))
    .filter(Boolean);

  const latestDate = maxDate(state.rows.map(r => r.receivedAt));
  $('#lastUpdateText').textContent = latestDate ? `${formatDate(latestDate)} 기준` : 'CSV 연결 완료';
}

function loadCsvViaGvizJsonp(csvUrl) {
  return new Promise((resolve, reject) => {
    const callbackName = `__danbiSheetCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      settled = true;
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (payload) => {
      try {
        if (!payload || payload.status === 'error') {
          const message = payload?.errors?.map(err => err.detailed_message || err.message).join(' / ') || 'Google Visualization response error';
          throw new Error(message);
        }
        const table = gvizPayloadToTable(payload);
        cleanup();
        resolve(table);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    script.onerror = () => {
      if (!settled) {
        cleanup();
        reject(new Error('Google Visualization JSONP script load failed'));
      }
    };

    script.src = csvUrlToGvizJsonpUrl(csvUrl, callbackName);
    document.head.appendChild(script);

    setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error('Google Visualization JSONP timeout'));
      }
    }, 15000);
  });
}

function csvUrlToGvizJsonpUrl(csvUrl, callbackName) {
  const url = new URL(csvUrl);
  const gid = url.searchParams.get('gid') || '0';
  const path = url.pathname.replace(/\/pub$/, '/gviz/tq');
  const gviz = new URL(`${url.origin}${path}`);
  gviz.searchParams.set('gid', gid);
  gviz.searchParams.set('headers', '1');
  gviz.searchParams.set('tqx', `out:json;responseHandler:${callbackName}`);
  return gviz.toString();
}

function gvizPayloadToTable(payload) {
  const table = payload.table;
  if (!table || !Array.isArray(table.cols) || !Array.isArray(table.rows)) {
    throw new Error('Google Visualization table format is invalid');
  }

  const headers = table.cols.map((col, index) => clean(col.label || col.id || `col${index + 1}`));
  const rows = table.rows.map(row => headers.map((_, index) => {
    const cell = row.c?.[index];
    if (!cell) return '';
    if (cell.f != null) return String(cell.f);
    if (cell.v == null) return '';
    return String(cell.v);
  }));

  return [headers, ...rows];
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (quote) {
      if (c === '"' && n === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quote = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      quote = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

function buildColumnMap(headers) {
  const find = (keyword) => headers.findIndex(h => h.includes(keyword));
  return {
    receivedAt: find('접수일'), source: find('접수 출처'), type: find('점검 종류'), symptom: find('증상'),
    handler: find('처리자'), processedAt: find('처리일'), start: find('시작시간'), end: find('종료시간'),
    duration: find('소요시간'), status: find('상태')
  };
}

function normalizeRow(row, headers, col, privateIndexes, privateNames) {
  const hidden = new Set();
  headers.forEach((h, index) => {
    if (privateIndexes.has(index) || privateNames.some(name => h.includes(name))) hidden.add(index);
  });

  const get = (index) => index >= 0 && !hidden.has(index) ? clean(row[index]) : '';
  const symptom = get(col.symptom);
  const statusRaw = get(col.status);
  const receivedAt = normalizeDate(get(col.receivedAt));

  if (!receivedAt && !symptom && !statusRaw) return null;

  return {
    receivedAt,
    source: get(col.source) || '미입력',
    type: get(col.type) || '미입력',
    symptom: symptom || '미분류',
    category: getCategory(symptom),
    handler: get(col.handler) || '미지정',
    processedAt: normalizeDate(get(col.processedAt)),
    start: get(col.start),
    end: get(col.end),
    durationRaw: get(col.duration),
    durationMin: getDurationMin(get(col.duration), get(col.start), get(col.end)),
    statusRaw: statusRaw || '미입력',
    status: normalizeStatus(statusRaw)
  };
}

function normalizeStatus(raw) {
  const value = clean(raw);
  if (!value) return '기타';
  const rules = state.config.statusRules;
  if (rules.completeIncludes.some(x => value.includes(x))) return '완료';
  if (rules.cancelIncludes.some(x => value.includes(x))) return '취소';
  return '기타';
}

function getCategory(symptom) {
  const value = clean(symptom);
  if (!value) return '미분류';
  const parts = value.split('_').map(v => clean(v)).filter(Boolean);
  return parts[0] || value;
}

function normalizeDate(value) {
  const v = clean(value).replace(/\s+/g, '');
  if (!v) return '';
  const dash = v.match(/^(\d{4})[-.](\d{1,2})[-.]?(\d{1,2})?$/);
  if (dash) {
    const y = dash[1];
    const m = dash[2].padStart(2, '0');
    const d = (dash[3] || '01').padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return v;
}

function getDurationMin(raw, start, end) {
  const num = clean(raw).match(/\d+(\.\d+)?/);
  if (num) return Number(num[0]);
  const diff = diffMinutes(start, end);
  return diff > 0 ? diff : null;
}

function diffMinutes(start, end) {
  const parse = (t) => {
    const m = clean(t).match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const s = parse(start);
  const e = parse(end);
  if (s == null || e == null) return null;
  return e >= s ? e - s : e + 1440 - s;
}

function renderNav() {
  const cfg = state.config;
  const onHome = state.view === 'home';
  const onDash = state.view === 'detail';

  const top = (cfg.sidebarNav || []).map(item => {
    const isDash = item.id === 'dashboard';
    const active = (isDash && onDash) || (item.id === 'home' && onHome && !state.ui.activeCat);
    return `<button class="nav-item ${active ? 'active' : ''}" data-view="${item.id}">
      <span class="ico">${ICONS[item.icon] || ICONS.default}</span>${item.label}</button>`;
  }).join('');

  const groups = (cfg.sidebarGroups || []).map(g => {
    const open = state.ui.openGroups[g.id] !== false;
    const items = (g.items || []).map(label => {
      const active = state.ui.activeCat === label;
      return `<button class="nav-sub ${active ? 'active' : ''}" data-cat="${escapeAttr(label)}">
        <span class="sub-dot"></span><span class="nav-sub-label">${label}</span></button>`;
    }).join('');
    return `<div class="nav-group ${open ? 'open' : ''}">
      <button class="nav-group-head" data-toggle="${g.id}">
        <span class="ico ico-${g.id}">${ICONS[g.icon] || ICONS.default}</span>
        <span class="ng-label">${g.label}</span><span class="ng-chev"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
      </button>
      <div class="nav-group-body">${items}</div>
    </div>`;
  }).join('');

  $('#mainNav').innerHTML = top + groups;
}

function bindChrome() {
  $('#mainNav').addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      const id = toggle.dataset.toggle;
      state.ui.openGroups[id] = state.ui.openGroups[id] === false;
      renderNav();
      return;
    }
    const sub = e.target.closest('[data-cat]');
    if (sub) {
      const label = sub.dataset.cat;
      const next = state.ui.activeCat === label ? '' : label;
      state.ui.activeCat = next;
      state.search = next ? firstToken(next) : '';
      state.view = 'home';
      $('#globalSearch').value = state.search;
      applyFilters();
      renderNav();
      render();
      return;
    }
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    state.view = btn.dataset.view === 'dashboard' ? 'detail' : 'home';
    state.ui.activeCat = '';
    renderNav();
    render();
  });

  $('#globalSearch').addEventListener('input', (e) => {
    state.search = e.target.value.trim();
    state.ui.activeCat = '';
    applyFilters();
    renderNav();
    render();
  });

  $('#themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    html.dataset.theme = next;
    $('#themeLabel').textContent = next === 'dark' ? 'Dark' : 'Light';
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#globalSearch').focus();
    }
  });
}

function applyFilters() {
  const q = state.search.toLowerCase();
  state.filtered = state.rows.filter(row => {
    if (q) {
      const searchable = [row.receivedAt, row.source, row.type, row.symptom, row.category, row.handler, row.processedAt, row.statusRaw, row.status].join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    if (state.filters.month !== 'all' && monthKey(row.receivedAt) !== state.filters.month) return false;
    if (state.filters.type !== 'all' && row.type !== state.filters.type) return false;
    if (state.filters.category !== 'all' && row.category !== state.filters.category) return false;
    if (state.filters.handler !== 'all' && row.handler !== state.filters.handler) return false;
    return true;
  });
}

function render() {
  if (state.view === 'detail') renderDetail();
  else renderHome();
}

function getStats(rows) {
  const total = rows.length;
  const statusCounts = countBy(rows, r => r.status);
  const completed = statusCounts['완료'] || 0;
  const canceled = statusCounts['취소'] || 0;
  const etc = total - completed - canceled;
  const months = sortedKeys(countBy(rows, r => monthKey(r.receivedAt))).filter(Boolean);
  const latestMonth = months[months.length - 1];
  const thisMonthCount = latestMonth ? rows.filter(r => monthKey(r.receivedAt) === latestMonth).length : 0;
  const validDurations = rows.map(r => r.durationMin).filter(v => Number.isFinite(v) && v > 0);
  const avgDuration = validDurations.length ? validDurations.reduce((a,b) => a + b, 0) / validDurations.length : 0;
  const sortedDur = [...validDurations].sort((a,b) => a - b);
  const maxDuration = sortedDur.length ? Math.max(...sortedDur) : 0;

  return { total, completed, canceled, etc, latestMonth, thisMonthCount, validDurations, avgDuration, maxDuration };
}

function renderHome() {
  const cat = state.ui.activeCat;
  const intro = cat
    ? `<div class="home-context"><span class="home-context-tag">${cat}</span><span>관련 가이드를 검색했어요.</span></div>`
    : '';
  $('#pageRoot').innerHTML = `
    <section class="main-column">
      ${heroTemplate()}
      ${intro}
      ${guideSectionTemplate()}
      ${quickSectionTemplate()}
      <div class="notice">가이드는 지속적으로 업데이트됩니다. 최신 정보 확인으로 정확한 상담을 지원해주세요.</div>
    </section>
  `;

  bindHeroSearch();
}

function heroTemplate() {
  const home = state.config.home;
  return `
    <section class="hero">
      <div>
        <h1>${home.heroTitle}</h1>
        <p>${home.heroDescription}</p>
        <label class="hero-search">
          <span class="si" aria-hidden="true">${UI_SVG.search}</span>
          <input id="heroSearch" type="search" placeholder="${escapeAttr(home.searchPlaceholder)}" value="${escapeAttr(state.search)}" />
          <button class="primary-btn" type="button" id="heroSearchButton">검색</button>
        </label>
        <div class="keyword-row">
          <span class="keyword-label">추천 검색어</span>
          ${home.keywords.map(keyword => `<button class="chip" data-keyword="${escapeAttr(keyword)}">${keyword}</button>`).join('')}
        </div>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <span class="ring"></span><span class="ring r2"></span>
        <span class="glyph">${UI_SVG.search}</span>
      </div>
    </section>`;
}

function bindHeroSearch() {
  const input = $('#heroSearch');
  if (!input) return;
  const doSearch = () => {
    state.search = input.value.trim();
    $('#globalSearch').value = state.search;
    applyFilters();
    render();
  };
  $('#heroSearchButton')?.addEventListener('click', doSearch);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  $$('.chip[data-keyword]').forEach(btn => btn.addEventListener('click', () => {
    state.search = btn.dataset.keyword;
    $('#globalSearch').value = state.search;
    applyFilters();
    render();
  }));
}

function renderDetail() {
  const rows = state.filtered;
  const stats = getStats(rows);
  const topSymptoms = topN(countBy(rows, r => r.symptom), 10);
  const topCategories = topN(countBy(rows, r => r.category), 8);
  const topTypes = topN(countBy(rows, r => r.type), 8);
  const monthly = buildMonthly(rows);
  const handlerStats = buildHandlerStats(rows);
  const durationStats = buildDurationStats(rows);

  $('#pageRoot').innerHTML = `
    <section class="main-column" style="grid-column:1 / -1">
      <div class="detail-header">
        <div>
          <h1>점검 운영 현황 상세</h1>
          <p>인입 유형, 카테고리 비율, 월별 통계, 처리자별 현황, 교사용 점검 투입시간을 비교합니다.</p>
        </div>
        <button class="primary-btn" id="backHome">홈으로</button>
      </div>
      ${filterBarTemplate(rows)}
      <section class="kpi-grid">
        ${kpi('총 점검', stats.total, '건', 'total')}
        ${kpi('완료', stats.completed, pct(stats.completed, stats.total), 'done')}
        ${kpi('취소', stats.canceled, pct(stats.canceled, stats.total), 'cancel')}
        ${kpi('기타', stats.etc, pct(stats.etc, stats.total), 'etc')}
        ${kpi('시간기록', stats.validDurations.length, '건', 'time')}
        ${kpi('평균소요', Math.round(stats.avgDuration), '분', 'avg')}
      </section>
      <section class="analysis-grid">
        ${barCard('상위 인입 항목 TOP 10', topSymptoms, rows.length)}
        ${barCard('카테고리 비율', topCategories, rows.length)}
        ${barCard('점검 종류별 비율', topTypes, rows.length)}
        <article class="card pad">
          <div class="card-title"><h2>처리 상태 분포</h2><small>필터 기준</small></div>
          ${donutTemplate(stats.completed, stats.canceled, stats.etc, stats.total)}
        </article>
      </section>
      <section class="analysis-grid">
        ${monthlyChartCard(monthly)}
        ${monthlyStackedCard(monthly)}
      </section>
      <section class="analysis-grid">
        ${handlerTableCard(handlerStats)}
        ${durationCard(durationStats, stats)}
      </section>
      <section class="analysis-grid">
        ${recentTableCard(rows.slice(0, 12))}
        ${guideSectionTemplate()}
      </section>
      <div class="notice">보안 기준: D열 자마드 주소, F열 메모, M열 특이사항은 화면/검색/상세 테이블에서 제외됩니다.</div>
    </section>
  `;

  $('#backHome').addEventListener('click', () => {
    state.view = 'home';
    renderNav();
    render();
  });
  bindFilters();
}

function filterBarTemplate(rows) {
  const allRows = state.rows;
  return `
    <div class="filter-bar card pad">
      ${selectTemplate('month', '기간', ['all', ...sortedKeys(countBy(allRows, r => monthKey(r.receivedAt))).filter(Boolean)], state.filters.month)}
      ${selectTemplate('type', '점검 종류', ['all', ...sortedKeys(countBy(allRows, r => r.type))], state.filters.type)}
      ${selectTemplate('category', '카테고리', ['all', ...sortedKeys(countBy(allRows, r => r.category))], state.filters.category)}
      ${selectTemplate('handler', '처리자', ['all', ...sortedKeys(countBy(allRows, r => r.handler))], state.filters.handler)}
    </div>`;
}

function selectTemplate(key, label, values, selected) {
  return `<label><span class="keyword-label">${label}</span><select data-filter="${key}">${values.map(v => `<option value="${escapeAttr(v)}" ${v === selected ? 'selected' : ''}>${v === 'all' ? '전체' : v}</option>`).join('')}</select></label>`;
}

function bindFilters() {
  $$('[data-filter]').forEach(select => select.addEventListener('change', () => {
    state.filters[select.dataset.filter] = select.value;
    applyFilters();
    render();
  }));
}

function kpi(label, value, sub, type) {
  const color = type === 'done' ? 'var(--c-done)' : type === 'cancel' ? 'var(--c-cancel)' : type === 'etc' ? 'var(--c-etc)'
    : type === 'time' ? 'var(--c-time)' : type === 'avg' ? 'var(--c-avg)' : 'var(--primary)';
  return `<div class="kpi"><span><i class="dot" style="background:${color}"></i>${label}</span><strong>${fmt(value)}</strong><em>${sub}</em></div>`;
}

function donutTemplate(done, canceled, etc, total) {
  const R = 62, SW = 18;
  const C = 2 * Math.PI * R;
  const segs = [
    { label: '완료', value: done, color: 'var(--c-done)' },
    { label: '취소', value: canceled, color: 'var(--c-cancel)' },
    { label: '기타', value: etc, color: 'var(--c-etc)' }
  ];
  const visible = segs.filter(s => s.value > 0);
  const gap = visible.length > 1 ? C * 0.012 : 0;
  let cursor = 0, delay = 0;

  const arcs = visible.map(s => {
    const frac = total ? s.value / total : 0;
    const len = Math.max(0, frac * C - gap);
    const offset = -cursor * C;
    cursor += frac;
    const d = (delay += 0.12) - 0.12;
    return `<circle class="donut-seg" r="${R}" cx="84" cy="84" fill="none" stroke="${s.color}"
      stroke-width="${SW}" stroke-linecap="round"
      stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
      style="--len:${len.toFixed(2)};--c:${C.toFixed(2)};animation-delay:${d.toFixed(2)}s"></circle>`;
  }).join('');

  const legend = segs.map(s => `<div class="legend-item"><i style="background:${s.color}"></i>${s.label} <b>${fmt(s.value)}</b></div>`).join('');

  return `
    <div class="donut-wrap">
      <div class="donut">
        <svg viewBox="0 0 168 168" role="img" aria-label="처리 상태 분포">
          <circle class="donut-track" r="${R}" cx="84" cy="84" fill="none" stroke-width="${SW}"></circle>
          ${arcs}
        </svg>
        <div class="donut-center">
          <em>완료율</em>
          <strong>${pct(done, total)}</strong>
          <span>${fmt(done)} / ${fmt(total)}건</span>
        </div>
      </div>
      <div class="legend">${legend}</div>
    </div>`;
}

function barCard(title, entries, total) {
  const max = Math.max(...entries.map(e => e[1]), 1);
  return `<article class="card pad"><div class="card-title"><h2>${title}</h2><small>총 ${fmt(total)}건</small></div>
    <div class="bar-list">${entries.map(([name, count]) => `
      <div class="bar-row"><strong>${name}</strong><div class="bar-track"><div class="bar-fill" style="width:${count / max * 100}%"></div></div><span class="bar-value">${fmt(count)}</span></div>`).join('')}</div></article>`;
}

function guideSectionTemplate() {
  return `<section class="card pad"><div class="card-title"><h2>자주 찾는 가이드</h2><button class="link-btn">전체 보기 ›</button></div>
    <div class="three-col">${state.config.guideCards.map(card => `
      <div class="guide-card"><span class="tile-icon">${ICONS[card.icon] || ICONS.default}</span><div><strong>${card.title}</strong><small>${card.category}</small></div><span class="arrow">›</span></div>`).join('')}</div></section>`;
}

function quickSectionTemplate() {
  return `<section class="card pad"><div class="card-title"><h2>빠른 실행</h2><button class="link-btn">전체 보기 ›</button></div>
    <div class="three-col q4">${state.config.quickActions.map(action => `
      <div class="quick-card"><span class="tile-icon">${ICONS[action.icon] || ICONS.default}</span><div><strong>${action.title}</strong><small>${action.description}</small></div><span class="arrow">›</span></div>`).join('')}</div></section>`;
}

function buildMonthly(rows) {
  const grouped = new Map();
  rows.forEach(row => {
    const m = monthKey(row.receivedAt);
    if (!m) return;
    if (!grouped.has(m)) grouped.set(m, []);
    grouped.get(m).push(row);
  });
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, list]) => ({
    month,
    total: list.length,
    completed: list.filter(r => r.status === '완료').length,
    canceled: list.filter(r => r.status === '취소').length,
    etc: list.filter(r => r.status === '기타').length,
    categories: countBy(list, r => r.category)
  }));
}

function monthlyChartCard(monthly) {
  const max = Math.max(...monthly.map(m => m.total), 1);
  return `<article class="card pad"><div class="card-title"><h2>월별 점검 추이</h2><small>접수일 기준</small></div>
    <div class="month-chart">${monthly.map(m => `<div class="month-bar"><i style="height:${Math.max(4, m.total / max * 100)}%"></i><span>${m.month.slice(5)}</span></div>`).join('')}</div></article>`;
}

function monthlyStackedCard(monthly) {
  const categoryNames = ['교사', '네트워크', '하드웨어', '콘텐츠'];
  const colors = ['var(--primary)', 'var(--c-done)', 'var(--c-amber)', 'var(--c-time)'];
  return `<article class="card pad"><div class="card-title"><h2>월별 카테고리 추이</h2><small>주요 4개</small></div>
    ${monthly.map(m => `<div class="stacked-month"><strong>${m.month}</strong><div class="stacked-track">
      ${categoryNames.map((cat, i) => `<span class="seg" style="width:${pct(m.categories[cat] || 0, m.total)};background:${colors[i]}"></span>`).join('')}
    </div><span class="bar-value">${fmt(m.total)}</span></div>`).join('')}
    <p class="safe-note">교사 / 네트워크 / 하드웨어 / 콘텐츠 중심으로 비교합니다.</p>
  </article>`;
}

function buildHandlerStats(rows) {
  return topN(countBy(rows, r => r.handler), 20).map(([handler, total]) => {
    const list = rows.filter(r => r.handler === handler);
    const completed = list.filter(r => r.status === '완료').length;
    const canceled = list.filter(r => r.status === '취소').length;
    const etc = total - completed - canceled;
    return { handler, total, completed, canceled, etc, rate: pct(completed, total) };
  });
}

function handlerTableCard(items) {
  return `<article class="card pad"><div class="card-title"><h2>처리자별 처리 현황</h2><small>건수 / 완료율</small></div>
    <table class="data-table"><thead><tr><th>처리자</th><th>전체</th><th>완료</th><th>취소</th><th>기타</th><th>완료율</th></tr></thead><tbody>
      ${items.map(i => `<tr><td><strong>${i.handler}</strong></td><td>${fmt(i.total)}</td><td>${fmt(i.completed)}</td><td>${fmt(i.canceled)}</td><td>${fmt(i.etc)}</td><td>${i.rate}</td></tr>`).join('')}
    </tbody></table></article>`;
}

function buildDurationStats(rows) {
  const valid = rows.filter(r => Number.isFinite(r.durationMin) && r.durationMin > 0);
  const byHandler = sortedKeys(countBy(valid, r => r.handler)).map(handler => {
    const list = valid.filter(r => r.handler === handler);
    const sum = list.reduce((acc, r) => acc + r.durationMin, 0);
    return { name: handler, count: list.length, total: sum, avg: list.length ? sum / list.length : 0 };
  }).sort((a,b) => b.total - a.total);
  const byType = sortedKeys(countBy(valid, r => r.type)).map(type => {
    const list = valid.filter(r => r.type === type);
    const sum = list.reduce((acc, r) => acc + r.durationMin, 0);
    return { name: type, count: list.length, total: sum, avg: list.length ? sum / list.length : 0 };
  }).sort((a,b) => b.count - a.count);
  return { valid, byHandler, byType };
}

function durationCard(durationStats, stats) {
  return `<article class="card pad"><div class="card-title"><h2>교사용 점검 투입시간</h2><small>시간 기록 건 기준</small></div>
    <div class="inline-stats">
      <div class="inline-stat"><small>시간 기록</small><strong>${fmt(stats.validDurations.length)}건</strong></div>
      <div class="inline-stat"><small>평균</small><strong>${Math.round(stats.avgDuration)}분</strong></div>
      <div class="inline-stat"><small>최대</small><strong>${Math.round(stats.maxDuration)}분</strong></div>
    </div>
    <p class="safe-note">※ 소요시간은 교사용 업무폰 및 PC 점검 건 중심으로 기록된 값입니다. 전체 점검 건 평균 처리시간이 아닙니다.</p>
    <table class="data-table"><thead><tr><th>처리자</th><th>기록건수</th><th>총시간</th><th>평균</th></tr></thead><tbody>
      ${durationStats.byHandler.map(i => `<tr><td><strong>${i.name}</strong></td><td>${fmt(i.count)}</td><td>${fmt(Math.round(i.total))}분</td><td>${i.avg.toFixed(1)}분</td></tr>`).join('')}
    </tbody></table>
  </article>`;
}

function recentTableCard(rows) {
  return `<article class="card pad"><div class="card-title"><h2>최근 점검</h2><small>보안 컬럼 제외</small></div>
    <table class="data-table"><thead><tr><th>접수일</th><th>점검 종류</th><th>증상</th><th>처리자</th><th>상태</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.receivedAt || '-'}</td><td>${r.type}</td><td><strong>${r.symptom}</strong></td><td>${r.handler}</td><td><span class="status-pill ${r.status === '완료' ? 'done' : r.status === '취소' ? 'cancel' : ''}">${r.status}</span></td></tr>`).join('')}
    </tbody></table></article>`;
}

function countBy(rows, selector) {
  return rows.reduce((acc, row) => {
    const key = selector(row) || '미분류';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
function topN(obj, n) { return Object.entries(obj).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).slice(0, n); }
function sortedKeys(obj) { return Object.keys(obj).sort((a,b) => a.localeCompare(b, 'ko')); }
function monthKey(date) { return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : ''; }
function maxDate(dates) { const valid = dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort(); return valid[valid.length - 1] || ''; }
function formatDate(date) { return date.replaceAll('-', '.'); }
function escapeAttr(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
