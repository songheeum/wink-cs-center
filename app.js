/* ============================================================
   단비공감팀 상담가이드 · 점검 대시보드
   구조: State → Utils → Icons → Data(CSV) → Guides → Nav → Views → Components → Bind → Init
   ============================================================ */

/* ---------- State ---------- */
const state = {
  config: null,
  view: 'home',                 // 'home' | 'detail' | 'guide'
  search: '',
  lastSync: null,
  // 대시보드(점검 데이터)
  rows: [],
  filtered: [],
  filters: { month: 'all', type: 'all', category: 'all', handler: 'all' },
  // 가이드(문서 데이터)
  guides: { '기술상담': new Map(), '일반상담': new Map() },
  docById: new Map(),
  guideDocs: [],
  ui: { expanded: new Set(['cat:기술상담']), activeDoc: null, device: '전체', acIndex: -1 }
};

const FILTER_LABELS = {
  month: '기간',
  type: '점검 종류',
  category: '카테고리',
  handler: '처리자'
};

/* ---------- Utils ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const pct = (v, t) => t ? `${((v / t) * 100).toFixed(1)}%` : '0.0%';
const clean = (v) => String(v ?? '').replace(/\r/g, '').trim();
const esc = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escapeAttr = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const splitMulti = (s) => clean(s).split(/\r?\n|｜|\||;/).map(x => x.trim()).filter(Boolean);
const splitTags  = (s) => clean(s).split(/[,\n;｜|]/).map(x => x.trim()).filter(Boolean);
const normalizeSearch = (v) => String(v ?? '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/[“”"'`.,/#!$%^&*;:{}=\-_~()[\]<>?\\]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const compactSearch = (v) => normalizeSearch(v).replace(/\s+/g, '');
const searchTokens = (q) => normalizeSearch(q).split(' ').map(t => t.trim()).filter(Boolean);
const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const markKeyword = (text, query) => {
  const raw = String(text ?? '');
  const q = clean(query);
  if (!q) return esc(raw);
  const terms = [...new Set([q, ...searchTokens(q)].filter(t => t && t.length >= 1))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  if (!terms.length) return esc(raw);
  const re = new RegExp(`(${terms.join('|')})`, 'gi');
  return esc(raw).replace(re, '<mark>$1</mark>');
};
const slug = (s) => String(s).toLowerCase().replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '');
const applyTheme = (theme) => {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  const label = document.getElementById('themeLabel');
  if (label) label.textContent = next === 'dark' ? 'Dark' : 'Light';
};
const getInitialTheme = () => {
  const saved = localStorage.getItem('danbiTheme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/* ---------- Icons ---------- */
const SVG = (i) => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${i}</svg>`;
const CHEV = SVG('<path d="m6 9 6 6 6-6"/>');
const ICONS = {
  home: SVG('<path d="M3 9.5 12 3l9 6.5"/><path d="M5 9v11h14V9"/><path d="M9.5 20v-6h5v6"/>'),
  chart: SVG('<path d="M3 3v18h18"/><rect x="7" y="12" width="2.6" height="5" rx=".6"/><rect x="11.7" y="8" width="2.6" height="9" rx=".6"/><rect x="16.4" y="14" width="2.6" height="3" rx=".6"/>'),
  tech: SVG('<path d="M14.6 6.3a4 4 0 0 0-5.3 5.3l-6 6a2 2 0 1 0 2.8 2.8l6-6a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.2-.5-.5-2.2z"/>'),
  general: SVG('<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.4 8.4 0 0 1-3.7-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>'),
  sync: SVG('<path d="M21 3v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 21v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>'),
  message: SVG('<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.4 8.4 0 0 1-3.7-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/>'),
  image: SVG('<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-4.5-4.5L5 21"/>'),
  file: SVG('<path d="M14 2.5H6.5A2 2 0 0 0 4.5 4.5v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5"/><path d="M8.5 13h7M8.5 17h7"/>'),
  copy: SVG('<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>'),
  check: SVG('<path d="M20 6 9 17l-5-5"/>'),
  search: SVG('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>'),
  bolt: SVG('<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>'),
  list: SVG('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  camera: SVG('<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3"/>'),
  wifi: SVG('<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 15.8a5 5 0 0 1 7 0"/><path d="M2 9a15 15 0 0 1 20 0"/><path d="M12 19h.01"/>'),
  power: SVG('<rect x="2" y="7.5" width="16" height="9" rx="2.4"/><path d="M22 10.5v3"/><path d="M5.5 10.5v3"/>'),
  monitor: SVG('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  gear: SVG('<circle cx="12" cy="12" r="3"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/>'),
  refresh: SVG('<path d="M21 4v6h-6"/><path d="M3 20v-6h6"/><path d="M19 10a8 8 0 0 0-14.3-3.3L3 8"/><path d="M5 14a8 8 0 0 0 14.3 3.3L21 16"/>'),
  lock: SVG('<rect x="4.5" y="10" width="15" height="10" rx="2.2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  sliders: SVG('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h13M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  grid: SVG('<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>'),
  clipboard: SVG('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 11h6M9 15h4"/>'),
  refund: SVG('<path d="M3 8a9 9 0 1 1-1.5 5"/><path d="M3 4v4h4"/><path d="M12 8v4l2.5 1.5"/>'),
  book: SVG('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 5.5V20.5"/>'),
  card: SVG('<rect x="2.5" y="5" width="19" height="14" rx="2.4"/><path d="M2.5 9.5h19M6 15h4"/>'),
  server: SVG('<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>'),
  box: SVG('<path d="m12 2 8 4.5v9L12 20l-8-4.5v-9z"/><path d="m4 6.5 8 4.5 8-4.5M12 11v9"/>'),
  truck: SVG('<path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5h4l3 3v3h-7z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
  tag: SVG('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.4"/>'),
  gift: SVG('<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5v8h14v-8M12 8.5v12"/><path d="M12 8.5S10 3.5 7.5 4.5 10 8.5 12 8.5zM12 8.5s2-5 4.5-4-.5 4-4.5 4z"/>'),
  default: SVG('<circle cx="12" cy="12" r="3.2"/>')
};

/* 카테고리 그룹명 → 대표 아이콘 매핑 (증상 성격에 맞춰 자동 선택) */
function groupIcon(grp, cat) {
  const g = String(grp || '');
  const rules = [
    [/와이파이|wifi|네트워크|인터넷|속도|버퍼링/i, ICONS.wifi],
    [/전원|충전|배터리|화면|밝기/i, ICONS.power],
    [/원격|기능검사|점검|모니터/i, ICONS.monitor],
    [/기기\s*설정|기본정보|환경설정/i, ICONS.gear],
    [/업데이트|초기화|리셋|재설정|앱\s*작동/i, ICONS.refresh],
    [/탈출|접근제한|잠금|보안|권한/i, ICONS.lock],
    [/초기화\/설정|설정/i, ICONS.sliders],
    [/업무툴|관리자|어드민/i, ICONS.grid],
    [/체험신청|체험운영|신청/i, ICONS.clipboard],
    [/해지|환불|청약철회|취소/i, ICONS.refund],
    [/학습운영|수업|단계|강의/i, ICONS.book],
    [/결제|할인|위약금|요금/i, ICONS.card],
    [/시스템|이관|응대|서버/i, ICONS.server],
    [/교재|구성품|추가구매|부품/i, ICONS.box],
    [/배송|회수|반품|택배/i, ICONS.truck],
    [/유료학습|상품안내|상품|가격/i, ICONS.tag],
    [/혜택|이벤트|리워드|쿠폰|사은품/i, ICONS.gift],
  ];
  for (const [re, ic] of rules) if (re.test(g)) return ic;
  return cat === '기술상담' ? ICONS.tech : ICONS.general;
}

/* ---------- Init ---------- */
init();
async function init() {
  try {
    state.config = await fetchJson('./app.json');
    applyTheme(getInitialTheme());
    bindChrome();
    renderNav();
    render();                                   // 즉시 스켈레톤/홈 노출 (하드 새로고침 불필요)
    await Promise.allSettled([loadDashboard(), loadGuides()]);
    state.lastSync = Date.now();
    applyFilters();
    renderNav();
    render();
    updateLiveLabel();
    startAutoRefresh();
  } catch (error) {
    console.error(error);
    $('#pageRoot').innerHTML = `<div class="empty-state"><h2>데이터를 불러오지 못했습니다.</h2><p>app.json의 CSV 주소와 구글시트 공개 설정을 확인해주세요.</p></div>`;
  }
}
async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`config load failed: ${res.status}`);
  return res.json();
}
function startAutoRefresh() {
  const sec = Number(state.config.refreshSeconds) || 30;
  setInterval(async () => {
    try {
      await Promise.allSettled([loadDashboard(), loadGuides()]);
      state.lastSync = Date.now();
      applyFilters();
      if (state.ui.activeDoc && !state.docById.has(state.ui.activeDoc)) {
        state.ui.activeDoc = null;
        state.view = 'home';
      }
      renderNav();
      render();
      updateLiveLabel();
    } catch (e) {
      console.warn('자동 갱신 실패, 마지막 정상 데이터를 유지합니다.', e);
    }
  }, sec * 1000);
  setInterval(updateLiveLabel, 1000);
}
function updateLiveLabel() {
  const el = $('#liveSince');
  if (!el || !state.lastSync) return;
  const s = Math.floor((Date.now() - state.lastSync) / 1000);
  el.textContent = s < 60 ? `${s}초 전 갱신` : `${Math.floor(s / 60)}분 전 갱신`;
}

/* ---------- Data: 공용 CSV 파이프라인 ---------- */
function loadTable(url) {
  return loadCsvViaFetch(url).catch((e) => {
    console.warn('CSV fetch 실패 → GViz JSONP 폴백', e);
    return loadCsvViaGvizJsonp(url);
  });
}
async function loadCsvViaFetch(csvUrl) {
  const res = await fetch(csvUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`csv load failed: ${res.status}`);
  return parseCSV(await res.text());
}
function loadCsvViaGvizJsonp(csvUrl) {
  return new Promise((resolve, reject) => {
    const cb = `__danbiCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    let settled = false;
    const cleanup = () => { settled = true; delete window[cb]; script.remove(); };
    window[cb] = (payload) => {
      try {
        if (!payload || payload.status === 'error') throw new Error(payload?.errors?.map(e => e.detailed_message || e.message).join(' / ') || 'GViz error');
        const table = gvizPayloadToTable(payload); cleanup(); resolve(table);
      } catch (e) { cleanup(); reject(e); }
    };
    script.onerror = () => { if (!settled) { cleanup(); reject(new Error('GViz JSONP load failed')); } };
    script.src = csvUrlToGvizJsonpUrl(csvUrl, cb);
    document.head.appendChild(script);
    setTimeout(() => { if (!settled) { cleanup(); reject(new Error('GViz JSONP timeout')); } }, 15000);
  });
}
function csvUrlToGvizJsonpUrl(csvUrl, cb) {
  const url = new URL(csvUrl);
  const gid = url.searchParams.get('gid') || '0';
  const gviz = new URL(`${url.origin}${url.pathname.replace(/\/pub$/, '/gviz/tq')}`);
  gviz.searchParams.set('gid', gid);
  gviz.searchParams.set('headers', '1');
  gviz.searchParams.set('tqx', `out:json;responseHandler:${cb}`);
  return gviz.toString();
}
function gvizPayloadToTable(payload) {
  const t = payload.table;
  if (!t || !Array.isArray(t.cols) || !Array.isArray(t.rows)) throw new Error('GViz table invalid');
  const headers = t.cols.map((c, i) => clean(c.label || c.id || `col${i + 1}`));
  const rows = t.rows.map(r => headers.map((_, i) => {
    const cell = r.c?.[i];
    if (!cell) return '';
    if (cell.f != null) return String(cell.f);
    return cell.v == null ? '' : String(cell.v);
  }));
  return [headers, ...rows];
}
function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (q) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
      continue;
    }
    if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  row.push(field); rows.push(row);
  return rows;
}

