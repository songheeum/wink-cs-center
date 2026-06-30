const state = {
  config: null,
  rows: [],
  filtered: [],
  view: 'home',
  guideMode: 'all',
  selectedDevice: null,
  openMenu: null,
  search: '',
  filters: { month: 'all', type: 'all', category: 'all', handler: 'all' }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const pct = (value, total) => total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';
const clean = (v) => String(v ?? '').replace(/\r/g, '').trim();


const ICONS = {
  sync: '↻', wifi: '◉', app: '⌘', video: '▣', keyboard: '⌨', shield: '◇',
  power: '⏻', screen: '□', payment: '₩', delivery: '⇢', general: '💬', book: '✦', service: '⚙', calendar: '◫',
  default: '•'
};

const NAV_CATEGORIES = [
  {
    id: 'wifi',
    label: '와이파이 / 네트워크',
    desc: '연결 · 저장됨 · 인증',
    icon: 'wifi3d',
    devices: ['윙크봇', '윙크스쿨', '학부모앱', '레노버', '삼성탭']
  },
  {
    id: 'power',
    label: '전원 / 충전 / 화면',
    desc: '전원 · 충전 · 표시',
    icon: 'power3d',
    devices: ['윙크봇', '윙크스쿨', '학부모앱', '레노버', '삼성탭']
  },
  {
    id: 'app',
    label: '앱 작동 / 업데이트 / 초기화',
    desc: '실행 · 업데이트 · 재설정',
    icon: 'app3d',
    devices: ['윙크봇', '윙크스쿨', '학부모앱', '레노버', '삼성탭']
  },
  {
    id: 'work',
    label: '일반 업무 가이드',
    desc: '무료체험 · 결제 · 배송',
    icon: 'work3d',
    devices: ['무료체험', '결제관리', '배송조회', '해지/환불']
  }
];

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
    const detail = error?.message ? escapeAttr(error.message) : '알 수 없는 오류';
    $('#pageRoot').innerHTML = `
      <div class="empty-state">
        <h2>데이터를 불러오지 못했습니다.</h2>
        <p>app.json 경로, CSV 공개 설정, GitHub 업로드 위치를 확인해주세요.</p>
        <p class="safe-note"><strong>오류 상세:</strong> ${detail}</p>
      </div>`;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`config load failed: ${res.status}`);
  return res.json();
}

async function loadData() {
  const errors = [];
  let table = null;

  // GitHub Pages에서 Google Sheets CSV fetch는 CORS 정책 때문에 실패할 수 있습니다.
  // 그래서 Google Visualization JSONP 방식을 먼저 사용하고, 실패 시 CSV fetch를 보조로 시도합니다.
  try {
    table = await loadCsvViaGvizJsonp(state.config.csvUrl);
  } catch (error) {
    errors.push(`GViz: ${error.message}`);
    console.warn('Google Visualization JSONP failed. Trying direct CSV fetch.', error);
  }

  if (!table) {
    try {
      table = await loadCsvViaFetch(state.config.csvUrl);
    } catch (error) {
      errors.push(`CSV fetch: ${error.message}`);
      console.warn('Direct CSV fetch failed.', error);
    }
  }

  if (!table) {
    throw new Error(errors.join(' / ') || 'CSV table load failed');
  }

  try {
    hydrateRowsFromTable(table);
  } catch (error) {
    errors.push(`Data parse: ${error.message}`);
    throw new Error(errors.join(' / '));
  }
}

async function loadCsvViaFetch(csvUrl) {
  const res = await fetch(csvUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`csv load failed: ${res.status}`);
  const csvText = await res.text();
  return parseCSV(csvText);
}

