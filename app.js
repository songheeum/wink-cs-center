const state = {
  config: null,
  rows: [],
  filtered: [],
  view: 'home',
  search: '',
  filters: { month: 'all', type: 'all', category: 'all', handler: 'all' }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const pct = (value, total) => total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';
const clean = (v) => String(v ?? '').replace(/\r/g, '').trim();

const ICONS = {
  home: '⌂', book: '▤', chart: '◔', note: '✎', star: '☆',
  sync: '↻', wifi: '◉', app: '⌘', video: '▷', keyboard: '⌨', shield: '⛉',
  message: '✉', image: '▨', file: '▦', default: '•'
};

/* 카테고리별 고정 색상 (좌측 카테고리 · 도넛 보조 팔레트와 통일) */
const CAT_COLORS = ['#5b5bd6', '#0fae7a', '#f59e0b', '#06b6d4', '#f43f5e', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#84cc16'];
const catColor = (name) => {
  let h = 0;
  for (let i = 0; i < String(name).length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CAT_COLORS[h % CAT_COLORS.length];
};

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
  $('#mainNav').innerHTML = state.config.navigation.map(item => `
    <button class="nav-item ${((item.id === state.view) || (item.id === 'dashboard' && state.view === 'detail')) ? 'active' : ''}" data-view="${item.id}">
      <span class="ico">${ICONS[item.icon] || ICONS.default}</span>${item.label}
    </button>`).join('');
}

function bindChrome() {
  $('#mainNav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    state.view = btn.dataset.view === 'dashboard' ? 'detail' : 'home';
    renderNav();
    render();
  });

  $('#globalSearch').addEventListener('input', (e) => {
    state.search = e.target.value.trim();
    applyFilters();
    render();
  });

  $('#themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    html.dataset.theme = next;
    $('#themeLabel').textContent = next === 'dark' ? 'Dark' : 'Light';
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
  renderSideCategories();
  if (state.view === 'detail') renderDetail();
  else renderHome();
}

/* 좌측 카테고리 — 전체 데이터 기준 상위 카테고리를 라이브로 표시.
   클릭 시 기존 검색 경로를 그대로 사용한다(검색 로직 변경 없음). */
function renderSideCategories() {
  const host = $('#sideCategories');
  if (!host) return;
  const entries = topN(countBy(state.rows, r => r.category), 12).filter(([name]) => name && name !== '미분류');
  const countEl = $('#sideCatCount');
  if (countEl) countEl.textContent = entries.length ? `${entries.length}` : '';

  if (!entries.length) {
    host.innerHTML = '<p class="cat-empty">표시할 카테고리가 없습니다</p>';
    return;
  }
  const max = Math.max(...entries.map(e => e[1]), 1);
  host.innerHTML = entries.map(([name, count]) => {
    const color = catColor(name);
    const active = state.search && name.includes(state.search) ? ' aria-current="true"' : '';
    return `<button class="cat-row" data-cat="${escapeAttr(name)}"${active}>
        <span class="cat-dot" style="background:${color}"></span>
        <span class="cat-name">${name}</span>
        <span class="cat-count">${fmt(count)}</span>
        <span class="cat-meter"><i style="width:${Math.max(6, count / max * 100)}%;background:${color}"></i></span>
      </button>`;
  }).join('');

  $$('.cat-row', host).forEach(btn => btn.addEventListener('click', () => {
    const term = btn.dataset.cat;
    state.search = state.search === term ? '' : term;
    const gs = $('#globalSearch');
    if (gs) gs.value = state.search;
    applyFilters();
    render();
  }));
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
  const rows = state.filtered;
  const stats = getStats(rows);
  const topSymptoms = topN(countBy(rows, r => r.symptom), 3);
  const topCategories = topN(countBy(rows, r => r.category), 3);
  const topHandlers = topN(countBy(rows, r => r.handler), 2);

  $('#pageRoot').innerHTML = `
    <section class="main-column">
      ${heroTemplate()}
      <section class="dashboard-overview">
        <article class="card pad summary-card">
          <div class="card-title">
            <div><h2>점검 운영 현황</h2><small>${stats.latestMonth ? `${stats.latestMonth} 기준 · ` : ''}D/F/M열 미노출 적용</small></div>
            <button class="link-btn" data-open-detail>전체 보기 ›</button>
          </div>
          <div class="summary-main">
            <div class="summary-icon">✓</div>
            <div class="summary-text">
              <p>총 누적 점검</p>
              <div class="summary-figure">${fmt(stats.total)}</div>
            </div>
            <div class="summary-rate">
              <p>완료율</p>
              <div class="big">${pct(stats.completed, stats.total)}</div>
            </div>
          </div>
          <div class="progress">
            <span class="pg-done" style="width:${pct(stats.completed, stats.total)}"></span>
            <span class="pg-cancel" style="width:${pct(stats.canceled, stats.total)}"></span>
            <span class="pg-etc" style="width:${pct(stats.etc, stats.total)}"></span>
          </div>
          <div class="stat-pills">
            <span class="stat-pill"><i style="background:var(--c-done)"></i>완료 <b>${fmt(stats.completed)}</b></span>
            <span class="stat-pill"><i style="background:var(--c-cancel)"></i>취소 <b>${fmt(stats.canceled)}</b></span>
            <span class="stat-pill"><i style="background:var(--c-etc)"></i>기타 <b>${fmt(stats.etc)}</b></span>
            <span class="stat-pill"><i style="background:var(--c-time)"></i>시간기록 <b>${fmt(stats.validDurations.length)}</b></span>
            <span class="stat-pill"><i style="background:var(--c-avg)"></i>평균 <b>${Math.round(stats.avgDuration)}분</b></span>
          </div>
          <p class="safe-note">※ 소요시간은 <strong>교사용 업무폰 및 PC 점검 건 중심</strong>으로 기록된 값입니다. 전체 점검 건 평균 처리시간으로 해석하지 않습니다.</p>
        </article>
        <article class="card pad donut-card">
          <div class="card-title"><div><h3>처리 상태 분포</h3><small>완료 / 취소 / 기타</small></div></div>
          ${donutTemplate(stats.completed, stats.canceled, stats.etc, stats.total)}
        </article>
      </section>
      <section class="three-col">
        ${miniInsight('많이 들어온 유형', topSymptoms)}
        ${miniInsight('주요 카테고리', topCategories)}
        ${miniInsight('처리자 현황', topHandlers)}
      </section>
      ${guideSectionTemplate()}
      ${quickSectionTemplate()}
      <div class="notice">가이드는 지속적으로 업데이트됩니다. 최신 정보 확인으로 정확한 상담을 지원해주세요.</div>
    </section>
    ${rightRailTemplate(rows)}
  `;

  bindHeroSearch();
  $('[data-open-detail]').addEventListener('click', () => {
    state.view = 'detail';
    renderNav();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function heroTemplate() {
  const home = state.config.home;
  return `
    <section class="hero">
      <div>
        <h1>${home.heroTitle}</h1>
        <p>${home.heroDescription}</p>
        <label class="hero-search">
          <span class="si" aria-hidden="true">⌕</span>
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
        <span class="glyph">⌕</span>
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

function miniInsight(title, entries) {
  const max = Math.max(...entries.map(e => e[1]), 1);
  const rows = entries.map(([name, count], i) => `
    <div class="rank-row">
      <span class="rank-no">${i + 1}</span>
      <div class="rank-body">
        <div class="rank-name">${name}</div>
        <div class="rank-meter"><i style="width:${Math.max(8, count / max * 100)}%"></i></div>
      </div>
      <span class="rank-count">${fmt(count)}</span>
    </div>`).join('');
  return `<article class="card pad"><div class="card-title"><h3>${title}</h3></div><div class="rank-list">${rows || '<p class="cat-empty">데이터 없음</p>'}</div></article>`;
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

function rightRailTemplate(rows) {
  const recent = rows.slice(0, 5);
  const favorites = state.config.guideCards.slice(0, 5);
  return `<aside class="right-rail">
    <article class="card rail-card"><div class="card-title"><h3>최근 본 항목</h3><button class="link-btn">전체 보기 ›</button></div><div class="rail-list">
      ${recent.map(row => `<div class="rail-item"><span class="rail-icon">◷</span><strong>${row.symptom}</strong><span class="time">${row.receivedAt || '-'}</span></div>`).join('')}
    </div></article>
    <article class="card rail-card"><div class="card-title"><h3>즐겨찾기</h3><button class="link-btn">전체 보기 ›</button></div><div class="rail-list">
      ${favorites.map(card => `<div class="rail-item"><span class="rail-icon">☆</span><strong>${card.title}</strong><span class="time">${card.category.split('·')[0].trim()}</span></div>`).join('')}
    </div></article>
    <article class="card rail-card"><div class="card-title"><h3>최근 업데이트</h3><button class="link-btn">전체 보기 ›</button></div><div class="rail-list">
      <div class="rail-item"><span class="new-badge">NEW</span><strong>점검 현황 상세 분석 추가</strong><span class="time">오늘</span></div>
      <div class="rail-item"><span class="new-badge">NEW</span><strong>D/F/M열 미노출 기준 적용</strong><span class="time">오늘</span></div>
      <div class="rail-item"><span class="new-badge">NEW</span><strong>교사용 점검 투입시간 안내 추가</strong><span class="time">오늘</span></div>
    </div></article>
  </aside>`;
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