/* ---------- Data: 대시보드(점검 데이터) ---------- */
async function loadDashboard() {
  const table = await loadTable(state.config.csvUrl);
  const headerIndex = table.findIndex(r => r.some(c => clean(c).includes('접수일')) && r.some(c => clean(c).includes('상태')));
  if (headerIndex < 0) throw new Error('대시보드 CSV 헤더(접수일/상태) 미검출');
  const headers = table[headerIndex].map(clean);
  const dataRows = table.slice(headerIndex + 1).filter(r => clean(r[0]) || clean(r[4]) || clean(r[9]) || clean(r[11]));
  const col = buildColumnMap(headers);
  const privateIndexes = new Set(state.config.privacy.privateColumnIndexes || []);
  const privateNames = state.config.privacy.privateColumnNames || [];
  state.rows = dataRows.map(r => normalizeRow(r, headers, col, privateIndexes, privateNames)).filter(Boolean);
}
function buildColumnMap(headers) {
  const find = (k) => headers.findIndex(h => h.includes(k));
  return { receivedAt: find('접수일'), source: find('접수 출처'), type: find('점검 종류'), symptom: find('증상'),
    handler: find('처리자'), processedAt: find('처리일'), start: find('시작시간'), end: find('종료시간'), duration: find('소요시간'), status: find('상태') };
}
function normalizeRow(row, headers, col, privateIndexes, privateNames) {
  const hidden = new Set();
  headers.forEach((h, i) => { if (privateIndexes.has(i) || privateNames.some(n => h.includes(n))) hidden.add(i); });
  const get = (i) => i >= 0 && !hidden.has(i) ? clean(row[i]) : '';
  const symptom = get(col.symptom), statusRaw = get(col.status), receivedAt = normalizeDate(get(col.receivedAt));
  if (!receivedAt && !symptom && !statusRaw) return null;
  return {
    receivedAt, source: get(col.source) || '미입력', type: get(col.type) || '미입력',
    symptom: symptom || '미분류', category: getCategory(symptom), handler: get(col.handler) || '미지정',
    processedAt: normalizeDate(get(col.processedAt)), start: get(col.start), end: get(col.end),
    durationRaw: get(col.duration), durationMin: getDurationMin(get(col.duration), get(col.start), get(col.end)),
    statusRaw: statusRaw || '미입력', status: normalizeStatus(statusRaw)
  };
}
function normalizeStatus(raw) {
  const v = clean(raw); if (!v) return '기타';
  const r = state.config.statusRules;
  if (r.completeIncludes.some(x => v.includes(x))) return '완료';
  if (r.cancelIncludes.some(x => v.includes(x))) return '취소';
  return '기타';
}
function getCategory(symptom) {
  const v = clean(symptom); if (!v) return '미분류';
  return v.split('_').map(clean).filter(Boolean)[0] || v;
}
function normalizeDate(value) {
  const v = clean(value).replace(/\s+/g, ''); if (!v) return '';
  const m = v.match(/^(\d{4})[-.](\d{1,2})[-.]?(\d{1,2})?$/);
  return m ? `${m[1]}-${m[2].padStart(2,'0')}-${(m[3]||'01').padStart(2,'0')}` : v;
}
function getDurationMin(raw, start, end) {
  const n = clean(raw).match(/\d+(\.\d+)?/); if (n) return Number(n[0]);
  const d = diffMinutes(start, end); return d > 0 ? d : null;
}
function diffMinutes(start, end) {
  const p = (t) => { const m = clean(t).match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
  const s = p(start), e = p(end);
  if (s == null || e == null) return null;
  return e >= s ? e - s : e + 1440 - s;
}

/* ---------- Data: 가이드(문서 데이터) ----------
   시트 헤더는 유동적이므로 별칭(alias)으로 유연 매핑한다.
   권장 헤더: 중분류 · 제목 · 설명 · 고객표현 · 상담포인트 · 확인항목 · 조치절차 ·
              이관기준 · 참고이미지 · 고객안내멘트 · 상담이력 · 필요사진 · 사진요청멘트 · 태그 · 기기 · 상태 */
const GUIDE_FIELDS = {
  title:    ['가이드명','제목','타이틀','문서명'],
  group:    ['증상그룹','업무그룹','그룹','중분류','카테고리','분류'],
  subclass: ['세부분류','소분류','상세분류'],
  devices:  ['적용기기','대상기기','기기','기종','대상'],
  expr:     ['고객표현','고객 표현','표현','고객멘트','화법'],
  check:    ['확인사항','확인항목','확인 사항','상담사확인','체크리스트','체크'],
  steps:    ['조치방법','조치절차','조치 방법','처리절차','해결절차','조치'],
  guide:    ['안내멘트','안내 멘트','고객안내','멘트'],
  escal:    ['처리기준','이관기준','처리 기준','이관','전달기준'],
  caution:  ['주의사항','유의사항','주의','유의'],
  tags:     ['태그','키워드','tags'],
  images:   ['이미지','참고이미지','스크린샷','예시화면']
};
function mapGuideColumns(headers) {
  const col = {};
  const taken = new Set();
  for (const [field, aliases] of Object.entries(GUIDE_FIELDS)) {
    let idx = -1;
    for (const a of aliases) {
      idx = headers.findIndex((h, i) => !taken.has(i) && h.replace(/\s/g, '').includes(a.replace(/\s/g, '')));
      if (idx >= 0) break;
    }
    col[field] = idx;
    if (idx >= 0) taken.add(idx);
  }
  return col;
}
async function loadGuides() {
  const sources = state.config.guides?.sources || [];
  await Promise.allSettled(sources.map(async (src) => {
    const table = await loadTable(src.url);
    hydrateGuide(table, src.category);
  }));
  buildGuideIndex();
}
function hydrateGuide(table, category) {
  if (!table || !table.length) return;
  // 헤더 행: 앞 6행 중 비어있지 않은 셀이 가장 많은 행
  let hi = 0, best = -1;
  for (let i = 0; i < Math.min(table.length, 6); i++) {
    const n = table[i].filter(c => clean(c)).length;
    if (n > best) { best = n; hi = i; }
  }
  const headers = table[hi].map(clean);
  const col = mapGuideColumns(headers);
  const get = (row, k) => col[k] >= 0 ? clean(row[col[k]]) : '';
  const map = new Map();
  table.slice(hi + 1).forEach((row, idx) => {
    const title = get(row, 'title');
    const hasBody = get(row, 'expr') || get(row, 'guide') || get(row, 'steps') || get(row, 'check');
    if (!title && !hasBody) return;
    const group = get(row, 'group') || '기타';
    const doc = {
      category, group, title: title || `문서 ${idx + 1}`,
      subclass: get(row, 'subclass'),
      devices: splitTags(get(row, 'devices')),
      expr: splitMulti(get(row, 'expr')),
      check: splitMulti(get(row, 'check')),
      steps: splitMulti(get(row, 'steps')),
      guide: get(row, 'guide'),
      escal: splitMulti(get(row, 'escal')),
      caution: get(row, 'caution'),
      images: splitMulti(get(row, 'images')),
      tags: splitTags(get(row, 'tags'))
    };
    doc.id = `${category}|${group}|${doc.title}|${idx}`;
    doc.searchTitle = normalizeSearch([doc.title, doc.subclass].join(' '));
    doc.searchMeta = normalizeSearch([category, group, doc.devices.join(' '), doc.tags.join(' ')].join(' '));
    doc.searchBody = normalizeSearch([doc.expr.join(' '), doc.check.join(' '), doc.steps.join(' '), doc.guide, doc.escal.join(' '), doc.caution, doc.images.join(' ')].join(' '));
    doc.hay = normalizeSearch([doc.searchTitle, doc.searchMeta, doc.searchBody].join(' '));
    doc.hayCompact = compactSearch(doc.hay);
    if (!map.has(group)) map.set(group, []);
    map.get(group).push(doc);
  });
  state.guides[category] = map;
}
function buildGuideIndex() {
  state.guideDocs = [];
  state.docById = new Map();
  ['기술상담', '일반상담'].forEach(cat => {
    (state.guides[cat] || new Map()).forEach(docs => docs.forEach(d => {
      state.guideDocs.push(d);
      state.docById.set(d.id, d);
    }));
  });
}
function guideMatches(query) {
  const q = normalizeSearch(query);
  const qc = compactSearch(query);
  const tokens = searchTokens(query);
  if (!q) return [];

  return state.guideDocs
    .map(d => {
      const title = d.searchTitle || '';
      const meta = d.searchMeta || '';
      const body = d.searchBody || '';
      const hay = d.hay || '';
      const compact = d.hayCompact || '';
      const titleCompact = compactSearch(title);
      const metaCompact = compactSearch(meta);
      const bodyCompact = compactSearch(body);

      const fullHit = hay.includes(q) || compact.includes(qc);
      const tokenHit = tokens.length && tokens.every(t => hay.includes(t) || compact.includes(t));
      if (!fullHit && !tokenHit) return null;

      let score = 0;
      if (title.includes(q) || titleCompact.includes(qc)) score += 120;
      if (meta.includes(q) || metaCompact.includes(qc)) score += 55;
      if (body.includes(q) || bodyCompact.includes(qc)) score += 25;
      tokens.forEach(t => {
        if (title.includes(t) || titleCompact.includes(t)) score += 35;
        if (meta.includes(t) || metaCompact.includes(t)) score += 14;
        if (body.includes(t) || bodyCompact.includes(t)) score += 6;
      });
      if (d.title.length < 18) score += 3;
      return { ...d, _score: score };
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score || a.title.localeCompare(b.title, 'ko-KR'));
}

/* ---------- Nav (좌측 트리) ---------- */
function renderNav() {
  const item = (id, icon, label, active) =>
    `<button class="nav-item ${active ? 'active' : ''}" data-view="${id}"><span class="ico">${ICONS[icon] || ICONS.default}</span><span class="nav-item-label">${label}</span></button>`;
  const top = item('home', 'home', '홈', state.view === 'home') + item('dashboard', 'chart', '점검 운영 현황', state.view === 'detail');
  const branches = ['기술상담', '일반상담'].map(renderBranch).join('');
  $('#mainNav').innerHTML = `
    <div class="nav-top nav-panel">${top}</div>
    <div class="nav-tree nav-panel">
      <div class="nav-tree-tools">
        <span class="nav-mini-actions">
          <button type="button" data-nav-action="expand">전체 열기</button>
          <button type="button" data-nav-action="collapse">닫기</button>
        </span>
      </div>
      ${branches}
    </div>`;
}
function renderBranch(cat) {
  const icon = cat === '기술상담' ? 'tech' : 'general';
  const open = state.ui.expanded.has('cat:' + cat);
  const groups = state.guides[cat];
  let body;
  let branchCurrent = false;

  if (!groups || !groups.size) {
    const fb = (state.config.sidebarGroups?.find(g => g.label === cat)?.items) || [];
    body = fb.length
      ? fb.map(l => `<div class="nav-cat2 is-loading"><span class="nav-cat2-label">${l}</span></div>`).join('')
      : `<div class="nav-empty">불러오는 중…</div>`;
  } else {
    body = [...groups.entries()].map(([grp, docs]) => {
      const gk = 'grp:' + cat + '/' + grp;
      const gopen = state.ui.expanded.has(gk);
      const current = docs.some(d => state.ui.activeDoc === d.id);
      if (current) branchCurrent = true;
      const leaves = docs.map(d =>
        `<button class="nav-doc ${state.ui.activeDoc === d.id ? 'active' : ''}" data-doc="${escapeAttr(d.id)}">${esc(d.title)}</button>`).join('');
      return `<div class="nav-cat2wrap type-${icon} ${gopen ? 'open' : ''} ${current ? 'current' : ''}">
        <button class="nav-cat2 type-${icon} ${current ? 'current' : ''}" data-grp="${escapeAttr(gk)}"><span class="ng-chev sm">${CHEV}</span><span class="nav-cat2-label">${esc(grp)}</span><span class="nav-cat2-count">${docs.length}</span></button>
        <div class="nav-doc-body">${leaves}</div></div>`;
    }).join('');
  }

  return `<div class="nav-group type-${icon} ${open ? 'open' : ''} ${branchCurrent ? 'current' : ''}">
    <button class="nav-sep-label nav-branch-row" data-branch="${escapeAttr(cat)}" aria-label="${cat} 접기/펼치기">
      <span class="ico ico-${icon}">${ICONS[icon]}</span><span class="nav-branch-title">${cat}</span>
      <span class="nav-branch-toggle" aria-hidden="true"><span class="ng-chev">${CHEV}</span></span>
    </button>
    <div class="nav-group-body">${body}</div></div>`;
}


/* ---------- Search autocomplete ---------- */
function runGlobalSearch(value) {
  const q = clean(value);
  state.search = q;
  const input = $('#globalSearch');
  if (input) input.value = q;
  hideGlobalSuggestions();

  if (q) {
    state.view = 'home';
    state.ui.activeDoc = null;
  } else if (state.view !== 'detail' && state.view !== 'guide') {
    state.view = 'home';
  }

  applyFilters();
  renderNav();
  render();
  if (state.view === 'home') window.scrollTo({ top: 0 });
}
function getKeywordSuggestions(q) {
  const nq = normalizeSearch(q);
  const source = [
    ...(state.config?.home?.keywords || []),
    ...state.guideDocs.flatMap(d => [d.title, d.subclass, d.group, ...d.tags]).filter(Boolean)
  ];
  const seen = new Set();
  return source
    .map(x => clean(x))
    .filter(Boolean)
    .filter(x => {
      const key = normalizeSearch(x);
      if (seen.has(key)) return false;
      seen.add(key);
      return !nq || key.includes(nq) || compactSearch(x).includes(compactSearch(q));
    })
    .slice(0, 6);
}
function positionGlobalSuggestions() {
  const wrap = document.querySelector('.top-search');
  const panel = $('#globalSuggest');
  if (!wrap || !panel || panel.hidden) return;

  const rect = wrap.getBoundingClientRect();
  const gap = 10;
  const viewportPad = 14;
  const maxHeight = Math.max(190, window.innerHeight - rect.bottom - gap - viewportPad);

  panel.style.left = `${Math.round(rect.left)}px`;
  panel.style.top = `${Math.round(rect.bottom + gap)}px`;
  panel.style.width = `${Math.round(rect.width)}px`;
  panel.style.maxHeight = `${Math.round(maxHeight)}px`;
}

function renderGlobalSuggestions() {
  const input = $('#globalSearch');
  const panel = $('#globalSuggest');
  if (!input || !panel) return;
  const q = clean(input.value);
  const qCompact = compactSearch(q);

  if (qCompact.length < 2) {
    hideGlobalSuggestions();
    return;
  }

  const docs = guideMatches(q).slice(0, 7);
  const keywords = getKeywordSuggestions(q).filter(k => !docs.some(d => normalizeSearch(d.title) === normalizeSearch(k))).slice(0, 4);
  const total = guideMatches(q).length;

  if (!docs.length && !keywords.length) {
    hideGlobalSuggestions();
    return;
  }

  const docRows = docs.map(d => `
    <button class="ac-option ac-doc ${d.category === '기술상담' ? 'tech' : 'general'}" type="button" role="option" data-ac-doc="${escapeAttr(d.id)}">
      <span class="ac-kind">${d.category === '기술상담' ? ICONS.tech : ICONS.general}</span>
      <span class="ac-main"><strong>${markKeyword(d.title, q)}</strong><small>${esc(d.category)} &gt; ${esc(d.group)}${d.subclass ? ` &gt; ${esc(d.subclass)}` : ''}</small></span>
      <span class="ac-go">열기</span>
    </button>`).join('');

  const keywordRows = keywords.map(k => `
    <button class="ac-option ac-query" type="button" role="option" data-ac-query="${escapeAttr(k)}">
      <span class="ac-kind">${ICONS.search}</span>
      <span class="ac-main"><strong>${markKeyword(k, q)}</strong><small>이 키워드로 전체 검색</small></span>
    </button>`).join('');

  const allSearchRow = q ? `
    <button class="ac-option ac-all" type="button" role="option" data-ac-query="${escapeAttr(q)}">
      <span class="ac-kind">${ICONS.list}</span>
      <span class="ac-main"><strong>“${esc(q)}” 전체 검색 결과 보기</strong><small>기술상담 · 일반상담 전체에서 검색</small></span>
      <span class="ac-count">${fmt(total)}건</span>
    </button>` : '';

  panel.innerHTML = `
    <div class="ac-head">
      <strong>${q ? `“${esc(q)}” 자동완성` : '추천 검색어'}</strong>
      <small>${q ? '가이드 제목을 바로 열거나 전체 검색할 수 있어요.' : '자주 쓰는 키워드와 시트 상단 가이드'}</small>
    </div>
    ${docRows ? `<div class="ac-section"><span>가이드 제목</span>${docRows}</div>` : ''}
    ${keywordRows ? `<div class="ac-section"><span>키워드</span>${keywordRows}</div>` : ''}
    ${allSearchRow ? `<div class="ac-section ac-bottom">${allSearchRow}</div>` : ''}
    ${q && !docs.length && !keywords.length ? `<div class="ac-empty">일치하는 자동완성이 없습니다. Enter를 누르면 전체 검색합니다.</div>` : ''}`;

  state.ui.acIndex = -1;
  panel.hidden = false;
  positionGlobalSuggestions();
}
function hideGlobalSuggestions() {
  const panel = $('#globalSuggest');
  if (panel) {
    panel.hidden = true;
    panel.removeAttribute('style');
  }
  state.ui.acIndex = -1;
}
function moveSuggestion(delta) {
  const panel = $('#globalSuggest');
  if (!panel || panel.hidden) return false;
  const options = $$('.ac-option', panel);
  if (!options.length) return false;
  state.ui.acIndex = (state.ui.acIndex + delta + options.length) % options.length;
  options.forEach((el, i) => el.classList.toggle('active', i === state.ui.acIndex));
  options[state.ui.acIndex]?.scrollIntoView({ block: 'nearest' });
  return true;
}
function chooseActiveSuggestion() {
  const panel = $('#globalSuggest');
  if (!panel || panel.hidden || state.ui.acIndex < 0) return false;
  const options = $$('.ac-option', panel);
  const selected = options[state.ui.acIndex];
  if (!selected) return false;
  selected.click();
  return true;
}

/* ---------- Bindings ---------- */
function bindChrome() {
  $('#mainNav').addEventListener('click', (e) => {
    const navAction = e.target.closest('[data-nav-action]');
    if (navAction) {
      navAction.dataset.navAction === 'expand' ? expandAllNav() : collapseAllNav();
      renderNav();
      return;
    }
    const branch = e.target.closest('[data-branch]');
    if (branch) { toggleExpand('cat:' + branch.dataset.branch); renderNav(); return; }
    const grp = e.target.closest('[data-grp]');
    if (grp) { toggleExpand(grp.dataset.grp); renderNav(); return; }
    const doc = e.target.closest('[data-doc]');
    if (doc) { openDoc(doc.dataset.doc); return; }
    const view = e.target.closest('[data-view]');
    if (!view) return;
    const nextView = view.dataset.view === 'dashboard' ? 'detail' : 'home';
    if (nextView === 'detail' || state.view === 'detail') resetFiltersSilently();
    if (nextView === 'home') {
      state.search = '';
      const gs = $('#globalSearch');
      if (gs) gs.value = '';
      hideGlobalSuggestions();
    }
    state.view = nextView;
    state.ui.activeDoc = null;
    renderNav(); render(); window.scrollTo({ top: 0 });
  });

  $('#pageRoot').addEventListener('click', (e) => {
    const doc = e.target.closest('[data-doc]');
    if (doc) openDoc(doc.dataset.doc);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-control')) {
      $$('.filter-control.open').forEach(w => {
        w.classList.remove('open');
        $('[data-filter-trigger]', w)?.setAttribute('aria-expanded', 'false');
      });
    }
    if (!e.target.closest('.top-search')) hideGlobalSuggestions();
  });

  window.addEventListener('resize', () => positionGlobalSuggestions());
  window.addEventListener('scroll', () => positionGlobalSuggestions(), { passive: true });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideGlobalSuggestions();
      $$('.filter-control.open').forEach(w => {
        w.classList.remove('open');
        $('[data-filter-trigger]', w)?.setAttribute('aria-expanded', 'false');
      });
    }
  });

  $('#globalSearch').addEventListener('input', () => {
    renderGlobalSuggestions();
  });

  $('#globalSearch').addEventListener('focus', () => {
    renderGlobalSuggestions();
  });

  $('#globalSearch').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSuggestion(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveSuggestion(-1); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!chooseActiveSuggestion()) runGlobalSearch($('#globalSearch').value);
      return;
    }
    if (e.key === 'Escape') hideGlobalSuggestions();
  });

  $('#globalSearchBtn')?.addEventListener('click', () => runGlobalSearch($('#globalSearch').value));

  $('#globalSuggest')?.addEventListener('click', (e) => {
    const doc = e.target.closest('[data-ac-doc]');
    if (doc) { hideGlobalSuggestions(); openDoc(doc.dataset.acDoc); return; }
    const query = e.target.closest('[data-ac-query]');
    if (query) runGlobalSearch(query.dataset.acQuery);
  });

  applyTheme(document.documentElement.dataset.theme || getInitialTheme());
  $('#themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('danbiTheme', next);
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#globalSearch').focus(); renderGlobalSuggestions(); }
  });

  // 복사 버튼 (위임)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      const orig = btn.innerHTML;
      btn.innerHTML = `${ICONS.check} 복사됨`;
      btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 1400);
    } catch (_) {}
  });
}
function toggleExpand(key) {
  if (state.ui.expanded.has(key)) state.ui.expanded.delete(key);
  else state.ui.expanded.add(key);
}
function expandAllNav() {
  ['기술상담', '일반상담'].forEach(cat => {
    state.ui.expanded.add('cat:' + cat);
    const groups = state.guides[cat];
    if (groups) groups.forEach((_, grp) => state.ui.expanded.add('grp:' + cat + '/' + grp));
  });
}
function collapseAllNav() {
  [...state.ui.expanded].forEach(key => {
    if (key.startsWith('grp:') || key.startsWith('cat:')) state.ui.expanded.delete(key);
  });
}
function openDoc(id) {
  const doc = state.docById.get(id);
  if (!doc) return;
  state.ui.activeDoc = id;
  state.ui.device = '전체';
  state.view = 'guide';
  state.ui.expanded.add('cat:' + doc.category);
  state.ui.expanded.add('grp:' + doc.category + '/' + doc.group);
  renderNav();
  render();
  window.scrollTo({ top: 0 });
}