function hydrateRowsFromTable(table) {
  if (!Array.isArray(table) || !table.length) {
    throw new Error('CSV/GViz table is empty');
  }

  const publicHeaders = getPublicHeaders();
  let headerIndex = table.findIndex(row =>
    row.some(cell => clean(cell).includes('접수일')) &&
    row.some(cell => clean(cell).includes('상태'))
  );

  let headers;
  let rawRows;

  if (headerIndex >= 0) {
    headers = table[headerIndex].map(clean);
    rawRows = table.slice(headerIndex + 1);
  } else {
    // Google Visualization이 헤더를 label로 넘기지 못하는 경우를 대비해
    // 공개용 CSV의 확정 컬럼 순서를 기준으로 해석합니다.
    console.warn('CSV header row not found. Using public sheet column order fallback.', table.slice(0, 5));
    headers = publicHeaders;
    rawRows = table;
  }

  const col = buildColumnMap(headers);
  const requiredIndexes = [col.receivedAt, col.type, col.symptom, col.handler, col.status].filter(index => index >= 0);
  const dataRows = rawRows.filter(row => requiredIndexes.some(index => clean(row[index])));

  const privateIndexes = new Set(state.config.privacy.privateColumnIndexes || []);
  const privateNames = state.config.privacy.privateColumnNames || [];

  state.rows = dataRows
    .map(row => normalizeRow(row, headers, col, privateIndexes, privateNames))
    .filter(Boolean);

  if (!state.rows.length) {
    throw new Error('No usable dashboard rows found');
  }

  const latestDate = maxDate(state.rows.map(r => r.receivedAt));
  const lastUpdateText = $('#lastUpdateText');
  if (lastUpdateText) lastUpdateText.textContent = latestDate ? `${formatDate(latestDate)} 기준` : 'CSV 연결 완료';
}