/* ---------- Filters (대시보드) ---------- */
function applyFilters() {
  const q = state.search.toLowerCase();
  state.filtered = state.rows.filter(row => {
    if (q) {
      const hay = [row.receivedAt, row.source, row.type, row.symptom, row.category, row.handler, row.processedAt, row.statusRaw, row.status].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.filters.month !== 'all' && monthKey(row.receivedAt) !== state.filters.month) return false;
    if (state.filters.type !== 'all' && row.type !== state.filters.type) return false;
    if (state.filters.category !== 'all' && row.category !== state.filters.category) return false;
    if (state.filters.handler !== 'all' && row.handler !== state.filters.handler) return false;
    return true;
  });
}

/* ---------- Router ---------- */
function render() {
  document.body.dataset.view = state.view;
  if (state.view === 'detail') renderDetail();
  else if (state.view === 'guide') renderGuide();
  else renderHome();
}

/* ---------- View: Home ---------- */
function renderHome() {
  const home = state.config.home;
  const q = state.search.trim();
  const allResults = q ? guideMatches(q) : [];
  const results = allResults.slice(0, 18);
  const resultCounts = {
    total: allResults.length,
    tech: allResults.filter(d => d.category === '기술상담').length,
    general: allResults.filter(d => d.category === '일반상담').length
  };

  const heroBlock = q ? '' : `
      <section class="hero">
        <div class="hero-body">
          <h1>${esc(home.heroTitle)}</h1>
          <p>${esc(home.heroDescription)}</p>
          <label class="hero-search">
            <span class="si">${ICONS.search}</span>
            <input id="heroSearch" type="search" placeholder="${escapeAttr(home.searchPlaceholder)}" value="${escapeAttr(q)}" />
            <button class="primary-btn" id="heroBtn">검색</button>
          </label>
          <div class="keyword-row"><span class="keyword-label">추천 검색어</span>
            ${home.keywords.map(k => `<button class="chip" data-keyword="${escapeAttr(k)}">${esc(k)}</button>`).join('')}</div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <span class="hv-glow"></span>
          <span class="hv-panel hv-p1"></span>
          <span class="hv-panel hv-p2"></span>
          <span class="hv-card">
            <span class="hv-line w1"></span>
            <span class="hv-line w2"></span>
            <span class="hv-spark">${ICONS.bolt}</span>
          </span>
        </div>
      </section>`;

  const resultBlock = q ? `
    <section class="search-portal">
      <div class="portal-head">
        <div>
          <h2><mark>${esc(q)}</mark> 검색 결과</h2>
          <p>좌측에서 보고 있던 문서와 관계없이 전체 상담가이드에서 찾았습니다.</p>
        </div>
        <span class="portal-count">총 ${resultCounts.total}건</span>
      </div>
      <div class="portal-scope" aria-label="검색 범위">
        <span>전체 ${resultCounts.total}</span>
        <span class="tech">기술상담 ${resultCounts.tech}</span>
        <span class="general">일반상담 ${resultCounts.general}</span>
        <em>가이드 제목 · 카테고리 · 태그 · 고객표현 · 조치방법까지 검색</em>
      </div>
      ${results.length ? `<div class="portal-result-list">${results.map(d => portalResultRow(d, q)).join('')}</div>${resultCounts.total > results.length ? `<p class="more-results-note">상위 ${results.length}건만 먼저 보여줍니다. 키워드를 하나 더 넣으면 더 정확해집니다.</p>` : ''}`
        : `<p class="empty-inline portal-empty">일치하는 가이드가 없습니다. 띄어쓰기 없이 검색하거나 고객 표현 그대로 검색해보세요.</p>`}
    </section>` : `${categoryGridBlock()}${guideQuickListBlock()}`;

  $('#pageRoot').innerHTML = `
    <section class="main-column">
      ${heroBlock}
      ${resultBlock}
    </section>`;

  bindHomeSearch();
}
function pickSnippet(d, q) {
  const chunks = [
    ...d.expr,
    ...d.check,
    ...d.steps,
    d.guide,
    d.note,
    d.caution,
    ...d.history,
    ...d.photos.map(p => `${p.title} ${p.desc} ${p.url}`),
    d.summary
  ].filter(Boolean);
  const nq = normalizeSearch(q);
  const cq = compactSearch(q);
  return chunks.find(x => normalizeSearch(x).includes(nq) || compactSearch(x).includes(cq)) || chunks[0] || '';
}
function portalResultRow(d, q) {
  const type = d.category === '기술상담' ? 'tech' : 'general';
  const snippet = pickSnippet(d, q);
  const tags = [d.subclass, ...d.tags.slice(0, 4)].filter(Boolean);
  return `<button class="portal-result ${type}" data-doc="${escapeAttr(d.id)}">
    <span class="portal-title">${markKeyword(d.title, q)}</span>
    <span class="portal-path">${esc(d.category)} &gt; ${esc(d.group)}${d.subclass ? ` &gt; ${esc(d.subclass)}` : ''}</span>
    ${snippet ? `<span class="portal-snippet">${markKeyword(snippet, q)}</span>` : ''}
    ${tags.length ? `<span class="portal-tags">${tags.map(t => `<b>${markKeyword(t, q)}</b>`).join('')}</span>` : ''}
  </button>`;
}
function categoryGridBlock() {
  const cards = [];
  ['기술상담', '일반상담'].forEach(cat => {
    (state.guides[cat] || new Map()).forEach((docs, grp) => {
      cards.push({ cat, grp, count: docs.length, first: docs[0]?.id });
    });
  });
  if (!cards.length) {
    return `<section class="card pad"><div class="card-title"><h2>카테고리 바로가기</h2></div><p class="empty-inline">가이드 시트를 불러오는 중입니다…</p></section>`;
  }
  return `<section class="card pad">
    <div class="card-title"><h2>카테고리 바로가기</h2><small>기술·일반상담 ${cards.length}개 분류</small></div>
    <div class="cat-grid">${cards.map(c => `
      <button class="cat-card" data-doc="${escapeAttr(c.first)}">
        <span class="cat-card-ic ${c.cat === '기술상담' ? 'tech' : 'gen'}">${groupIcon(c.grp, c.cat)}</span>
        <span class="cat-card-body"><strong>${esc(c.grp)}</strong><small>${esc(c.cat)} · ${c.count}개 문서</small></span>
        <span class="result-arrow">${CHEV}</span></button>`).join('')}</div></section>`;
}
function guideQuickListBlock() {
  const docs = state.guideDocs.slice(0, 6);
  if (!docs.length) return '';
  return `<section class="card pad guide-quick-card">
    <div class="card-title"><div><h2>가이드 빠른 목록</h2><small>시트 상단 기준 · 자주 봐야 할 문서를 위에 배치하면 메인에 먼저 노출됩니다.</small></div></div>
    <div class="quick-doc-grid">${docs.map(d => `<button class="quick-doc ${d.category === '기술상담' ? 'tech' : 'general'}" data-doc="${escapeAttr(d.id)}">
      <span class="quick-doc-icon">${d.category === '기술상담' ? ICONS.tech : ICONS.general}</span>
      <span><strong>${esc(d.title)}</strong><small>${esc(d.category)} · ${esc(d.group)}</small></span>
    </button>`).join('')}</div>
  </section>`;
}
function bindHomeSearch() {
  const input = $('#heroSearch');
  const run = () => {
    state.search = input.value.trim();
    state.view = 'home';
    state.ui.activeDoc = null;
    $('#globalSearch').value = state.search;
    applyFilters();
    renderNav();
    render();
  };
  $('#heroBtn')?.addEventListener('click', run);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  $$('.chip[data-keyword]').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.keyword; run(); }));
}

/* ---------- View: Guide document ---------- */
function renderGuide() {
  const doc = state.docById.get(state.ui.activeDoc);
  if (!doc) { state.view = 'home'; renderHome(); return; }

  const toc = [];
  const secs = [];
  const addSec = (id, title, inner) => { toc.push({ id, title }); secs.push(`<section class="doc-sec" id="${id}"><h2>${title}</h2>${inner}</section>`); };

  // 고객 표현
  if (doc.expr.length) {
    addSec('sec-expr', '고객 표현', `<ul class="doc-quotes">${doc.expr.map(x => `<li>“${esc(x.replace(/^["“”']+|["“”']+$/g, ''))}”</li>`).join('')}</ul>`);
  }
  // 상담사가 먼저 확인할 것
  if (doc.check.length) addSec('sec-check', '상담사가 먼저 확인할 것', checkBlock(doc.check));
  // 조치 방법
  if (doc.steps.length) addSec('sec-steps', '조치 방법', `<ol class="doc-steps">${doc.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`);
  // 처리 기준 (일반상담)
  if (doc.escal.length) addSec('sec-escal', '처리 기준', `<ul class="doc-list">${doc.escal.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`);
  // 안내 멘트
  if (doc.guide) addSec('sec-guide', '안내 멘트', copyCard('안내 멘트', doc.guide));
  // 주의사항
  if (doc.caution) addSec('sec-caution', '주의사항', callout('주의사항', doc.caution, 'warn'));
  // 참고 이미지 (항상 노출, 없으면 안내)
  addSec('sec-images', '참고 이미지', doc.images.length
    ? `<div class="doc-images">${doc.images.map(src => `<img loading="lazy" src="${escapeAttr(resolveImg(src))}" alt="참고 이미지">`).join('')}</div>`
    : `<p class="doc-placeholder">이 문서는 별도 참고 이미지가 없습니다.</p>`);

  const subTags = [doc.subclass, ...doc.devices].filter(Boolean);

  $('#pageRoot').innerHTML = `
    <article class="main-column doc-main">
      <nav class="breadcrumb">${esc(doc.category)} <span>›</span> ${esc(doc.group)}${doc.subclass ? ` <span>›</span> ${esc(doc.subclass)}` : ''}</nav>
      <header class="doc-head">
        <h1>${esc(doc.title)}</h1>
        <p>${esc(doc.category)} · ${esc(doc.group)} 관련 문의를 빠르게 분류하고, 확인 사항·조치 방법·안내 멘트까지 한 번에 정리한 가이드입니다.</p>
        <div class="doc-tags"><span class="doc-tag tone">${esc(doc.category)}</span><span class="doc-tag">${esc(doc.group)}</span>${subTags.map(t => `<span class="doc-tag">${esc(t)}</span>`).join('')}${doc.tags.map(t => `<span class="doc-tag ghost">#${esc(t)}</span>`).join('')}</div>
      </header>
      ${secs.join('')}
    </article>
    <aside class="toc-rail">
      <div class="toc-inner">
        <div class="toc-title">이 문서의 목차</div>
        <nav class="toc-list">${toc.map(t => `<a href="#${t.id}" class="toc-link" data-toc="${t.id}">${t.title}</a>`).join('')}</nav>
      </div>
    </aside>`;

  bindGuide();
}
function checkBlock(items) {
  const pairs = items.map(x => {
    const m = x.split(/\s*[:：]\s*/);
    return m.length >= 2 ? { term: m[0], desc: m.slice(1).join(': ') } : null;
  });
  if (pairs.every(Boolean) && pairs.length) {
    return `<div class="doc-table"><div class="doc-tr head"><span>확인 항목</span><span>상담 중 질문 예시</span></div>
      ${pairs.map(p => `<div class="doc-tr"><span class="doc-term">${esc(p.term)}</span><span>${esc(p.desc)}</span></div>`).join('')}</div>`;
  }
  return `<ul class="doc-list">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
}
function callout(label, text, tone) {
  return `<div class="doc-callout ${tone === 'warn' ? 'warn' : ''}"><span class="callout-label">${esc(label)}</span><p>${esc(text).replace(/\n/g, '<br>')}</p></div>`;
}
function copyCard(label, text) {
  return `<div class="doc-copycard">
    <div class="doc-copyhead"><span>${esc(label)}</span>
      <button class="copy-btn" data-copy="${escapeAttr(text)}">${ICONS.copy} 복사</button></div>
    <p>${esc(text).replace(/\n/g, '<br>')}</p></div>`;
}
function resolveImg(src) {
  if (/^https?:\/\//.test(src)) return src;
  const base = state.config.guides?.imageBase || 'img/';
  return base + src.replace(/^\/+/, '');
}
function bindGuide() {
  const links = $$('[data-toc]');
  const sections = links.map(a => document.getElementById(a.dataset.toc)).filter(Boolean);
  const setActive = (id) => {
    links.forEach(link => link.classList.toggle('active', link.dataset.toc === id));
  };

  links.forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault();
    const el = document.getElementById(a.dataset.toc);
    if (el) {
      setActive(a.dataset.toc);
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }));

  if (!sections.length) return;
  setActive(sections[0].id);

  if (state._tocObserver) state._tocObserver.disconnect();

  const visible = new Map();
  const pickActive = () => {
    const ordered = sections
      .map((sec, idx) => ({
        id: sec.id,
        idx,
        ratio: visible.get(sec.id) || 0,
        top: Math.abs(sec.getBoundingClientRect().top)
      }))
      .filter(item => item.ratio > 0);
    if (!ordered.length) return;
    ordered.sort((a, b) => (b.ratio - a.ratio) || (a.top - b.top) || (a.idx - b.idx));
    setActive(ordered[0].id);
  };

  if ('IntersectionObserver' in window) {
    state._tocObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      });
      pickActive();
    }, { rootMargin: '-14% 0px -58% 0px', threshold: [0.05, 0.2, 0.35, 0.6, 0.85] });

    sections.forEach(sec => state._tocObserver.observe(sec));
  } else {
    const onScroll = () => {
      let current = sections[0].id;
      for (const sec of sections) {
        if (sec.getBoundingClientRect().top <= 140) current = sec.id;
      }
      setActive(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
}

/* ---------- View: Dashboard ---------- */
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
    <section class="main-column">
      <div class="detail-header">
        <div>
          <div class="live-inline"><span class="live-dot"></span>자마드 실시간 연동 · <span id="liveSince">방금 갱신</span></div>
          <h1>점검 운영 현황 상세</h1>
          <p>인입 유형, 카테고리 비율, 월별 통계, 처리자별 현황, 교사용 점검 투입시간을 자동 갱신합니다.</p>
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
        <article class="card pad">
          <div class="card-title"><div><h2>처리 상태 분포</h2><small>필터 기준</small></div></div>
          ${donutTemplate(stats.completed, stats.canceled, stats.etc, stats.total)}
        </article>
        ${donutCard('카테고리 비율', topCategories, rows.length)}
      </section>
      <section class="analysis-grid">
        ${barCard('상위 인입 항목 TOP 10', topSymptoms, rows.length)}
        ${barCard('점검 종류별 비율', topTypes, rows.length)}
      </section>
      <section class="analysis-grid">
        ${monthlyChartCard(monthly)}
        ${monthlyStackedCard(monthly)}
      </section>
      <section class="analysis-grid">
        ${handlerTableCard(handlerStats)}
        ${durationCard(durationStats, stats)}
      </section>
      ${recentTableCard(rows.slice(0, 12))}
      <div class="notice">보안 기준: D열 자마드 주소, F열 메모, M열 특이사항은 화면/검색/상세 테이블에서 제외됩니다.</div>
    </section>`;

  $('#backHome').addEventListener('click', () => { resetFiltersSilently(); state.view = 'home'; renderNav(); render(); window.scrollTo({ top: 0 }); });
  bindFilters();
  updateLiveLabel();
}
function getStats(rows) {
  const total = rows.length;
  const sc = countBy(rows, r => r.status);
  const completed = sc['완료'] || 0, canceled = sc['취소'] || 0, etc = total - completed - canceled;
  const months = sortedKeys(countBy(rows, r => monthKey(r.receivedAt))).filter(Boolean);
  const latestMonth = months[months.length - 1];
  const thisMonthCount = latestMonth ? rows.filter(r => monthKey(r.receivedAt) === latestMonth).length : 0;
  const validDurations = rows.map(r => r.durationMin).filter(v => Number.isFinite(v) && v > 0);
  const avgDuration = validDurations.length ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length : 0;
  const maxDuration = validDurations.length ? Math.max(...validDurations) : 0;
  return { total, completed, canceled, etc, latestMonth, thisMonthCount, validDurations, avgDuration, maxDuration };
}
function filterBarTemplate() {
  const a = state.rows;
  const total = state.rows.length;
  const current = state.filtered.length;
  const active = activeFilterEntries();
  return `<section class="filter-card card pad">
    <div class="filter-card-head">
      <div>
        <h2>조회 조건</h2>
        <p>${active.length ? `${active.length}개 필터 적용 중` : '전체 데이터 기준'} · ${fmt(current)} / ${fmt(total)}건 표시</p>
      </div>
      <button class="filter-reset-btn" id="resetFilters" type="button" ${active.length ? '' : 'disabled'}>${ICONS.sync} 필터 초기화</button>
    </div>
    <div class="filter-bar">
      ${filterDropdownTemplate('month', ['all', ...sortedKeys(countBy(a, r => monthKey(r.receivedAt))).filter(Boolean)], state.filters.month)}
      ${filterDropdownTemplate('type', ['all', ...sortedKeys(countBy(a, r => r.type))], state.filters.type)}
      ${filterDropdownTemplate('category', ['all', ...sortedKeys(countBy(a, r => r.category))], state.filters.category)}
      ${filterDropdownTemplate('handler', ['all', ...sortedKeys(countBy(a, r => r.handler))], state.filters.handler)}
    </div>
    ${active.length ? `<div class="active-filter-row">${active.map(f => `<button type="button" class="active-filter-chip" data-filter-clear="${f.key}"><span>${esc(f.label)}</span><b>${esc(f.value)}</b><i>×</i></button>`).join('')}</div>` : ''}
  </section>`;
}
function filterDropdownTemplate(key, values, selected) {
  const label = FILTER_LABELS[key] || key;
  const selectedLabel = selected === 'all' ? '전체' : selected;
  return `<div class="filter-control" data-filter-wrap="${key}">
    <span class="field-label">${esc(label)}</span>
    <button type="button" class="filter-trigger" data-filter-trigger="${key}" aria-haspopup="listbox" aria-expanded="false">
      <span>${esc(selectedLabel)}</span><i class="filter-chevron">${CHEV}</i>
    </button>
    <div class="filter-menu" role="listbox">
      ${values.map(v => `<button type="button" class="filter-option ${v === selected ? 'active' : ''}" data-filter-option="${key}" data-value="${escapeAttr(v)}" role="option" aria-selected="${v === selected ? 'true' : 'false'}"><span>${v === 'all' ? '전체' : esc(v)}</span>${v === selected ? ICONS.check : ''}</button>`).join('')}
    </div>
  </div>`;
}
function activeFilterEntries() {
  return Object.entries(state.filters)
    .filter(([, value]) => value !== 'all')
    .map(([key, value]) => ({ key, label: FILTER_LABELS[key] || key, value }));
}
function resetFilters(key = null) {
  if (key) state.filters[key] = 'all';
  else Object.keys(state.filters).forEach(k => { state.filters[k] = 'all'; });
  applyFilters();
  render();
}
function resetFiltersSilently() {
  Object.keys(state.filters).forEach(k => { state.filters[k] = 'all'; });
  applyFilters();
}
function bindFilters() {
  const closeMenus = () => $$('.filter-control.open').forEach(w => {
    w.classList.remove('open');
    $('[data-filter-trigger]', w)?.setAttribute('aria-expanded', 'false');
  });

  $$('[data-filter-trigger]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wrap = btn.closest('.filter-control');
    const wasOpen = wrap.classList.contains('open');
    closeMenus();
    if (!wasOpen) {
      wrap.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  }));

  $$('[data-filter-option]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.filters[btn.dataset.filterOption] = btn.dataset.value;
    applyFilters();
    render();
  }));

  $$('[data-filter-clear]').forEach(btn => btn.addEventListener('click', () => resetFilters(btn.dataset.filterClear)));
  $('#resetFilters')?.addEventListener('click', () => resetFilters());
}

/* ---------- Components ---------- */
function kpi(label, value, sub, type) {
  const color = { done: 'var(--c-done)', cancel: 'var(--c-cancel)', etc: 'var(--c-etc)', time: 'var(--c-time)', avg: 'var(--c-avg)' }[type] || 'var(--primary)';
  return `<div class="kpi"><span><i class="dot" style="background:${color}"></i>${label}</span><strong>${fmt(value)}</strong><em>${sub}</em></div>`;
}
function donutTemplate(done, canceled, etc, total) {
  const R = 62, SW = 18, C = 2 * Math.PI * R;
  const segs = [{ label: '완료', value: done, color: 'var(--c-done)' }, { label: '취소', value: canceled, color: 'var(--c-cancel)' }, { label: '기타', value: etc, color: 'var(--c-etc)' }];
  const visible = segs.filter(s => s.value > 0);
  const gap = visible.length > 1 ? C * 0.012 : 0;
  let cursor = 0, delay = 0;
  const arcs = visible.map(s => {
    const frac = total ? s.value / total : 0;
    const len = Math.max(0, frac * C - gap);
    const offset = -cursor * C; cursor += frac;
    const d = (delay += 0.12) - 0.12;
    return `<circle class="donut-seg" r="${R}" cx="84" cy="84" fill="none" stroke="${s.color}" stroke-width="${SW}" stroke-linecap="round" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" style="--len:${len.toFixed(2)};--c:${C.toFixed(2)};animation-delay:${d.toFixed(2)}s"></circle>`;
  }).join('');
  const legend = segs.map(s => `<div class="legend-item"><i style="background:${s.color}"></i>${s.label} <b>${fmt(s.value)}</b></div>`).join('');
  return `<div class="donut-wrap"><div class="donut">
      <svg viewBox="0 0 168 168" role="img" aria-label="처리 상태 분포"><circle class="donut-track" r="${R}" cx="84" cy="84" fill="none" stroke-width="${SW}"></circle>${arcs}</svg>
      <div class="donut-center"><em>완료율</em><strong>${pct(done, total)}</strong><span>${fmt(done)} / ${fmt(total)}건</span></div>
    </div><div class="legend">${legend}</div></div>`;
}
function donutCard(title, entries, total) {
  const R = 62, SW = 18, C = 2 * Math.PI * R;
  const palette = ['#5b5bd6', '#0fae7a', '#f59e0b', '#06b6d4', '#f43f5e', '#8b5cf6', '#ec4899', '#94a3b8'];
  const top = entries.slice(0, 6);
  const shown = top.reduce((a, [, c]) => a + c, 0);
  const rest = total - shown;
  const data = rest > 0 ? [...top, ['기타', rest]] : top;
  let cursor = 0, delay = 0;
  const gap = data.length > 1 ? C * 0.012 : 0;
  const arcs = data.map(([, count], i) => {
    const frac = total ? count / total : 0;
    const len = Math.max(0, frac * C - gap);
    const offset = -cursor * C; cursor += frac;
    const d = (delay += 0.1) - 0.1;
    return `<circle class="donut-seg" r="${R}" cx="84" cy="84" fill="none" stroke="${palette[i % palette.length]}" stroke-width="${SW}" stroke-linecap="round" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" style="--len:${len.toFixed(2)};--c:${C.toFixed(2)};animation-delay:${d.toFixed(2)}s"></circle>`;
  }).join('');
  const legend = data.map(([name, count], i) => `<div class="legend-item"><i style="background:${palette[i % palette.length]}"></i>${esc(name)} <b>${fmt(count)}</b></div>`).join('');
  return `<article class="card pad"><div class="card-title"><div><h2>${title}</h2><small>총 ${fmt(total)}건</small></div></div>
    <div class="donut-wrap"><div class="donut">
      <svg viewBox="0 0 168 168"><circle class="donut-track" r="${R}" cx="84" cy="84" fill="none" stroke-width="${SW}"></circle>${arcs}</svg>
      <div class="donut-center"><em>분류</em><strong>${data.length}</strong><span>카테고리</span></div>
    </div><div class="legend">${legend}</div></div></article>`;
}
function barCard(title, entries, total) {
  const max = Math.max(...entries.map(e => e[1]), 1);
  return `<article class="card pad"><div class="card-title"><div><h2>${title}</h2><small>총 ${fmt(total)}건</small></div></div>
    <div class="bar-list">${entries.map(([name, count]) => `<div class="bar-row"><strong>${esc(name)}</strong><div class="bar-track"><div class="bar-fill" style="width:${count / max * 100}%"></div></div><span class="bar-value">${fmt(count)}</span></div>`).join('')}</div></article>`;
}
function buildMonthly(rows) {
  const g = new Map();
  rows.forEach(r => { const m = monthKey(r.receivedAt); if (!m) return; if (!g.has(m)) g.set(m, []); g.get(m).push(r); });
  return [...g.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, list]) => ({
    month, total: list.length,
    completed: list.filter(r => r.status === '완료').length,
    canceled: list.filter(r => r.status === '취소').length,
    etc: list.filter(r => r.status === '기타').length,
    categories: countBy(list, r => r.category)
  }));
}
function monthlyChartCard(monthly) {
  const max = Math.max(...monthly.map(m => m.total), 1);
  return `<article class="card pad"><div class="card-title"><div><h2>월별 점검 추이</h2><small>접수일 기준</small></div></div>
    <div class="month-chart">${monthly.map(m => `<div class="month-bar"><i style="height:${Math.max(4, m.total / max * 100)}%"></i><span>${m.month.slice(5)}</span></div>`).join('') || '<p class="empty-inline">데이터 없음</p>'}</div></article>`;
}
function monthlyStackedCard(monthly) {
  const cats = ['교사', '네트워크', '하드웨어', '콘텐츠'];
  const colors = ['var(--primary)', 'var(--c-done)', 'var(--c-amber)', 'var(--c-time)'];
  return `<article class="card pad"><div class="card-title"><div><h2>월별 카테고리 추이</h2><small>주요 4개</small></div></div>
    ${monthly.map(m => `<div class="stacked-month"><strong>${m.month}</strong><div class="stacked-track">${cats.map((c, i) => `<span class="seg" style="width:${pct(m.categories[c] || 0, m.total)};background:${colors[i]}"></span>`).join('')}</div><span class="bar-value">${fmt(m.total)}</span></div>`).join('') || '<p class="empty-inline">데이터 없음</p>'}
    <p class="safe-note">교사 / 네트워크 / 하드웨어 / 콘텐츠 중심으로 비교합니다.</p></article>`;
}
function buildHandlerStats(rows) {
  return topN(countBy(rows, r => r.handler), 20).map(([handler, total]) => {
    const list = rows.filter(r => r.handler === handler);
    const completed = list.filter(r => r.status === '완료').length;
    const canceled = list.filter(r => r.status === '취소').length;
    return { handler, total, completed, canceled, etc: total - completed - canceled, rate: pct(completed, total) };
  });
}
function handlerTableCard(items) {
  return `<article class="card pad"><div class="card-title"><div><h2>처리자별 처리 현황</h2><small>건수 / 완료율</small></div></div>
    <table class="data-table"><thead><tr><th>처리자</th><th>전체</th><th>완료</th><th>취소</th><th>기타</th><th>완료율</th></tr></thead><tbody>
      ${items.map(i => `<tr><td><strong>${esc(i.handler)}</strong></td><td>${fmt(i.total)}</td><td>${fmt(i.completed)}</td><td>${fmt(i.canceled)}</td><td>${fmt(i.etc)}</td><td>${i.rate}</td></tr>`).join('') || '<tr><td colspan="6" class="td-empty">데이터 없음</td></tr>'}
    </tbody></table></article>`;
}
function buildDurationStats(rows) {
  const valid = rows.filter(r => Number.isFinite(r.durationMin) && r.durationMin > 0);
  const byHandler = sortedKeys(countBy(valid, r => r.handler)).map(handler => {
    const list = valid.filter(r => r.handler === handler);
    const sum = list.reduce((a, r) => a + r.durationMin, 0);
    return { name: handler, count: list.length, total: sum, avg: list.length ? sum / list.length : 0 };
  }).sort((a, b) => b.total - a.total);
  return { valid, byHandler };
}
function durationCard(ds, stats) {
  return `<article class="card pad"><div class="card-title"><div><h2>교사용 점검 투입시간</h2><small>시간 기록 건 기준</small></div></div>
    <div class="inline-stats">
      <div class="inline-stat"><small>시간 기록</small><strong>${fmt(stats.validDurations.length)}건</strong></div>
      <div class="inline-stat"><small>평균</small><strong>${Math.round(stats.avgDuration)}분</strong></div>
      <div class="inline-stat"><small>최대</small><strong>${Math.round(stats.maxDuration)}분</strong></div>
    </div>
    <p class="safe-note">※ 소요시간은 교사용 업무폰 및 PC 점검 건 중심으로 기록된 값입니다. 전체 점검 건 평균 처리시간이 아닙니다.</p>
    <table class="data-table"><thead><tr><th>처리자</th><th>기록건수</th><th>총시간</th><th>평균</th></tr></thead><tbody>
      ${ds.byHandler.map(i => `<tr><td><strong>${esc(i.name)}</strong></td><td>${fmt(i.count)}</td><td>${fmt(Math.round(i.total))}분</td><td>${i.avg.toFixed(1)}분</td></tr>`).join('') || '<tr><td colspan="4" class="td-empty">데이터 없음</td></tr>'}
    </tbody></table></article>`;
}
function recentTableCard(rows) {
  return `<article class="card pad"><div class="card-title"><div><h2>최근 점검</h2><small>보안 컬럼 제외</small></div></div>
    <table class="data-table"><thead><tr><th>접수일</th><th>점검 종류</th><th>증상</th><th>처리자</th><th>상태</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.receivedAt || '-'}</td><td>${esc(r.type)}</td><td><strong>${esc(r.symptom)}</strong></td><td>${esc(r.handler)}</td><td><span class="status-pill ${r.status === '완료' ? 'done' : r.status === '취소' ? 'cancel' : ''}">${r.status}</span></td></tr>`).join('') || '<tr><td colspan="5" class="td-empty">데이터 없음</td></tr>'}
    </tbody></table></article>`;
}

/* ---------- Small helpers ---------- */
function countBy(rows, sel) { return rows.reduce((a, r) => { const k = sel(r) || '미분류'; a[k] = (a[k] || 0) + 1; return a; }, {}); }
function topN(obj, n) { return Object.entries(obj).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).slice(0, n); }
function sortedKeys(obj) { return Object.keys(obj).sort((a, b) => a.localeCompare(b, 'ko')); }
function monthKey(d) { return /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : ''; }