function loadCsvViaGvizJsonp(csvUrl) {
  return new Promise((resolve, reject) => {
    const callbackName = `__danbiSheetCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    let settled = false;

    const previousGoogle = window.google;
    const previousCallback = window[callbackName];

    const finish = (payload) => {
      if (settled) return;
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

    const cleanup = () => {
      settled = true;
      if (previousCallback) window[callbackName] = previousCallback;
      else delete window[callbackName];
      if (previousGoogle) window.google = previousGoogle;
      else delete window.google;
      script.remove();
    };

    window[callbackName] = finish;

    // Google이 responseHandler 대신 기본 google.visualization.Query.setResponse로
    // 응답하는 경우도 있어 둘 다 받도록 방어합니다.
    window.google = window.google || {};
    window.google.visualization = window.google.visualization || {};
    window.google.visualization.Query = window.google.visualization.Query || {};
    window.google.visualization.Query.setResponse = finish;

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

  const expected = getPublicHeaders();
  const labels = table.cols.map((col, index) => clean(col.label || col.id || ''));
  const hasUsableLabels = labels.some(label => label.includes('접수일')) && labels.some(label => label.includes('상태'));
  const headers = hasUsableLabels ? labels : expected.slice(0, Math.max(expected.length, table.cols.length));

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

function getPublicHeaders() {
  return ['접수일', '접수 출처', '점검 종류', '증상', '처리자', '처리일', '시작시간', '종료시간', '소요시간', '상태'];
}

function buildColumnMap(headers) {
  const find = (keyword, fallbackIndex) => {
    const index = headers.findIndex(h => clean(h).includes(keyword));
    return index >= 0 ? index : fallbackIndex;
  };

  return {
    receivedAt: find('접수일', 0),
    source: find('접수 출처', 1),
    type: find('점검 종류', 2),
    symptom: find('증상', 3),
    handler: find('처리자', 4),
    processedAt: find('처리일', 5),
    start: find('시작시간', 6),
    end: find('종료시간', 7),
    duration: find('소요시간', 8),
    status: find('상태', 9)
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


function navIconSvg(icon) {
  const icons = {
    home3d: `
      <span class="nav-icon-orb home" aria-hidden="true">
        <svg class="nav-svg" viewBox="0 0 48 48" role="img">
          <defs>
            <linearGradient id="home3dA" x1="8" y1="5" x2="42" y2="43" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#BFE0FF"/><stop offset=".52" stop-color="#3182F6"/><stop offset="1" stop-color="#155EEF"/></linearGradient>
            <linearGradient id="home3dB" x1="17" y1="25" x2="32" y2="42" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset="1" stop-color="#D8EBFF" stop-opacity=".72"/></linearGradient>
            <filter id="home3dS" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="#3182F6" flood-opacity=".32"/></filter>
          </defs>
          <path filter="url(#home3dS)" d="M9.7 22.8 24 10.4l14.3 12.4v14.1a3.4 3.4 0 0 1-3.4 3.4h-7.1V29.5h-7.6v10.8h-7.1a3.4 3.4 0 0 1-3.4-3.4V22.8Z" fill="url(#home3dA)"/>
          <path d="M15 24.8 24 17l9 7.8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".86"/>
          <path d="M20.2 40.3V29.5h7.6v10.8" fill="url(#home3dB)"/>
        </svg>
      </span>`,
    dashboard3d: `
      <span class="nav-icon-orb dashboard" aria-hidden="true">
        <svg class="nav-svg" viewBox="0 0 48 48" role="img">
          <defs>
            <linearGradient id="dash3dA" x1="9" y1="7" x2="40" y2="42" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#CDE4FF"/><stop offset=".48" stop-color="#3182F6"/><stop offset="1" stop-color="#1B64DA"/></linearGradient>
            <filter id="dash3dS" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="#3182F6" flood-opacity=".28"/></filter>
          </defs>
          <rect x="9" y="8" width="30" height="31" rx="9" fill="url(#dash3dA)" filter="url(#dash3dS)"/>
          <rect x="15" y="26" width="4.8" height="7.5" rx="2.4" fill="#fff" opacity=".92"/>
          <rect x="22" y="19" width="4.8" height="14.5" rx="2.4" fill="#fff" opacity=".98"/>
          <rect x="29" y="13" width="4.8" height="20.5" rx="2.4" fill="#fff" opacity=".76"/>
          <path d="M15 36h18" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".42"/>
        </svg>
      </span>`,
    wifi3d: `
      <span class="nav-icon-orb wifi" aria-hidden="true">
        <svg class="nav-svg" viewBox="0 0 48 48" role="img">
          <defs>
            <linearGradient id="wifi3dA" x1="7" y1="9" x2="41" y2="41" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#BDEBFF"/><stop offset=".52" stop-color="#00A9C7"/><stop offset="1" stop-color="#007FA3"/></linearGradient>
            <filter id="wifi3dS" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="#00A9C7" flood-opacity=".28"/></filter>
          </defs>
          <circle cx="24" cy="24" r="17" fill="url(#wifi3dA)" filter="url(#wifi3dS)"/>
          <path d="M14.5 21.6a15.2 15.2 0 0 1 19 0" fill="none" stroke="#fff" stroke-width="3.3" stroke-linecap="round" opacity=".86"/>
          <path d="M18.8 26.3a8.3 8.3 0 0 1 10.4 0" fill="none" stroke="#fff" stroke-width="3.3" stroke-linecap="round" opacity=".92"/>
          <circle cx="24" cy="31.2" r="2.8" fill="#fff"/>
        </svg>
      </span>`,
    power3d: `
      <span class="nav-icon-orb power" aria-hidden="true">
        <svg class="nav-svg" viewBox="0 0 48 48" role="img">
          <defs>
            <linearGradient id="power3dA" x1="8" y1="7" x2="40" y2="42" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFE1B2"/><stop offset=".5" stop-color="#F59F00"/><stop offset="1" stop-color="#E67700"/></linearGradient>
            <filter id="power3dS" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="#F59F00" flood-opacity=".30"/></filter>
          </defs>
          <circle cx="24" cy="24" r="17" fill="url(#power3dA)" filter="url(#power3dS)"/>
          <path d="M24 13v12" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
          <path d="M17.4 18.5a10 10 0 1 0 13.2 0" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".88"/>
        </svg>
      </span>`,
    app3d: `
      <span class="nav-icon-orb app" aria-hidden="true">
        <svg class="nav-svg" viewBox="0 0 48 48" role="img">
          <defs>
            <linearGradient id="app3dA" x1="7" y1="7" x2="41" y2="42" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#D6C6FF"/><stop offset=".5" stop-color="#8B5CF6"/><stop offset="1" stop-color="#6D28D9"/></linearGradient>
            <filter id="app3dS" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="#8B5CF6" flood-opacity=".30"/></filter>
          </defs>
          <rect x="10" y="9" width="28" height="30" rx="9" fill="url(#app3dA)" filter="url(#app3dS)"/>
          <rect x="16" y="15" width="7" height="7" rx="2.4" fill="#fff" opacity=".92"/>
          <rect x="25" y="15" width="7" height="7" rx="2.4" fill="#fff" opacity=".74"/>
          <rect x="16" y="25" width="7" height="7" rx="2.4" fill="#fff" opacity=".74"/>
          <rect x="25" y="25" width="7" height="7" rx="2.4" fill="#fff" opacity=".92"/>
        </svg>
      </span>`,
    work3d: `
      <span class="nav-icon-orb work" aria-hidden="true">
        <svg class="nav-svg" viewBox="0 0 48 48" role="img">
          <defs>
            <linearGradient id="work3dA" x1="8" y1="8" x2="40" y2="42" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#C6F6E7"/><stop offset=".52" stop-color="#00A882"/><stop offset="1" stop-color="#087A63"/></linearGradient>
            <filter id="work3dS" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="#00A882" flood-opacity=".28"/></filter>
          </defs>
          <rect x="9" y="12" width="30" height="25" rx="8" fill="url(#work3dA)" filter="url(#work3dS)"/>
          <path d="M18 12v-1.5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V12" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".88"/>
          <path d="M15.5 22h17M15.5 28h11" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".88"/>
        </svg>
      </span>`
  };
  return icons[icon] || `<span class="nav-icon-orb" aria-hidden="true"><span class="nav-glyph">${ICONS.default}</span></span>`;
}

function renderNav() {
  const isHome = state.view === 'home' && state.guideMode === 'all';
  const isDashboard = state.view === 'detail';

  $('#mainNav').innerHTML = `
    <div class="nav-section nav-section-main">
      <button class="nav-item ${isHome ? 'active' : ''}" data-view="home">
        ${navIconSvg('home3d')}
        <span class="nav-copy"><strong>홈</strong><small>상담가이드 메인</small></span>
      </button>
      <button class="nav-item ${isDashboard ? 'active' : ''}" data-view="dashboard">
        ${navIconSvg('dashboard3d')}
        <span class="nav-copy"><strong>점검 운영 현황</strong><small>대시보드</small></span>
      </button>
    </div>

    <div class="nav-divider" aria-hidden="true"></div>

    <div class="nav-section nav-section-symptom">
      <div class="nav-stack">
        ${NAV_CATEGORIES.map(category => {
          const open = state.openMenu === category.id || state.guideMode === category.id;
          const active = state.view === 'home' && state.guideMode === category.id;
          return `
            <div class="nav-group ${open ? 'open' : ''} ${active ? 'active' : ''}">
              <button class="nav-item nav-parent ${active ? 'active' : ''}" data-menu="${category.id}" aria-expanded="${open}">
                ${navIconSvg(category.icon)}
                <span class="nav-copy"><strong>${category.label}</strong><small>${category.desc}</small></span>
                <span class="nav-caret" aria-hidden="true">⌄</span>
              </button>
              <div class="nav-submenu">
                ${category.devices.map(device => `
                  <button class="sub-nav-item ${state.guideMode === category.id && state.selectedDevice === device ? 'active' : ''}" data-guide-mode="${category.id}" data-device="${escapeAttr(device)}">
                    <span>${device}</span>
                  </button>`).join('')}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function bindChrome() {
  $('#mainNav').addEventListener('click', (e) => {
    const direct = e.target.closest('[data-view]');
    const parent = e.target.closest('[data-menu]');
    const child = e.target.closest('[data-guide-mode]');

    if (direct) {
      const view = direct.dataset.view;
      if (view === 'dashboard') {
        state.view = 'detail';
      } else {
        state.view = 'home';
        state.guideMode = 'all';
        state.selectedDevice = null;
        state.openMenu = null;
      }
      renderNav();
      render();
      return;
    }

    if (parent) {
      const mode = parent.dataset.menu;
      state.view = 'home';
      state.guideMode = mode;
      state.selectedDevice = null;
      state.openMenu = mode;
      renderNav();
      render();
      return;
    }

    if (child) {
      state.view = 'home';
      state.guideMode = child.dataset.guideMode;
      state.selectedDevice = child.dataset.device;
      state.openMenu = child.dataset.guideMode;
      renderNav();
      render();
    }
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

  $('#pageRoot').addEventListener('click', (e) => {
    const selectButton = e.target.closest('.select-button');
    if (selectButton) {
      const select = selectButton.closest('[data-custom-select]');
      const isOpen = select.classList.contains('open');
      closeCustomSelects(select);
      select.classList.toggle('open', !isOpen);
      selectButton.setAttribute('aria-expanded', String(!isOpen));
      return;
    }

    const option = e.target.closest('.select-option');
    if (option) {
      const select = option.closest('[data-custom-select]');
      state.filters[select.dataset.filter] = option.dataset.value;
      closeCustomSelects();
      applyFilters();
      render();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-custom-select]')) closeCustomSelects();
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
  bindHeroSearch();
  animateMountedContent();
}

function animateMountedContent() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const items = $$('#pageRoot .hero, #pageRoot .card, #pageRoot .detail-header');
  requestAnimationFrame(() => {
    items.forEach((item, index) => {
      item.classList.remove('motion-item');
      item.style.setProperty('--motion-delay', `${Math.min(index * 55, 660)}ms`);
      void item.offsetWidth;
      item.classList.add('motion-item');
    });
  });
}

function cssPct(value, total, min = 0) {
  if (!total) return `${min}%`;
  const number = Math.max(min, Math.min(100, (value / total) * 100));
  return `${number.toFixed(2)}%`;
}

function barDelay(index) {
  return `${Math.min(index * 70, 560)}ms`;
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
  const medianDuration = sortedDur.length ? sortedDur[Math.floor(sortedDur.length / 2)] : 0;
  const maxDuration = sortedDur.length ? Math.max(...sortedDur) : 0;

  return { total, completed, canceled, etc, latestMonth, thisMonthCount, validDurations, avgDuration, medianDuration, maxDuration };
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
        <article class="card pad">
          <div class="card-title">
            <div><h2>점검 운영 현황</h2><small>${stats.latestMonth ? `${stats.latestMonth} 기준 · ` : ''}D/F/M열 미노출 적용</small></div>
            <button class="link-btn" data-open-detail>전체 보기 ›</button>
          </div>
          <div class="summary-main">
            <div class="summary-icon">✓</div>
            <div>
              <p>총 누적 점검</p>
              <h2>${fmt(stats.total)}</h2>
            </div>
            <div style="margin-left:auto;text-align:right">
              <p>완료율</p>
              <h2 style="color:var(--primary)">${pct(stats.completed, stats.total)}</h2>
            </div>
          </div>
          <div class="progress"><span style="--value:${cssPct(stats.completed, stats.total)}"></span></div>
          <div class="kpi-grid">
            ${kpi('완료', stats.completed, pct(stats.completed, stats.total), 'done')}
            ${kpi('취소', stats.canceled, pct(stats.canceled, stats.total), 'cancel')}
            ${kpi('기타', stats.etc, pct(stats.etc, stats.total), 'etc')}
            ${kpi('최근 월', stats.thisMonthCount, stats.latestMonth || '-', 'month')}
            ${kpi('시간기록', stats.validDurations.length, '교사용 중심', 'time')}
            ${kpi('평균소요', Math.round(stats.avgDuration), '분', 'avg')}
          </div>
          <p class="safe-note">※ 소요시간은 <strong>교사용 업무폰 및 PC 점검 건 중심</strong>으로 기록된 값입니다. 전체 점검 건 평균 처리시간으로 해석하지 않습니다.</p>
        </article>
        <article class="card pad">
          <div class="card-title"><h2>처리 상태 분포</h2><small>완료 / 취소 / 기타</small></div>
          ${donutTemplate(stats.completed, stats.canceled, stats.etc, stats.total)}
        </article>
      </section>
      <section class="three-col">
        ${miniInsight('많이 들어온 유형', topSymptoms)}
        ${miniInsight('주요 카테고리', topCategories)}
        ${miniInsight('처리자 현황', topHandlers)}
      </section>
      ${guideSectionTemplate()}
    </section>
    ${rightRailTemplate(rows)}
  `;

  $('[data-open-detail]').addEventListener('click', () => {
    state.view = 'detail';
    renderNav();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function heroTemplate() {
  const home = state.config.home;
  const category = NAV_CATEGORIES.find(item => item.id === state.guideMode);
  const heroPresets = {
    all: {
      title: home.heroTitle,
      description: home.heroDescription,
      placeholder: home.searchPlaceholder,
      keywords: home.keywords
    },
    wifi: {
      title: '와이파이 / 네트워크 증상부터 확인하세요',
      description: '고객이 말한 연결 오류를 먼저 고르고, 해당 기기별 점검 가이드로 좁혀볼 수 있어요.',
      placeholder: '예: 저장됨, 인증 실패, 연결 끊김, 네트워크 오류',
      keywords: ['저장됨', '네트워크 끊김', '접속/인증', 'Wi-Fi 6', 'Wi-Fi 7']
    },
    power: {
      title: '전원 / 충전 / 화면 증상을 확인하세요',
      description: '전원 불량, 충전 불가, 화면 무반응처럼 기기 상태 중심으로 빠르게 분류합니다.',
      placeholder: '예: 충전 안 됨, 전원 꺼짐, 화면 멈춤, 과열',
      keywords: ['충전', '전원', '화면', '과열', '교체']
    },
    app: {
      title: '앱 작동 / 업데이트 / 초기화 흐름으로 확인하세요',
      description: '앱 실행 오류, 업데이트 실패, 초기화 요청을 기기별로 분리해 대응합니다.',
      placeholder: '예: 앱작동, 업데이트, 초기화, 로그인, 튕김',
      keywords: ['앱작동', '업데이트', '초기화', '로그인', '튕김']
    },
    work: {
      title: '일반 업무 가이드를 바로 확인하세요',
      description: '무료체험, 결제관리, 배송조회, 해지/환불처럼 상담 빈도가 높은 업무를 모았습니다.',
      placeholder: '예: 무료체험, 결제, 배송, 회수, 환불',
      keywords: ['무료체험', '결제관리', '배송조회', '해지/환불', '회수']
    }
  };
  const current = heroPresets[state.guideMode] || heroPresets.all;
  const title = state.selectedDevice && category ? `${state.selectedDevice} · ${current.title}` : current.title;
  const description = state.selectedDevice && category ? `${category.label} 중 ${state.selectedDevice} 기준으로 관련 가이드를 좁혀 보여줍니다.` : current.description;

  return `
    <section class="hero">
      <div class="hero-copy">
        <h1>${title}</h1>
        <p>${description}</p>
        <label class="hero-search">
          <input id="heroSearch" type="search" placeholder="${current.placeholder}" value="${escapeAttr(state.search)}" />
          <button class="primary-btn" type="button" id="heroSearchButton">검색</button>
        </label>
        <div class="keyword-row">
          <span class="keyword-label">추천 검색어</span>
          ${current.keywords.map(keyword => `<button class="chip" data-keyword="${escapeAttr(keyword)}">${keyword}</button>`).join('')}
        </div>
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
      ${filterBarTemplate()}
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
    </section>
  `;

  $('#backHome').addEventListener('click', () => {
    state.view = 'home';
    renderNav();
    render();
  });
}

function filterBarTemplate() {
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
  const selectedText = selected === 'all' ? '전체' : selected;
  return `
    <div class="filter-control" data-custom-select data-filter="${key}">
      <span class="keyword-label">${label}</span>
      <button class="select-button" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span class="select-value">${selectedText}</span>
        <svg class="select-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.2 6.2 8 10l3.8-3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="select-menu" role="listbox">
        ${values.map(v => {
          const labelText = v === 'all' ? '전체' : v;
          const isSelected = v === selected;
          return `<button class="select-option ${isSelected ? 'selected' : ''}" type="button" role="option" aria-selected="${isSelected}" data-value="${escapeAttr(v)}">
            <span class="option-label">${labelText}</span>
            <span class="option-check" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M3.5 8.2 6.6 11.3 12.8 4.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
}


function closeCustomSelects(except = null) {
  $$('[data-custom-select].open').forEach(select => {
    if (select === except) return;
    select.classList.remove('open');
    $('.select-button', select)?.setAttribute('aria-expanded', 'false');
  });
}

function kpi(label, value, sub, type) {
  return `<div class="kpi"><span>${statusDot(type)} ${label}</span><strong>${fmt(value)}</strong><em>${sub}</em></div>`;
}
function statusDot(type) {
  const color = type === 'done' ? 'var(--green)' : type === 'cancel' ? 'var(--red)' : type === 'time' ? 'var(--purple)' : type === 'avg' ? 'var(--cyan)' : 'var(--primary)';
  return `<i class="dot" style="background:${color}"></i>`;
}

function donutTemplate(done, canceled, etc, total) {
  const donePct = total ? done / total * 100 : 0;
  const cancelPct = total ? canceled / total * 100 : 0;
  return `
    <div class="donut-wrap">
      <div class="donut" style="background:conic-gradient(var(--primary) 0 ${donePct}%, var(--red) ${donePct}% ${donePct + cancelPct}%, var(--faint) ${donePct + cancelPct}% 100%)">
        <div class="donut-center"><strong>${pct(done, total)}</strong><span>완료 ${fmt(done)} / 전체 ${fmt(total)}</span></div>
      </div>
      <div class="legend">
        <div class="legend-item"><i class="dot"></i>완료 ${fmt(done)}</div>
        <div class="legend-item"><i class="dot" style="background:var(--red)"></i>취소 ${fmt(canceled)}</div>
        <div class="legend-item"><i class="dot" style="background:var(--faint)"></i>기타 ${fmt(etc)}</div>
      </div>
    </div>`;
}

function miniInsight(title, entries) {
  return `<article class="card pad"><div class="card-title"><h3>${title}</h3></div><div class="insight-list">${entries.map(([name, count], index) => `
    <div class="insight-item"><span class="insight-rank">${index + 1}</span><strong>${name}</strong><span class="time">${fmt(count)}건</span></div>`).join('')}</div></article>`;
}

function barCard(title, entries, total) {
  const max = Math.max(...entries.map(e => e[1]), 1);
  return `<article class="card pad"><div class="card-title"><h2>${title}</h2><small>총 ${fmt(total)}건</small></div>
    <div class="bar-list">${entries.map(([name, count], index) => `
      <div class="bar-row"><strong>${name}</strong><div class="bar-track"><div class="bar-fill" style="--value:${cssPct(count, max)};--bar-delay:${barDelay(index)}"></div></div><span class="bar-value">${fmt(count)}</span></div>`).join('')}</div></article>`;
}

function guideSectionTemplate() {
  const category = NAV_CATEGORIES.find(item => item.id === state.guideMode);
  const cards = state.config.guideCards.filter(card => {
    if (state.guideMode === 'all') return true;
    if (card.group !== state.guideMode) return false;
    if (state.selectedDevice && card.device !== state.selectedDevice) return false;
    return true;
  });
  const title = state.guideMode === 'all'
    ? '자주 찾는 가이드'
    : `${state.selectedDevice ? `${state.selectedDevice} · ` : ''}${category?.label || '상담'} 가이드`;
  const empty = `<div class="empty-mini">선택한 조건에 맞는 가이드가 아직 없습니다.</div>`;

  return `<section class="card pad"><div class="card-title"><h2>${title}</h2><button class="link-btn">전체 보기 ›</button></div>
    <div class="three-col">${cards.length ? cards.map(card => `
      <div class="guide-card"><span class="tile-icon">${ICONS[card.icon] || ICONS.default}</span><div><strong>${card.title}</strong><small>${card.category}</small></div><span class="arrow">›</span></div>`).join('') : empty}</div></section>`;
}

function rightRailTemplate(rows) {
  const recent = rows.slice(0, 5);
  const favoritesSource = state.config.guideCards.filter(card => {
    if (state.guideMode === 'all') return true;
    if (card.group !== state.guideMode) return false;
    if (state.selectedDevice && card.device !== state.selectedDevice) return false;
    return true;
  });
  const favorites = favoritesSource.slice(0, 5);
  return `<aside class="right-rail">
    <article class="card rail-card"><div class="card-title"><h3>최근 본 항목</h3><button class="link-btn">전체 보기 ›</button></div><div class="rail-list">
      ${recent.map(row => `<div class="rail-item"><span class="rail-icon">◷</span><strong>${row.symptom}</strong><span class="time">${row.receivedAt || '-'}</span></div>`).join('')}
    </div></article>
    <article class="card rail-card"><div class="card-title"><h3>즐겨찾기</h3><button class="link-btn">전체 보기 ›</button></div><div class="rail-list">
      ${favorites.map(card => `<div class="rail-item"><span class="rail-icon">☆</span><strong>${card.title}</strong><span class="time">${card.device || card.category.split('·')[0].trim()}</span></div>`).join('')}
    </div></article>
    <article class="card rail-card"><div class="card-title"><h3>최근 업데이트</h3><button class="link-btn">전체 보기 ›</button></div><div class="rail-list">
      <div class="rail-item"><span class="new-badge">NEW</span><strong>증상 → 기기 상담 동선 적용</strong><span class="time">오늘</span></div>
      <div class="rail-item"><span class="new-badge">NEW</span><strong>점검 현황 상세 분석 추가</strong><span class="time">오늘</span></div>
      <div class="rail-item"><span class="new-badge">NEW</span><strong>보안 컬럼 미노출 기준 적용</strong><span class="time">오늘</span></div>
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
    <div class="month-chart">${monthly.map((m, index) => `<div class="month-bar"><i style="--value:${cssPct(m.total, max, 4)};--bar-delay:${barDelay(index)}"></i><span>${m.month.slice(5)}</span></div>`).join('')}</div></article>`;
}

function monthlyStackedCard(monthly) {
  const categoryNames = ['교사', '네트워크', '하드웨어', '콘텐츠'];
  const colors = ['var(--primary)', 'var(--green)', 'var(--orange)', 'var(--purple)'];
  return `<article class="card pad"><div class="card-title"><h2>월별 카테고리 추이</h2><small>주요 4개</small></div>
    ${monthly.map(m => `<div class="stacked-month"><strong>${m.month}</strong><div class="stacked-track">
      ${categoryNames.map((cat, i) => `<span class="seg" style="--value:${cssPct(m.categories[cat] || 0, m.total)};background:${colors[i]};--bar-delay:${barDelay(i)}"></span>`).join('')}
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
  return { valid, byHandler };
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

